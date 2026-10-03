// M3.F1 + M3.F8 — 로그인 화면 (OAuth 버튼 + 이메일/비밀번호 폼). Figma "로그인&기존회원"(node 53:1127) 적용.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { authErrorMessage, fetchMe, loginWithEmail, oauthLoginUrl } from "../api/endpoints/auth";
import eyeIcon from "../assets/login/eye-icon.svg";
import googleG1 from "../assets/login/google-g-1.svg";
import googleG2 from "../assets/login/google-g-2.svg";
import googleG3 from "../assets/login/google-g-3.svg";
import googleG4 from "../assets/login/google-g-4.svg";
import kakaoIcon from "../assets/login/kakao-icon.svg";
import { AuthHeroPanel } from "../components/auth/hero-panel";
import { Button } from "../components/ui/button";
import { FormField, Input } from "../components/ui/field";
import { type LoginValues, loginSchema } from "../schemas/auth";
import { useAuthStore } from "../stores/auth-store";
import { landingPath } from "./guards";

const WITHDRAWN_MESSAGE =
  "탈퇴 처리된 계정입니다. 탈퇴 후 30일이 지나면 같은 계정으로 다시 가입할 수 있습니다.";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { registeredEmail?: string; withdrawn?: boolean } | null;
  const registeredEmail = navState?.registeredEmail;
  // OAuth 콜백이 탈퇴 유예 계정을 /login?error=withdrawn으로 돌려보낸다 (07_api_spec.md §2)
  const [searchParams] = useSearchParams();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const [formError, setFormError] = useState<string | null>(
    searchParams.get("error") === "withdrawn" ? WITHDRAWN_MESSAGE : null,
  );
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: registeredEmail ?? "", password: "" },
    mode: "onBlur",
  });

  const mutation = useMutation({
    mutationFn: async (values: LoginValues) => {
      const tokens = await loginWithEmail(values.email, values.password);
      setAccessToken(tokens.access_token);
      const me = await fetchMe();
      setUser(me);
      return me;
    },
    onSuccess: (me) => {
      navigate(landingPath(me), { replace: true });
    },
    onError: async (error) => {
      setFormError(await authErrorMessage(error, "로그인에 실패했습니다."));
    },
  });

  const onSubmit = (values: LoginValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  const goKakao = () => window.location.assign(oauthLoginUrl("kakao"));
  const goGoogle = () => window.location.assign(oauthLoginUrl("google"));

  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-[1fr_minmax(480px,820px)]">
      <AuthHeroPanel
        heading="내 가게를 쉽게 관리하다"
        subtext={
          <>
            사주라는 소상공인을 위한 자동화 가게 재고 정리 서비스입니다.
            <br />
            어려웠던 재고관리 사주라로 쉽게 관리해보세요
          </>
        }
      />

      <section className="flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-[688px] space-y-8">
          <header className="space-y-2">
            <h1 className="text-4xl font-semibold text-[#101828] lg:text-5xl">Welcome,Sajura</h1>
            <p className="text-xl font-medium text-[#364153] lg:text-2xl">
              로그인을 하고 재고를 쉽게 관리해보아요
            </p>
          </header>

          {registeredEmail ? (
            <output className="block rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
              회원가입이 완료되었습니다. 로그인해주세요.
            </output>
          ) : null}
          {navState?.withdrawn ? (
            <output className="block rounded-md bg-[#f3f4f6] p-3 text-sm text-[#364153]">
              탈퇴가 접수되었습니다. 30일 뒤 매장 데이터를 포함한 모든 정보가 삭제됩니다.
            </output>
          ) : null}

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            <FormField label="ID" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="아이디를 입력해 주세요."
                className="h-[58px] rounded-xl border-[#d1d5dc] bg-[#f3f4f6] px-4 text-base"
                {...register("email")}
              />
            </FormField>

            <FormField label="Password" htmlFor="password" error={errors.password?.message}>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력해 주세요."
                  className="h-[58px] rounded-xl border-[#d1d5dc] bg-[#f3f4f6] px-4 pr-12 text-base"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#99a1af]"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
                >
                  <img src={eyeIcon} alt="" className="size-6" />
                </button>
              </div>
            </FormField>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-3 text-base text-[#99a1af]">
                <input type="checkbox" defaultChecked className="size-6 rounded accent-[#7a5eff]" />
                다음에도 기억하기
              </label>
              <span className="cursor-default text-base text-[#99a1af] underline">
                비밀번호를 잊으셨나요?
              </span>
            </div>

            {formError ? (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={mutation.isPending}
              className="h-[68px] w-full rounded-full bg-[#7a5eff] text-xl font-semibold hover:bg-[#6a4eef]"
            >
              {mutation.isPending ? "로그인 중…" : "로그인하기"}
            </Button>
          </form>

          <div className="flex items-center gap-4">
            <span className="h-px flex-1 bg-[#d1d5dc]" />
            <span className="text-lg text-[#364153]">or continue with</span>
            <span className="h-px flex-1 bg-[#d1d5dc]" />
          </div>

          <div className="space-y-4">
            <Button
              type="button"
              onClick={goGoogle}
              data-provider="google"
              className="h-[68px] w-full rounded-full border-2 border-[#d1d5dc] bg-[#f3f4f6] text-xl font-semibold text-[#364153] hover:bg-[#e5e7eb]"
            >
              <span className="relative size-8 shrink-0">
                <img src={googleG1} alt="" className="absolute inset-0 size-full" />
                <img src={googleG2} alt="" className="absolute inset-0 size-full" />
                <img src={googleG3} alt="" className="absolute inset-0 size-full" />
                <img src={googleG4} alt="" className="absolute inset-0 size-full" />
              </span>
              구글로 시작하기
            </Button>
            <Button
              type="button"
              onClick={goKakao}
              data-provider="kakao"
              className="h-[68px] w-full rounded-full bg-[#ffdf20] text-xl font-semibold text-[#364153] hover:bg-[#f5d500]"
            >
              <img src={kakaoIcon} alt="" className="h-[30px] w-[33px] shrink-0" />
              카카오로 시작하기
            </Button>
          </div>

          <p className="text-center text-base text-[#99a1af]">
            계정이 없으신가요?{" "}
            <Link to="/register" className="font-medium text-[#364153] hover:underline">
              여기서 회원가입 하세요
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
