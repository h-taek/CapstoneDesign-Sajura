import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  authErrorCode,
  authErrorMessage,
  fetchMe,
  fetchSocialSignup,
  register as registerApi,
  registerSocial,
} from "../api/endpoints/auth";
import { BusinessFields } from "../components/auth/business-fields";
import { REGISTER_SKY, REGISTER_SKY_STEPS, goDashboard, useSky } from "../components/sky";
import { Button } from "../components/ui/button";
import { registerSchema } from "../schemas/auth";
import { useAuthStore } from "../stores/auth-store";

type Step = "terms" | "email" | "name" | "password" | "business";

// 회원가입 단계 (04_fe.md §4.1) — 마지막 사업자 인증을 통과해야 계정이 생기고 곧바로 로그인된다
const EMAIL_STEPS: Step[] = ["terms", "email", "name", "password", "business"];
const SOCIAL_STEPS: Step[] = ["terms", "business"];
const STEP_LABEL: Record<Step, string> = {
  terms: "약관",
  email: "이메일",
  name: "이름",
  password: "비밀번호",
  business: "사업자 인증",
};
const PROVIDER_LABEL = { GOOGLE: "구글", KAKAO: "카카오" } as const;
const SIGNUP_EXPIRED = "/login?error=signup_expired";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 처음 보는 소셜 계정 — BE 콜백이 가입 대기 토큰(Cookie)과 함께 보낸다 (03_be.md §7.1)
  const isSocial = searchParams.get("social") === "1";
  const steps = isSocial ? SOCIAL_STEPS : EMAIL_STEPS;
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>("terms");
  const [errorType, setErrorType] = useState<string | null>(null);

  const { data: social, error: socialError } = useQuery({
    queryKey: ["social-signup"],
    queryFn: fetchSocialSignup,
    enabled: isSocial,
    retry: false,
  });
  useEffect(() => {
    if (socialError) navigate(SIGNUP_EXPIRED, { replace: true });
  }, [socialError, navigate]);

  // 약관 상태
  const [tAge, setTAge] = useState(false);
  const [tService, setTService] = useState(false);
  const [tPrivacy, setTPrivacy] = useState(false);
  const [tNotice, setTNotice] = useState(false);
  const [termsDoc, setTermsDoc] = useState<string | null>(null);

  // 폼 입력값
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [businessNo, setBusinessNo] = useState("");
  const [cert, setCert] = useState<File | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 활성 하늘 단계 key
  const activeSkyStep =
    step === "terms"
      ? errorType === "terms"
        ? "terms-error"
        : "terms"
      : step === "email"
        ? errorType === "email"
          ? "email-error"
          : "email"
        : step === "name"
          ? "name"
          : step === "password"
            ? errorType === "password"
              ? "pw-error"
              : "password"
            : errorType === "business"
              ? "business-error"
              : "business";

  useSky(REGISTER_SKY, REGISTER_SKY_STEPS, activeSkyStep);

  const allAgreed = tAge && tService && tPrivacy && tNotice;
  const handleToggleAll = (checked: boolean) => {
    setTAge(checked);
    setTService(checked);
    setTPrivacy(checked);
    setTNotice(checked);
    if (checked && errorType === "terms") {
      setErrorType(null);
    }
  };

  const handleNextFromTerms = () => {
    if (!tAge || !tService || !tPrivacy) {
      setErrorType("terms");
      return;
    }
    setErrorType(null);
    setStep(steps[1] ?? "email");
  };

  const handleNextFromEmail = () => {
    const trimmed = email.trim();
    // 서버(EmailStr)가 마지막 가입 단계에서 거절할 주소는 여기서 막는다 — 가입 스키마와 같은 검사
    if (!registerSchema.innerType().shape.email.safeParse(trimmed).success) {
      setErrorType("email");
      return;
    }
    setErrorType(null);
    setStep("name");
  };

  const handleNextFromName = () => {
    if (!name.trim()) return;
    setErrorType(null);
    setStep("password");
  };

  const handleNextFromPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || password !== passwordConfirm) {
      setErrorType("password");
      return;
    }
    setErrorType(null);
    setStep("business");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorType(null);
    setBusinessError(null);
    try {
      const tokens = isSocial
        ? await registerSocial(businessNo, cert)
        : await registerApi({
            email: email.trim(),
            password,
            name: name.trim(),
            businessNo,
            cert,
          });
      // 가입 즉시 로그인 — 사업자 인증을 통과한 계정이라 곧장 온보딩으로 간다
      setAccessToken(tokens.access_token);
      const me = await fetchMe();
      setUser(me);
      await goDashboard(me, navigate);
    } catch (err) {
      const code = await authErrorCode(err);
      if (code === "AUTH_SIGNUP_TOKEN_INVALID") {
        navigate(SIGNUP_EXPIRED, { replace: true });
      } else if (code === "AUTH_EMAIL_DUPLICATE" || code === "AUTH_ACCOUNT_WITHDRAWN") {
        setStep("email");
        setErrorType("email");
      } else {
        setErrorType("business");
        setBusinessError(await authErrorMessage(err, "회원가입에 실패했습니다."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = steps.indexOf(step);

  return (
    <>
      <p className="fixed top-6 left-6 z-10 text-[1.75rem] leading-none font-extrabold tracking-tight text-[#b3a4ff] sm:top-8 sm:left-10">
        Sajura
      </p>

      <main className="sky-titles min-h-dvh px-5 pt-[13vh] pb-10 text-center text-white">
        <section className="mx-auto w-full max-w-[400px]">
          {/* 진행 막대 — 지나온 단계는 눌러서 돌아간다 */}
          <div
            className="-my-3 flex justify-center gap-2"
            aria-label={`${stepIndex + 1} / ${steps.length} 단계`}
          >
            {steps.map((s, i) =>
              i < stepIndex ? (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStep(s);
                    setErrorType(null);
                  }}
                  aria-label={`${i + 1}단계 ${STEP_LABEL[s]}로 돌아가기`}
                  className="cursor-pointer py-3 hover:opacity-80"
                >
                  <span className="block h-1 w-9 rounded-full bg-white/20" />
                </button>
              ) : (
                <span key={s} className="py-3" aria-current={i === stepIndex ? "step" : undefined}>
                  <span
                    className={`block h-1 w-9 rounded-full ${i === stepIndex ? "bg-[#b3a4ff]" : "bg-white/20"}`}
                  />
                </span>
              ),
            )}
          </div>

          {/* 1단계: 약관 */}
          {step === "terms" && (
            <div>
              <h1 className="mt-9 text-[1.75rem] font-extrabold tracking-tight">
                이용약관 및 정책
              </h1>
              {errorType === "terms" ? (
                <p className="mt-2 text-base font-semibold text-[#ffd6d6]" role="alert">
                  필수 약관에 모두 동의해 주세요
                </p>
              ) : social ? (
                <p className="mt-2 text-base break-all text-white/75">
                  {PROVIDER_LABEL[social.provider]} 계정 {social.email}로 가입해요
                </p>
              ) : (
                <p className="mt-2 text-base text-white/75">사주라 서비스 약관을 확인해 주세요</p>
              )}
              <form
                className="mt-8 space-y-3 text-left"
                noValidate
                onSubmit={(e) => e.preventDefault()}
              >
                <label className="flex items-center gap-3 border-b border-white/20 pb-4 text-base font-bold text-white">
                  <input
                    type="checkbox"
                    id="t-all-a"
                    checked={allAgreed}
                    onChange={(e) => handleToggleAll(e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 rounded accent-[#b3a4ff] !mt-0"
                  />
                  모두 동의합니다
                </label>
                <div className="pt-2.5">
                  <label className="flex items-start gap-3 py-2.5">
                    <input
                      type="checkbox"
                      id="t-age-a"
                      checked={tAge}
                      onChange={(e) => setTAge(e.target.checked)}
                      className="mt-0.5 size-5 shrink-0 rounded accent-[#b3a4ff]"
                    />
                    <span className="flex-1 text-[0.95rem] text-white/90">
                      <b className="font-semibold text-[#b3a4ff]">[필수]</b> 만 14세 이상입니다
                    </span>
                  </label>
                  <div className="flex items-start gap-3 py-2.5">
                    <label className="flex flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        id="t-service-a"
                        checked={tService}
                        onChange={(e) => setTService(e.target.checked)}
                        className="mt-0.5 size-5 shrink-0 rounded accent-[#b3a4ff]"
                      />
                      <span className="flex-1 text-[0.95rem] text-white/90">
                        <b className="font-semibold text-[#b3a4ff]">[필수]</b> 이용약관 동의
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-label="이용약관 보기"
                      onClick={() => setTermsDoc("이용약관")}
                      className="-m-2 shrink-0 rounded-full p-2 text-white/70 hover:bg-white/10"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </div>
                  <div className="flex items-start gap-3 py-2.5">
                    <label className="flex flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        id="t-privacy-a"
                        checked={tPrivacy}
                        onChange={(e) => setTPrivacy(e.target.checked)}
                        className="mt-0.5 size-5 shrink-0 rounded accent-[#b3a4ff]"
                      />
                      <span className="flex-1 text-[0.95rem] text-white/90">
                        <b className="font-semibold text-[#b3a4ff]">[필수]</b> 개인정보 수집·이용
                        동의
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-label="개인정보 수집·이용 보기"
                      onClick={() => setTermsDoc("개인정보 수집·이용")}
                      className="-m-2 shrink-0 rounded-full p-2 text-white/70 hover:bg-white/10"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </div>
                  <label className="flex items-start gap-3 py-2.5">
                    <input
                      type="checkbox"
                      id="t-notice-a"
                      checked={tNotice}
                      onChange={(e) => setTNotice(e.target.checked)}
                      className="mt-0.5 size-5 shrink-0 rounded accent-[#b3a4ff]"
                    />
                    <span className="flex-1 text-[0.95rem] text-white/90">
                      <b className="font-semibold text-white/75">[선택]</b> 이벤트·혜택 알림 수신
                      <span className="mt-1 block text-sm leading-relaxed text-white/90">
                        새 기능과 이벤트 소식을 알림으로 받아요.
                      </span>
                    </span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleNextFromTerms}
                  className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong"
                >
                  계속
                </button>
              </form>
            </div>
          )}

          {/* 2단계: 이메일 */}
          {step === "email" && (
            <div>
              <h1 className="mt-9 text-[1.75rem] font-extrabold tracking-tight">반가워요!</h1>
              <p className="mt-2 text-base text-white/75">이메일 주소를 입력해 주세요</p>
              <form
                className="mt-8 space-y-3 text-left"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNextFromEmail();
                }}
              >
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-label="이메일"
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-[52px] w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
                />
                {errorType === "email" && (
                  <p className="px-1 text-sm text-[#ffd6d6]" role="alert">
                    이미 가입된 이메일이거나 올바르지 않은 형식입니다.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleNextFromEmail}
                  className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong"
                >
                  계속
                </button>
              </form>
            </div>
          )}

          {/* 3단계: 이름 */}
          {step === "name" && (
            <div>
              <h1 className="mt-9 text-[1.75rem] font-extrabold tracking-tight">
                이름을 알려 주세요
              </h1>
              <p className="mt-2 text-base text-white/75">사장님 이름을 입력해 주세요</p>
              <form
                className="mt-8 space-y-3 text-left"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  handleNextFromName();
                }}
              >
                <input
                  id="name"
                  autoComplete="name"
                  aria-label="이름"
                  placeholder="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-[52px] w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleNextFromName}
                  className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong"
                >
                  계속
                </button>
              </form>
            </div>
          )}

          {/* 4단계: 비밀번호 */}
          {step === "password" && (
            <div>
              <h1 className="mt-9 text-[1.75rem] font-extrabold tracking-tight">
                비밀번호를 만들어 주세요
              </h1>
              <p className="mt-2 text-base text-white/75">8자 이상으로 입력해 주세요</p>
              <form
                className="mt-8 space-y-3 text-left"
                noValidate
                onSubmit={handleNextFromPassword}
              >
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  aria-label="비밀번호"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-[52px] w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
                />
                <input
                  id="password_confirm"
                  type="password"
                  autoComplete="new-password"
                  aria-label="비밀번호 확인"
                  placeholder="비밀번호 확인"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="h-[52px] w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
                />
                {errorType === "password" && (
                  <p className="px-1 text-sm text-[#ffd6d6]" role="alert">
                    비밀번호가 일치하지 않거나 8자 미만입니다.
                  </p>
                )}
                <button
                  type="submit"
                  className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong"
                >
                  계속
                </button>
              </form>
            </div>
          )}

          {/* 마지막 단계: 사업자 인증 — 통과하면 계정 생성 + 로그인 */}
          {step === "business" && (
            <div>
              <h1 className="mt-9 text-[1.75rem] font-extrabold tracking-tight">
                매장 인증을 해 주세요
              </h1>
              {businessError ? (
                <p className="mt-2 text-base font-semibold text-[#ffd6d6]" role="alert">
                  {businessError}
                </p>
              ) : (
                <p className="mt-2 text-base text-white/75">
                  사업자등록번호와 등록증을 올리면 가입이 끝나요
                </p>
              )}
              <form className="mt-8 space-y-3 text-left" noValidate onSubmit={handleRegister}>
                <BusinessFields
                  businessNo={businessNo}
                  onBusinessNoChange={setBusinessNo}
                  cert={cert}
                  onCertChange={setCert}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
                >
                  {isSubmitting ? "가입 중…" : "가입하기"}
                </button>
              </form>
            </div>
          )}
        </section>
      </main>
      {termsDoc && <TermsDialog title={termsDoc} onClose={() => setTermsDoc(null)} />}
    </>
  );
}

// 약관 보기 — 본문이 정해지기 전이라 준비 중 안내만 띄운다. showModal이 포커스 가두기·Esc 닫기를 맡는다
function TermsDialog({ title, onClose }: { title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="terms-dialog-title"
      className="m-auto w-[calc(100%-2.5rem)] max-w-sm rounded-3xl border-0 p-6 text-left glass-strong backdrop:bg-ink/40"
    >
      <h2 id="terms-dialog-title" className="text-lg font-bold text-ink">
        {title}
      </h2>
      <p className="mt-2 text-[0.95rem] text-ink-2">약관 본문을 준비하고 있어요.</p>
      <Button size="lg" className="mt-6 w-full" onClick={() => ref.current?.close()}>
        닫기
      </Button>
    </dialog>
  );
}
