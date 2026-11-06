import { ArrowRight, Check, ChevronDown, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { InstallGuideSheet } from "../components/pwa/install-banner";
import { goShop, useSky } from "../components/sky";
import { promptInstall, useInstallState } from "../lib/pwa-install";

export default function IntroPage() {
  const navigate = useNavigate();
  useSky("scroll");

  const installState = useInstallState();
  const [guideType, setGuideType] = useState<"android" | "ios" | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > window.innerHeight * 0.3);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll(".reveal");
    if (elements.length === 0) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      for (const el of elements) {
        el.classList.add("in");
      }
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
          }
        }
      },
      { threshold: 0.2 },
    );

    for (const el of elements) {
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    await goShop("/login", navigate);
  };

  const handleInstallClick = async () => {
    if (installState.canPrompt) {
      await promptInstall();
      return;
    }
    setGuideType(installState.ios ? "ios" : "android");
  };

  return (
    <>
      <style>{`
        .day-header { color: var(--sky-fg); pointer-events: none; }
        .hd-top { color: var(--sky-fg); }
        .hd-pill { transition: opacity .5s ease, transform .5s cubic-bezier(.2,.7,.2,1); }
        .hd-pill { background: var(--sky-pill); border: 1px solid rgb(255 255 255 / .22);
          backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
          box-shadow: 0 10px 30px -12px rgb(20 10 70 / .35), inset 0 1px 0 rgb(255 255 255 / .25);
          opacity: 0; transform: translate(-50%, -8px) scale(.94); }
        /* 알약 상자는 터치를 받지 않고 안의 링크·버튼만 받는다 — 상자가 받으면 아이폰 사파리가 상태 표시줄 자리를 단색 띠로 덮는다 */
        .day-header.scrolled .hd-pill a,
        .day-header.scrolled .hd-pill button { pointer-events: auto; }
        .day-header.scrolled .hd-pill { opacity: 1; transform: translate(-50%, 0); }

        .scene { position: relative; min-height: 115vh; display: grid; align-items: center; padding: 120px 6vw 22vh; }
        .scene[data-tone="dark"] { color: #fff; --sub: rgb(255 255 255 / .74); }
        .scene[data-tone="light"] { color: var(--color-ink); --sub: var(--color-ink-2); }
        .scene-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6vw; align-items: center; max-width: 1180px; width: 100%; margin: 0 auto; }
        .time { display: inline-flex; align-items: baseline; gap: 10px; margin-bottom: 18px; font-weight: 600; color: var(--sub); }
        .time b { font-size: 2.6rem; font-weight: 300; letter-spacing: -.02em; color: currentColor; font-variant-numeric: tabular-nums; }
        .scene h1, .scene h2 { font-weight: 800; letter-spacing: -.035em; line-height: 1.18; }
        .scene h1 { font-size: clamp(2.4rem, 5.6vw, 4.6rem); }
        .scene h2 { font-size: clamp(2rem, 3.6vw, 3rem); }
        .lead { margin-top: 20px; max-width: 30em; font-size: 1.12rem; line-height: 1.7; color: var(--sub); }
        .hint { margin-top: 64px; font-size: .85rem; color: var(--sub); }
        .hint::after { content: ""; display: block; width: 1px; height: 44px; margin: 12px auto 0;
          background: linear-gradient(currentColor, transparent); animation: drop 2s ease-in-out infinite; }
        @keyframes drop { 0% { transform: scaleY(0); transform-origin: top; } 50% { transform: scaleY(1); transform-origin: top; }
          51% { transform-origin: bottom; } 100% { transform: scaleY(0); transform-origin: bottom; } }

        .shot { justify-self: center; width: min(100%, 440px); padding: 22px; border-radius: 28px; color: var(--color-ink);
          background: rgb(255 255 255 / .74); border: 1px solid rgb(255 255 255 / .6);
          backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%);
          box-shadow: 0 30px 80px -20px rgb(20 10 70 / .45), inset 0 1px 0 rgb(255 255 255 / .8); }
        .phone { justify-self: center; width: 290px; height: 520px; border-radius: 46px; padding: 14px; background: rgb(20 14 60 / .35);
          border: 1px solid rgb(255 255 255 / .35); box-shadow: 0 30px 80px -20px rgb(40 20 80 / .5); position: relative; overflow: hidden; }
        .phone .shot { position: absolute; left: 12px; right: 12px; bottom: 120px; width: auto; padding: 16px; border-radius: 22px; }

        .reveal { opacity: 0; transform: translateY(28px); transition: opacity .9s ease, transform .9s cubic-bezier(.2,.7,.2,1); }
        .reveal.in { opacity: 1; transform: none; }
        .reveal.d1 { transition-delay: .12s; } .reveal.d2 { transition-delay: .24s; }
        @media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } .hint::after { animation: none; } }

        @media (max-width: 860px) {
          .scene { min-height: auto; padding: 120px 20px 26vh; }
          .scene.first { min-height: 100svh; }
          .scene-grid { grid-template-columns: 1fr; gap: 40px; }
          .time b { font-size: 2rem; }
          .lead { font-size: 1.02rem; }
        }
      `}</style>

      <header
        id="hd"
        className={`day-header pt-safe fixed inset-x-0 top-0 z-40 ${isScrolled ? "scrolled" : ""}`}
      >
        <div className="hd-pill fixed top-[calc(env(safe-area-inset-top)+12px)] left-1/2 flex h-13 items-center gap-3 rounded-full pr-1.5 pl-1.5">
          <Link
            to="/intro"
            aria-label="사주라 소개"
            className="flex size-10 items-center justify-center rounded-full bg-brand text-sm font-black text-white"
          >
            사
          </Link>
          <p className="flex items-baseline gap-2 text-sm font-semibold whitespace-nowrap text-[var(--sky-fg2)]">
            사주라의 하루
            <b
              data-sky-clock
              className="text-lg font-bold tracking-wide text-[var(--sky-fg)] tabular"
            >
              21:30
            </b>
          </p>
          <a
            href="/login"
            onClick={handleStart}
            data-go-shop
            className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold whitespace-nowrap text-white hover:bg-brand-strong"
          >
            시작하기
          </a>
        </div>
      </header>

      <main>
        {/* 로고 줄은 본문과 함께 스크롤된다 — 고정 헤더에 두면 아이폰 사파리가 상태 표시줄 자리를 단색 띠로 덮는다 */}
        <div className="hd-top absolute inset-x-0 top-[env(safe-area-inset-top)] z-10 flex h-20 items-center gap-4 px-5 sm:px-8">
          <Link to="/intro" className="flex items-center gap-2" aria-label="사주라 소개">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-sm font-black text-white">
              사
            </span>
            <span className="text-xl font-extrabold tracking-tight">사주라</span>
          </Link>
        </div>
        {/* 21:30 마감 — 첫 화면 */}
        <section className="scene first" data-tone="dark" data-min="1290">
          <div className="text-center">
            <div className="time reveal">
              <b>21:30</b>마감
            </div>
            <h1 className="reveal d1">
              사장님이 퇴근하면
              <br />
              사주라가 출근해요
            </h1>
            <p className="lead reveal d2 mx-auto">
              밤사이 매출을 계산해서, 아침이면 오늘 시킬 재료를 알려 드려요. 주문은 사장님이 보고
              확정하세요.
            </p>
            <div className="reveal d2 mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="/login"
                onClick={handleStart}
                data-go-shop
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-7 text-lg font-bold text-white hover:bg-brand-strong"
              >
                지금 시작하기 <ArrowRight className="size-5" />
              </a>
            </div>
            <p className="hint">스크롤해서 사주라의 하루 보기</p>
          </div>
        </section>

        {/* 22:40 매출 올리기 */}
        <section className="scene" data-tone="dark" data-min="1360">
          <div className="scene-grid">
            <div>
              <div className="time reveal">
                <b>22:40</b>매출 올리기
              </div>
              <h2 className="reveal d1">
                문 닫기 전에
                <br />
                매출 파일 하나만
              </h2>
              <p className="lead reveal d2">
                POS에서 내려받은 매출 파일을 올리면 메뉴와 맞춰 저장해요. 같은 영수증은 두 번
                저장하지 않아요.
              </p>
            </div>
            <div className="shot reveal d1">
              <p className="flex items-center justify-between text-[0.95rem] font-bold">
                매출 파일 올리기{" "}
                <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
                  완료
                </span>
              </p>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/70 p-3.5">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#e8f7ee] text-xs font-extrabold text-[#16a34a]">
                  CSV
                </span>
                <div className="flex-1">
                  <p className="text-[0.92rem] font-bold">포스매출_1030.csv</p>
                  <p className="text-xs text-ink-3">영수증 248건 · 1.2MB</p>
                  <div className="mt-2 h-1.5 rounded-full bg-brand" />
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-ink-2">
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-brand" />새 영수증 248건 저장
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-brand" />
                  겹친 영수증 12건은 건너뜀
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 shrink-0 text-brand" />새 메뉴 2개 발견 — 등록할지 골라
                  주세요
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 02:00 AI 계산 */}
        <section className="scene" data-tone="dark" data-min="1560">
          <div className="scene-grid">
            <div>
              <div className="time reveal">
                <b>02:00</b>AI 계산
              </div>
              <h2 className="reveal d1">
                모두 잠든 사이
                <br />
                앞으로 3일을 계산해요
              </h2>
              <p className="lead reveal d2">
                지난 매출에 요일과 날씨를 함께 보고 내일·모레·사흘 뒤 매출을 미리 계산해요. 왜
                그렇게 봤는지 한 문장으로 남겨요.
              </p>
            </div>
            <div className="shot reveal d1">
              <p className="flex items-center justify-between text-[0.95rem] font-bold">
                앞으로 3일 예상 매출{" "}
                <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">
                  AI
                </span>
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/70 p-3 ring-2 ring-brand">
                  <p className="text-xs text-ink-3">내일(금)</p>
                  <p className="text-lg font-extrabold tabular">91만원</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-3">
                  <p className="text-xs text-ink-3">모레(토)</p>
                  <p className="text-lg font-extrabold tabular">64만원</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-3">
                  <p className="text-xs text-ink-3">사흘 뒤(일)</p>
                  <p className="text-lg font-extrabold tabular">58만원</p>
                </div>
              </div>
              <div className="mt-3 flex h-28 items-end gap-2 rounded-2xl bg-white/55 p-3">
                <i className="h-[38%] flex-1 rounded-md bg-brand-tint" />
                <i className="h-[46%] flex-1 rounded-md bg-brand-tint" />
                <i className="h-[34%] flex-1 rounded-md bg-brand-tint" />
                <i className="h-[52%] flex-1 rounded-md bg-brand-tint" />
                <i className="h-[88%] flex-1 rounded-md bg-brand" />
                <i className="h-[62%] flex-1 rounded-md bg-brand" />
                <i className="h-[56%] flex-1 rounded-md bg-brand" />
              </div>
              <p className="mt-3 rounded-2xl bg-brand-soft px-3.5 py-3 text-sm leading-relaxed text-ink-2">
                금요일이고 저녁에 비 소식이 있어 지난 금요일보다 12% 높게 봤어요.
              </p>
            </div>
          </div>
        </section>

        {/* 07:30 아침 알림 */}
        <section className="scene" data-tone="dark" data-min="1890">
          <div className="scene-grid">
            <div>
              <div className="time reveal">
                <b>07:30</b>아침 알림
              </div>
              <h2 className="reveal d1">
                눈 뜨면
                <br />할 일이 정리돼 있어요
              </h2>
              <p className="lead reveal d2">
                예상 매출에 메뉴별 레시피와 지금 재고를 곱해서, 재료별로 몇 개 시킬지 알림으로
                보내요.
              </p>
            </div>
            <div className="phone reveal d1" role="img" aria-label="휴대폰 잠금 화면의 사주라 알림">
              <div className="pt-14 text-center text-white">
                <p className="text-sm text-white/85">11월 1일 금요일</p>
                <p className="text-[4.2rem] leading-tight font-light tracking-tight">7:30</p>
              </div>
              <div className="shot">
                <p className="flex items-center gap-2 text-xs text-ink-3">
                  <span className="flex size-5.5 items-center justify-center rounded-md bg-brand text-[0.6rem] font-black text-white">
                    사
                  </span>
                  사주라<span className="ml-auto">지금</span>
                </p>
                <p className="mt-2 text-[0.95rem] font-bold">오늘 발주할 재료가 3개 있어요</p>
                <p className="mt-1 text-sm text-ink-2">삼겹살 6.5kg · 맥주 24병 · 깻잎 2kg</p>
              </div>
            </div>
          </div>
        </section>

        {/* 10:00 발주 확정 */}
        <section className="scene" data-tone="light" data-min="2040">
          <div className="scene-grid">
            <div>
              <div className="time reveal">
                <b>10:00</b>발주 확정
              </div>
              <h2 className="reveal d1">
                보고, 고치고,
                <br />
                확정은 사장님이
              </h2>
              <p className="lead reveal d2">
                추천 수량은 제안일 뿐이에요. 고칠 건 고친 뒤 확정하세요. 재고가 넉넉한 재료는 0으로
                나와요.
              </p>
            </div>
            <div className="shot reveal d1">
              <p className="flex items-center justify-between text-[0.95rem] font-bold">
                오늘 발주 <span className="text-xs font-medium text-ink-3">11월 1일</span>
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-3 rounded-2xl bg-white/70 px-3.5 py-3">
                  <span className="flex size-5 items-center justify-center rounded-md bg-brand text-white">
                    <Check className="size-3.5" />
                  </span>
                  <b>삼겹살</b>
                  <span className="ml-auto flex items-center gap-1.5 font-bold tabular">
                    <span className="flex size-6.5 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      −
                    </span>
                    6.5kg
                    <span className="flex size-6.5 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      +
                    </span>
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-2xl bg-white/70 px-3.5 py-3">
                  <span className="flex size-5 items-center justify-center rounded-md bg-brand text-white">
                    <Check className="size-3.5" />
                  </span>
                  <b>맥주</b>
                  <span className="ml-auto flex items-center gap-1.5 font-bold tabular">
                    <span className="flex size-6.5 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      −
                    </span>
                    24병
                    <span className="flex size-6.5 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      +
                    </span>
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-2xl bg-white/70 px-3.5 py-3">
                  <span className="flex size-5 items-center justify-center rounded-md bg-brand text-white">
                    <Check className="size-3.5" />
                  </span>
                  <b>깻잎</b>
                  <span className="ml-auto flex items-center gap-1.5 font-bold tabular">
                    <span className="flex size-6.5 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      −
                    </span>
                    2kg
                    <span className="flex size-6.5 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      +
                    </span>
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-2xl bg-white/70 px-3.5 py-3 opacity-60">
                  <span className="size-5 rounded-md border-2 border-ink-4" />
                  <b>대파</b>
                  <span className="ml-auto text-sm text-ink-3">충분해요 · 0단</span>
                </li>
              </ul>
              <p className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-ink font-bold text-white">
                3개 발주 확정
              </p>
            </div>
          </div>
        </section>

        {/* 14:00 앱 설치 */}
        <section id="app" className="scene" data-tone="light" data-min="2280">
          <div className="scene-grid">
            <div>
              <div className="time reveal">
                <b>14:00</b>어디서든
              </div>
              <h2 className="reveal d1">
                앱스토어 없이
                <br />
                휴대폰 홈 화면에 바로
              </h2>
              <p className="lead reveal d2">
                사주라는 웹앱(PWA)이에요. 한 번 설치하면 앱 아이콘으로 바로 열리고, 화면 아래 큰
                글씨 메뉴로 홈·매출 예측·재고·발주를 오가요.
              </p>
            </div>
            <div className="shot reveal d1">
              <p className="text-[0.95rem] font-bold">홈 화면에 추가</p>
              {installState.installed ? (
                <p className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3.5 font-semibold text-brand-strong">
                  <Check className="size-5" />
                  이미 이 기기에 설치되어 있어요
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="mt-4 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-white hover:bg-brand-strong"
                >
                  <Smartphone className="size-5" />
                  {installState.canPrompt ? "지금 앱 설치하기" : "설치 방법 보기"}
                </button>
              )}
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-white/70 p-3.5">
                  <p className="font-bold">안드로이드 · PC 크롬</p>
                  <ol className="mt-1.5 space-y-0.5 text-ink-2">
                    <li>1. 위 버튼을 누르세요</li>
                    <li>2. '설치'를 누르면 끝</li>
                  </ol>
                </div>
                <div className="rounded-2xl bg-white/70 p-3.5">
                  <p className="font-bold">아이폰 · 아이패드</p>
                  <ol className="mt-1.5 space-y-0.5 text-ink-2">
                    <li>1. 사파리로 이 페이지 열기</li>
                    <li>2. 공유 → '홈 화면에 추가'</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 19:00 다시 저녁 — 시작 버튼과 FAQ */}
        <section id="faq" className="scene !min-h-0 !pb-[26vh]" data-tone="light" data-min="2580">
          <div className="mx-auto w-full max-w-3xl">
            <div className="text-center">
              <div className="time reveal">
                <b>19:00</b>다시 저녁
              </div>
              <h2 className="reveal d1">
                오늘 밤부터
                <br />
                사주라에게 맡겨 보세요
              </h2>
              <p className="lead reveal d2 mx-auto">
                가입하고 사업자 인증을 마치면 오늘 매출 파일로 바로 시작할 수 있어요.
              </p>
              <div className="reveal d2 mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href="/login"
                  onClick={handleStart}
                  data-go-shop
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-7 text-lg font-bold text-white hover:bg-brand-strong"
                >
                  지금 시작하기 <ArrowRight className="size-5" />
                </a>
              </div>
            </div>
            <h3 className="mt-20 text-sm font-bold text-ink-2">자주 묻는 질문</h3>
            <div className="mt-3 divide-y divide-line rounded-3xl glass-strong">
              <details className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                  앱스토어에서 받아야 하나요?
                  <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">
                  아니요. 사주라는 웹앱(PWA)이라 인터넷 주소로 들어와 '홈 화면에 추가'만 하면
                  휴대폰에 앱 아이콘이 생깁니다. 안드로이드는 설치 버튼 한 번, 아이폰은 사파리의
                  공유 → 홈 화면에 추가로 설치합니다.
                </p>
              </details>
              <details className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                  어떤 POS를 쓰고 있어야 하나요?
                  <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">
                  지금은 POS에서 내려받은 매출 파일(CSV)을 올리는 방식입니다. POS 자동 연동은 준비
                  중입니다.
                </p>
              </details>
              <details className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                  주문까지 자동으로 해 주나요?
                  <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">
                  사주라는 '얼마나 시킬지'를 추천합니다. 추천 수량을 고치거나 빼는 것, 최종 확정은
                  사장님이 직접 합니다.
                </p>
              </details>
              <details className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                  아무나 가입할 수 있나요?
                  <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">
                  회원가입 후 사업자 인증을 거쳐야 매장 화면을 쓸 수 있습니다. 매장 데이터는 본인
                  매장 계정에서만 볼 수 있습니다.
                </p>
              </details>
              <details className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold">
                  예측은 얼마나 정확한가요?
                  <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">
                  매장마다 다르고 매출 기록이 쌓일수록 좋아집니다. 판매 기록이 너무 적으면(10일
                  미만) 예측 대신 안내를 보여주고, 불확실한 날은 '신뢰도 낮음'으로 표시합니다.
                </p>
              </details>
            </div>
            <p className="mt-16 text-center text-sm text-ink-2">
              사주라 · 홍익대학교 소프트웨어융합전공 캡스톤디자인 1조
            </p>
          </div>
        </section>
      </main>

      {guideType !== null && (
        <InstallGuideSheet ios={guideType === "ios"} onClose={() => setGuideType(null)} />
      )}
    </>
  );
}
