// 사주라 화면 목업 공용 스크립트 — 대시보드 셸, 아이콘, 차트, 화면 상태 전환, 목업 도구 막대.
// 각 페이지는 Front/src/routes/*.tsx의 마크업과 Tailwind 클래스를 옮기고 데이터만 가짜로 채운다.

const PAGES = {
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
  settings: { file: "14_settings.html", route: "/settings", name: "설정" },
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

const ICON_PATHS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  trendingUp: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
  trendingDown: '<path d="M22 17 13.5 8.5 8.5 13.5 2 7"/><path d="M16 17h6v-6"/>',
  minus: '<path d="M5 12h14"/>',
  boxes:
    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  clipboard:
    '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  chefHat:
    '<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><path d="M6 17h12"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  sparkles:
    '<path d="M9.94 14.06 4 20M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/>',
  wallet:
    '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  receipt:
    '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 17.5v-11"/>',
  utensils:
    '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7M2.1 21.8l6.4-6.3M19 5l-7 7"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  store:
    '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4M2 7h20M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
  card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  egg: '<path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z"/>',
};

function icon(name, cls = "size-5") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] ?? ""}</svg>`;
}

const NAV = [
  { key: "home", label: "홈", icon: "home" },
  { key: "forecast", label: "매출예측", icon: "trendingUp" },
  { key: "inventory", label: "재고관리", icon: "boxes" },
  { key: "orders", label: "발주추천", icon: "clipboard" },
  { key: "recipes", label: "레시피 관리", icon: "chefHat" },
];

// DashboardShell(components/dashboard/shell.tsx) — 사이드 내비게이션 + 상단바
function renderShell(el) {
  const active = el.dataset.shell;
  const item = (key, label, ic, href) => {
    const on = key === active;
    return `<a href="${href}" class="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors ${on ? "bg-[#7a5eff]/10 text-[#7a5eff]" : "text-[#364153] hover:bg-[#f3f4f6]"}">${icon(ic)}<span class="flex-1">${label}</span>${icon("chevronRight", "size-4 text-[#c1c6cf]")}</a>`;
  };
  const content = el.innerHTML;
  el.outerHTML = `
  <div class="grid min-h-dvh grid-cols-[266px_1fr] bg-[#f3f4f6]">
    <aside class="flex flex-col justify-between bg-white p-4">
      <div class="space-y-1">
        <p class="px-2 pb-4 text-2xl font-semibold text-[#7a5eff]">Sajura</p>
        ${NAV.map((n) => item(n.key, n.label, n.icon, PAGES[n.key].file)).join("")}
      </div>
      <div class="space-y-1 border-t border-[#eef1f4] pt-4">
        ${item("settings", "설정", "settings", PAGES.settings.file)}
        <a href="${PAGES.login.file}" class="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-base font-medium text-[#364153] hover:bg-[#f3f4f6]">${icon("logout")}<span class="flex-1">로그아웃</span>${icon("chevronRight", "size-4 text-[#c1c6cf]")}</a>
      </div>
    </aside>
    <div class="flex flex-col">
      <header class="flex items-center justify-between border-b border-[#eef1f4] bg-white px-8 py-4">
        <div>
          <p class="text-lg font-semibold text-[#101828]">${MOCK_USER.store}</p>
          <p class="text-sm text-[#99a1af]">hello, ${MOCK_USER.name}</p>
        </div>
        <a href="${PAGES.settings.file}" class="grid size-10 place-items-center rounded-full bg-[#f3f4f6] text-sm font-medium text-[#364153]" aria-label="계정">${MOCK_USER.name.slice(0, 1)}</a>
      </header>
      <main class="flex-1 p-8">${content}</main>
    </div>
  </div>`;
}

