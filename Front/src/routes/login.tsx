import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { authErrorMessage, fetchMe, loginWithEmail, oauthLoginUrl } from "../api/endpoints/auth";
import eyeIcon from "../assets/login/eye-icon.svg";
import googleG1 from "../assets/login/google-g-1.svg";
import googleG2 from "../assets/login/google-g-2.svg";
import googleG3 from "../assets/login/google-g-3.svg";
import googleG4 from "../assets/login/google-g-4.svg";
import kakaoIcon from "../assets/login/kakao-icon.svg";
import { LOGIN_SKY, LOGIN_SKY_STEPS, goDashboard, useSky } from "../components/sky";
import { clearWithdrawnNotice, hasWithdrawnNotice } from "../features/auth/withdrawn-notice";
import { type LoginValues, loginSchema } from "../schemas/auth";
import { useAuthStore } from "../stores/auth-store";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isOauthWithdrawn = searchParams.get("error") === "withdrawn";
  // 방금 탈퇴했으면 한 번만 안내한다 — 읽은 뒤 지워 다음 방문에는 뜨지 않게
  const [justWithdrawn] = useState(hasWithdrawnNotice);
  useEffect(() => {
    if (justWithdrawn) clearWithdrawnNotice();
  }, [justWithdrawn]);
  const isWithdrawn = justWithdrawn || isOauthWithdrawn;
  // 소셜 가입 대기 토큰(30분)이 만료돼 회원가입 화면에서 돌려보냄 (04_fe.md §4.1)
  const isSignupExpired = searchParams.get("error") === "signup_expired";

  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  const [hasAuthError, setHasAuthError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const activeSkyStep = isWithdrawn ? "withdrawn" : "default";
  useSky(LOGIN_SKY, LOGIN_SKY_STEPS, activeSkyStep);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });
  // 입력 검증 오류 — 칸 아래가 아니라 부제 자리에 첫 번째 것만 보인다
  const fieldError = errors.email?.message ?? errors.password?.message;

  const mutation = useMutation({
    mutationFn: async (values: LoginValues) => {
      const tokens = await loginWithEmail(values.email, values.password);
      setAccessToken(tokens.access_token);
      const me = await fetchMe();
      setUser(me);
      return me;
    },
    onSuccess: async (me) => {
      await goDashboard(me, navigate);
    },
    onError: async (error) => {
      setHasAuthError(true);
      await authErrorMessage(error, "로그인에 실패했습니다.");
    },
  });

  const onSubmit = (values: LoginValues) => {
    setHasAuthError(false);
    mutation.mutate(values);
  };

  const goKakao = () => window.location.assign(oauthLoginUrl("kakao"));
  const goGoogle = () => window.location.assign(oauthLoginUrl("google"));

  return (
    <main className="sky-titles min-h-dvh px-5 pt-[8vh] pb-10 text-center text-white">
      <section className="mx-auto w-full max-w-[400px]">
        <p className="text-[2rem] leading-none font-extrabold tracking-tight text-[#b3a4ff]">
          Sajura
        </p>
        <h1
          aria-label="Sajura 어서 오세요, 사장님"
          className="mt-4 text-[1.75rem] font-extrabold tracking-tight"
        >
          어서 오세요, 사장님
        </h1>

        {/* 알림·오류는 부제 자리에 대신 보여 높이를 그대로 둔다 */}
        {fieldError ? (
          <p className="mt-2 text-base font-semibold text-[#ffd6d6]" role="alert">
            {fieldError}
          </p>
        ) : hasAuthError ? (
          <p className="mt-2 text-base font-semibold text-[#ffd6d6]" role="alert">
            이메일 또는 비밀번호가 올바르지 않아요.
          </p>
        ) : isSignupExpired ? (
          <p className="mt-2 text-base font-semibold text-[#ffd6d6]" role="alert">
            가입 시간이 지났어요. 소셜 로그인부터 다시 해 주세요.
          </p>
        ) : isWithdrawn ? (
          // biome-ignore lint/a11y/useSemanticElements: mockup requirement
          <p className="mt-2 text-base font-semibold text-white" role="status">
            탈퇴가 접수되었어요. 30일 뒤 삭제돼요.
            <span className="sr-only">
              {isOauthWithdrawn ? "탈퇴 처리된 계정입니다." : "탈퇴가 접수되었습니다."}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-base text-white/75">
            로그인하고 오늘 밤부터 사주라에게 맡겨 보세요.
          </p>
        )}

        <form className="mt-7 space-y-3 text-left" onSubmit={handleSubmit(onSubmit)} noValidate>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-label="이메일"
            placeholder="이메일"
            className="h-[52px] w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 text-base text-white placeholder:text-white/70 backdrop-blur-md focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
            {...register("email")}
          />
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-label="비밀번호"
              placeholder="비밀번호"
              className="h-[52px] w-full rounded-xl border border-white/15 bg-[#0d0a26]/45 px-4 pr-12 text-base text-white placeholder:text-white/70 backdrop-blur-md focus:border-[#b3a4ff] focus:ring-4 focus:ring-[#b3a4ff]/25 focus:outline-none"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            >
              <img src={eyeIcon} alt="" className="h-4 w-[22px] brightness-0 invert opacity-75" />
            </button>
          </div>
          <label className="flex items-center gap-2.5 pt-1 text-sm text-white/90">
            <input
              type="checkbox"
              defaultChecked
              className="size-[18px] rounded accent-[#b3a4ff]"
            />
            다음에도 기억하기
          </label>

          <button
            type="submit"
            disabled={mutation.isPending}
            aria-label="로그인하기"
            className="!mt-6 inline-flex h-[52px] w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-bold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
          >
            {mutation.isPending ? "로그인 중…" : "로그인"}
          </button>
        </form>

        <p className="mt-6">
          <span className="inline-flex items-center gap-4 text-[0.95rem] text-white">
            <Link to="/register" className="font-bold hover:underline">
              회원가입
            </Link>
            <span className="h-3.5 w-px bg-white/40" aria-hidden="true" />
            <span className="cursor-default">비밀번호 재설정</span>
          </span>
        </p>

        <div className="mt-7 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/25" />
          <span className="text-sm text-white">간편 로그인</span>
          <span className="h-px flex-1 bg-white/25" />
        </div>

        {/* 간편 로그인 — 둥근 아이콘 버튼 */}
        <div className="mt-4 flex justify-center gap-4">
          <button
            type="button"
            onClick={goKakao}
            data-provider="kakao"
            aria-label="카카오로 시작하기 (카카오 로그인)"
            className="flex size-[52px] items-center justify-center rounded-full bg-[#ffdf20] transition-colors hover:bg-[#f5d500]"
          >
            <img src={kakaoIcon} alt="" className="h-[22px] w-[24px]" />
          </button>
          <button
            type="button"
            onClick={goGoogle}
            data-provider="google"
            aria-label="구글로 시작하기 (구글 로그인)"
            className="flex size-[52px] items-center justify-center rounded-full bg-white transition-colors hover:bg-subtle"
          >
            <span className="relative size-6">
              <img src={googleG1} alt="" className="absolute inset-0 size-full" />
              <img src={googleG2} alt="" className="absolute inset-0 size-full" />
              <img src={googleG3} alt="" className="absolute inset-0 size-full" />
              <img src={googleG4} alt="" className="absolute inset-0 size-full" />
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}
