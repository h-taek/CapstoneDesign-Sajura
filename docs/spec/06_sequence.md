# 시퀀스 설계서

## 1. 전체 시스템 흐름

```text
[점주 요청 흐름]
1. 사용자 요청
2. Frontend → Backend API 호출
3. Backend → DB 조회 (n8n이 사전 생성·저장한 예측/추천 결과)
4. 결과 존재 → 즉시 반환
5. 결과 없음 → Backend가 AI Server 직접 호출 → 결과 생성 → DB 저장 → 반환

[발주 흐름]
6. 점주가 추천발주안 확인 / 수정 / 확정
7. 발주 내역 DB 저장
8. Playwright → 쿠팡 장바구니 자동 담기
9. 실제 결제는 쿠팡에서 진행

[배치 흐름 — n8n 주도]
10. 판매 결과, 폐기 데이터, 점주 수정 이력 DB 축적
11. n8n이 매일 02:00에 예측 배치 트리거 → AI Server 호출 → 결과 DB 저장
12. n8n이 매주 일요일 02:00에 재학습 배치 트리거 → AI Server 호출
```

---

## 2. 소셜 로그인 및 온보딩 시퀀스

> 인증 방식: Authlib OAuth 2.0, Firebase 미사용. API 기준: api_spec.md 섹션 2

```mermaid
sequenceDiagram
    participant 사용자
    participant 사주라UI
    participant 사주라서버
    participant OAuth제공자
    participant DB

    사용자->>사주라UI: Google / 카카오 로그인 버튼 클릭
    사주라UI->>사주라서버: GET /api/auth/login/google (또는 /kakao)
    사주라서버-->>사주라UI: 302 Redirect → OAuth 인가 페이지 URL
    사주라UI->>OAuth제공자: 리다이렉트 (사용자 인증)
    OAuth제공자-->>사주라서버: GET /api/auth/callback/google?code=... (인가 코드)
    사주라서버->>OAuth제공자: 사용자 정보 조회
    OAuth제공자-->>사주라서버: email, social_id 등 반환
    사주라서버->>DB: 회원 존재 여부 조회 (auth_provider + social_id)
    DB-->>사주라서버: 조회 결과

    alt 기존 사용자
        사주라서버->>사주라서버: JWT 발급 (Refresh는 HttpOnly Cookie)
        사주라서버-->>사주라UI: Set-Cookie refresh_token + 302 Redirect → /
        사주라UI->>사주라서버: POST /api/auth/refresh (Cookie 자동 전송)
        사주라서버-->>사주라UI: Access Token 응답
        사주라UI->>사주라서버: GET /api/auth/me
        사주라서버-->>사주라UI: user 정보 + onboarding_completed: true
        사주라UI-->>사용자: 메인 홈 이동
    else 신규 사용자
        사주라서버->>DB: 회원 정보 저장
        사주라서버->>사주라서버: JWT 발급 (Refresh는 HttpOnly Cookie)
        사주라서버-->>사주라UI: Set-Cookie refresh_token + 302 Redirect → /
        사주라UI->>사주라서버: POST /api/auth/refresh (Cookie 자동 전송)
        사주라서버-->>사주라UI: Access Token 응답
        사주라UI->>사주라서버: GET /api/auth/me
        사주라서버-->>사주라UI: user 정보 + business_status: UNVERIFIED + onboarding_completed: false
        사주라UI-->>사용자: 사업자 검증 화면 진입 (온보딩 진입 전 게이트)

        사용자->>사주라UI: 사업자등록번호 + 사업자등록증 파일 입력
        사주라UI->>사주라서버: POST /api/store/business/verify (multipart: business_no + cert)
        사주라서버->>사주라서버: 국세청 API 즉시 검증 (마스터 코드면 곧바로 VERIFIED)
        alt 휴업 / 폐업 / 미등록 / 형식오류
            사주라서버-->>사주라UI: 400·422 오류 + 사유 (상태 유지)
            사주라UI-->>사용자: 재입력 / 진행 불가 안내
        else 계속사업자 (또는 마스터 코드)
            사주라서버->>DB: 등록증 파일 저장(경로) + business_no 저장 + business_status=PENDING (마스터면 VERIFIED)
            사주라서버-->>사주라UI: 200 business_status: PENDING
            사주라UI-->>사용자: 온보딩 Step 1 진입 (PENDING부터 허용)
            note over 사주라서버,DB: (비동기) 관리자가 /admin 심사 큐에서 등록증 확인 → 승인(VERIFIED) / 반려(REJECTED·사유)

            사용자->>사주라UI: 매장 정보 입력 (매장명·업종·연락처·주소·규모·운영형태)
            사주라UI->>사주라서버: PATCH /api/store
            사주라서버->>DB: 매장 정보 저장

            사용자->>사주라UI: POS 연동 모드 선택 (CSV[MVP] / POS API[2단계])
            alt CSV 모드 (MVP 기본 경로)
                사용자->>사주라UI: CSV 파일 업로드
                사주라UI->>사주라서버: POST /api/sales/upload
                사주라서버->>DB: pos_mode=CSV_MODE 저장 + 판매 데이터 적재
            else POS API 연동 [2단계]
                사용자->>사주라UI: POS 종류·자격증명 입력
                사주라UI->>사주라서버: POST /api/store/pos
                사주라서버->>DB: POS 정보 저장
                alt POS 연동 성공
                    사주라서버-->>사주라UI: 연동 성공 (pos_mode: CONNECTED)
                else POS 연동 실패
                    사주라서버-->>사주라UI: 연동 실패 → CSV 모드로 전환 (pos_mode: CSV_MODE)
                end
            end
            Note over 사주라UI: CSV·POS API 양쪽 모두 수요예측·자동발주 활성화

            사용자->>사주라UI: 초기 재고 / 초기 메뉴 입력
            사주라UI->>사주라서버: POST /api/inventory/items, POST /api/menus (각각)
            사주라서버->>DB: 재고·메뉴 저장

            사주라UI->>사주라서버: POST /api/store/onboarding/complete
            사주라서버->>DB: onboarding_completed: true 저장
            사주라서버-->>사주라UI: 온보딩 완료
            사주라UI-->>사용자: 메인 홈 이동
        end
    end
```

