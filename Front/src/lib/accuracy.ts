// 예측 정확도 — 1 − |예측 − 실제| ÷ 실제 (04_fe.md §4.3·§4.4). 홈·매출 예측이 같이 쓴다.
// 실제가 0 이하이거나 예측이 없으면 null. 크게 빗나가 0 아래면 0. 비율(1 = 100%)로 돌려주고 반올림은 표시하는 곳이 한다.
export function accuracyRatio(
  actual: number | null | undefined,
  predicted: number | null | undefined,
): number | null {
  if (actual == null || predicted == null || actual <= 0) return null;
  return Math.max(0, 1 - Math.abs(predicted - actual) / actual);
}
