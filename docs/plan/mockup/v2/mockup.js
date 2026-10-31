// 사주라 화면 목업 v2 공용 스크립트 — 디자인 토큰, 유리 셸(배경·상단 바·웹 왼쪽 메뉴·하단 알약·본문 패널),
// 아이콘, 차트, 화면 상태 전환, 목업 도구 막대, 앱 폭(390px) 보기.
// 리디자인 시안이다. 색은 아직 정하지 않았다 — 배경은 후보 세 가지와 유리 효과 판단용 흑백 시험 배경을 도구 막대에서 고른다.

// 진입 순서. 각 화면은 v1 목업(Front/src/routes/*.tsx 재현)의 구성·문구·상태를 그대로 두고 모양만 바꾼다
const PAGES = {
  intro: { file: "01_intro.html", route: "/intro", name: "서비스 소개" },
  login: { file: "02_login.html", route: "/login", name: "로그인" },
  register: { file: "03_register.html", route: "/register", name: "회원가입" },
  verify: { file: "04_verify-business.html", route: "/verify-business", name: "사업자 검증" },
  onboarding: { file: "05_onboarding.html", route: "/onboarding/1~4", name: "매장 온보딩" },
  home: { file: "06_home.html", route: "/", name: "홈" },
  forecast: { file: "07_forecast.html", route: "/forecast", name: "매출예측" },
  inventory: { file: "08_inventory.html", route: "/inventory", name: "재고관리" },
  orders: { file: "09_orders.html", route: "/orders", name: "발주추천" },
  menus: { file: "10_menus.html", route: "/menus", name: "메뉴 관리" },
  upload: { file: "11_sales-upload.html", route: "/sales/upload", name: "매출 CSV 업로드" },
  settings: { file: "12_settings.html", route: "/settings", name: "설정(앱: 더보기)" },
  pos: { file: "13_settings-pos.html", route: "/settings/pos", name: "POS 연동 설정" },
  notifications: { file: "14_settings-notifications.html", route: "/settings/notifications", name: "알림 설정" },
  account: { file: "15_settings-account.html", route: "/settings/account", name: "계정 정보" },
  appinfo: { file: "16_settings-app-info.html", route: "/settings/app-info", name: "앱 정보" },
  admin: { file: "17_admin-verifications.html", route: "/admin/verifications", name: "관리자 심사" },
};

const href = (key) => PAGES[key]?.file ?? "#";

const MOCK_USER = { name: "김사주", store: "사주라 화덕피자 성수점" };

// 디자인 토큰 — Front/src/index.css(@theme·base·utility)와 같은 내용. Tailwind 브라우저 빌드가 읽는다.
const THEME_CSS = `
@theme {
  --font-sans: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui,
    "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;
  --color-brand: #6b4eff;
  --color-brand-strong: #5636e8;
  --color-brand-soft: #f1eeff;
  --color-brand-tint: #e2dbff;
  --color-ink: #111827;
  --color-ink-2: #374151;
  --color-ink-3: #6b7280;
  --color-ink-4: #9ca3af;
  /* 유리 위에 놓이므로 선·옅은 바탕은 반투명. canvas는 배경이 비치도록 투명 */
  --color-line: rgb(72 60 140 / 0.16);
  --color-line-soft: rgb(72 60 140 / 0.09);
  --color-canvas: transparent;
  --color-subtle: rgb(255 255 255 / 0.5);
  --color-accent: #ffe066;
  --color-up: #e5484d;
  --color-down: #2f6fed;
  --color-ok: #138a4a;
  --color-ok-soft: #e8f7ee;
  --color-warn: #b45309;
  --color-warn-soft: #fff4e0;
  --color-danger: #d92d20;
  --color-danger-soft: #fdecec;
  --shadow-card: 0 1px 2px rgb(17 24 39 / 0.04), 0 1px 1px rgb(17 24 39 / 0.02);
  --shadow-pop: 0 10px 30px -12px rgb(17 24 39 / 0.25);
}
@layer base {
  html { font-size: 112.5%; -webkit-text-size-adjust: 100%; }
  @media (min-width: 1024px) { html { font-size: 100%; } }
  body { background: var(--color-canvas); font-family: var(--font-sans); color: var(--color-ink);
    -webkit-font-smoothing: antialiased; word-break: keep-all; }
  :focus-visible { outline: 3px solid var(--color-brand-tint); outline-offset: 2px; }
  input[type="checkbox"] { accent-color: var(--color-brand); }
}
@utility tabular { font-variant-numeric: tabular-nums; }
@utility pt-safe { padding-top: env(safe-area-inset-top); }
@utility pb-safe { padding-bottom: env(safe-area-inset-bottom); }

/* 유리 — 반투명 흰색 + 뒤 배경 흐림·채도 + 밝은 테두리 + 위쪽 반사광 + 그림자.
   상단 바·왼쪽 메뉴·하단 알약·본문 패널처럼 배경 위에 바로 놓이는 판에만 쓴다 */
@utility glass {
  background: rgb(255 255 255 / 0.1);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid rgb(255 255 255 / 0.45);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6), inset 0 -1px 0 rgb(255 255 255 / 0.15),
    0 20px 50px -20px rgb(0 0 0 / 0.35);
}
/* 진한 유리 — 폼·대화 상자처럼 배경 위에 바로 놓이면서 글을 오래 읽는 판 */
@utility glass-strong {
  background: rgb(255 255 255 / 0.72);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgb(255 255 255 / 0.6);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.8), 0 24px 60px -24px rgb(40 20 120 / 0.35);
}
/* 패널 안쪽 카드 — 이미 흐려진 패널 위라 흐림은 다시 걸지 않고 흰색만 더 올린다 */
@utility glass-card {
  background: rgb(255 255 255 / 0.38);
  border: 1px solid rgb(255 255 255 / 0.5);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.7);
}
`;

(function injectTheme() {
  const style = document.createElement("style");
  style.type = "text/tailwindcss";
  style.textContent = THEME_CSS;
  document.head.appendChild(style);
  const font = document.createElement("link");
  font.rel = "stylesheet";
  font.href =
    "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";
  document.head.appendChild(font);
})();

// lucide-react 0.468.0 아이콘 — 키는 lucide 이름의 camelCase (AlertTriangle → alertTriangle)
const ICON_PATHS = {
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  alertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  beef: '<circle cx="12.5" cy="8.5" r="2.5"/><path d="M12.5 2a6.5 6.5 0 0 0-6.22 4.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3A6.5 6.5 0 0 0 12.5 2Z"/><path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1 .31 2 6.49 6.49 0 0 1-2.6 5.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5"/>',
  beer: '<path d="M17 11h1a3 3 0 0 1 0 6h-1"/><path d="M9 12v6"/><path d="M13 12v6"/><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  boxes: '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/>',
  calendarDays: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  carrot: '<path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle2: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  chefHat: '<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  clipboardCheck: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  clipboardList: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  cookingPot: '<path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m4 8 16-4"/><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"/>',
  creditCard: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  egg: '<path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z"/>',
  fileSpreadsheet: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
  fish: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  leafyGreen: '<path d="M2 22c1.25-.987 2.27-1.975 3.9-2.2a5.56 5.56 0 0 1 3.8 1.5 4 4 0 0 0 6.187-2.353 3.5 3.5 0 0 0 3.69-5.116A3.5 3.5 0 0 0 20.95 8 3.5 3.5 0 1 0 16 3.05a3.5 3.5 0 0 0-5.831 1.373 3.5 3.5 0 0 0-5.116 3.69 4 4 0 0 0-2.348 6.155C3.499 15.42 4.409 16.712 4.2 18.1 3.926 19.743 3.014 20.732 2 22"/><path d="M2 22 17 7"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  minus: '<path d="M5 12h14"/>',
  moreVertical: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  packageX: '<path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><path d="m17 13 5 5m-5 0 5-5"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  plusSquare: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
  shieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  trash2: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  trendingDown: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
  trendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  dollarSign: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
};

