import cart from "./fixtures/cart.html?raw";
import product from "./fixtures/product.html?raw";
import search from "./fixtures/search.html?raw";

export const SEARCH_URL = "https://www.coupang.com/np/search?q=%EC%96%91%ED%8C%8C&channel=user";
export const PRODUCT_URL =
  "https://www.coupang.com/vp/products/8783459207?itemId=28626905951&vendorItemId=92548976689&q=x";
export const CART_URL = "https://cart.coupang.com/cartView.pang";

const FIXTURES = { search, product, cart };

/** 저장한 화면을 문서로 연다. 같은 창(jsdom)의 문서라 instanceof 검사가 그대로 통한다. */
export function load(name: keyof typeof FIXTURES): Document {
  return new DOMParser().parseFromString(FIXTURES[name], "text/html");
}