---

## 3. 수요예측 시퀀스

> n8n이 예측 배치를 주도하고 결과를 DB에 사전 저장한다. Backend는 캐시된 결과만 반환한다.

```mermaid
sequenceDiagram
    participant 사용자
    participant 사주라UI
    participant 사주라서버
    participant DB
    participant n8n
    participant AIServer

    par 사전 예측 배치 (매일 02:00)
        n8n->>DB: 판매 데이터·메뉴·레시피·재고 조회
        n8n->>n8n: 외부 데이터 수집 (날씨·유동인구·행사[조사 중] 등)
        n8n->>n8n: 전처리·정규화
        n8n->>AIServer: POST /ai/forecast/predict (예측 요청)
        AIServer-->>n8n: 예측 결과 + 예측 근거(형태는 research §3) 반환
        n8n->>DB: forecast_results 저장 (UPSERT)
        n8n->>AIServer: POST /ai/orders/recommend (추천발주 요청)
        AIServer-->>n8n: 추천발주안 반환
        n8n->>DB: order_recommendations 저장
        n8n->>DB: pipeline_jobs DONE 업데이트
    and 점주 조회 흐름
        사용자->>사주라UI: 수요예측 화면 진입
        사주라UI->>사주라서버: GET /api/forecast?menu_id=...
        사주라서버->>DB: 저장된 예측 결과 조회
        DB-->>사주라서버: 결과 반환
        alt 캐시 존재
            사주라서버-->>사주라UI: 예측 결과 전달
        else 캐시 없음 (수동 실행 허용 시)
            사주라서버->>AIServer: POST /ai/forecast/predict (단건)
            AIServer-->>사주라서버: 예측 결과 반환
            사주라서버->>DB: 결과 저장
            사주라서버-->>사주라UI: 예측 결과 전달
        end
        사주라UI-->>사용자: 메뉴별 예측 결과 + 신뢰도 배지 표시
    end
```

---

## 4. 발주 확정 및 쿠팡 자동화 시퀀스

> 발주 확정과 쿠팡 자동화는 별도 엔드포인트로 분리된다. api_spec.md 기준.