// RevenueBarChart(components/dashboard/revenue-chart.tsx) 모양 — data-chart="bar|area"
function renderChart(el) {
  const labels = el.dataset.labels.split(",");
  const values = el.dataset.values.split(",").map(Number);
  const W = 600;
  const H = 196;
  const L = 52;
  const B = 24;
  const max = Math.max(...values) * 1.15 || 1;
  const x = (i) => L + ((W - L - 8) / values.length) * (i + 0.5);
  const y = (v) => 8 + (H - B - 8) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => max * t);
  const fmt = (v) => (v >= 10000 ? `${Math.round(v / 10000)}만` : String(Math.round(v)));
  let body = ticks
    .map(
      (t) =>
        `<line x1="${L}" x2="${W - 8}" y1="${y(t)}" y2="${y(t)}" stroke="#eef1f4"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="#9ba5b7">${fmt(t)}</text>`,
    )
    .join("");
  const step = Math.ceil(labels.length / 8);
  body += labels
    .map((l, i) =>
      i % step === 0
        ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#9ba5b7">${l}</text>`
        : "",
    )
    .join("");
  if (el.dataset.chart === "bar") {
    const bw = Math.min(40, ((W - L - 8) / values.length) * 0.6);
    body += values
      .map(
        (v, i) =>
          `<rect x="${x(i) - bw / 2}" y="${y(v)}" width="${bw}" height="${H - B - y(v)}" rx="6" fill="#7a5eff"/>`,
      )
      .join("");
  } else {
    const pts = values.map((v, i) => `${x(i)},${y(v)}`);
    body += `<defs><linearGradient id="g${Math.random().toString(36).slice(2, 7)}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7a5eff" stop-opacity=".3"/><stop offset="1" stop-color="#7a5eff" stop-opacity="0"/></linearGradient></defs>`;
    const gid = body.match(/id="(g\w+)"/)[1];
    body += `<path d="M${pts[0]} L${pts.join(" L")} L${x(values.length - 1)},${H - B} L${x(0)},${H - B}Z" fill="url(#${gid})"/>`;
    body += `<polyline points="${pts.join(" ")}" fill="none" stroke="#7a5eff" stroke-width="2"/>`;
    body += values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="#7a5eff"/>`).join("");
  }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="h-full w-full">${body}</svg>`;
}

// MenuSharePieChart 모양 — data-pie="값,값,…" data-colors="#..,#.."
function renderPie(el) {
  const values = el.dataset.pie.split(",").map(Number);
  const colors = el.dataset.colors.split(",");
  const total = values.reduce((a, b) => a + b, 0);
  let a0 = -Math.PI / 2;
  const R = 70;
  const r = 42;
  const pt = (rad, a) => `${90 + rad * Math.cos(a)},${90 + rad * Math.sin(a)}`;
  const arcs = values
    .map((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const d = `M${pt(R, a0)} A${R},${R} 0 ${big} 1 ${pt(R, a1)} L${pt(r, a1)} A${r},${r} 0 ${big} 0 ${pt(r, a0)}Z`;
      a0 = a1;
      return `<path d="${d}" fill="${colors[i]}" stroke="white"/>`;
    })
    .join("");
  el.innerHTML = `<svg viewBox="0 0 180 180" class="mx-auto h-full">${arcs}</svg>`;
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
}

function renderToolbar(pageKey) {
  const page = PAGES[pageKey];
  const states = (document.body.dataset.states ?? "")
    .split(",")
    .filter(Boolean)
    .map((s) => s.split(":"));
  const bar = document.createElement("div");
  bar.className =
    "fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-xl bg-[#101828]/90 px-3 py-2 text-xs text-white shadow-lg";
  bar.innerHTML = `
    <a href="00_wireflow.html" class="rounded-md bg-white/10 px-2 py-1 font-semibold hover:bg-white/20">← 와이어플로우</a>
    <span class="text-white/60">${page.route}</span>
    ${states.map(([label, key]) => `<button type="button" data-mock-state="${key}" class="rounded-md px-2 py-1 hover:bg-white/20 aria-pressed:bg-white aria-pressed:text-[#101828]">${label}</button>`).join("")}
    <select aria-label="다른 화면으로 이동" class="rounded-md bg-white/10 px-1 py-1 text-white">
      ${Object.entries(PAGES)
        .map(([k, p]) => `<option value="${p.file}" class="text-black" ${k === pageKey ? "selected" : ""}>${p.name}</option>`)
        .join("")}
    </select>`;
  bar.querySelector("select").addEventListener("change", (e) => {
    location.href = e.target.value;
  });
  document.body.appendChild(bar);
}

document.addEventListener("DOMContentLoaded", () => {
  const pageKey = document.body.dataset.page;
  for (const el of document.querySelectorAll("[data-shell]")) renderShell(el);
  for (const el of document.querySelectorAll("[data-icon]")) {
    const svg = icon(el.dataset.icon, el.getAttribute("class") ?? "size-5");
    el.outerHTML = el.dataset.when ? svg.replace("<svg ", `<svg data-when="${el.dataset.when}" `) : svg;
  }
  for (const el of document.querySelectorAll("[data-chart]")) renderChart(el);
  for (const el of document.querySelectorAll("[data-pie]")) renderPie(el);
  renderToolbar(pageKey);

  const states = document.body.dataset.states;
  if (states) {
    const first = states.split(",")[0].split(":")[1];
    applyState(new URLSearchParams(location.search).get("state") ?? first);
  }

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
