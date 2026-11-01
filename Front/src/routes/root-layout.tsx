// 루트 레이아웃 — 라우트 바깥에 '사장님의 하루' 하늘 배경을 한 번만 두고 화면을 넘겨도 유지한다.
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { SkyBackdrop } from "../components/sky/sky-backdrop";
import { applySkyMode, defaultSkyForPath, hasActiveSkyHook } from "../components/sky/use-sky";

export default function RootLayout() {
  const location = useLocation();
  const navState = location.state as { registeredEmail?: string } | null;
  const registered = Boolean(navState?.registeredEmail);

  useEffect(() => {
    if (hasActiveSkyHook()) return;
    return applySkyMode(defaultSkyForPath(location.pathname, registered));
  }, [location.pathname, registered]);

  return (
    <>
      <SkyBackdrop />
      <Outlet />
    </>
  );
}