```mermaid
sequenceDiagram
    participant 사용자
    participant 사주라UI
    participant 사주라서버
    participant DB
    participant Playwright
    participant 쿠팡

    사용자->>사주라UI: 추천발주 화면 진입
    사주라UI->>사주라서버: GET /api/orders/recommend
    사주라서버->>DB: 추천발주안 조회
    DB-->>사주라서버: 추천발주안 반환
    사주라서버-->>사주라UI: 추천발주안 전달
    사주라UI-->>사용자: 품목별 추천발주안 표시

    opt 점주 수정
        사용자->>사주라UI: 수량 수정 또는 품목 제외
        사주라UI->>사주라서버: PATCH /api/orders/recommend
        사주라서버->>DB: 수정 이력 저장 (AI 추천 수량, 점주 수정 수량)
    end

    사용자->>사주라UI: 발주 확정 버튼 클릭
    사주라UI->>사주라서버: POST /api/orders/approve
    사주라서버->>DB: 발주 내역 저장 (orders)
    사주라서버-->>사주라UI: 발주 확정 완료

    사용자->>사주라UI: 쿠팡 자동 담기 요청
    사주라UI->>사주라서버: POST /api/orders/{order_id}/automate
    사주라서버->>Playwright: 쿠팡 장바구니 담기 요청
    Playwright->>쿠팡: 품목별 장바구니 추가 시도

    alt 전체 성공
        쿠팡-->>Playwright: 담기 완료
        Playwright-->>사주라서버: 성공 응답
        사주라서버-->>사주라UI: 쿠팡 결제 진행 안내
        사주라UI-->>사용자: 쿠팡 결제 진행 안내 표시
    else 부분 실패
        쿠팡-->>Playwright: 일부 품목 실패
        Playwright-->>사주라서버: 성공 품목 + 실패 품목 목록
        사주라서버-->>사주라UI: 부분 실패 응답
        사주라UI-->>사용자: 성공 품목 완료 안내 + 실패 품목 수동 처리 안내
    else 전체 실패
        Playwright-->>사주라서버: 전체 실패 응답
        사주라서버-->>사주라UI: 전체 실패 응답 + manual_guide_url
        사주라UI-->>사용자: 전체 품목 수동 처리 안내
    end
```

---

## 5. 야간 배치 파이프라인 시퀀스

> 매일 02:00 실행. 각 단계 실패 시 3회 재시도 후 개발팀 Slack 알림. feature_spec.md 섹션 10.1 기준.

```mermaid
sequenceDiagram
    participant n8n
    participant DB
    participant ExternalAPI
    participant AIServer
    participant BE as 사주라서버
    participant Push as Web Push

    Note over n8n: 매일 02:00 트리거
    n8n->>DB: pipeline_jobs INSERT (type=FORECAST, status=RUNNING, triggered_by=N8N)
    n8n->>DB: 판매 데이터·메뉴·레시피·재고·리드타임·안전재고 조회
    n8n->>ExternalAPI: 날씨·유동인구·검색량[조사 중]·행사 정보[조사 중] 수집
    n8n->>n8n: 전처리·정규화 (결측값 처리, 이상치 필터링, 단위 통일, 외부 변수 병합)
    n8n->>AIServer: POST /ai/forecast/predict
    AIServer-->>n8n: 예측 결과 + 예측 근거(형태는 research §3) 반환
    n8n->>AIServer: POST /ai/orders/recommend
    AIServer-->>n8n: 추천발주안 반환
    n8n->>DB: forecast_results UPSERT (예측 결과; 근거 저장 컬럼은 research §3 확정 후 정의)
    n8n->>DB: order_recommendations INSERT (추천발주안)

    alt 전체 성공
        n8n->>DB: pipeline_jobs UPDATE (status=DONE)
        n8n->>BE: 알림 발송 API 호출 (예측 완료 + 추천발주안 생성, store_id 목록 전달)
        BE->>DB: NotificationService.create_and_push — notifications INSERT
        BE->>Push: pywebpush로 push_subscriptions 대상에 Web Push 전송
        BE-->>n8n: 발송 결과 반환
    else 단계 실패 (3회 재시도 후 지속)
        n8n->>DB: pipeline_jobs UPDATE (status=FAILED)
        n8n->>n8n: slack_sdk Webhook — 개발팀 채널에 직접 전송 (BE 경유 안 함, 도메인 무관)
    end
```

> 점주 알림은 BE `NotificationService.create_and_push`가 일관 처리(인앱 INSERT + Web Push). n8n은 BE API를 트리거할 뿐 직접 알림을 만들지 않는다. 개발팀 Slack 알림만 n8n에서 직접 발송.

---

## 6. 재고 자동 차감(FIFO) 시퀀스

> POS 판매 데이터 저장 시 레시피 기반으로 재고를 소비기한 오름차순(FIFO)으로 자동 차감한다.