function icon(name, cls = "size-5", strokeWidth = 2) {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] ?? ""}</svg>`;
}

// 유리 셸 — <div data-shell="활성키" data-title="패널 제목" data-back="뒤로 갈 목업 파일">본문</div>
// 웹(lg 이상): 상단 바 + 왼쪽 알약 메뉴 + 본문 패널 + 하단 알약(넣을 요소 미정)
// 앱(lg 미만): 상단 바 + 본문 패널 + 하단 알약 탭
const WEB_NAV = [
  { key: "home", label: "홈", icon: "home" },
  { key: "forecast", label: "매출예측", icon: "trendingUp" },
  { key: "inventory", label: "재고관리", icon: "boxes" },
  { key: "orders", label: "발주추천", icon: "clipboardList" },
  { key: "menus", label: "메뉴 관리", icon: "chefHat" },
];

const APP_TABS = [
  { key: "home", label: "홈", icon: "home" },
  { key: "forecast", label: "매출 예측", icon: "trendingUp" },
  { key: "inventory", label: "재고", icon: "boxes" },
  { key: "orders", label: "발주", icon: "clipboardList" },
  { key: "settings", label: "더보기", icon: "menu" },
];

const APP_TITLE = {
  home: "홈",
  forecast: "매출 예측",
  inventory: "재고",
  orders: "발주",
  menus: "메뉴 관리",
  settings: "더보기",
};

// 배경 후보 — 도구 막대에서 고르고(?bg=키), 고른 값은 다른 화면으로 가도 유지한다.
// 모든 후보는 가장자리가 또렷한 도형으로 그린다. 흐림은 유리 판이 맡아야 바깥은 또렷하고 패널 안은 뭉개진 대비가 생긴다.
// 움직임은 느리게(한 바퀴 18~40초), '동작 줄이기' 설정에서는 멈춘다.
const BACKDROP_KEYS = [
  ["day", "⑥ 사장님의 하루"],
  ["flow", "⑤ 흐름"],
  ["aurora", "① 오로라"],
  ["glossy", "② 3D 유광"],
  ["lines", "③ 선·파형"],
  ["sky", "④ 오로라 (사진 참고)"],
  ["test", "흑백 시험"],
];

const BACKDROP_CSS = `
.bd { position: fixed; inset: 0; z-index: -10; overflow: hidden; pointer-events: none; }
.bd > * { position: absolute; display: block; }
@media (prefers-reduced-motion: reduce) { .bd * { animation: none !important; } }

