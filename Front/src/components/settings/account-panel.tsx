// 내 계정 설정 판 — 이름 변경, 비밀번호 변경(LOCAL), 회원 탈퇴.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import {
  authErrorMessage,
  changePassword,
  deleteAccount,
  updateMe,
} from "../../api/endpoints/auth";
import { releaseDevicePush } from "../../features/auth/sign-out";
import { markWithdrawn } from "../../features/auth/withdrawn-notice";
import { clearLocalSession } from "../../lib/local-session";
import { useAuthStore } from "../../stores/auth-store";
import { FollowPanel } from "../shell/follow-panel";

const nameSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요.").max(50),
});
type NameValues = z.infer<typeof nameSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "현재 비밀번호를 입력하세요."),
    new_password: z.string().min(8, "8자 이상이어야 합니다.").max(128),
    new_password_confirm: z.string(),
  })
  .refine((v) => v.new_password === v.new_password_confirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["new_password_confirm"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

const PROVIDER_LABEL = {
  LOCAL: "이메일 로그인",
  KAKAO: "카카오 로그인",
  GOOGLE: "구글 로그인",
} as const;

export function AccountPanel({ onBack }: { onBack?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const isLocal = user?.auth_provider === "LOCAL";
  const providerText = user?.auth_provider ? PROVIDER_LABEL[user.auth_provider] : "이메일 로그인";

  // 이름 수정
  const [nameSaved, setNameSaved] = useState(false);
  const nameForm = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    values: { name: user?.name ?? "" },
  });
  const nameMutation = useMutation({
    mutationFn: (v: NameValues) => updateMe(v),
    onSuccess: (updated) => {
      setUser(updated);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    },
  });

  // 비밀번호 변경
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", new_password_confirm: "" },
  });
  const passwordMutation = useMutation({
    mutationFn: (v: PasswordValues) => changePassword(v.current_password, v.new_password),
    onSuccess: () => {
      setPwSuccess(true);
      setPwError(null);
      passwordForm.reset();
      setTimeout(() => setPwSuccess(false), 3000);
    },
    onError: () => setPwError("비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인하세요."),
  });

  // 회원 탈퇴
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [withdrawConfirmed, setWithdrawConfirmed] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const withdrawMutation = useMutation({
    mutationFn: () => deleteAccount(isLocal ? withdrawPassword : ""),
    onSuccess: async () => {
      // 탈퇴는 refresh 토큰만 폐기한다 — 아직 유효한 로그인 토큰으로 이 기기의 푸시 구독을 먼저 지운다
      await releaseDevicePush();
      markWithdrawn();
      clearLocalSession(queryClient);
      navigate("/login", { replace: true });
    },
    onError: async (error) =>
      setWithdrawError(await authErrorMessage(error, "탈퇴에 실패했습니다.")),
  });

  const canWithdraw =
    withdrawConfirmed && (!isLocal || withdrawPassword.length > 0) && !withdrawMutation.isPending;

  return (
    <FollowPanel
      title="내 계정"
      aria-label="내 계정"
      className="lg:col-span-3"
      {...(onBack ? { onClose: onBack } : {})}
    >
      <p className="mt-1 text-sm text-ink-2">
        {user?.email} · {providerText}
      </p>

      {/* 이름 변경 */}
      <form onSubmit={nameForm.handleSubmit((v) => nameMutation.mutate(v))} className="mt-5">
        <h3 className="text-sm font-bold text-ink">이름</h3>
        <div className="mt-3 flex items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-ink-2">
            <span className="sr-only">이름</span>
            <input
              type="text"
              {...nameForm.register("name")}
              className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={nameMutation.isPending}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/80 px-5 text-[0.95rem] font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-white/30 disabled:opacity-50"
          >
            {nameMutation.isPending ? "저장 중…" : "저장"}
          </button>
        </div>
        {nameForm.formState.errors.name && (
          <p className="mt-1 text-sm text-danger">{nameForm.formState.errors.name.message}</p>
        )}
        {nameSaved && (
          <output className="mt-2 block text-sm font-semibold text-ok">저장했어요</output>
        )}
      </form>

      {/* 비밀번호 변경 — LOCAL 가입자만 */}
      {isLocal && (
        <form
          onSubmit={passwordForm.handleSubmit((v) => passwordMutation.mutate(v))}
          className="mt-6 border-t border-white/70 pt-5"
        >
          <h3 className="text-sm font-bold text-ink">비밀번호 바꾸기</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-sm font-semibold text-ink-2">
              현재 비밀번호
              <input
                type="password"
                autoComplete="current-password"
                {...passwordForm.register("current_password")}
                className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
              새 비밀번호
              <input
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("new_password")}
                className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-ink-2">
              새 비밀번호 확인
              <input
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("new_password_confirm")}
                className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
              />
            </label>
          </div>
          {passwordForm.formState.errors.current_password && (
            <p className="mt-1 text-sm text-danger">
              {passwordForm.formState.errors.current_password.message}
            </p>
          )}
          {passwordForm.formState.errors.new_password && (
            <p className="mt-1 text-sm text-danger">
              {passwordForm.formState.errors.new_password.message}
            </p>
          )}
          {passwordForm.formState.errors.new_password_confirm && (
            <p className="mt-1 text-sm text-danger">
              {passwordForm.formState.errors.new_password_confirm.message}
            </p>
          )}
          {pwError && (
            <p role="alert" className="mt-1 text-sm font-semibold text-danger">
              {pwError}
            </p>
          )}
          {pwSuccess && (
            <output className="mt-2 block text-sm font-semibold text-ok">
              비밀번호를 변경했어요
            </output>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={passwordMutation.isPending}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/80 px-5 text-[0.95rem] font-semibold whitespace-nowrap text-ink-2 transition-colors hover:bg-white/30 disabled:opacity-50"
            >
              비밀번호 바꾸기
            </button>
          </div>
        </form>
      )}

      {/* 회원 탈퇴 */}
      <section className="mt-6 border-t border-white/70 pt-5">
        <h3 className="text-sm font-bold text-ink">회원 탈퇴</h3>
        <p className="mt-1 text-sm text-ink-2">
          탈퇴하면 바로 로그인할 수 없어요. 30일 뒤 매장의 모든 데이터와 사업자등록증이 지워지고,
          그때까지 같은 계정으로 다시 가입할 수 없어요.
        </p>

        {isLocal && (
          <label className="mt-3 flex flex-col gap-1 text-sm font-semibold text-ink-2">
            비밀번호 확인
            <input
              type="password"
              autoComplete="current-password"
              value={withdrawPassword}
              onChange={(e) => setWithdrawPassword(e.target.value)}
              className="h-11 w-full rounded-full border border-white/80 bg-[rgb(46_32_120/0.065)] px-4 text-base font-normal text-ink placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
            />
          </label>
        )}

        <label className="mt-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={withdrawConfirmed}
            onChange={(e) => setWithdrawConfirmed(e.target.checked)}
            className="size-4 accent-[var(--color-brand)]"
          />
          30일 뒤 모든 데이터가 지워지는 것을 확인했어요
        </label>

        {withdrawError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger">
            {withdrawError}
          </p>
        )}

        <button
          type="button"
          disabled={!canWithdraw}
          onClick={() => {
            setWithdrawError(null);
            withdrawMutation.mutate();
          }}
          className="mt-3 inline-flex h-10 items-center rounded-full bg-danger px-5 text-[0.95rem] font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:bg-ink-3/40"
        >
          회원 탈퇴
        </button>
      </section>
    </FollowPanel>
  );
}
