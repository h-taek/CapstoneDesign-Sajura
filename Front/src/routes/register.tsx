// M3.F8 — 자체 회원가입 화면 (07_api_spec.md §2 POST /api/auth/register).
// Figma "인증 및 회원 등록"(node 4:323)은 저해상도 와이어프레임이라 로그인 화면과 같은 톤으로 재해석.
// 휴대폰 SMS 본인인증 UI는 백엔드 미구현이라 제외 — 실제 지원되는 이메일/비밀번호/이름만 구현.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { authErrorMessage, register as registerApi } from "../api/endpoints/auth";
import { AuthHeroPanel } from "../components/auth/hero-panel";
import { Button } from "../components/ui/button";
import { FormField, Input } from "../components/ui/field";
import { type RegisterValues, registerSchema } from "../schemas/auth";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", password_confirm: "", name: "" },
    mode: "onBlur",
  });

  const mutation = useMutation({
    mutationFn: (values: RegisterValues) =>
      registerApi({ email: values.email, password: values.password, name: values.name }),
    onSuccess: (_data, values) => {
      navigate("/login", { replace: true, state: { registeredEmail: values.email } });
    },
    onError: async (error) => {
      setFormError(await authErrorMessage(error, "회원가입에 실패했습니다. 다시 시도해주세요."));
    },
  });

  const onSubmit = (values: RegisterValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-[1fr_minmax(480px,820px)]">
      <AuthHeroPanel
        heading="내 가게를 쉽게 관리하다"
        subtext={
          <>
            사주라는 소상공인을 위한 자동화 가게 재고 정리 서비스입니다.
            <br />
            지금 바로 계정을 만들고 시작해보세요
          </>
        }
      />

      <section className="flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-[688px] space-y-8">
          <header className="space-y-2">
            <h1 className="text-4xl font-semibold text-[#101828] lg:text-5xl">계정 생성</h1>
            <p className="text-xl font-medium text-[#364153] lg:text-2xl">
              사주라 사장님 계정을 만들어보아요
            </p>
          </header>

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

            <FormField label="이름" htmlFor="name" error={errors.name?.message}>
              <Input
                id="name"
                autoComplete="name"
                placeholder="이름을 입력해 주세요."
                className="h-[58px] rounded-xl border-[#d1d5dc] bg-[#f3f4f6] px-4 text-base"
                {...register("name")}
              />
            </FormField>

            <FormField
              label="Password"
              htmlFor="password"
              error={errors.password?.message}
              hint="8자 이상"
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호를 입력해 주세요."
                className="h-[58px] rounded-xl border-[#d1d5dc] bg-[#f3f4f6] px-4 text-base"
                {...register("password")}
              />
            </FormField>

            <FormField
              label="PW 재입력"
              htmlFor="password_confirm"
              error={errors.password_confirm?.message}
            >
              <Input
                id="password_confirm"
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호를 다시 입력해 주세요."
                className="h-[58px] rounded-xl border-[#d1d5dc] bg-[#f3f4f6] px-4 text-base"
                {...register("password_confirm")}
              />
            </FormField>

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
              {mutation.isPending ? "가입 중…" : "계정 생성"}
            </Button>
          </form>

          <p className="text-center text-base text-[#99a1af]">
            이미 계정이 있으신가요?{" "}
            <Link to="/login" className="font-medium text-[#364153] hover:underline">
              여기서 로그인 하세요
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
