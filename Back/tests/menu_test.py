"""재고 차감 ON 메뉴는 레시피 필수 — 01_basic_design.md §3.2, 02_implementation_design.md §3.4."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.sales_test import _register_verified_user


async def _setup(client: AsyncClient) -> tuple[dict, str, str]:
    _, auth = await _register_verified_user(client)
    r = await client.post("/api/menus", json={"name": "아메리카노", "price": 4500}, headers=auth)
    assert r.status_code == 201, r.text
    assert (r.json()["use_inventory_deduction"], r.json()["has_recipe"]) == (False, False)
    menu_id = r.json()["menu_id"]
    r = await client.post(
        "/api/inventory", json={"name": "원두", "unit": "g", "quantity": 0}, headers=auth
    )
    assert r.status_code == 201, r.text
    return auth, menu_id, r.json()["item_id"]


def _assert_recipe_required(r) -> None:
    assert r.status_code == 422, r.text
    assert r.json()["error"] == "MENU_RECIPE_REQUIRED"


@pytest.mark.asyncio
async def test_create_with_deduction_rejected(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    r = await client.post(
        "/api/menus",
        json={"name": "라떼", "price": 5000, "use_inventory_deduction": True},
        headers=auth,
    )
    _assert_recipe_required(r)
    r = await client.post(
        "/api/menus/bulk",
        json={"menus": [{"name": "라떼", "price": 5000, "use_inventory_deduction": True}]},
        headers=auth,
    )
    _assert_recipe_required(r)


@pytest.mark.asyncio
async def test_deduction_turns_on_only_after_recipe(client: AsyncClient) -> None:
    auth, menu_id, item_id = await _setup(client)
    on = {"use_inventory_deduction": True}

    _assert_recipe_required(await client.patch(f"/api/menus/{menu_id}", json=on, headers=auth))

    r = await client.put(
        f"/api/menus/{menu_id}/recipe",
        json={"ingredients": [{"item_id": item_id, "quantity": 18, "unit": "g"}]},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    r = await client.patch(f"/api/menus/{menu_id}", json=on, headers=auth)
    assert r.status_code == 200, r.text
    assert (r.json()["use_inventory_deduction"], r.json()["has_recipe"]) == (True, True)

    r = await client.get("/api/menus", headers=auth)
    assert [m["has_recipe"] for m in r.json()["items"]] == [True]


@pytest.mark.asyncio
async def test_recipe_cannot_be_emptied_while_deducting(client: AsyncClient) -> None:
    auth, menu_id, item_id = await _setup(client)
    await client.put(
        f"/api/menus/{menu_id}/recipe",
        json={"ingredients": [{"item_id": item_id, "quantity": 18, "unit": "g"}]},
        headers=auth,
    )
    on = {"use_inventory_deduction": True}
    await client.patch(f"/api/menus/{menu_id}", json=on, headers=auth)

    r = await client.put(f"/api/menus/{menu_id}/recipe", json={"ingredients": []}, headers=auth)
    _assert_recipe_required(r)
    _assert_recipe_required(await client.delete(f"/api/menus/{menu_id}/recipe", headers=auth))

    r = await client.patch(
        f"/api/menus/{menu_id}", json={"use_inventory_deduction": False}, headers=auth
    )
    assert r.status_code == 200, r.text
    r = await client.delete(f"/api/menus/{menu_id}/recipe", headers=auth)
    assert r.status_code == 204, r.text
