# 공용 쿠팡 상품 가격 검증 조사

> 대상: 여러 매장의 확장이 보내는 정가로 공용 쿠팡 상품(`01_basic_design.md` §3.3.1)을 갱신할 때, 잘못 읽힌 값을 걸러내는 방법. 조사일 2026-10-28.

---

## 1. 사례

| 사례 | 관찰 |
|---|---|
| Open Food Facts Open Prices | 저장 전 형식 검증(잘못된 값은 400). 상품별 중앙값보다 크게 높거나 낮은 가격에 `WRONG_PRICE_VALUE` 플래그를 매일 배치로 단다. 플래그는 사용자도 달 수 있고 모더레이터가 수정·삭제한다. 공개 문서에 임계값은 없다. 2026-02 기준 가격 약 15만 건, 기여자 약 2,300명 |
| GasBuddy류 주유 가격 | 공식 알고리즘 문서는 없다. 2012년 보도에 1~2일 지난 보고는 시스템에서 지운다는 설명이 있다. 'Crowdsensus' 특허는 합의값·정확도·신뢰도 엔진으로 나누고, 주유소 업주가 손님을 끌려고 일부러 낮은 가격을 올리는 경우를 동기로 든다 |
| 나이지리아 모바일 식품 가격 수집 (Arbia et al., Scientific Data 2023) | 자원봉사자가 앱으로 보낸 일별 가격을 시장·기간 단위로 실시간 검증하는 3단계 이상값 탐지를 거친 뒤, 위치 기준으로 주간 가중치를 다시 매긴다 |

## 2. 기법

| 기법 | 동작 | 성질 |
|---|---|---|
| 고정 기준 비율 임계값 | 저장값 대비 차이가 비율 X 이상이면 거부 | 계산이 단순하다. 기준이 저장값이라 실제 가격이 한 번에 X 넘게 바뀌면 이후 값이 모두 거부되어 저장값이 갱신되지 않는다. 조금씩 바뀌는 변화는 따라간다 |
| Hampel 식별자 (중앙값 ± h × 1.4826 × MAD) | 최근 값들의 중앙값과 MAD로 범위를 정하고 벗어나면 이상값. h = 3이 흔하다 | 소수의 튀는 값이 기준을 끌어당기지 못한다. 값이 여러 개 쌓여야 동작한다. 지속적인 수준 변화는 연속 이상값으로 보인다 |
| 보류 후 확인 | 벗어난 값을 바로 버리지 않고 보류한다. 다음 값이 같은 쪽으로 오면 받아들이고, 오지 않으면 버린다 | 단발성 오류와 실제 변화를 나눈다. 확인 횟수 N과 기간은 정해진 값이 없다 |
| 기준선 제외와 재설정 | 이상값은 기준선 계산에서 빼고, 이상값이 N번 연속이면 수준이 바뀐 것으로 보고 기준선을 새로 잡는다 | 수준 변화를 따라간다. 같은 출처가 연속으로 틀린 값을 보내면 그것도 수준 변화로 받아들인다 |
| 독립 출처 합의 | 서로 다른 출처 여럿이 비슷한 값을 보내야 받아들인다 | 한 출처의 오류가 퍼지지 않는다. 출처가 적으면 합의가 이뤄지지 않아 갱신되지 않는다 |

## 3. 사주라 조건에서의 관찰

- 정가는 할인가와 달리 사람마다 다르지 않아서, 정상 매장들이 보내는 값은 같은 시점에 거의 같다.
- 매장 수가 적은 동안(시연 매장 1곳)은 같은 상품을 담는 다른 매장이 없어 독립 출처 합의가 이뤄지지 않는다.
- 같은 매장이 같은 값을 반복해 보내는 경우, 그것만으로는 '실제 가격 변화의 확인'인지 '그 매장의 반복 오류'인지 나눌 수 없다. 반복 오류 매장 처리(`02_implementation_design.md` §1.4 2단계)와 같은 신호를 쓴다.

## 4. 가격비교 사이트의 대표 가격 기준

| 사이트 | 대표 가격 | 따로 두는 가격 |
|---|---|---|
| 네이버 쇼핑 (EP 개편, 2024-10-10 적용) | `price_pc` — 네이버쇼핑에서 업체 상세 페이지로 이동했을 때 보이는 즉시 할인가 | `benefit_price` — 적용 가능한 쿠폰을 모두 포함한 최대 할인가, 상품 가격 아래 별도 노출. `normal_price` — 할인 전 가격, 할인 전과 같거나 정가가 없으면 비운다 |
| 다나와 (EP 작성 안내, 2014-05-14 수정) | 판매가 — 쿠폰이 있으면 쿠폰 적용가. 모든 사용자에게 적용 가능한 쿠폰이어야 한다 | 카드 할인 — 카드프로모션명·카드프로모션가 별도 필드 |

- 두 곳 모두 할인 전 가격(정가)을 대표 가격으로 쓰지 않는다. 대표 가격은 조건 없이 누구나 받는 할인가이고, 회원·카드·추가 행동이 필요한 할인은 분리한다.
- 쿠팡 검색 카드의 할인 표시 글자는 '할인'·'쿠폰할인'·'와우쿠폰할인'으로 나뉜다(`16_coupang_page_probe.md` §1). 비로그인 상태의 표시 가격에 회원 조건 할인이 들어가는지는 확인하지 않았다.

## 출처

- [Open Prices — data quality](https://openfoodfacts.github.io/open-prices/topics/data-quality/)
- [Open Prices — moderation](https://openfoodfacts.github.io/open-prices/topics/moderation/)
- [Open Prices — FOSDEM 2026 발표 자료](https://fosdem.org/2026/events/attachments/CNPVJL-lightning_lightning_talks_1/slides/267016/open_pric_eojra1o.pdf)
- [Crowdsensus 특허 (US 8781990)](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8781990)
- [NPR — Finding Cheaper Gas With Your Smartphone (2012)](https://www.npr.org/blogs/alltechconsidered/2012/03/26/149229284/finding-cheaper-gas-with-your-smartphone)
- [Arbia et al. — From mobile crowdsourcing to crowd-trusted food price in Nigeria (2023)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10338426/)
- [SAS — The Hampel identifier](https://blogs.sas.com/content/iml/2021/06/01/hampel-filter-robust-outliers.html)
- [screamer — Hampel](https://screamer.readthedocs.io/en/latest/functions_rolling/Hampel.html)
- [네이버 쇼핑 EP 변경 공지 (가격·최대할인가격·쿠폰)](https://diad.co.kr/Customer/NoticeView?Idx=4242)
- [다나와 엔진페이지(EP) 작성 안내](https://www.danawa.com/elec/data_sample/guide.html)
- [서버 응답 시간 이상값 특허 (US 11379443) — 연속 이상값 시 기준 재설정](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11379443)