/* ① 오로라 — 보라 계열 큰 덩어리가 천천히 떠다닌다. 노랑은 하나만 작게 */
.bd-aurora { background: #efeaff; }
.bd-aurora .a1 { width: 46vmax; aspect-ratio: 1; left: -12vmax; top: -16vmax; border-radius: 50%; background: #6b4eff; animation: au1 34s ease-in-out infinite alternate; }
.bd-aurora .a2 { width: 36vmax; aspect-ratio: 1; right: -8vmax; top: 6vh; border-radius: 46% 54% 58% 42% / 52% 44% 56% 48%; background: #b9a8ff; animation: au2 28s ease-in-out infinite alternate; }
.bd-aurora .a3 { width: 58vmax; aspect-ratio: 1.3; left: 18vw; bottom: -34vmax; border-radius: 48% 52% 60% 40% / 50% 45% 55% 50%; background: #3d23c4; animation: au3 40s ease-in-out infinite alternate; }
.bd-aurora .a4 { width: 26vmax; aspect-ratio: 1; left: 34vw; top: 14vh; border-radius: 50%; background: #d9cfff; animation: au4 30s ease-in-out infinite alternate; }
.bd-aurora .a5 { width: 15vmax; aspect-ratio: 1; right: 20vw; bottom: 10vh; border-radius: 50%; background: #ffe066; animation: au5 24s ease-in-out infinite alternate; }
@keyframes au1 { to { translate: 14vw 12vh; rotate: 30deg; scale: 1.08; } }
@keyframes au2 { to { translate: -12vw 18vh; rotate: -40deg; } }
@keyframes au3 { to { translate: 10vw -8vh; rotate: 20deg; scale: 0.94; } }
@keyframes au4 { to { translate: 16vw 20vh; scale: 1.15; } }
@keyframes au5 { to { translate: -22vw -26vh; } }

/* ② 3D 유광 — 빛을 받은 구체·고리·캡슐. 실제로는 렌더 영상으로 만들 것을 CSS로 흉내 낸다 */
.bd-glossy { background: linear-gradient(160deg, #f4f1ff, #dcd2ff); }
.bd-glossy .sphere { aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #fff 0 3%, #d6ccff 12%, #8a72ff 36%, #5136e0 62%, #24107f 100%);
  box-shadow: 0 50px 90px -40px rgb(50 20 150 / 0.55); }
.bd-glossy .g1 { width: 30vmax; left: -7vmax; top: 6vh; animation: gl1 18s ease-in-out infinite alternate; }
.bd-glossy .g2 { width: 13vmax; right: 16vw; top: 5vh; animation: gl2 14s ease-in-out infinite alternate; }
.bd-glossy .g3 { width: 9vmax; left: 46vw; bottom: 9vh;
  background: radial-gradient(circle at 32% 28%, #fff 0 4%, #fff3b0 14%, #ffd84a 45%, #b98a00 100%);
  animation: gl3 16s ease-in-out infinite alternate; }
.bd-glossy .ring { width: 34vmax; aspect-ratio: 1; right: -9vmax; bottom: -11vmax; border-radius: 50%;
  background: radial-gradient(closest-side, transparent 56%, #3a1fc0 58%, #7a62ff 66%, #e6dfff 71%, #8a72ff 78%, #4a2fd6 90%, #24107f 99%, transparent 100%);
  filter: drop-shadow(0 40px 50px rgb(50 20 150 / 0.45)); animation: gl4 26s ease-in-out infinite alternate; }
.bd-glossy .capsule { width: 28vmax; height: 9vmax; left: 22vw; top: 50vh; border-radius: 999px; rotate: -28deg;
  background: linear-gradient(180deg, #fff 0 5%, #c4b6ff 18%, #6b4eff 58%, #2c149e 100%);
  box-shadow: 0 40px 70px -30px rgb(50 20 150 / 0.5); animation: gl5 22s ease-in-out infinite alternate; }
@keyframes gl1 { to { translate: 4vw 8vh; } }
@keyframes gl2 { to { translate: -3vw 10vh; } }
@keyframes gl3 { to { translate: 6vw -10vh; } }
@keyframes gl4 { to { translate: -4vw -6vh; rotate: 25deg; } }
@keyframes gl5 { to { translate: 8vw -6vh; rotate: -16deg; } }

/* ③ 선·파형 — 차트처럼 흐르는 보라 선. 굵은 띠를 섞어 유리 너머에서도 색이 남게 한다 */
.bd-lines { background: #f5f2ff radial-gradient(#cbbfff 1.2px, transparent 1.5px) 0 0 / 28px 28px; }
.bd-lines svg { left: 0; width: 200vw; height: 100vh; animation: wave linear infinite; }
@keyframes wave { to { translate: -100vw 0; } }

/* ⑤ 흐름 — 시작 화면과 대시보드가 같이 쓰는 배경. 시작 화면(body[data-mood="hero"])에서는 그대로 보이고,
   대시보드에서는 옅은 막(veil)이 덮여 가라앉는다. 진한 색은 보라 하나만 쓴다 */
.bd-flow { background: #efeaff; }
.bd-flow .f1 { width: 46vmax; aspect-ratio: 1; left: -12vmax; top: -16vmax; border-radius: 50%; background: #9d8bff; animation: au1 34s ease-in-out infinite alternate; }
.bd-flow .f2 { width: 36vmax; aspect-ratio: 1; right: -8vmax; top: 6vh; border-radius: 46% 54% 58% 42% / 52% 44% 56% 48%; background: #d4c9ff; animation: au2 28s ease-in-out infinite alternate; }
.bd-flow .f3 { width: 58vmax; aspect-ratio: 1.3; left: 18vw; bottom: -36vmax; border-radius: 48% 52% 60% 40% / 50% 45% 55% 50%; background: #6b4eff; animation: au3 40s ease-in-out infinite alternate; }
.bd-flow .f4 { width: 24vmax; aspect-ratio: 1; left: 30vw; top: 12vh; border-radius: 50%; background: #ffd9c4; animation: au4 30s ease-in-out infinite alternate; }
.bd-flow .f5 { width: 13vmax; aspect-ratio: 1; right: 22vw; bottom: 12vh; border-radius: 50%; background: #fff0a8; animation: au5 24s ease-in-out infinite alternate; }
.bd-veil { inset: 0; background: rgb(248 246 255 / 0.62); }
body[data-mood="hero"] .bd-veil { opacity: 0; }

/* 시작 화면의 구체 — AI 예측의 상징. 떠 있다가 '지금 시작하기'를 누르면 화면을 채우며 사라진다 */
.orb { width: min(34vmin, 300px); aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff 0 6%, #e6defe 18%, #a996ff 45%, #6b4eff 72%, #4a2fd6 100%);
  box-shadow: 0 0 120px 30px rgb(140 110 255 / 0.45), inset 0 0 40px rgb(255 255 255 / 0.35);
  animation: orb-float 6s ease-in-out infinite alternate; }
@keyframes orb-float { to { transform: translateY(-14px); } }

/* 나가기(로그인 → 홈) */
.leaving .intro-copy, .leaving main { animation: ex-down 0.4s ease-in both; }
.leaving .orb { animation: orb-out 0.9s cubic-bezier(0.6, 0, 0.2, 1) both; }
.leaving .bd-veil { animation: veil-in 0.9s ease both; }
@keyframes ex-down { to { opacity: 0; transform: translateY(16px); } }
@keyframes orb-out { to { transform: scale(7); opacity: 0; } }
@keyframes veil-in { from { opacity: 0; } to { opacity: 1; } }

/* 들어오기(대시보드가 시작 화면에서 넘어왔을 때만) — 상단 바, 메뉴, 패널, 하단 알약, 패널 속 내용 순 */
.entering .en { animation: en-up 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: var(--d, 0s); }
.entering .en-top { animation-name: en-down; }
.entering .en-left { animation-name: en-left; }
.entering main > * > * { animation: en-up 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.entering main > * > :nth-child(1) { animation-delay: 0.35s; }
.entering main > * > :nth-child(2) { animation-delay: 0.45s; }
.entering main > * > :nth-child(3) { animation-delay: 0.55s; }
.entering main > * > :nth-child(n + 4) { animation-delay: 0.65s; }
@keyframes en-up { from { opacity: 0; transform: translateY(24px) scale(0.98); } }
@keyframes en-down { from { opacity: 0; transform: translateY(-16px); } }
@keyframes en-left { from { opacity: 0; transform: translateX(-16px); } }
@media (prefers-reduced-motion: reduce) { .entering *, .leaving * { animation: none !important; } }

/* ④ 오로라 (사진 참고) — 빛 커튼·세로 빛줄기·수평선·반사면 구성은 두고 색·밝기·별·빛줄기를 덜어낸다.
   커튼 윗가장자리 선과 수평선은 또렷하게 그려 유리 너머 대비를 남긴다.
   층(svg)마다 따로 움직여 흐림을 프레임마다 다시 계산하지 않는다 */
.bd-sky { background: #8f80ec; }
.bd-sky svg { inset: 0; width: 100%; height: 100%; }
.bd-sky .sk-a { animation: ska 32s ease-in-out infinite alternate; }
.bd-sky .sk-b { animation: skb 26s ease-in-out infinite alternate; }
.bd-sky .sk-rays { animation: skrays 9s ease-in-out infinite alternate; }
.bd-sky .sk-star { animation: sktw 5s ease-in-out infinite alternate; }
/* 반사 — 수평선(장면 y=565)을 축으로 뒤집는다. slice 배치라 화면 위치는 배율로 계산 */
.bd-sky .sk-mirror { transform-origin: 50% calc(50% + max(100vw / 1600, 100vh / 900) * 115); opacity: 0.28; filter: blur(6px); }
.bd-sky .sk-a.sk-mirror { animation-name: skar; }
.bd-sky .sk-b.sk-mirror { animation-name: skbr; }
@keyframes ska { from { translate: 0 0; scale: 1 1; } to { translate: 50px -18px; scale: 1.05 1.08; } }
@keyframes skar { from { translate: 0 0; scale: 1 -1; } to { translate: 50px 18px; scale: 1.05 -1.08; } }
@keyframes skb { from { translate: 0 0; rotate: 0deg; } to { translate: -40px 14px; rotate: -3deg; } }
@keyframes skbr { from { translate: 0 0; scale: 1 -1; } to { translate: -40px -14px; scale: 1 -1; } }
@keyframes skrays { from { opacity: 0.35; } to { opacity: 0.75; } }
@keyframes sktw { from { opacity: 0.35; } to { opacity: 1; } }

/* ⑥ 사장님의 하루 — 시각에 따라 하늘 색·별·달·해·가게 창문 불빛이 바뀐다.
   시작 화면은 스크롤 위치, 가입·온보딩은 정해 둔 밤 시각, 대시보드는 실제 현재 시각을 쓴다.
   대시보드(data-calm)는 읽기용 옅은 막을 덮고 동네를 흐리게 둔다. 밤일수록 막을 진하게 해 글이 읽힌다.
   --sky-fg·--sky-fg2·--sky-pill은 하늘 위에 바로 놓인 글자색과 알약 유리색(막 없는 화면에서만 바뀐다) */
:root { --sky-fg: #111827; --sky-fg2: #374151; --sky-pill: rgb(255 255 255 / 0.1); }
.bd-day { background: #241a5e; }
.bd-day .d-sky, .bd-day .d-veil { inset: 0; }
.bd-day .d-stars { inset: 0; width: 100%; height: 100%; }
.bd-day .d-stars circle { animation: dtw 4s ease-in-out infinite alternate; }
.bd-day .d-stars circle:nth-child(3n) { animation-duration: 6s; }
.bd-day .d-stars circle:nth-child(4n) { animation-duration: 3s; }
@keyframes dtw { to { opacity: 0.25; } }
.bd-day .d-veil { background: #f6f4ff; opacity: 0; }
.bd-day .d-moon { width: 88px; height: 88px; border-radius: 50%; translate: -50% -50%;
  background: radial-gradient(circle at 38% 36%, #fffdf3, #e9e4ff 70%);
  box-shadow: 0 0 60px 18px rgb(214 205 255 / 0.35), inset -14px -10px 0 rgb(170 160 230 / 0.35); }
.bd-day .d-sun { width: 150px; height: 150px; border-radius: 50%; translate: -50% -50%;
  background: radial-gradient(circle, #fff7e0 0 34%, #ffd9a0 46%, rgb(255 190 140 / 0) 70%); }
.bd-day .d-town { left: 0; right: 0; bottom: 0; width: 100%; height: min(22vh, 190px); }
@media (max-width: 860px) { .bd-day .d-moon { width: 60px; height: 60px; } .bd-day .d-sun { width: 110px; height: 110px; } }
.entering .bd-day .d-veil { animation: dveil 1s ease both; }
@keyframes dveil { from { opacity: 0; } }

/* 가게로 들어가기(시작 화면 → 가입·로그인) — 그 순간의 창문 색 빛이 창문에서 두 겹 원으로 퍼진다.
   바깥 원(옅게)이 앞서고 안쪽 원이 뒤따른다. 다음 화면은 두 원이 겹친 밝기의 같은 색 빛이 걷히며 나타난다 */
.shop-light { position: fixed; inset: 0; z-index: 70; pointer-events: none; }
.shop-light.out { animation: shop-out 0.9s ease 0.1s both; }
@keyframes shop-out { to { opacity: 0; } }
.going-shop main, .going-shop header { transition: opacity 0.3s ease; opacity: 0; }
.arrive-shop main > * { animation: en-up 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.3s both; }

/* 아침이 밝기(로그인 → 홈) — 폼이 사라지고 시계가 지금 시각까지 빨리 돈다 */
.morning-clock { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; pointer-events: none;
  font-size: clamp(3.5rem, 10vw, 7rem); font-weight: 300; letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
  animation: mc-in 0.4s ease both; }
@keyframes mc-in { from { opacity: 0; transform: translateY(10px); } }
@media (prefers-reduced-motion: reduce) { .arrive-shop *, .shop-light { animation: none !important; } }
`;

// 파형 하나 — 가로 2배 폭에 같은 모양을 두 번 그려, 절반만큼 밀면 이음매 없이 반복된다
function wavePath(amp, period, y, phase) {
  const W = 2880;
  let d = "";
  for (let x = 0; x <= W; x += 16) {
    const v = y + amp * Math.sin(((x / period) * 2 + phase) * Math.PI);
    d += `${x === 0 ? "M" : "L"}${x},${v.toFixed(1)} `;
  }
  return d;
}

const WAVES = [
  // [진폭, 주기, 세로 위치, 위상, 굵기, 색, 한 바퀴 초]
  [90, 1440, 600, 0, 70, "#6b4eff", 40],
  [70, 720, 430, 0.3, 28, "#b9a8ff", 30],
  [110, 1440, 300, 0.7, 3, "#4a32c9", 36],
  [60, 480, 520, 0.1, 2.5, "#6b4eff", 26],
  [130, 720, 720, 0.5, 3, "#3d23c4", 44],
  [50, 360, 200, 0.9, 2, "#8f7bff", 22],
  [80, 720, 780, 0.2, 5, "#ffd84a", 32],
];

// ④ 오로라 (사진 참고) — 1600×900 장면을 화면에 꽉 채운다(넘치는 쪽은 잘림). 수평선은 y=565
const SKY = {
  // 큰 보라 커튼 — 윗가장자리(edge)는 또렷한 선, 아래로 갈수록 사라진다
  aEdge: "M-100 360 C 250 260 520 470 820 420 C 1080 380 1250 180 1700 150",
  aBand: "M-100 360 C 250 260 520 470 820 420 C 1080 380 1250 180 1700 150 L 1700 330 C 1300 330 1100 560 820 560 C 500 560 250 430 -100 470 Z",
  // 분홍 휘감김 — 수평선 가운데에서 오른쪽 위로 감아 오른다
  bEdge: "M700 565 C 900 540 1020 400 1110 260 C 1180 150 1290 40 1430 -20",
  bBand: "M700 565 C 900 540 1020 400 1110 260 C 1180 150 1290 40 1430 -20 L 1600 -20 C 1440 60 1320 200 1250 320 C 1150 480 1000 575 700 585 Z",
};

function skyLayer(cls, inner) {
  return `<svg class="${cls}" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
}

function skyBackdrop() {
  const defs = `<defs>
    <linearGradient id="sk-bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#5f52c9"/><stop offset="0.4" stop-color="#9a8cf2"/>
      <stop offset="0.627" stop-color="#f3efff"/><stop offset="0.66" stop-color="#ddd5ff"/><stop offset="1" stop-color="#ab9ff0"/>
    </linearGradient>
    <linearGradient id="sk-a" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0.2" stop-color="#ece6ff" stop-opacity="0.95"/><stop offset="0.5" stop-color="#a48eff" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#7a62ff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sk-b" x1="0.35" x2="1" y1="0.6" y2="0.2">
      <stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="0.35" stop-color="#f4c2f0" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#b996ff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sk-ray" x1="0" x2="0" y1="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0.8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="sk-glow"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <filter id="sk-blur40" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="40"/></filter>
    <filter id="sk-blur2"><feGaussianBlur stdDeviation="2"/></filter>
    <!-- 빛줄기는 커튼 바로 위에만 보이게 — 커튼 모양을 위로 올려 흐린 것을 가림막으로 쓴다 -->
    <mask id="sk-raymask" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="900">
      <g filter="url(#sk-blur40)" fill="#fff" transform="translate(0 -150)"><path d="${SKY.aBand}"/><path d="${SKY.bBand}"/></g>
    </mask>
  </defs>`;

  const stars = [[120, 80], [410, 50], [700, 100], [1010, 60], [1330, 120], [260, 190], [560, 230], [1480, 260], [880, 200]]
    .map(([x, y], i) => `<circle class="sk-star" style="animation-delay:${-i * 0.7}s" cx="${x}" cy="${y}" r="${i % 3 ? 1.2 : 1.7}" fill="#fff"/>`)
    .join("");

  // 세로 빛줄기 — 폭·간격을 조금씩 달리한다
  let rays = "";
  for (let x = 0, i = 0; x < 1600; x += 11 + (i % 4) * 5, i++) {
    rays += `<rect x="${x}" y="0" width="${2 + (i % 3) * 2}" height="620" fill="url(#sk-ray)" opacity="${0.35 + (i % 5) * 0.12}"/>`;
  }

  const ribbonA = `<path d="${SKY.aBand}" fill="#b7a4ff" opacity="0.55" filter="url(#sk-blur40)"/>
    <path d="${SKY.aBand}" fill="url(#sk-a)"/>
    <path d="${SKY.aEdge}" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="2"/>`;
  const ribbonB = `<path d="${SKY.bBand}" fill="#f0b8f0" opacity="0.45" filter="url(#sk-blur40)"/>
    <path d="${SKY.bBand}" fill="url(#sk-b)"/>
    <path d="${SKY.bEdge}" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="2"/>`;

  return `<div class="bd bd-sky" aria-hidden="true">
    ${skyLayer("", `${defs}<rect width="1600" height="900" fill="url(#sk-bg)"/>${stars.replaceAll('class="sk-star"', 'class="sk-star"')}`)}
    ${skyLayer("sk-rays", `<g mask="url(#sk-raymask)" filter="url(#sk-blur2)">${rays}</g>`)}
    ${skyLayer("sk-a sk-mirror", ribbonA)}
    ${skyLayer("sk-b sk-mirror", ribbonB)}
    ${skyLayer("sk-a", ribbonA)}
    ${skyLayer("sk-b", ribbonB)}
    ${skyLayer("", `<ellipse cx="800" cy="565" rx="780" ry="30" fill="url(#sk-glow)"/><line x1="0" x2="1600" y1="565" y2="565" stroke="#fff" stroke-opacity="0.8" stroke-width="1.5"/>`)}
  </div>`;
}

function backdropHtml(key) {
  if (key === "day") return dayBackdrop();
  if (key === "flow") return `<div class="bd bd-flow" aria-hidden="true"><i class="f1"></i><i class="f2"></i><i class="f3"></i><i class="f4"></i><i class="f5"></i><i class="bd-veil"></i></div>`;
  if (key === "sky") return skyBackdrop();
  if (key === "aurora") return `<div class="bd bd-aurora" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="a4"></i><i class="a5"></i></div>`;
  if (key === "glossy") return `<div class="bd bd-glossy" aria-hidden="true"><i class="sphere g1"></i><i class="sphere g2"></i><i class="ring"></i><i class="capsule"></i><i class="sphere g3"></i></div>`;
  if (key === "lines") {
    const svgs = WAVES.map(
      ([amp, period, y, phase, sw, color, sec]) =>
        `<svg viewBox="0 0 2880 900" preserveAspectRatio="none" style="top:0;animation-duration:${sec}s"><path d="${wavePath(amp, period, y, phase)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/></svg>`,
    ).join("");
    return `<div class="bd bd-lines" aria-hidden="true">${svgs}</div>`;
  }
  return TEST_BACKDROP;
}

function syncBackdropPhase() {
  const now = (performance.timeOrigin + performance.now()) / 1000;
  for (const el of document.querySelectorAll(".bd *")) {
    const cs = getComputedStyle(el);
    const dur = Number.parseFloat(cs.animationDuration);
    if (cs.animationName === "none" || !dur) continue;
    const cycle = cs.animationDirection.includes("alternate") ? dur * 2 : dur;
    el.style.animationDelay = `-${(now % cycle).toFixed(2)}s`;
  }
}

// 로그인 → 홈. 나가는 연출이 끝나면 홈으로 가고, 홈은 ?enter=1이면 들어오는 연출을 한다
function goDashboard() {
  const u = new URL(PAGES.home.file, location.href);
  const bg = new URLSearchParams(location.search).get("bg");
  if (bg) u.searchParams.set("bg", bg);
  u.searchParams.set("enter", "1");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    location.href = u.href;
    return;
  }
  document.body.classList.add("leaving");
  if (!document.querySelector(".bd-day")) {
    setTimeout(() => {
      location.href = u.href;
    }, 900);
    return;
  }
  // 아침이 밝기 — 지금 시각(다음에 오는 그 시각)까지 1.8초 동안 시계를 돌린다
  const run = ++DAY.run;
  const from = DAY.mf;
  const now = new Date();
  let to = now.getHours() * 60 + now.getMinutes();
  while (to <= from) to += 1440;
  const clock = document.createElement("div");
  clock.className = "morning-clock";
  const dur = 1800;
  let t0 = 0;
  const step = (ts) => {
    if (run !== DAY.run) return;
    t0 ||= ts;
    const p = Math.min(1, (ts - t0) / dur);
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    drawDay(from + (to - from) * e);
    clock.textContent = dayClock(DAY.mf);
    clock.style.color = getComputedStyle(document.documentElement).getPropertyValue("--sky-fg");
    if (p < 1) requestAnimationFrame(step);
    else setTimeout(() => run === DAY.run && (location.href = u.href), 300);
  };
  setTimeout(() => {
    if (run !== DAY.run) return;
    document.body.appendChild(clock);
    requestAnimationFrame(step);
  }, 350);
}

function currentBackdrop() {
  const fromUrl = new URLSearchParams(location.search).get("bg");
  let saved = null;
  try {
    saved = localStorage.getItem("mock-bg2");
  } catch {}
  const key = fromUrl ?? saved ?? "day";
  return BACKDROP_KEYS.some(([k]) => k === key) ? key : "day";
}

function setBackdrop(key) {
  try {
    localStorage.setItem("mock-bg2", key);
  } catch {}
  const u = new URL(location.href);
  u.searchParams.set("bg", key);
  location.href = u.href;
}

// 흑백 시험 배경 — 윤곽이 또렷한 도형이라 유리의 흐림·흰색 양 차이가 바로 보인다
const TEST_BACKDROP = `
  <div aria-hidden="true" class="fixed inset-0 -z-10 overflow-hidden" style="background:repeating-linear-gradient(90deg,#e6e6e6 0 18px,#c8c8c8 18px 20px)">
    <i class="absolute block" style="left:30%;top:-5%;width:22%;height:62%;background:#3a3a3a"></i>
    <i class="absolute block" style="left:30%;top:18%;width:22%;height:10px;background:#111"></i>
    <i class="absolute block" style="left:30%;top:38%;width:22%;height:10px;background:#111"></i>
    <i class="absolute block" style="left:34%;top:4%;width:3%;height:14%;background:#9a9a9a"></i>
    <i class="absolute block" style="left:39%;top:6%;width:3%;height:12%;background:#f2f2f2"></i>
    <i class="absolute block" style="left:44%;top:26%;width:3%;height:12%;background:#7a7a7a"></i>
    <i class="absolute block" style="right:9%;top:10%;width:min(150px,30vw);aspect-ratio:1;border-radius:50%;background:#fff;box-shadow:0 0 0 14px #111"></i>
    <i class="absolute block" style="left:-3%;bottom:-6%;width:30%;height:34%;border-radius:40px 40px 0 0;background:#1f1f1f"></i>
    <i class="absolute block" style="left:28%;bottom:0;width:46%;height:15%;background:#8c8c8c;border-top:8px solid #2b2b2b"></i>
    <i class="absolute block" style="right:16%;bottom:6%;width:min(170px,34vw);height:min(230px,46vw);border-radius:50% 50% 40% 40%;background:#5a5a5a"></i>
    <i class="absolute block" style="right:62%;top:58%;width:0;height:0;border-left:70px solid transparent;border-right:70px solid transparent;border-bottom:120px solid #000"></i>
  </div>`;

// ⑥ 사장님의 하루 — [분, 하늘 위·가운데·아래, 별, 동네, 가게 창문, 하늘 위 글자 밝기(0 흰색 → 1 진한 글자)]
// 열쇠 시각 사이는 직선으로 섞는다. 시작 화면 장면 시각(21:30 22:40 02:00 07:30 10:00 14:00 19:00)과 같다
const DAY_KEYS = [
  [120, ["#05031a", "#110b3a", "#2a1d6a"], 1, "#07051a", "#8f7bff", 0], // 02:00 — 창문은 사주라가 일하는 보라 불
  [450, ["#3e36a8", "#ac86d8", "#ffc6a6"], 0.12, "#3a2c78", "#3a2c78", 0.2], // 07:30 새벽
  [600, ["#8ea6ff", "#c8c2ff", "#f3efff"], 0, "#b9b0f0", "#fff3c4", 1], // 10:00
  [840, ["#a6b8ff", "#dcd7ff", "#faf8ff"], 0, "#d4cdfb", "#fff3c4", 1], // 14:00
  [1140, ["#a9a6f4", "#e7d3f4", "#ffd6bf"], 0, "#c9b9ec", "#ffd27a", 1], // 19:00
  [1290, ["#241a5e", "#6a46c4", "#f2988c"], 0.35, "#1d1446", "#ffd27a", 0], // 21:30 마감
  [1360, ["#110b36", "#24195f", "#4a368f"], 0.8, "#0f0a2c", "#ffd27a", 0], // 22:40
];
const dayHex = (h) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
const dayMix = (a, b, t) => dayHex(a).map((v, i) => Math.round(v + (dayHex(b)[i] - v) * t));
const dayRgb = (c, alpha) => `rgb(${c.join(" ")}${alpha === undefined ? "" : ` / ${alpha}`})`;
const dayLerp = (a, b, t) => a + (b - a) * t;
const dayClock = (mf) => {
  const m = ((Math.round(mf) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
// run — 나가는 연출 번호. 뒤로 가기로 돌아오면 올려서, 멈춰 있던 연출의 반복·타이머가 이어서 돌지 않게 한다
const DAY = { mf: 1290, win: [255, 210, 122], redraw: () => {}, run: 0 };

function dayAt(mf) {
  const d = ((mf % 1440) + 1440) % 1440;
  let i = DAY_KEYS.length - 1;
  DAY_KEYS.forEach(([m], k) => {
    if (m <= d) i = k;
  });
  const A = DAY_KEYS[i];
  const B = DAY_KEYS[(i + 1) % DAY_KEYS.length];
  const t = (((d - A[0]) % 1440) + 1440) % 1440 / ((((B[0] - A[0]) % 1440) + 1440) % 1440);
  return {
    sky: A[1].map((c, j) => dayMix(c, B[1][j], t)),
    stars: dayLerp(A[2], B[2], t),
    town: dayMix(A[3], B[3], t),
    win: dayMix(A[4], B[4], t),
    fg: dayLerp(A[5], B[5], t),
  };
}

function dayBackdrop() {
  // 별은 화면이 바뀌어도 같은 자리에 뜨게 고정 씨앗으로 뿌린다
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let stars = "";
  for (let i = 0; i < 140; i++) {
    stars += `<circle cx="${(rnd() * 100).toFixed(2)}%" cy="${(rnd() * 70).toFixed(2)}%" r="${(rnd() * 1.3 + 0.3).toFixed(2)}" fill="#fff" opacity="${(rnd() * 0.6 + 0.4).toFixed(2)}"/>`;
  }
  const calm = document.body.dataset.sky === "now" || document.querySelector("[data-shell]") ? " data-calm" : "";
  // 동네 실루엣 — 가운데 보라 차양이 사장님 가게
  return `<div class="bd bd-day"${calm} aria-hidden="true">
    <i class="d-sky"></i>
    <svg class="d-stars">${stars}</svg>
    <i class="d-veil"></i>
    <i class="d-moon"></i>
    <i class="d-sun"></i>
    <svg class="d-town" viewBox="0 0 1440 190" preserveAspectRatio="xMidYMax slice">
      <g class="d-fill">
        <path d="M0 190V112h70V84h54v28h40V60h86v130zM250 190V96l46-30 46 30v94zM342 190V120h78V74h64v116z"/>
        <path d="M484 190V130h60V100h46v90z"/>
        <path d="M760 190V56h96v134zM856 190V108h58l30-24 30 24h40v82z"/>
        <path d="M1014 190V92h120v98zM1134 190V124h70V70h80v120zM1284 190V100h60V80h96v110z"/>
      </g>
      <g transform="translate(162 0)">
        <path class="d-fill" d="M484 190V88h170v102z"/>
        <path d="M478 92h182l-10 24H488z" fill="#6b4eff" opacity=".9"/>
        <path d="M498 92l-6 24M528 92l-4 24M558 92l-2 24M588 92v24M618 92l2 24M648 92l4 24" stroke="#fff" stroke-opacity=".35" stroke-width="10"/>
        <rect class="d-win" x="508" y="128" width="62" height="40" rx="4"/>
        <rect class="d-win" x="586" y="128" width="40" height="62" rx="3"/>
      </g>
    </svg>
  </div>`;
}

// mf: 분(자정을 넘으면 1440을 넘는다)
function drawDay(mf) {
  const bd = document.querySelector(".bd-day");
  if (!bd) return;
  DAY.mf = mf;
  const s = dayAt(mf);
  const calm = bd.hasAttribute("data-calm");
  bd.querySelector(".d-sky").style.background = `linear-gradient(180deg, ${dayRgb(s.sky[0])} 0%, ${dayRgb(s.sky[1])} 55%, ${dayRgb(s.sky[2])} 100%)`;
  bd.querySelector(".d-stars").style.opacity = s.stars;
  bd.querySelector(".d-veil").style.opacity = calm ? 0.25 + (1 - s.fg) * 0.55 : 0;
  // 달·해 — 같은 호를 같은 방향(오른쪽 → 왼쪽)으로 넘어간다. 왼쪽 글 칸을 피해 뜨는 쪽을 오른쪽에 둔다.
  const narrow = innerWidth < 860;
  const arc = (el, f) => {
    const p = Math.min(1, Math.max(0, f));
    let y = 84 - 70 * Math.sin(Math.PI * p);
    if (narrow) y = 4 + (y - 6) * 0.12; // 앱 폭은 글과 겹치지 않게 오른쪽 위 구석(약 4~13vh)에서만
    el.style.left = `${92 - 84 * p}vw`;
    el.style.top = `${y}vh`;
    el.style.opacity = f > 0 && f < 1 ? Math.min(1, p / 0.06, (1 - p) / 0.06) * (narrow ? 0.5 : 1) : 0;
  };
  arc(bd.querySelector(".d-sun"), ((mf % 1440) - 390) / 780); // 06:30 뜨고 19:30 진다
  arc(bd.querySelector(".d-moon"), (((mf - 1170) % 1440) + 1440) % 1440 / 720); // 19:30 뜨고 07:30 진다
  const town = bd.querySelector(".d-town");
  town.style.opacity = calm ? 0.3 : 1;
  for (const el of town.querySelectorAll(".d-fill")) el.setAttribute("fill", dayRgb(s.town));
  DAY.win = s.win;
  for (const el of town.querySelectorAll(".d-win")) el.setAttribute("fill", dayRgb(s.win));
  if (!calm) {
    const root = document.documentElement.style;
    root.setProperty("--sky-fg", dayRgb(dayMix("#ffffff", "#111827", s.fg)));
    root.setProperty("--sky-fg2", dayRgb(dayMix("#dcd8f2", "#374151", s.fg)));
    root.setProperty("--sky-pill", dayRgb(s.sky[0], 0.42));
  }
  for (const el of document.querySelectorAll("[data-sky-clock]")) el.textContent = dayClock(mf);
}

// 시각 소스 — body[data-sky]: "scroll"(시작 화면 장면 .scene[data-min]), "now"(실제 시각), "HH:MM"(고정). 없으면 대시보드는 now, 그 외는 21:30
function startDay() {
  const bd = document.querySelector(".bd-day");
  if (!bd) return;
  const mode = document.body.dataset.sky ?? (bd.hasAttribute("data-calm") ? "now" : "21:30");
  if (mode === "scroll") {
    const ease = (t) => t * t * (3 - 2 * t);
    const fromScroll = () => {
      const secs = [...document.querySelectorAll("main .scene[data-min]")];
      const mid = scrollY + innerHeight / 2;
      const c = secs.map((el) => el.offsetTop + el.offsetHeight / 2);
      let i = 0;
      while (i < c.length - 2 && mid > c[i + 1]) i++;
      const t = ease(Math.min(1, Math.max(0, (mid - c[i]) / (c[i + 1] - c[i]))));
      drawDay(dayLerp(+secs[i].dataset.min, +secs[i + 1].dataset.min, t));
    };
    addEventListener("scroll", () => requestAnimationFrame(fromScroll), { passive: true });
    addEventListener("resize", fromScroll);
    addEventListener("load", fromScroll);
    DAY.redraw = fromScroll;
    fromScroll();
  } else if (mode === "now") {
    const fromNow = () => {
      const d = new Date();
      drawDay(d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60);
    };
    DAY.redraw = fromNow;
    fromNow();
    setInterval(fromNow, 30000);
    addEventListener("resize", fromNow);
  } else {
    const [h, m] = mode.split(":").map(Number);
    DAY.redraw = () => drawDay(h * 60 + m);
    // 가게로 들어가기로 왔으면 시작 화면에서 흐르던 하늘을 이어받아 빛이 걷히는 동안 끝까지 흐른다
    const q = new URLSearchParams(location.search);
    const [from, to, p] = ["from", "to", "p"].map((k) => Number(q.get(k)));
    if (q.get("enter") === "shop" && q.has("to") && to !== from && p < 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      flowSky(from, to, p, 1, SHOP_ARRIVE_MS, ++DAY.run);
    } else {
      DAY.redraw();
    }
    addEventListener("resize", () => drawDay(DAY.mf));
  }
}

const SHOP_RINGS = [
  [0.3, 0],
  [0.6, 0.12],
];
// 두 원이 겹친 밝기 — 다음 화면의 빛이 이 밝기에서 걷힌다
const SHOP_GLOW_OPACITY = 1 - SHOP_RINGS.reduce((a, [o]) => a * (1 - o), 1);
// 하늘 흐름 — 빛이 퍼지는 순간 시작해 시작 화면(950ms)과 다음 화면(1100ms)에 걸쳐 하나의 곡선으로 흐른다.
// 도착 시각은 가입·로그인 화면 하늘(21:30)
const SHOP_SKY = 1290;
const SHOP_LEAVE_MS = 950;
const SHOP_ARRIVE_MS = 1100;
const SHOP_SPLIT = SHOP_LEAVE_MS / (SHOP_LEAVE_MS + SHOP_ARRIVE_MS);
// 출발이 너무 느리면 빛과 같이 시작하는 느낌이 안 나서 완만한 곡선(사인)을 쓴다
const shopEase = (p) => (1 - Math.cos(Math.PI * p)) / 2;

// 진행률 p0 → p1을 ms 동안 그린다. run이 바뀌면(뒤로 가기 등) 멈춘다
function flowSky(from, to, p0, p1, ms, run) {
  let t0 = 0;
  const step = (ts) => {
    if (run !== DAY.run) return;
    t0 ||= ts;
    const k = Math.min(1, (ts - t0) / ms);
    DAY.flowP = p0 + (p1 - p0) * k;
    drawDay(from + (to - from) * shopEase(DAY.flowP));
    if (k < 1) requestAnimationFrame(step);
  };
  DAY.flowP = p0;
  drawDay(from + (to - from) * shopEase(p0));
  requestAnimationFrame(step);
}

// 뒤로 가기로 돌아오면 브라우저가 떠나던 순간의 모습(빛이 덮은 화면, 돌던 시계)을 그대로 보여 준다.
// 그때는 나가던 연출을 걷어 내고 하늘을 이 화면의 시각으로 다시 그린다
addEventListener("pageshow", (e) => {
  if (!e.persisted) return;
  DAY.run++;
  for (const el of document.querySelectorAll(".shop-light, .morning-clock")) el.remove();
  document.body.classList.remove("going-shop", "leaving");
  DAY.redraw();
});

// 가게로 들어가기 — 창문 가운데서 창문 색 빛이 두 겹 원으로 퍼진 뒤 넘어간다.
// 하늘은 빛과 함께 누른 시각에서 21:30으로 흐르기 시작하고, 다음 화면은 ?enter=shop&glow=색&from=분&to=분&p=진행률로
// 같은 색 빛이 걷히는 동안 그 흐름을 이어받는다. 앞뒤 중 가까운 쪽으로 흐른다(뒤로 가면 달·해도 거꾸로 움직인다)
function goShop(url) {
  const u = new URL(url, location.href);
  const glow = DAY.win.map((v) => v.toString(16).padStart(2, "0")).join("");
  u.searchParams.set("enter", "shop");
  u.searchParams.set("glow", glow);
  const from = Math.round(DAY.mf) % 1440;
  let to = SHOP_SKY;
  while (to - from > 720) to -= 1440;
  while (from - to > 720) to += 1440;
  u.searchParams.set("from", String(from));
  u.searchParams.set("to", String(to));
  const win = document.querySelector(".bd-day .d-win");
  if (!win || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    location.href = u.href;
    return;
  }
  const r = win.getBoundingClientRect();
  // 원 — 창문 가운데에서 창문을 덮는 크기로 시작해 화면 가장 먼 모서리까지 퍼진다
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const far = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
  // [불투명도, 늦게 출발하는 초] — 바깥 원, 안쪽 원 순
  const rings = SHOP_RINGS.map(([opacity, delay]) => {
    const el = document.createElement("div");
    el.className = "shop-light";
    el.style.background = `#${glow}`;
    el.style.opacity = opacity;
    el.style.clipPath = `circle(${Math.hypot(r.width, r.height) / 2}px at ${cx}px ${cy}px)`;
    el.dataset.delay = delay;
    document.body.appendChild(el);
    return el;
  });
  document.body.classList.add("going-shop");
  const run = ++DAY.run;
  if (to !== from) flowSky(from, to, 0, SHOP_SPLIT, SHOP_LEAVE_MS, run);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      for (const el of rings) {
        el.style.transition = `clip-path 0.8s cubic-bezier(0.7, 0, 0.2, 1) ${el.dataset.delay}s`;
        el.style.clipPath = `circle(${far}px at ${cx}px ${cy}px)`;
      }
    }),
  );
  setTimeout(() => {
    if (run !== DAY.run) return;
    u.searchParams.set("p", (DAY.flowP ?? SHOP_SPLIT).toFixed(3));
    location.href = u.href;
  }, SHOP_LEAVE_MS);
}

function renderShell(el) {
  const active = el.dataset.shell;
  const appTabKey = active === "menus" ? "settings" : active;
  const title = el.dataset.title ?? (active === "home" ? MOCK_USER.store : APP_TITLE[active]);
  const subtitle = active === "home" && !el.dataset.title ? `${MOCK_USER.name}님, 안녕하세요` : "";
  const back = el.dataset.back ?? (active === "menus" ? PAGES.settings.file : "");
  const content = el.innerHTML;

  // 왼쪽 알약 메뉴 — 아이콘만 두고 이름은 마우스를 올리면 오른쪽에 뜬다
  const sideNav = WEB_NAV.map((n) => {
    const on = n.key === active;
    return `<a href="${href(n.key)}" ${on ? 'aria-current="page"' : ""} aria-label="${n.label}" class="group relative flex size-11 items-center justify-center rounded-full transition-colors ${on ? "bg-white/90 text-ink shadow-md" : "text-ink-2 hover:bg-white/40"}">
      ${icon(n.icon, "size-5", on ? 2.4 : 2)}
      <span class="pointer-events-none absolute left-full ml-3 hidden rounded-lg bg-ink/85 px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-white group-hover:block">${n.label}</span>
    </a>`;
  }).join("");

  const tabs = APP_TABS.map((t) => {
    const on = t.key === appTabKey;
    return `<li><a href="${href(t.key)}" ${on ? 'aria-current="page"' : ""} class="flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[0.75rem] font-semibold ${on ? "bg-white/90 text-ink shadow-md" : "text-ink-2"}">${icon(t.icon, "size-[1.4rem]", on ? 2.4 : 2)}${t.label}</a></li>`;
  }).join("");

  el.outerHTML = `
  ${backdropHtml(currentBackdrop())}

  <header class="en en-top glass pt-safe fixed inset-x-3 top-3 z-30 flex h-14 items-center gap-2 rounded-full pr-2 pl-2 lg:top-4 lg:right-4 lg:left-12 lg:gap-3 lg:pl-5">
    ${back ? `<a href="${back}" aria-label="뒤로 가기" class="flex size-10 items-center justify-center rounded-full text-ink hover:bg-white/40 lg:hidden">${icon("chevronLeft", "size-6")}</a>` : ""}
    <a href="${href("home")}" class="hidden items-center gap-2 lg:flex" aria-label="사주라 홈">
      <span class="flex size-8 items-center justify-center rounded-lg bg-ink text-sm font-black text-white">S</span>
      <span class="text-lg font-extrabold tracking-tight text-ink">사주라</span>
    </a>
    <div class="min-w-0 flex-1 pl-2 leading-tight lg:hidden">
      ${subtitle ? `<p class="text-xs text-ink-3">${subtitle}</p>` : ""}
      <p class="truncate text-[1.05rem] font-bold text-ink">${title}</p>
    </div>

    <!-- 입력창 자리 — 연결할 기능 미정 -->
    <div class="mx-auto hidden h-10 w-full max-w-[460px] items-center gap-2 rounded-full border border-dashed border-ink/25 bg-white/30 px-4 text-sm text-ink-3 lg:flex">
      ${icon("sparkles", "size-4")}<span>입력창 자리 — 연결할 기능 미정</span>
    </div>

    <div class="flex items-center gap-1 lg:gap-2">
      <a href="${href("upload")}" class="hidden h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white lg:inline-flex">${icon("upload", "size-4")} 매출 올리기</a>
      <a href="${href("settings")}" aria-label="설정" class="hidden size-10 items-center justify-center rounded-full text-ink-2 hover:bg-white/40 lg:flex">${icon("settings")}</a>
      <a href="${href("account")}" aria-label="계정" class="flex items-center gap-2 rounded-full p-1 hover:bg-white/40 lg:pr-3">
        <span class="flex size-9 items-center justify-center rounded-full bg-white/80 text-sm font-bold text-ink">${MOCK_USER.name.slice(0, 1)}</span>
        <span class="hidden leading-tight lg:block">
          <span class="block text-sm font-semibold text-ink">${MOCK_USER.store}</span>
          <span class="block text-xs text-ink-3">${MOCK_USER.name}님</span>
        </span>
      </a>
    </div>
  </header>

  <!-- 메뉴 폭(58px)의 절반이 패널 왼쪽 가장자리(3rem)에 걸친다. 윗변은 제목 아래 첫 카드 줄 윗선(패널 위 5.25rem + 안쪽 여백 1.75rem + 제목 줄 68px) -->
  <nav aria-label="주 메뉴" style="--d:0.1s" class="en en-left glass fixed top-[calc(7rem+68px)] left-[calc(3rem-29px)] z-30 hidden flex-col items-center gap-2 rounded-full p-1.5 lg:flex">${sideNav}</nav>

  <main style="--d:0.15s" class="en glass fixed inset-x-3 top-[4.75rem] bottom-[5.75rem] z-20 overflow-y-auto rounded-[1.75rem] px-4 py-5 lg:top-[5.25rem] lg:right-4 lg:bottom-12 lg:left-12 lg:pr-8 lg:pl-[calc(29px+2rem)] lg:py-7">
    ${content}
  </main>

  <!-- 웹 하단 알약 — 넣을 요소 미정. 높이(54px)의 절반이 패널 아래 가장자리(3rem)에 걸치고, 가로는 패널 가운데 -->
  <div style="--d:0.25s" class="en glass fixed bottom-[calc(3rem-27px)] left-[calc(50%+1rem)] z-30 hidden -translate-x-1/2 items-center gap-1 rounded-full p-1.5 lg:flex">
    <span class="flex h-10 items-center rounded-full border border-dashed border-ink/25 px-5 text-sm text-ink-3">하단 알약 — 넣을 요소 미정</span>
  </div>

  <nav aria-label="하단 메뉴" style="--d:0.25s" class="en glass pb-safe fixed inset-x-3 bottom-3 z-30 rounded-full p-1.5 lg:hidden">
    <ul class="grid grid-cols-5 gap-1">${tabs}</ul>
  </nav>`;
}

// RevenueBarChart(components/dashboard/revenue-chart.tsx) 모양
// <div data-chart="bar|area|dashed-line" data-labels="10/1,10/2,…" data-values="…" data-metric="revenue|sales_count" style="height:240px">
const CHART = { brand: "#6b4eff", grid: "#eef0f3", tick: "#6b7280", line: "#e3e6eb" };

function renderChart(el) {
  const labels = el.dataset.labels.split(",");
  const values = el.dataset.values.split(",").map(Number);
  const isRevenue = (el.dataset.metric ?? "revenue") === "revenue";
  // 요소 크기 그대로 그려 글자가 늘어나지 않게 한다
  const W = el.clientWidth || 600;
  const H = el.clientHeight || 240;
  const B = 26;
  const max = Math.max(...values) * 1.15 || 1;
  const fmt = (v) => (isRevenue ? `${Math.round(v / 10000)}만` : String(Math.round(v)));
  // 세로축 숫자 형식은 PR(만 단위) 그대로 두고, 칸 폭만 가장 긴 숫자에 맞춘다
  const L = Math.max(52, fmt(max).length * 8.5 + 10);
  const x = (i) => L + ((W - L - 8) / values.length) * (i + 0.5);
  const y = (v) => 8 + (H - B - 8) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t);
  let body = ticks
    .map(
      (t) =>
        `<line x1="${L}" x2="${W - 8}" y1="${y(t)}" y2="${y(t)}" stroke="${CHART.grid}"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="13" fill="${CHART.tick}">${fmt(t)}</text>`,
    )
    .join("");
  body += `<line x1="${L}" x2="${W - 8}" y1="${H - B}" y2="${H - B}" stroke="${CHART.line}"/>`;
  const step = Math.ceil(labels.length / 8);
  body += labels
    .map((l, i) =>
      i % step === 0
        ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="13" fill="${CHART.tick}">${l}</text>`
        : "",
    )
    .join("");
  const pts = values.map((v, i) => `${x(i)},${y(v)}`);
  if (el.dataset.chart === "bar") {
    const bw = Math.min(36, ((W - L - 8) / values.length) * 0.6);
    body += values
      .map(
        (v, i) =>
          `<path d="M${x(i) - bw / 2},${H - B} V${y(v) + 6} q0,-6 6,-6 h${bw - 12} q6,0 6,6 V${H - B}Z" fill="${CHART.brand}"/>`,
      )
      .join("");
  } else if (el.dataset.chart === "area") {
    const gid = `g${Math.random().toString(36).slice(2, 7)}`;
    body += `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${CHART.brand}" stop-opacity=".22"/><stop offset="1" stop-color="${CHART.brand}" stop-opacity="0"/></linearGradient></defs>`;
    body += `<path d="M${pts[0]} L${pts.join(" L")} L${x(values.length - 1)},${H - B} L${x(0)},${H - B}Z" fill="url(#${gid})"/>`;
    body += `<polyline points="${pts.join(" ")}" fill="none" stroke="${CHART.brand}" stroke-width="2.5"/>`;
  } else {
    body += `<polyline points="${pts.join(" ")}" fill="none" stroke="${CHART.brand}" stroke-width="2.5" stroke-dasharray="6 4"/>`;
    body += values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${CHART.brand}"/>`).join("");
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="h-full w-full">${body}</svg>`;
}

// 화면 상태 — body[data-states]="라벨:키,…". data-when="키 키"인 요소는 그 상태에서만 보인다.
function applyState(state) {
  document.body.dataset.state = state;
  for (const el of document.querySelectorAll("[data-when]")) {
    // SVG 요소는 hidden 프로퍼티가 없어 속성으로 다룬다
    el.toggleAttribute("hidden", !el.dataset.when.split(" ").includes(state));
  }
  for (const b of document.querySelectorAll("[data-mock-state]")) {
    b.setAttribute("aria-pressed", String(b.dataset.mockState === state));
  }
  skyForState(state);
  const url = new URL(location.href);
  url.searchParams.set("state", state);
  history.replaceState(null, "", url);
  // 숨겨져 있다 나타난 차트는 크기가 0으로 그려졌으니 다시 그린다
  requestAnimationFrame(() => {
    for (const el of document.querySelectorAll("[data-chart]")) if (el.clientWidth > 0) renderChart(el);
  });
  if (inFrame) parent.postMessage({ mock: "page", page: document.body.dataset.page, state }, "*");
}

// 단계마다 하늘 시각이 다른 화면(온보딩) — body[data-sky-steps]="상태:HH:MM,…". 상태가 바뀌면 그 시각으로 앞뒤 중 가까운 쪽으로 흐른다
function skyForState(state) {
  const steps = Object.fromEntries(
    (document.body.dataset.skySteps ?? "")
      .split(",")
      .filter(Boolean)
      .map((p) => [p.slice(0, p.indexOf(":")), p.slice(p.indexOf(":") + 1)]),
  );
  if (!steps[state] || !document.querySelector(".bd-day")) return;
  const [h, m] = steps[state].split(":").map(Number);
  const from = ((Math.round(DAY.mf) % 1440) + 1440) % 1440;
  let to = h * 60 + m;
  while (to - from > 720) to -= 1440;
  while (from - to > 720) to += 1440;
  DAY.redraw = () => drawDay(h * 60 + m);
  // 페이지를 처음 열 때는 흐르지 않고 바로 그 시각에 둔다(열자마자 달이 움직이지 않게)
  if (!DAY.stepped || to === from || matchMedia("(prefers-reduced-motion: reduce)").matches) DAY.redraw();
  else flowSky(from, to, 0, 1, 900, ++DAY.run);
  DAY.stepped = true;
}

function parseStates(raw) {
  return (raw ?? "")
    .split(",")
    .filter(Boolean)
    .map((s) => s.split(":"));
}

// 목업 도구 막대 — 와이어플로우로, 화면 상태 전환, 웹/앱 폭 전환, 다른 화면 이동
function renderToolbar(pageKey, states, current, appView) {
  const page = PAGES[pageKey];
  document.getElementById("mock-toolbar")?.remove();
  const bar = document.createElement("div");
  bar.id = "mock-toolbar";
  bar.style.fontSize = "12px";
  // 앱 보기에서는 프레임을 가리지 않게 위에, 웹 보기에서는 앱 하단 탭 위(넓은 화면은 오른쪽 아래)에 둔다
  bar.className = `fixed right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-xl bg-[#101828]/90 px-3 py-2 text-white shadow-lg ${appView ? "top-4" : "top-20 lg:top-auto lg:bottom-4"}`;
  const viewHref = (view) => {
    const u = new URL(page.file, location.href);
    if (view === "app") u.searchParams.set("view", "app");
    if (current) u.searchParams.set("state", current);
    return u.href;
  };
  bar.innerHTML = `
    <span class="text-white/60">${page.route}</span>
    <span class="flex overflow-hidden rounded-md bg-white/10">
      <a href="${viewHref("web")}" class="px-2 py-1 ${appView ? "hover:bg-white/20" : "bg-white text-[#101828]"}">웹</a>
      <a href="${viewHref("app")}" class="px-2 py-1 ${appView ? "bg-white text-[#101828]" : "hover:bg-white/20"}">앱 390</a>
    </span>
    ${states.map(([label, key]) => `<button type="button" data-mock-state="${key}" aria-pressed="${key === current}" class="rounded-md px-2 py-1 hover:bg-white/20 aria-pressed:bg-white aria-pressed:text-[#101828]">${label}</button>`).join("")}
    <select aria-label="배경" data-mock-bg class="rounded-md bg-white/10 px-1 py-1 text-white">
      ${BACKDROP_KEYS.map(([k, label]) => `<option value="${k}" class="text-black" ${k === currentBackdrop() ? "selected" : ""}>${label}</option>`).join("")}
    </select>
    <select aria-label="다른 화면으로 이동" class="rounded-md bg-white/10 px-1 py-1 text-white">
      ${Object.entries(PAGES)
        .filter(([, p]) => p.file)
        .map(([k, p]) => `<option value="${p.file}" class="text-black" ${k === pageKey ? "selected" : ""}>${p.name}</option>`)
        .join("")}
    </select>`;
  bar.querySelector("[data-mock-bg]").addEventListener("change", (e) => setBackdrop(e.target.value));
  bar.querySelector('select[aria-label="다른 화면으로 이동"]').addEventListener("change", (e) => {
    location.href = appView ? `${e.target.value}?view=app` : e.target.value;
  });
  document.body.appendChild(bar);
}

// 앱 폭 보기(?view=app) — 같은 화면을 390×844 프레임 안에 띄운다. 프레임 안 화면은 도구 막대 없이 그린다.
const inFrame = window.parent !== window;

function renderAppFrame(pageKey) {
  const inner = new URL(location.href);
  inner.searchParams.delete("view");
  document.body.removeAttribute("data-states");
  document.body.className = "grid min-h-dvh place-items-center bg-[#d9dce3] p-6 pt-20";
  document.body.innerHTML = `<iframe id="mock-app-frame" title="앱 화면 (390×844)" src="${inner.href}" class="box-content h-[844px] w-[390px] rounded-[2.75rem] border-[10px] border-[#111827] bg-white shadow-2xl"></iframe>`;
  const frame = document.getElementById("mock-app-frame");
  let states = [];
  window.addEventListener("message", (e) => {
    if (e.data?.mock !== "page") return;
    if (e.data.states !== undefined) states = parseStates(e.data.states);
    const key = e.data.page;
    const outer = new URL(location.href);
    outer.pathname = outer.pathname.replace(/[^/]*$/, PAGES[key].file);
    outer.searchParams.set("view", "app");
    if (e.data.state) outer.searchParams.set("state", e.data.state);
    else outer.searchParams.delete("state");
    history.replaceState(null, "", outer);
    renderToolbar(key, states, e.data.state, true);
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mock-state]");
    if (b) frame.contentWindow.postMessage({ mock: "state", state: b.dataset.mockState }, "*");
  });
  renderToolbar(pageKey, [], new URLSearchParams(location.search).get("state"), true);
}

document.addEventListener("DOMContentLoaded", () => {
  const pageKey = document.body.dataset.page;
  const params = new URLSearchParams(location.search);
  if (params.get("view") === "app" && !inFrame) {
    renderAppFrame(pageKey);
    return;
  }

  const bdStyle = document.createElement("style");
  bdStyle.textContent = BACKDROP_CSS;
  document.head.appendChild(bdStyle);
  for (const el of document.querySelectorAll("[data-backdrop]")) el.outerHTML = backdropHtml(el.dataset.backdrop || currentBackdrop());
  for (const el of document.querySelectorAll("[data-shell]")) renderShell(el);
  syncBackdropPhase();
  startDay();
  if (params.get("enter")) {
    if (params.get("enter") === "shop") {
      document.body.classList.add("arrive-shop");
      const light = document.createElement("div");
      light.className = "shop-light out";
      const glow = params.get("glow");
      light.style.background = /^[0-9a-f]{6}$/.test(glow ?? "") ? `#${glow}` : `${dayRgb(DAY.win)}`;
      light.style.opacity = SHOP_GLOW_OPACITY;
      document.body.appendChild(light);
      setTimeout(() => light.remove(), 1100);
    } else {
      document.body.classList.add("entering");
    }
    const u = new URL(location.href);
    u.searchParams.delete("enter");
    u.searchParams.delete("glow");
    u.searchParams.delete("from");
    u.searchParams.delete("to");
    u.searchParams.delete("p");
    history.replaceState(null, "", u);
  }
  for (const el of document.querySelectorAll("[data-icon]")) {
    // data-stroke로 선 굵기 지정 (tsx의 strokeWidth)
    const svg = icon(el.dataset.icon, el.getAttribute("class") ?? "size-5", el.dataset.stroke ?? 2);
    el.outerHTML = el.dataset.when ? svg.replace("<svg ", `<svg data-when="${el.dataset.when}" `) : svg;
  }

  const rawStates = document.body.dataset.states;
  const states = parseStates(rawStates);
  const first = states[0]?.[1];
  const current = params.get("state") ?? first;
  if (!inFrame) renderToolbar(pageKey, states, current, false);
  if (current) applyState(current);
  if (inFrame) {
    parent.postMessage({ mock: "page", page: pageKey, states: rawStates ?? "", state: current }, "*");
    window.addEventListener("message", (e) => {
      if (e.data?.mock === "state") applyState(e.data.state);
    });
  }
  // 차트는 상태 전환 뒤 크기가 정해진 다음 그린다
  requestAnimationFrame(() => {
    for (const el of document.querySelectorAll("[data-chart]")) renderChart(el);
  });

  document.addEventListener("click", (e) => {
    const shop = e.target.closest("[data-go-shop]");
    if (shop) {
      e.preventDefault();
      goShop(shop.getAttribute("href"));
      return;
    }
    if (e.target.closest("[data-go-dashboard]")) {
      e.preventDefault();
      goDashboard();
      return;
    }
    const t = e.target.closest("[data-toggle],[data-go],[data-set-state],[data-mock-state]");
    if (!t) return;
    if (t.dataset.mockState) applyState(t.dataset.mockState);
    if (t.dataset.setState) applyState(t.dataset.setState);
    if (t.dataset.toggle) {
      for (const target of document.querySelectorAll(t.dataset.toggle)) target.toggleAttribute("hidden");
      t.setAttribute("aria-expanded", String(t.getAttribute("aria-expanded") !== "true"));
    }
    if (t.dataset.go) location.href = t.dataset.go;
  });
  // 목업은 서버로 보내지 않는다 — 제출 버튼의 data-go/data-set-state만 동작한다
  document.addEventListener("submit", (e) => e.preventDefault());
});
