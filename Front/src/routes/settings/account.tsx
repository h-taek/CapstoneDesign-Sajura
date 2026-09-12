// 계정 정보 — 실제 GET/PATCH /api/auth/me + /api/store + PATCH /api/auth/password로 연결.
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { changePassword, updateMe } from "../../api/endpoints/auth";
import { getStore, patchStore } from "../../api/endpoints/store";
import { DashboardShell } from "../../components/dashboard/shell";
import { Button } from "../../components/ui/button";
import { FormField, Input } from "../../components/ui/field";
import { useAuthStore } from "../../stores/auth-store";

const profileSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요.").max(50),
  store_name: z.string().min(1, "매장명을 입력하세요.").max(100),
});
type ProfileValues = z.infer<typeof profileSchema>;

const storeSchema = z.object({
  business_type: z.string().max(50).optional(),
  address: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
});
type StoreValues = z.infer<typeof storeSchema>;

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

export default function AccountSettingsPage() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  const { data: store } = useQuery({ queryKey: ["store"], queryFn: getStore });

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? "", store_name: user?.store_name ?? "" },
  });
  const profileMutation = useMutation({
    mutationFn: (v: ProfileValues) => updateMe(v),
    onSuccess: (updated) => setUser(updated),
  });

  const storeForm = useForm<StoreValues>({
    resolver: zodResolver(storeSchema),
    values: {
      business_type: store?.business_type ?? "",
      address: store?.address ?? "",
      phone: store?.phone ?? "",
    },
  });
  const storeMutation = useMutation({
    mutationFn: (v: StoreValues) => patchStore(v),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store"] }),
  });

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
    },
    onError: () => setPwError("비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인하세요."),
  });

  return (
    <DashboardShell active="settings">
      <div className="max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#101828]">계정 정보</h1>
          <p className="text-sm text-[#99a1af]">{user?.email}</p>
        </header>

        <form
          onSubmit={profileForm.handleSubmit((v) => profileMutation.mutate(v))}
          className="space-y-4 rounded-xl border border-[#d1d5dc] bg-white p-6"
        >
          <h2 className="text-lg font-semibold text-[#101828]">내 정보</h2>
          <FormField label="이름" htmlFor="name" error={profileForm.formState.errors.name?.message}>
            <Input
              id="name"
              className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
              {...profileForm.register("name")}
            />
          </FormField>
          <FormField
            label="매장명"
            htmlFor="store_name"
            error={profileForm.formState.errors.store_name?.message}
          >
            <Input
              id="store_name"
              className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
              {...profileForm.register("store_name")}
            />
          </FormField>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={profileMutation.isPending}
              className="h-10 rounded-full bg-[#7a5eff] px-6 font-semibold hover:bg-[#6a4eef]"
            >
              {profileMutation.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
          {profileMutation.isSuccess && <p className="text-sm text-emerald-600">저장되었습니다.</p>}
        </form>

        <form
          onSubmit={storeForm.handleSubmit((v) => storeMutation.mutate(v))}
          className="space-y-4 rounded-xl border border-[#d1d5dc] bg-white p-6"
        >
          <h2 className="text-lg font-semibold text-[#101828]">매장 정보</h2>
          <FormField label="업종" htmlFor="business_type">
            <Input
              id="business_type"
              className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
              {...storeForm.register("business_type")}
            />
          </FormField>
          <FormField label="주소" htmlFor="address">
            <Input
              id="address"
              className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
              {...storeForm.register("address")}
            />
          </FormField>
          <FormField label="전화번호" htmlFor="phone">
            <Input
              id="phone"
              className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
              {...storeForm.register("phone")}
            />
          </FormField>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={storeMutation.isPending}
              className="h-10 rounded-full bg-[#7a5eff] px-6 font-semibold hover:bg-[#6a4eef]"
            >
              {storeMutation.isPending ? "저장 중…" : "저장"}
            </Button>
          </div>
          {storeMutation.isSuccess && <p className="text-sm text-emerald-600">저장되었습니다.</p>}
        </form>

        <form
          onSubmit={passwordForm.handleSubmit((v) => passwordMutation.mutate(v))}
          className="space-y-4 rounded-xl border border-[#d1d5dc] bg-white p-6"
        >
          <h2 className="text-lg font-semibold text-[#101828]">비밀번호 변경</h2>
          <FormField
            label="현재 비밀번호"
            htmlFor="current_password"
            error={passwordForm.formState.errors.current_password?.message}
          >
            <Input
              id="current_password"
              type="password"
              autoComplete="current-password"
              className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
              {...passwordForm.register("current_password")}
            />
          </FormField>
          <FormField
            label="새 비밀번호"
            htmlFor="new_password"
            error={passwordForm.formState.errors.new_password?.message}
          >
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
              {...passwordForm.register("new_password")}
            />
          </FormField>
          <FormField
            label="새 비밀번호 확인"
            htmlFor="new_password_confirm"
            error={passwordForm.formState.errors.new_password_confirm?.message}
          >
            <Input
              id="new_password_confirm"
              type="password"
              autoComplete="new-password"
              className="h-11 rounded-xl border-[#d1d5dc] bg-[#f3f4f6]"
              {...passwordForm.register("new_password_confirm")}
            />
          </FormField>
          {pwError && (
            <p className="text-sm text-red-600" role="alert">
              {pwError}
            </p>
          )}
          {pwSuccess && <p className="text-sm text-emerald-600">비밀번호가 변경되었습니다.</p>}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={passwordMutation.isPending}
              className="h-10 rounded-full bg-[#7a5eff] px-6 font-semibold hover:bg-[#6a4eef]"
            >
              {passwordMutation.isPending ? "변경 중…" : "비밀번호 변경"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
