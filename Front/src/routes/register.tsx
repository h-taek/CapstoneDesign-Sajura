import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { authErrorMessage, register as registerApi } from "../api/endpoints/auth";
import { REGISTER_SKY, REGISTER_SKY_STEPS, useSky } from "../components/sky";

type Step = "terms" | "email" | "name" | "password";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("terms");
  const [errorType, setErrorType] = useState<string | null>(null);

  // 약관 상태
  const [tAge, setTAge] = useState(false);
  const [tService, setTService] = useState(false);
  const [tPrivacy, setTPrivacy] = useState(false);
  const [tNotice, setTNotice] = useState(false);

  // 폼 입력값
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

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
          : errorType === "password"
            ? "pw-error"
            : "password";

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
    setStep("email");
  };

  const handleNextFromEmail = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || password !== passwordConfirm) {
      setErrorType("password");
      return;
    }

    setIsSubmitting(true);
    setErrorType(null);
    try {
      await registerApi({ email: email.trim(), password, name: name.trim() });
      navigate("/login", { replace: true, state: { registeredEmail: email.trim() } });
    } catch (err) {
      const msg = await authErrorMessage(err, "회원가입에 실패했습니다.");
      if (msg.includes("이메일") || msg.includes("email") || msg.includes("이미")) {
        setStep("email");
        setErrorType("email");
      } else {
        setErrorType("password");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndex = step === "terms" ? 1 : step === "email" ? 2 : step === "name" ? 3 : 4;

  return (
    <>
      <p className="fixed top-6 left-6 z-10 text-[1.75rem] leading-none font-extrabold tracking-tight text-[#b3a4ff] sm:top-8 sm:left-10">
        Sajura
      </p>

      <main className="sky-titles min-h-dvh px-5 pt-[13vh] pb-10 text-center text-white">
        <section className="mx-auto w-full max-w-[400px]">
          {/* 진행 막대 4칸 */}
          <div className="-my-3 flex justify-center gap-2" aria-label={`${stepIndex} / 4 단계`}>
            {/* 1단계 약관 */}
            {stepIndex > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setStep("terms");
                  setErrorType(null);
                }}
                aria-label="1단계 약관로 돌아가기"
                className="cursor-pointer py-3 hover:opacity-80"
              >
                <span className="block h-1 w-9 rounded-full bg-white/20" />
              </button>
            ) : (
              <span className="py-3" aria-current="step">
                <span className="block h-1 w-9 rounded-full bg-[#b3a4ff]" />
              </span>
            )}

            {/* 2단계 이메일 */}
            {stepIndex > 2 ? (
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setErrorType(null);
                }}
                aria-label="2단계 이메일로 돌아가기"
                className="cursor-pointer py-3 hover:opacity-80"
              >
                <span className="block h-1 w-9 rounded-full bg-white/20" />
              </button>
            ) : stepIndex === 2 ? (
              <span className="py-3" aria-current="step">
                <span className="block h-1 w-9 rounded-full bg-[#b3a4ff]" />
              </span>
            ) : (
              <span className="py-3">
                <span className="block h-1 w-9 rounded-full bg-white/20" />
              </span>
            )}

            {/* 3단계 이름 */}
            {stepIndex > 3 ? (
              <button
                type="button"
                onClick={() => {
                  setStep("name");
                  setErrorType(null);
                }}
                aria-label="3단계 이름로 돌아가기"
                className="cursor-pointer py-3 hover:opacity-80"
              >
                <span className="block h-1 w-9 rounded-full bg-white/20" />
              </button>
            ) : stepIndex === 3 ? (
              <span className="py-3" aria-current="step">
                <span className="block h-1 w-9 rounded-full bg-[#b3a4ff]" />
              </span>
            ) : (
              <span className="py-3">
                <span className="block h-1 w-9 rounded-full bg-white/20" />
              </span>
            )}

            {/* 4단계 비밀번호 */}
            {stepIndex === 4 ? (
              <span className="py-3" aria-current="step">
                <span className="block h-1 w-9 rounded-full bg-[#b3a4ff]" />
              </span>
            ) : (
              <span className="py-3">
                <span className="block h-1 w-9 rounded-full bg-white/20" />
              </span>
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
                  <label className="flex items-start gap-3 py-2.5">
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
                    <ChevronRight className="size-5 shrink-0 text-white/70" />
                  </label>
                  <label className="flex items-start gap-3 py-2.5">
                    <input
                      type="checkbox"
                      id="t-privacy-a"
                      checked={tPrivacy}
                      onChange={(e) => setTPrivacy(e.target.checked)}
                      className="mt-0.5 size-5 shrink-0 rounded accent-[#b3a4ff]"
                    />
                    <span className="flex-1 text-[0.95rem] text-white/90">
                      <b className="font-semibold text-[#b3a4ff]">[필수]</b> 개인정보 수집·이용 동의
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-white/70" />
                  </label>
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
              <form className="mt-8 space-y-3 text-left" noValidate onSubmit={handleRegister}>
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
    </>
  );
}
