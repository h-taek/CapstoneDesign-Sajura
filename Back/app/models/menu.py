"""Menu / Recipe / RecipeIngredient ORM — 08_schema.md §3."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, DECIMAL, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid


class Menu(Base):
    __tablename__ = "menus"

    menu_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    use_inventory_deduction: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    recipe: Mapped["Recipe | None"] = relationship(
        back_populates="menu", uselist=False, cascade="all, delete-orphan"
    )


class Recipe(Base):
    __tablename__ = "recipes"

    recipe_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    menu_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("menus.menu_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    menu: Mapped[Menu] = relationship(back_populates="recipe")
    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        back_populates="recipe", cascade="all, delete-orphan"
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    recipe_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("recipes.recipe_id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("inventory_items.item_id"), nullable=False, index=True
    )
    quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)

    recipe: Mapped[Recipe] = relationship(back_populates="ingredients")
