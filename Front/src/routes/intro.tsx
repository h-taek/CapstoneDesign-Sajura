import {
  ArrowRight,
  Beef,
  Beer,
  Boxes,
  CalendarDays,
  Carrot,
  Check,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  CookingPot,
  Egg,
  FileSpreadsheet,
  Fish,
  Home,
  Menu as MenuIcon,
  PackageX,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";
// 서비스 소개(랜딩) 페이지 — 로그인 없이 누구나 볼 수 있다. /intro
// 구성은 수발주 서비스 소개 페이지(발주고·마켓봄·앳트래커)의 흐름을 따른다:
// 히어로 → 사장님 고민 → 기능 → 이용 순서 → 앱(PWA) 설치 → 자주 묻는 질문 → 시작하기.
// 사실만 쓴다 — 누적 이용자 수·후기·수상 같은 검증 안 된 숫자는 넣지 않는다.
import heroPhoto from "../assets/auth/hero-photo.png";
import { InstallGuideSheet, useStartInstall } from "../components/pwa/install-banner";
import { cn } from "../lib/utils";

const NAV = [
  { href: "#features", label: "주요 기능" },
  { href: "#how", label: "이용 방법" },
  { href: "#app", label: "앱 설치" },
  { href: "#faq", label: "자주 묻는 질문" },
];

const PAINS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: ClipboardList,
    title: "매일 감으로 발주",
    body: "어제 얼마 팔렸는지 떠올리며 거래처에 주문을 넣고 계신가요?",
  },
  {
    icon: Trash2,
    title: "남아서 버리는 재료",
    body: "많이 시키면 소비기한이 지나 폐기, 그만큼 이익이 줄어듭니다.",
  },
  {
    icon: PackageX,
    title: "바쁜 날엔 재료 부족",
    body: "손님 많은 금·토요일에 재료가 떨어지면 팔 수 있는 것도 못 팝니다.",
  },
];

const FEATURES: Array<{ icon: LucideIcon; title: string; body: string; points: string[] }> = [
  {
    icon: TrendingUp,
    title: "매출 예측",
    body: "지난 매출과 요일 같은 요인을 함께 보고 앞으로 3일 매출을 미리 계산합니다.",
    points: [
      "다음 날·이틀 뒤·사흘 뒤 예상 매출",
      "예상 범위와 이유를 한 문장으로",
      "신뢰도가 낮으면 따로 표시",
    ],
  },
  {
    icon: ClipboardList,
    title: "발주 추천",
    body: "예측 매출 × 메뉴별 레시피 × 지금 재고를 계산해 재료별로 몇 개 시킬지 알려드립니다.",
    points: ["재료마다 추천 수량과 계산 근거", "필요 없으면 '0'으로 추천", "확정은 사장님이 직접"],
  },
  {
    icon: Boxes,
    title: "재고 관리",
    body: "입고한 묶음(로트)마다 수량과 소비기한을 기록하고, 판매된 만큼 먼저 들어온 것부터 줄입니다.",
    points: ["부족·소비기한 임박 알림", "입고·실사 조정·폐기 기록", "기준 수량 아래면 발주 목록에"],
  },
  {
    icon: FileSpreadsheet,
    title: "POS 매출 올리기",
    body: "POS에서 내려받은 매출 파일(CSV)을 올리면 메뉴와 자동으로 맞춰 저장합니다.",
    points: [
      "같은 영수증은 두 번 저장 안 함",
      "새 메뉴 자동 등록 선택 가능",
      "POS 자동 연동은 준비 중",
    ],
  },
];

const STEPS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Upload,
    title: "매출 올리기",
    body: "POS 매출 파일을 올리고 메뉴별 레시피를 한 번만 등록하세요.",
  },
  {
    icon: Sparkles,
    title: "AI가 계산",
    body: "매일 밤 앞으로 3일 매출과 재료별 필요량을 계산합니다.",
  },
  {
    icon: ClipboardCheck,
    title: "확인하고 확정",
    body: "아침에 추천 수량을 보고, 고칠 건 고친 뒤 발주를 확정하세요.",
  },
];

