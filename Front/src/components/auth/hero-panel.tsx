// 인증 화면 공용 좌측 히어로 패널 — Figma "로그인&기존회원"(node 53:1127) 스타일.
import type { ReactNode } from "react";
import heroPhoto from "../../assets/auth/hero-photo.png";

export function AuthHeroPanel({
  heading,
  subtext,
}: {
  heading: string;
  subtext: ReactNode;
}) {
  return (
    <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand to-brand-strong lg:block">
      <img
        src={heroPhoto}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-brand/70" />
      <p className="relative px-16 pt-14 text-5xl font-semibold text-white">Sajura</p>
      <div className="absolute bottom-24 left-16 right-16 space-y-6">
        <h2 className="text-5xl font-semibold leading-tight text-white">{heading}</h2>
        <p className="text-2xl text-white/90">{subtext}</p>
      </div>
    </section>
  );
}
