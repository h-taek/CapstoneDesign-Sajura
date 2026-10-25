// 식자재 아이콘 매핑 — KAMIS는 실제 상품 사진을 제공하지 않아, 재료 종류를 나타내는
// 아이콘으로 대체 표시. 실 API 연동 시 새 품목명이 들어와도 기본 아이콘으로 안전하게 대체된다.
import { Beef, Carrot, Egg, Leaf, LeafyGreen, Sprout } from "lucide-react";

const ICON_MAP: Record<string, typeof Leaf> = {
  양파: Carrot,
  대파: Sprout,
  배추: LeafyGreen,
  계란: Egg,
};

function pickIcon(itemName: string): typeof Leaf {
  for (const [keyword, Icon] of Object.entries(ICON_MAP)) {
    if (itemName.includes(keyword)) return Icon;
  }
  if (itemName.includes("고기") || itemName.includes("삼겹살")) return Beef;
  return Leaf;
}

export function IngredientIcon({ itemName }: { itemName: string }) {
  const Icon = pickIcon(itemName);
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-brand">
      <Icon className="size-5" />
    </span>
  );
}