const FAQS: Array<{ q: string; a: ReactNode }> = [
  {
    q: "앱스토어에서 받아야 하나요?",
    a: "아니요. 사주라는 웹앱(PWA)이라 인터넷 주소로 들어와 '홈 화면에 추가'만 하면 휴대폰에 앱 아이콘이 생깁니다. 안드로이드는 설치 버튼 한 번, 아이폰은 사파리의 공유 → 홈 화면에 추가로 설치합니다.",
  },
  {
    q: "어떤 POS를 쓰고 있어야 하나요?",
    a: "지금은 POS에서 내려받은 매출 파일(CSV)을 올리는 방식입니다. POS 자동 연동은 준비 중입니다.",
  },
  {
    q: "주문까지 자동으로 해 주나요?",
    a: "사주라는 '얼마나 시킬지'를 추천합니다. 추천 수량을 고치거나 빼는 것, 최종 확정은 사장님이 직접 합니다.",
  },
  {
    q: "아무나 가입할 수 있나요?",
    a: "회원가입 후 사업자 인증을 거쳐야 매장 화면을 쓸 수 있습니다. 매장 데이터는 본인 매장 계정에서만 볼 수 있습니다.",
  },
  {
    q: "예측은 얼마나 정확한가요?",
    a: "매장마다 다르고 매출 기록이 쌓일수록 좋아집니다. 판매 기록이 너무 적으면(10일 미만) 예측 대신 안내를 보여주고, 불확실한 날은 '신뢰도 낮음'으로 표시합니다.",
  },
];

