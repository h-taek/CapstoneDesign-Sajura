// 사장님의 하루(bd-day) 하늘·별·달·해·동네 실루엣 React 부품.
import { useEffect } from "react";
import { DAY, drawDay } from "./day";
import { markBackdropMounted } from "./use-sky";
import "./sky.css";

interface StarItem {
  id: number;
  cx: string;
  cy: string;
  r: string;
  opacity: string;
}

// 별은 화면이 바뀌어도 같은 자리에 뜨게 고정 씨앗(seed = 7)으로 뿌린다.
const STARS: readonly StarItem[] = (() => {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const list: StarItem[] = [];
  for (let i = 0; i < 140; i++) {
    list.push({
      id: i,
      cx: `${(rnd() * 100).toFixed(2)}%`,
      cy: `${(rnd() * 70).toFixed(2)}%`,
      r: (rnd() * 1.3 + 0.3).toFixed(2),
      opacity: (rnd() * 0.6 + 0.4).toFixed(2),
    });
  }
  return list;
})();

export function dayBackdrop(calm = false): string {
  const stars = STARS.map(
    (s) => `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="#fff" opacity="${s.opacity}"/>`,
  ).join("");
  const calmAttr = calm ? " data-calm" : "";
  return `<div class="bd bd-day"${calmAttr} aria-hidden="true">
    <i class="d-sky"></i>
    <svg class="d-stars">${stars}</svg>
    <i class="d-veil"></i>
    <i class="d-moon"></i>
    <i class="d-sun"></i>
    <svg class="d-town" viewBox="0 0 1440 190" preserveAspectRatio="xMidYMax slice">
      <g class="d-fill">
        <path d="M0 190V112h70V84h54v28h40V60h86v130zM250 190V96l46-30 46 30v94zM342 190V120h78V74h64v116z"/>
        <path d="M484 190V130h60V100h46v90z"/>
        <path d="M760 190V56h96v134zM856 190V108h58l30-24 30 24h40v82z"/>
        <path d="M1014 190V92h120v98zM1134 190V124h70V70h80v120zM1284 190V100h60V80h96v110z"/>
      </g>
      <g transform="translate(162 0)">
        <path class="d-fill" d="M484 190V88h170v102z"/>
        <path d="M478 92h182l-10 24H488z" fill="#6b4eff" opacity=".9"/>
        <path d="M498 92l-6 24M528 92l-4 24M558 92l-2 24M588 92v24M618 92l2 24M648 92l4 24" stroke="#fff" stroke-opacity=".35" stroke-width="10"/>
        <rect class="d-win" x="508" y="128" width="62" height="40" rx="4"/>
        <rect class="d-win" x="586" y="128" width="40" height="62" rx="3"/>
      </g>
    </svg>
  </div>`;
}

export function SkyBackdrop() {
  useEffect(() => {
    const cleanup = markBackdropMounted();
    drawDay(DAY.mf);
    return cleanup;
  }, []);

  return (
    <div className="bd bd-day" data-calm={DAY.calm ? "" : undefined} aria-hidden="true">
      <i className="d-sky" />
      <svg className="d-stars" aria-hidden="true">
        {STARS.map((s) => (
          <circle key={s.id} cx={s.cx} cy={s.cy} r={s.r} fill="#fff" opacity={s.opacity} />
        ))}
      </svg>
      <i className="d-veil" />
      <i className="d-moon" />
      <i className="d-sun" />
      <svg
        className="d-town"
        viewBox="0 0 1440 190"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <g className="d-fill">
          <path d="M0 190V112h70V84h54v28h40V60h86v130zM250 190V96l46-30 46 30v94zM342 190V120h78V74h64v116z" />
          <path d="M484 190V130h60V100h46v90z" />
          <path d="M760 190V56h96v134zM856 190V108h58l30-24 30 24h40v82z" />
          <path d="M1014 190V92h120v98zM1134 190V124h70V70h80v120zM1284 190V100h60V80h96v110z" />
        </g>
        <g transform="translate(162 0)">
          <path className="d-fill" d="M484 190V88h170v102z" />
          <path d="M478 92h182l-10 24H488z" fill="#6b4eff" opacity=".9" />
          <path
            d="M498 92l-6 24M528 92l-4 24M558 92l-2 24M588 92v24M618 92l2 24M648 92l4 24"
            stroke="#fff"
            strokeOpacity=".35"
            strokeWidth="10"
          />
          <rect className="d-win" x="508" y="128" width="62" height="40" rx="4" />
          <rect className="d-win" x="586" y="128" width="40" height="62" rx="3" />
        </g>
      </svg>
    </div>
  );
}

export const DayBackdrop = SkyBackdrop;
