// 사주라 화면 목업 공용 스크립트 — 디자인 토큰, 대시보드 셸(웹 상단 내비·앱 상단바·하단 탭), 아이콘, 차트,
// 화면 상태 전환, 목업 도구 막대, 앱 폭(390px) 보기.
// 각 페이지는 Front/src/routes/*.tsx의 마크업과 Tailwind 클래스를 옮기고 데이터만 가짜로 채운다.

const PAGES = {
  intro: { file: "21_intro.html", route: "/intro", name: "서비스 소개" },
  login: { file: "01_login.html", route: "/login", name: "로그인" },
  register: { file: "02_register.html", route: "/register", name: "회원가입" },
  verify: { file: "03_verify-business.html", route: "/verify-business", name: "사업자 검증" },
  ob1: { file: "04_onboarding-store.html", route: "/onboarding/1", name: "온보딩 1 매장 정보" },
  ob2: { file: "05_onboarding-pos.html", route: "/onboarding/2", name: "온보딩 2 POS 연동" },
  ob3: { file: "06_onboarding-menus.html", route: "/onboarding/3", name: "온보딩 3 메뉴 등록" },
  ob4: { file: "07_onboarding-confirm.html", route: "/onboarding/4", name: "온보딩 4 확인" },
  home: { file: "08_home.html", route: "/", name: "홈" },
  forecast: { file: "09_forecast.html", route: "/forecast", name: "매출예측" },
  inventory: { file: "10_inventory.html", route: "/inventory", name: "재고관리" },
  orders: { file: "11_orders.html", route: "/orders", name: "발주추천" },
  recipes: { file: "12_recipes.html", route: "/recipes", name: "레시피 관리" },
  upload: { file: "13_sales-upload.html", route: "/sales/upload", name: "매출 CSV 업로드" },
  settings: { file: "14_settings.html", route: "/settings", name: "설정(앱: 더보기)" },
  pos: { file: "15_settings-pos.html", route: "/settings/pos", name: "POS 연동 설정" },
  pricing: { file: "16_settings-pricing.html", route: "/settings/pricing", name: "단가 관리" },
  notifications: {
    file: "17_settings-notifications.html",
    route: "/settings/notifications",
    name: "알림 설정",
  },
  account: { file: "18_settings-account.html", route: "/settings/account", name: "계정 정보" },
  appinfo: { file: "19_settings-app-info.html", route: "/settings/app-info", name: "앱 정보" },
  admin: { file: "20_admin-verifications.html", route: "/admin/verifications", name: "관리자 심사" },
};

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
  --color-line: #e3e6eb;
  --color-line-soft: #eef0f3;
  --color-canvas: #f4f5f8;
  --color-subtle: #f6f7f9;
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

// DashboardShell(components/dashboard/shell.tsx)
// <div data-shell="활성키" data-title="앱 상단바 제목" data-back="뒤로 갈 목업 파일">본문</div>
const WEB_NAV = [
  { key: "home", label: "홈" },
  { key: "forecast", label: "매출예측" },
  { key: "inventory", label: "재고관리" },
  { key: "orders", label: "발주추천" },
  { key: "recipes", label: "레시피 관리" },
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
  recipes: "레시피 관리",
  settings: "더보기",
};