export default function IntroPage() {
  const install = useStartInstall();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-white text-ink">
      {/* 상단 내비 */}
      <header className="pt-safe sticky top-0 z-40 border-b border-line-soft bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/intro" className="flex items-center gap-2" aria-label="사주라 소개">
            <img src="/icon-192.png" alt="" className="size-8 rounded-lg" />
            <span className="text-xl font-extrabold tracking-tight">사주라</span>
          </Link>
          <nav aria-label="소개 메뉴" className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-2 text-[0.95rem] font-semibold text-ink-2 hover:bg-subtle hover:text-ink"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/login"
              className="hidden h-10 items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink-2 hover:bg-subtle sm:inline-flex"
            >
              로그인
            </Link>
            <Link
              to="/register"
              className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-strong"
            >
              지금 시작하기
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="메뉴 열기"
              className="flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-subtle md:hidden"
            >
              <MenuIcon className="size-6" />
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav aria-label="소개 메뉴" className="border-t border-line-soft px-4 py-2 md:hidden">
            {[...NAV, { href: "/login", label: "로그인" }].map((n) =>
              n.href.startsWith("#") ? (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-semibold text-ink-2 active:bg-subtle"
                >
                  {n.label}
                </a>
              ) : (
                <Link
                  key={n.href}
                  to={n.href}
                  className="block rounded-lg px-3 py-3 text-base font-semibold text-ink-2 active:bg-subtle"
                >
                  {n.label}
                </Link>
              ),
            )}
          </nav>
        ) : null}
      </header>

      <main>
        {/* 히어로 */}
        <section className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-strong text-white">
          {/* 로그인 화면과 같은 사진 + 보라 그라데이션 덧씌우기 */}
          <img
            src={heroPhoto}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-strong/75 via-brand/35 to-brand/70" />
          <DecoIcons
            className="text-white/10"
            items={[
              [Beef, "top-10 right-[46%] size-16 rotate-12"],
              [Egg, "bottom-12 left-[38%] size-12 -rotate-12"],
              [Receipt, "top-1/3 left-[48%] size-14 rotate-6"],
            ]}
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-24">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur">
                <Sparkles className="size-4" /> 외식업 사장님을 위한 AI 발주 도우미
              </span>
              <h1 className="text-[2.1rem] leading-tight font-extrabold tracking-tight sm:text-5xl lg:text-[3.4rem]">
                내일 뭘 얼마나 시킬지,
                <br />
                <span className="text-accent">사주라가 먼저</span> 알려드려요
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-white/90">
                매출 기록으로 앞으로 3일 매출을 예측하고, 레시피와 재고를 계산해 재료별 발주량을
                추천합니다. 주문은 사장님이 보고 확정하세요.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-7 text-lg font-bold text-brand-strong shadow-pop hover:bg-brand-soft"
                >
                  지금 시작하기 <ArrowRight className="size-5" />
                </Link>
                {install.state.installed ? null : (
                  <button
                    type="button"
                    onClick={install.start}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-7 text-lg font-bold text-white backdrop-blur hover:bg-white/20"
                  >
                    <Smartphone className="size-5" /> 휴대폰에 앱 설치
                  </button>
                )}
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem] text-white/90">
                {[
                  "앱스토어 없이 바로 설치",
                  "POS 매출 파일로 시작",
                  "발주 확정은 사장님이 직접",
                ].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-accent" strokeWidth={3} /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* 사장님 고민 */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHead eyebrow="이런 고민 있으셨죠?" title="발주, 아직도 감으로 하고 계신가요?" />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PAINS.map((p, i) => (
              <div
                key={p.title}
                className="relative overflow-hidden rounded-2xl border border-line bg-subtle p-6"
              >
                <p.icon
                  aria-hidden
                  className="absolute -right-4 -bottom-4 size-28 text-brand opacity-[0.08]"
                  strokeWidth={1.5}
                />
                <p className="text-sm font-bold text-brand">0{i + 1}</p>
                <p className="mt-2 text-xl font-bold">{p.title}</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 기능 */}
        <section
          id="features"
          className="relative scroll-mt-20 overflow-hidden bg-canvas py-16 lg:py-24"
        >
          <DecoIcons
            className="text-brand/[0.07]"
            items={[
              [CookingPot, "top-8 right-6 size-40 rotate-12"],
              [Carrot, "top-1/2 -left-6 size-32 -rotate-12"],
              [Fish, "right-1/4 bottom-6 size-28 rotate-6"],
              [Beer, "top-24 left-1/3 size-20 -rotate-6"],
            ]}
          />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead
              eyebrow="주요 기능"
              title="예측부터 발주까지 한 화면에서"
              description="복잡한 표 대신, 오늘 해야 할 일과 숫자만 크게 보여드립니다."
            />
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <article
                    key={f.title}
                    className="rounded-3xl border border-line bg-white p-7 shadow-card"
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                      <Icon className="size-6" />
                    </span>
                    <h3 className="mt-5 text-2xl font-bold">{f.title}</h3>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{f.body}</p>
                    <ul className="mt-5 space-y-2">
                      {f.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-2 text-[0.95rem] text-ink">
                          <Check className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={2.5} />
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* 이용 방법 */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <SectionHead eyebrow="이용 방법" title="세 단계면 끝나요" />
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.title}
                  className="relative rounded-3xl border border-line bg-white p-7 shadow-card"
                >
                  <span className="text-sm font-bold text-brand">STEP {i + 1}</span>
                  <span className="mt-3 flex size-12 items-center justify-center rounded-2xl bg-brand text-white">
                    <Icon className="size-6" />
                  </span>
                  <p className="mt-4 text-xl font-bold">{s.title}</p>
                  <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">{s.body}</p>
                </li>
              );
            })}
          </ol>
          <div className="mt-8 flex items-start gap-3 rounded-2xl bg-brand-soft p-5 text-[0.95rem] leading-relaxed text-ink-2">
            <ShieldCheck className="mt-0.5 size-6 shrink-0 text-brand" />
            <p>
              <strong className="text-ink">결정은 사장님이 합니다.</strong> 사주라는 발주를 부추기지
              않고 필요한 만큼만 제안합니다. 재고가 넉넉하면 추천 수량은 0개로 나옵니다.
            </p>
          </div>
        </section>

        {/* 앱 설치 */}
        <section
          id="app"
          className="relative scroll-mt-20 overflow-hidden bg-ink py-16 text-white lg:py-24"
        >
          <img
            src={heroPhoto}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-10"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-brand-strong/60" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div className="space-y-6">
              <p className="text-sm font-bold text-brand-tint">앱 설치</p>
              <h2 className="text-3xl leading-tight font-extrabold tracking-tight lg:text-4xl">
                앱스토어 없이,
                <br />
                휴대폰 홈 화면에 바로
              </h2>
              <p className="text-lg leading-relaxed text-white/80">
                사주라는 웹앱(PWA)입니다. 한 번 설치하면 앱 아이콘을 눌러 바로 열리고, 화면 아래 큰
                글씨 메뉴로 홈·매출 예측·재고·발주를 오갈 수 있어요.
              </p>
              {install.state.installed ? (
                <p className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-4 text-base font-semibold">
                  <Check className="size-5" /> 이미 이 기기에 설치되어 있어요
                </p>
              ) : (
                <button
                  type="button"
                  onClick={install.start}
                  className="inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-7 text-lg font-bold text-ink hover:bg-brand-soft"
                >
                  <Smartphone className="size-5" />
                  {install.state.canPrompt ? "지금 앱 설치하기" : "설치 방법 보기"}
                </button>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <InstallHow
                  title="안드로이드 · PC 크롬"
                  steps={["위 버튼을 누르세요", "'설치'를 누르면 끝"]}
                />
                <InstallHow
                  title="아이폰 · 아이패드"
                  steps={["사파리로 이 페이지 열기", "공유 → '홈 화면에 추가'"]}
                />
              </div>
            </div>
            <PhonePreview />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
          <SectionHead eyebrow="자주 묻는 질문" title="궁금한 점이 있으신가요?" />
          <div className="mt-10 divide-y divide-line rounded-3xl border border-line">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 마지막 CTA */}
        <section className="px-4 pb-16 sm:px-6 lg:pb-24">
          <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-strong p-8 text-white sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <img
              src={heroPhoto}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-brand-strong/70 to-brand/40" />
            <div className="relative">
              <p className="text-2xl font-extrabold sm:text-3xl">
                오늘 매출 파일 하나로 시작해 보세요
              </p>
              <p className="mt-2 text-lg text-white/80">
                가입하고 사업자 인증을 마치면 바로 쓸 수 있어요.
              </p>
            </div>
            <div className="relative flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                to="/register"
                className="inline-flex h-14 items-center justify-center rounded-2xl bg-white px-7 text-lg font-bold text-brand-strong hover:bg-brand-soft"
              >
                지금 시작하기
              </Link>
              <Link
                to="/login"
                className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/40 px-7 text-lg font-bold text-white hover:bg-white/10"
              >
                로그인
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-subtle">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm text-ink-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="" className="size-7 rounded-md" />
            <span className="font-bold text-ink-2">사주라</span>
            <span>· 홍익대학교 소프트웨어융합전공 캡스톤디자인 1조</span>
          </div>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-ink">
              로그인
            </Link>
            <Link to="/register" className="hover:text-ink">
              회원가입
            </Link>
          </div>
        </div>
      </footer>

      {install.guideOpen && (
        <InstallGuideSheet ios={install.state.ios} onClose={install.closeGuide} />
      )}
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm font-bold text-brand">{eyebrow}</p>
      <h2 className="text-3xl leading-tight font-extrabold tracking-tight lg:text-4xl">{title}</h2>
      {description ? <p className="text-lg text-ink-2">{description}</p> : null}
    </div>
  );
}