```mermaid
sequenceDiagram
    participant POS
    participant 사주라서버
    participant DB

    POS->>사주라서버: 판매 데이터 동기화 (어댑터 공통 스키마)
    사주라서버->>사주라서버: 이상치 감지
    Note over 사주라서버: 탐지 방법·임계값·이상 데이터 처리·알림 트리거는 research §3 확정 후 정의
    사주라서버->>DB: 정상 판매 데이터 저장 (sale_records)

    loop 판매된 메뉴별
        사주라서버->>DB: 해당 메뉴의 레시피 조회 (recipe_ingredients)
        loop 레시피 재료별
            사주라서버->>DB: 소비기한 오름차순 로트 목록 조회 (inventory_lots)
            loop 로트별 FIFO 차감
                alt 로트 수량 충분
                    사주라서버->>DB: 해당 로트 수량 차감
                else 로트 수량 부족 → 다음 로트로 이어서 차감
                    사주라서버->>DB: 해당 로트 0으로 설정 → 다음 로트 차감 계속
                end
            end
            alt 전체 로트 합산 후에도 수량 부족
                사주라서버->>DB: 재고 "재고 확인 필요" 상태로 표시
                사주라서버->>사주라서버: 점주 앱 내 알림 발송 (재고 부족 경고)
            end
        end
    end
```

---

## 7. 소비기한 배치 및 알림 시퀀스

> 매일 02:00 BE ARQ `cron_jobs`에서 실행. 자동 폐기 없음 — 점주 수동 처리 원칙.
> 소비기한 체크는 **재고 도메인 비즈니스 로직**이므로 BE가 책임 (n8n은 AI 파이프라인 도구라 책임 영역 아님).

```mermaid
sequenceDiagram
    participant ARQ as ARQ cron
    participant BE as 사주라서버
    participant DB
    participant Push as Web Push

    Note over ARQ: 매일 02:00 트리거
    ARQ->>BE: InventoryService.check_expiry_batch 호출
    BE->>DB: inventory_lots에서 expiry_date 기준 D-3·D-1·초과 매칭 로트 조회

    loop 매칭된 로트별
        alt D-3일 임박
            BE->>DB: 해당 로트 경고 상태 표시
            BE->>BE: NotificationService.create_and_push (경고 — 소비기한 D-3일)
            BE->>DB: notifications INSERT
            BE->>Push: pywebpush로 점주 Web Push 발송
        else D-1일 임박
            BE->>DB: 해당 로트 긴급 상태 표시
            BE->>BE: NotificationService.create_and_push (긴급 — 소비기한 D-1일)
            BE->>DB: notifications INSERT
            BE->>Push: pywebpush로 점주 Web Push 발송
        else 소비기한 초과
            BE->>BE: NotificationService.create_and_push (긴급 — 폐기 요청)
            BE->>DB: notifications INSERT
            BE->>Push: pywebpush로 점주 Web Push 발송
            Note over BE: 자동 폐기 없음. 점주가 직접 처리.
        end
    end
```

---

## 8. Refresh Token 갱신 시퀀스

> Access Token 만료 시 Frontend가 자동으로 갱신 요청한다. Refresh Token은 사용마다 교체(Rotation).

```mermaid
sequenceDiagram
    participant 사주라UI
    participant 사주라서버
    participant DB

    사주라UI->>사주라서버: API 요청 (만료된 Access Token)
    사주라서버-->>사주라UI: 401 Unauthorized

    사주라UI->>사주라서버: POST /api/auth/refresh (HttpOnly Cookie의 Refresh Token 자동 포함)
    사주라서버->>DB: Refresh Token 유효성 검증 (token_hash 조회)

    alt 유효한 Refresh Token
        사주라서버->>사주라서버: 새 Access Token + 새 Refresh Token 생성
        사주라서버->>DB: 기존 Refresh Token 폐기 + 새 token_hash 저장
        사주라서버-->>사주라UI: 새 Access Token 반환 + 새 Refresh Token Cookie 설정
        사주라UI->>사주라서버: 원래 API 요청 재시도 (새 Access Token)
        사주라서버-->>사주라UI: 정상 응답
    else 만료 또는 무효한 Refresh Token
        사주라서버-->>사주라UI: 401 Unauthorized
        사주라UI-->>사주라UI: 로그인 화면으로 이동
    end
```