function renderShell(el) {
  const active = el.dataset.shell;
  const appTabKey = active === "recipes" ? "settings" : active;
  const title = el.dataset.title ?? (active === "home" ? MOCK_USER.store : APP_TITLE[active]);
  const subtitle = active === "home" && !el.dataset.title ? `${MOCK_USER.name}님, 안녕하세요` : "";
  const back = el.dataset.back ?? (active === "recipes" ? PAGES.settings.file : "");
  const content = el.innerHTML;

  const webNav = WEB_NAV.map((n) => {
    const on = n.key === active;
    return `<a href="${PAGES[n.key].file}" ${on ? 'aria-current="page"' : ""} class="relative flex items-center px-3.5 text-[0.95rem] font-semibold transition-colors ${on ? "text-brand" : "text-ink-2 hover:text-ink"}">${n.label}${on ? '<span class="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-brand"></span>' : ""}</a>`;
  }).join("");

  const tabs = APP_TABS.map((t) => {
    const on = t.key === appTabKey;
    return `<li><a href="${PAGES[t.key].file}" ${on ? 'aria-current="page"' : ""} class="flex h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.8rem] font-semibold ${on ? "text-brand" : "text-ink-3"}">${icon(t.icon, "size-[1.6rem]", on ? 2.4 : 2)}${t.label}</a></li>`;
  }).join("");

  el.outerHTML = `
  <div class="min-h-dvh bg-canvas">
    <header class="sticky top-0 z-30 hidden border-b border-line bg-white/95 backdrop-blur lg:block">
      <div class="mx-auto flex h-16 max-w-[1280px] items-center gap-8 px-8">
        <a href="${PAGES.home.file}" class="flex items-center gap-2" aria-label="사주라 홈">
          <span class="flex size-8 items-center justify-center rounded-lg bg-brand text-sm font-black text-white">S</span>
          <span class="text-xl font-extrabold tracking-tight text-ink">사주라</span>
        </a>
        <nav aria-label="주 메뉴" class="flex h-full items-stretch gap-1">${webNav}</nav>
        <div class="ml-auto flex items-center gap-2">
          <a href="${PAGES.upload.file}" class="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong">${icon("upload", "size-4")} 매출 올리기</a>
          <a href="${PAGES.settings.file}" aria-label="설정" class="flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-subtle ${active === "settings" ? "bg-brand-soft text-brand" : ""}">${icon("settings")}</a>
          <div class="ml-2 flex items-center gap-3 border-l border-line pl-4">
            <a href="${PAGES.account.file}" class="flex items-center gap-2.5 text-left" aria-label="계정">
              <span class="flex size-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">${MOCK_USER.name.slice(0, 1)}</span>
              <span class="leading-tight">
                <span class="block text-sm font-semibold text-ink">${MOCK_USER.store}</span>
                <span class="block text-xs text-ink-3">${MOCK_USER.name}님</span>
              </span>
            </a>
            <a href="${PAGES.login.file}" class="flex size-9 items-center justify-center rounded-lg text-ink-3 hover:bg-subtle hover:text-ink" aria-label="로그아웃" title="로그아웃">${icon("logOut", "size-[18px]")}</a>
          </div>
        </div>
      </div>
    </header>

    <header class="pt-safe sticky top-0 z-30 border-b border-line-soft bg-white/95 backdrop-blur lg:hidden">
      <div class="flex min-h-16 items-center gap-1 px-2 py-2">
        ${back ? `<a href="${back}" aria-label="뒤로 가기" class="flex size-12 items-center justify-center rounded-full text-ink active:bg-subtle">${icon("chevronLeft", "size-7")}</a>` : '<span class="w-3"></span>'}
        <div class="min-w-0 flex-1">
          ${subtitle ? `<p class="text-sm text-ink-3">${subtitle}</p>` : ""}
          <p class="truncate text-[1.35rem] font-bold tracking-tight text-ink">${title}</p>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-[1280px] px-4 pt-4 pb-32 sm:px-6 lg:px-8 lg:pt-8 lg:pb-16">${content}</main>

    <nav aria-label="하단 메뉴" class="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white lg:hidden">
      <ul class="grid grid-cols-5">${tabs}</ul>
    </nav>
  </div>`;
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
  const url = new URL(location.href);
  url.searchParams.set("state", state);
  history.replaceState(null, "", url);
  // 숨겨져 있다 나타난 차트는 크기가 0으로 그려졌으니 다시 그린다
  requestAnimationFrame(() => {
    for (const el of document.querySelectorAll("[data-chart]")) if (el.clientWidth > 0) renderChart(el);
  });
  if (inFrame) parent.postMessage({ mock: "page", page: document.body.dataset.page, state }, "*");
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
  bar.className = `fixed right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-xl bg-[#101828]/90 px-3 py-2 text-white shadow-lg ${appView ? "top-4" : "bottom-24 lg:bottom-4"}`;
  const viewHref = (view) => {
    const u = new URL(page.file, location.href);
    if (view === "app") u.searchParams.set("view", "app");
    if (current) u.searchParams.set("state", current);
    return u.href;
  };
  bar.innerHTML = `
    <a href="00_wireflow.html" class="rounded-md bg-white/10 px-2 py-1 font-semibold hover:bg-white/20">← 와이어플로우</a>
    <span class="text-white/60">${page.route}</span>
    <span class="flex overflow-hidden rounded-md bg-white/10">
      <a href="${viewHref("web")}" class="px-2 py-1 ${appView ? "hover:bg-white/20" : "bg-white text-[#101828]"}">웹</a>
      <a href="${viewHref("app")}" class="px-2 py-1 ${appView ? "bg-white text-[#101828]" : "hover:bg-white/20"}">앱 390</a>
    </span>
    ${states.map(([label, key]) => `<button type="button" data-mock-state="${key}" aria-pressed="${key === current}" class="rounded-md px-2 py-1 hover:bg-white/20 aria-pressed:bg-white aria-pressed:text-[#101828]">${label}</button>`).join("")}
    <select aria-label="다른 화면으로 이동" class="rounded-md bg-white/10 px-1 py-1 text-white">
      ${Object.entries(PAGES)
        .map(([k, p]) => `<option value="${p.file}" class="text-black" ${k === pageKey ? "selected" : ""}>${p.name}</option>`)
        .join("")}
    </select>`;
  bar.querySelector("select").addEventListener("change", (e) => {
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

  for (const el of document.querySelectorAll("[data-shell]")) renderShell(el);
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