function InstallHow({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
      <p className="font-bold">{title}</p>
      <ol className="mt-2 space-y-1 text-[0.95rem] text-white/75">
        {steps.map((s, i) => (
          <li key={s}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 히어로 오른쪽 — 웹 대시보드 축소 미리보기(예시 화면, 실제 데이터 아님). */
function HeroPreview() {
  const bars = [42, 55, 38, 64, 88, 96, 35];
  return (
    <div className="relative" aria-label="사주라 화면 예시" role="img">
      <div className="rounded-3xl border border-line bg-white p-5 shadow-pop">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-ink">앞으로 3일 예상 매출</p>
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
            AI
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["내일", "91만원", true],
            ["모레", "64만원", false],
            ["사흘 뒤", "58만원", false],
          ].map(([d, v, on]) => (
            <div
              key={String(d)}
              className={cn(
                "rounded-2xl border p-3",
                on ? "border-brand bg-brand-soft" : "border-line",
              )}
            >
              <p className="flex items-center gap-1 text-xs text-ink-3">
                <CalendarDays className="size-3.5" /> {d}
              </p>
              <p className="mt-1 text-lg font-extrabold text-ink">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex h-28 items-end gap-2 rounded-2xl bg-subtle px-3 pt-3 pb-2">
          {bars.map((h, i) => (
            <div
              key={`${h}-${i.toString()}`}
              className={cn("flex-1 rounded-t-md", i >= 4 && i <= 5 ? "bg-brand" : "bg-brand-tint")}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {[
            ["삼겹살", "6.5kg 추천"],
            ["맥주", "24병 추천"],
            ["대파", "충분해요 · 0단"],
          ].map(([n, v]) => (
            <div
              key={n}
              className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-ink">
                <span className="flex size-5 items-center justify-center rounded-md bg-brand text-white">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {n}
              </span>
              <span className="text-sm font-semibold text-brand">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-white/70">
        * 화면 예시입니다. 숫자는 실제 매장 데이터가 아닙니다.
      </p>
    </div>
  );
}

/** 앱 설치 섹션 — 휴대폰 화면 예시(하단 탭 포함). */
function PhonePreview() {
  const tabs: Array<[LucideIcon, string, boolean]> = [
    [Home, "홈", true],
    [TrendingUp, "매출 예측", false],
    [Boxes, "재고", false],
    [ClipboardList, "발주", false],
    [MenuIcon, "더보기", false],
  ];
  return (
    <div className="mx-auto w-full max-w-[300px]" role="img" aria-label="사주라 앱 화면 예시">
      <div className="rounded-[2.5rem] bg-white/10 p-3 ring-1 ring-white/15">
        <div className="overflow-hidden rounded-[2rem] bg-canvas text-ink">
          <div className="bg-white px-5 pt-6 pb-3">
            <p className="text-xs text-ink-3">김사장님, 안녕하세요</p>
            <p className="text-lg font-extrabold">우리 가게</p>
          </div>
          <div className="space-y-3 p-4">
            <div className="rounded-2xl bg-brand p-4 text-white">
              <p className="text-xs text-white/80">오늘 할 일</p>
              <p className="mt-0.5 font-bold">발주가 필요한 재료가 3개 있어요</p>
              <p className="mt-3 rounded-xl bg-white py-2 text-center text-sm font-bold text-brand-strong">
                발주하러 가기
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["오늘 매출", "84만원"],
                ["판매건수", "37건"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-2xl border border-line bg-white p-3">
                  <p className="text-xs text-ink-3">{l}</p>
                  <p className="mt-1 text-lg font-extrabold">{v}</p>
                </div>
              ))}
            </div>
            <div className="h-16 rounded-2xl border border-line bg-white" />
          </div>
          <div className="grid grid-cols-5 border-t border-line bg-white py-2">
            {tabs.map(([Icon, label, on]) => (
              <div
                key={label}
                className={cn(
                  "flex flex-col items-center gap-0.5 text-[10px] font-bold",
                  on ? "text-brand" : "text-ink-3",
                )}
              >
                <Icon className="size-5" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 배경 장식 — 흐릿한 식재료·주방 아이콘. 스크린리더에는 숨긴다. */
function DecoIcons({
  items,
  className,
}: { items: Array<[LucideIcon, string]>; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {items.map(([Icon, pos]) => (
        <Icon key={pos} className={cn("absolute", pos)} strokeWidth={1.25} />
      ))}
    </div>
  );
}
