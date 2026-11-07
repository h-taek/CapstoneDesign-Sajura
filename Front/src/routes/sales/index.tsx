// 판매 데이터 조회 화면 (UC-03, 04_fe.md §4.7, mockup 08_sales.html).
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { getSalesSummary, getSalesTrends, listSales } from "../../api/endpoints/sales";
import { AllSalesPanel } from "../../components/sales/all-sales-panel";
import {
  type MenuItemSalesSummary,
  aggregateDaySales,
  buildContinuousDailySales,
  isRangeExceeded,
} from "../../components/sales/calculations";
import { DayPanel } from "../../components/sales/day-panel";
import { MenuPanel } from "../../components/sales/menu-panel";
import { DateField, MainShell } from "../../components/shell";
import { LoadError } from "../../components/ui/load-error";
import { formatSlashDate, formatWon, parseLocalDate, toIsoDate } from "../../lib/format";
import { useBackToClose } from "../../lib/use-back-to-close";

const PAGE_SIZE = 31; // 1년이면 366줄이라 31줄씩 쪽 이동

export default function SalesPage() {
  // 기준일: summary의 last_sale_at 또는 오늘
  const { data: summary } = useQuery({
    queryKey: ["sales-summary"],
    queryFn: getSalesSummary,
    staleTime: 60_000,
  });

  const defaultEndIso = useMemo(() => {
    if (summary?.last_sale_at) {
      return summary.last_sale_at.slice(0, 10);
    }
    return toIsoDate(new Date());
  }, [summary?.last_sale_at]);

  const defaultStartIso = useMemo(() => {
    // 기본 일주일 전 (6일 차이)
    const date = parseLocalDate(defaultEndIso);
    date.setDate(date.getDate() - 6);
    return toIsoDate(date);
  }, [defaultEndIso]);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const currentStart = startDate || defaultStartIso;
  const currentEnd = endDate || defaultEndIso;

  const rangeError = isRangeExceeded(currentStart, currentEnd);
  // 기간 오류 — 거꾸로 고른 기간을 '판매 없음'으로 보이지 않게 1년 초과와 같은 자리에 알린다
  const periodError = rangeError
    ? "기간은 1년까지 고를 수 있어요"
    : currentStart > currentEnd
      ? "시작일이 종료일보다 늦어요"
      : null;

  // 날짜별 표 데이터 조회: GET /api/sales/trends(group_by=day)
  const trendsQuery = useQuery({
    queryKey: ["sales-trends", "day", currentStart, currentEnd],
    queryFn: () => getSalesTrends(currentStart, currentEnd, "day"),
    enabled: Boolean(currentStart && currentEnd && !rangeError && currentStart <= currentEnd),
    staleTime: 60_000,
  });

  // 날짜별 연속 목록 생성 (최신일순, 판매 없는 날 0 채우기)
  const continuousDays = useMemo(() => {
    if (!currentStart || !currentEnd || rangeError || currentStart > currentEnd) return [];
    return buildContinuousDailySales(currentStart, currentEnd, trendsQuery.data?.data ?? []);
  }, [currentStart, currentEnd, rangeError, trendsQuery.data?.data]);

  // 기간 합계 계산
  const totalStats = useMemo(() => {
    let q = 0;
    let r = 0;
    for (const d of continuousDays) {
      q += d.quantity;
      r += d.revenue;
    }
    return { quantity: q, revenue: r };
  }, [continuousDays]);

  // 페이징 (31줄씩 쪽 이동)
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(continuousDays.length / PAGE_SIZE));
  const pagedDays = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    return continuousDays.slice(startIdx, startIdx + PAGE_SIZE);
  }, [continuousDays, currentPage]);

  // 판 상태: 고른 날짜, 고른 메뉴, 전체 기록 모드
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<MenuItemSalesSummary | null>(null);
  const [isAllRecordsOpen, setIsAllRecordsOpen] = useState(false);

  // 고른 날의 판매 기록 전부 — GET /api/sales는 한 쪽 100건까지라 마지막 쪽까지 이어 받는다
  const daySalesQuery = useQuery({
    queryKey: ["day-sales", selectedDayIso],
    queryFn: async () => {
      const day = selectedDayIso as string;
      const first = await listSales({ start_date: day, end_date: day, size: 100 });
      const items = [...first.items];
      for (let page = 2; page <= first.total_pages; page++) {
        const next = await listSales({ start_date: day, end_date: day, size: 100, page });
        items.push(...next.items);
      }
      return { ...first, items };
    },
    enabled: Boolean(selectedDayIso),
    staleTime: 60_000,
  });

  const dayAggregated = useMemo(() => {
    if (!daySalesQuery.data?.items) return undefined;
    return aggregateDaySales(daySalesQuery.data.items);
  }, [daySalesQuery.data?.items]);

  // 특정 메뉴가 선택된 경우의 판매 기록
  const menuSalesList = useMemo(() => {
    if (!selectedMenu || !dayAggregated) return [];
    return dayAggregated.allSales.filter((s) => s.menu_id === selectedMenu.menu_id);
  }, [selectedMenu, dayAggregated]);

  // 날짜 선택 버튼 핸들러
  const handleSelectDay = (dayIso: string) => {
    if (selectedDayIso === dayIso) {
      // 이미 선택된 날을 다시 누르면 닫거나 유지 (토글 대신 유지/새로고침)
      return;
    }
    setSelectedDayIso(dayIso);
    setSelectedMenu(null);
    setIsAllRecordsOpen(false);
  };

  // 날짜 판 닫기
  const handleCloseDayPanel = () => {
    setSelectedDayIso(null);
    setSelectedMenu(null);
    setIsAllRecordsOpen(false);
  };

  // 세 번째 판에서 날짜 판으로 뒤로가기
  const handleBackToDayPanel = () => {
    setSelectedMenu(null);
    setIsAllRecordsOpen(false);
  };

  // 전체 기록 판 페이징 상태 (더 보기)
  const [allSalesDisplayCount, setAllSalesDisplayCount] = useState(20);

  const selectedDayInfo = useMemo(() => {
    if (!selectedDayIso) return null;
    return continuousDays.find((d) => d.date === selectedDayIso) ?? null;
  }, [selectedDayIso, continuousDays]);

  const hasThirdPanel = Boolean(selectedMenu || isAllRecordsOpen);
  // 앱 폭은 판이 화면을 덮으므로 휴대폰 뒤로 가기가 판을 하나씩 닫게 한다(세 번째 판 → 날짜 판 → 목록)
  useBackToClose(Boolean(selectedDayIso), handleCloseDayPanel);
  useBackToClose(hasThirdPanel, handleBackToDayPanel);

  // 그리드 칼럼 계산:
  // 기본(판 없음): col-span-6
  // 날짜 판만 열림: col-span-3 (표 3, 날짜 판 3)
  // 세 번째 판까지 열림:
  //   1024~1279px (lg): 표 3, 판 3 (세 번째 판이 날짜 판 대신함)
  //   1280px+ (xl): 표 2, 날짜 판 2, 세 번째 판 2
  let listColSpan = "lg:col-span-6";
  if (selectedDayIso && !hasThirdPanel) {
    listColSpan = "lg:col-span-3";
  } else if (selectedDayIso && hasThirdPanel) {
    listColSpan = "lg:col-span-3 xl:col-span-2";
  }

  return (
    <MainShell active="sales">
      <div>
        <header className="mb-5 hidden lg:block">
          <h1 className="text-[1.75rem] font-bold tracking-tight text-ink">판매 데이터</h1>
        </header>

        {/* 위 줄 — 기간(시작일 ~ 종료일, 웹은 공용 틀의 유리 달력)과 기간 합계 */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="block min-w-0 flex-1 sm:w-44 sm:flex-none">
              <span className="sr-only" id="start-date-label">
                시작일
              </span>
              <DateField
                aria-labelledby="start-date-label"
                value={currentStart}
                onChange={(v) => {
                  setStartDate(v);
                  setCurrentPage(1);
                  setSelectedDayIso(null);
                  setSelectedMenu(null);
                  setIsAllRecordsOpen(false);
                }}
                className={periodError ? "border-danger focus:border-danger" : ""}
              />
            </div>
            <span className="text-ink-2">~</span>
            <div className="block min-w-0 flex-1 sm:w-44 sm:flex-none">
              <span className="sr-only" id="end-date-label">
                종료일
              </span>
              <DateField
                aria-labelledby="end-date-label"
                value={currentEnd}
                onChange={(v) => {
                  setEndDate(v);
                  setCurrentPage(1);
                  setSelectedDayIso(null);
                  setSelectedMenu(null);
                  setIsAllRecordsOpen(false);
                }}
                className={periodError ? "border-danger focus:border-danger" : ""}
              />
            </div>
          </div>

          {periodError ? (
            <p role="alert" className="text-sm font-semibold text-danger">
              {periodError}
            </p>
          ) : (
            <p className="tabular text-[0.95rem] text-ink-2">
              <span className="font-bold text-ink">{totalStats.quantity}개</span> ·{" "}
              <span className="font-bold text-ink">{formatWon(totalStats.revenue)}</span>
            </p>
          )}
        </div>

        <div className="sales-wrap grid grid-cols-1 items-start gap-6 lg:grid-cols-6">
          <div className={`sales-list min-w-0 ${listColSpan}`}>
            {trendsQuery.isLoading ? (
              <p className="glass-card rounded-2xl px-5 py-10 text-center text-ink-2">
                불러오는 중…
              </p>
            ) : periodError ? null : trendsQuery.isError && !trendsQuery.data ? (
              <LoadError onRetry={() => void trendsQuery.refetch()} />
            ) : continuousDays.length === 0 || totalStats.quantity === 0 ? (
              <p className="glass-card rounded-2xl px-5 py-10 text-center text-ink-2">
                이 기간에 판매가 없어요
              </p>
            ) : (
              <div className="glass-card rounded-2xl px-2 pb-2">
                {/* 앱 폭은 날짜를 '10/27'로 줄이고 수량 칸도 좁혀 한 줄에 맞춘다(웹은 '10월 27일 (화)') */}
                <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_7.5rem_1.25rem] gap-x-3 px-3 pt-4 pb-1 text-xs font-semibold text-ink-2 lg:grid-cols-[minmax(0,1fr)_4.5rem_7.5rem_1.25rem]">
                  <span>날짜</span>
                  <span className="text-center">판매 수량</span>
                  <span className="text-right">매출</span>
                  <span />
                </div>
                <ul className="divide-y divide-line-soft">
                  {pagedDays.map((d) => {
                    const isSelected = selectedDayIso === d.date;
                    return (
                      <li key={d.date}>
                        <button
                          type="button"
                          onClick={() => handleSelectDay(d.date)}
                          className={`grid w-full grid-cols-[minmax(0,1fr)_3.5rem_7.5rem_1.25rem] items-center lg:grid-cols-[minmax(0,1fr)_4.5rem_7.5rem_1.25rem] gap-x-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-white/30 ${
                            isSelected ? "outline-2 outline-brand -outline-offset-2" : ""
                          }`}
                        >
                          <span className="min-w-0 font-semibold text-ink">
                            <span className="tabular lg:hidden">{formatSlashDate(d.date)}</span>
                            <span className="hidden lg:inline">
                              {d.shortDate}{" "}
                              <span className="font-normal text-ink-2">{d.dayOfWeek}</span>
                            </span>
                          </span>
                          <span className="tabular text-center text-[0.95rem] text-ink-2">
                            {d.quantity}개
                          </span>
                          <span className="tabular text-right font-semibold text-ink">
                            {formatWon(d.revenue)}
                          </span>
                          <ChevronRight className="size-5 text-ink-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* 1년이면 366줄이라 31줄씩 쪽 이동 */}
                {totalPages > 1 ? (
                  <div className="mt-3 flex items-center justify-between border-t border-white/60 px-3 pt-3">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-white/50 disabled:opacity-30"
                      aria-label="이전 페이지"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <span className="tabular text-sm font-semibold text-ink-2">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-white/50 disabled:opacity-30"
                      aria-label="다음 페이지"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* 날짜 판 */}
          {selectedDayIso && selectedDayInfo ? (
            <DayPanel
              dateLabel={selectedDayInfo.dayLabel}
              totalQuantity={selectedDayInfo.quantity}
              totalRevenue={selectedDayInfo.revenue}
              details={dayAggregated}
              isLoading={daySalesQuery.isLoading}
              selectedMenuId={selectedMenu?.menu_id}
              isAllSelected={isAllRecordsOpen}
              onClose={handleCloseDayPanel}
              onSelectMenu={(menu) => {
                setSelectedMenu(menu);
                setIsAllRecordsOpen(false);
              }}
              onSelectAll={() => {
                setIsAllRecordsOpen(true);
                setSelectedMenu(null);
                setAllSalesDisplayCount(20);
              }}
              hideOnMediumWhenThirdOpen={hasThirdPanel}
            />
          ) : null}

          {/* 메뉴 판 */}
          {selectedDayIso && selectedDayInfo && selectedMenu ? (
            <MenuPanel
              dayShort={selectedDayInfo.shortDate}
              dateLabel={selectedDayInfo.dayLabel}
              menuName={selectedMenu.menu_name}
              totalQuantity={selectedMenu.quantity}
              totalRevenue={selectedMenu.revenue}
              sales={menuSalesList}
              isLoading={daySalesQuery.isLoading}
              onBackToDay={handleBackToDayPanel}
            />
          ) : null}

          {/* 전체 기록 판 */}
          {selectedDayIso && selectedDayInfo && isAllRecordsOpen ? (
            <AllSalesPanel
              dayShort={selectedDayInfo.shortDate}
              dateLabel={selectedDayInfo.dayLabel}
              sales={dayAggregated?.allSales.slice(0, allSalesDisplayCount) ?? []}
              totalCount={dayAggregated?.allSales.length ?? 0}
              hasMore={(dayAggregated?.allSales.length ?? 0) > allSalesDisplayCount}
              isLoadingMore={false}
              onLoadMore={() => setAllSalesDisplayCount((c) => c + 20)}
              onBackToDay={handleBackToDayPanel}
            />
          ) : null}
        </div>
      </div>
    </MainShell>
  );
}
