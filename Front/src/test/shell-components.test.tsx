// A2 메인 셸·공용 부품 단위 시험 — 알림 정렬·POS 상단 고정, 옆 판 휠 드롭, 날짜 판 월 넘김·최소/최대, MainShell.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  type NotificationItem,
  notificationTargetPath,
  sortNotifications,
} from "../api/endpoints/notifications";
import {
  DateField,
  FollowPanel,
  MainShell,
  NotificationPopover,
  calcFollowPanelDrop,
  isDateOutOfRange,
  stepCalendarMonth,
} from "../components/shell";

function makeNotification(
  overrides: Partial<NotificationItem> & Pick<NotificationItem, "notification_id">,
): NotificationItem {
  return {
    notification_id: overrides.notification_id,
    type: overrides.type ?? "FORECAST_DONE",
    priority: overrides.priority ?? "INFO",
    title: overrides.title ?? "알림 제목",
    body: overrides.body ?? "알림 내용",
    related_resource_type: overrides.related_resource_type ?? null,
    related_resource_id: overrides.related_resource_id ?? null,
    is_read: overrides.is_read ?? false,
    created_at: overrides.created_at ?? "2026-10-20T09:00:00Z",
  };
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

describe("Notification sorting, routing, and POS fixed item", () => {
  it("sorts notifications in URGENT → WARNING → INFO order while preserving order within same priority", () => {
    const items: NotificationItem[] = [
      makeNotification({
        notification_id: "n-info-1",
        priority: "INFO",
        type: "FORECAST_DONE",
        title: "발주 추천 준비 완료",
      }),
      makeNotification({
        notification_id: "n-warn-1",
        priority: "WARNING",
        type: "STOCK_LOW",
        title: "모짜렐라 치즈 부족",
      }),
      makeNotification({
        notification_id: "n-urgent-1",
        priority: "URGENT",
        type: "EXPIRY_D1",
        title: "루꼴라 소비기한 D-1",
      }),
      makeNotification({
        notification_id: "n-warn-2",
        priority: "WARNING",
        type: "ANOMALY_HIGH",
        title: "어제 매출 급증",
      }),
      makeNotification({
        notification_id: "n-urgent-2",
        priority: "URGENT",
        type: "EXPIRY_OVER",
        title: "바질 소비기한 초과",
      }),
    ];

    const sorted = sortNotifications(items);
    expect(sorted.map((n) => n.notification_id)).toEqual([
      "n-urgent-1",
      "n-urgent-2",
      "n-warn-1",
      "n-warn-2",
      "n-info-1",
    ]);
  });

  it("maps notification types to target paths per 01_basic_design.md §4.11", () => {
    expect(notificationTargetPath({ type: "STOCK_LOW" })).toBe("/inventory");
    expect(notificationTargetPath({ type: "EXPIRY_D3" })).toBe("/inventory");
    expect(notificationTargetPath({ type: "EXPIRY_D1" })).toBe("/inventory");
    expect(notificationTargetPath({ type: "EXPIRY_OVER" })).toBe("/inventory");
    expect(notificationTargetPath({ type: "ANOMALY_HIGH" })).toBe("/sales");
    expect(notificationTargetPath({ type: "FORECAST_DONE" })).toBe("/orders");
  });

  it("renders POS disconnected alert pinned at the top of NotificationPopover and marks items read on click", () => {
    const onMarkRead = vi.fn();
    const onMarkAllRead = vi.fn();
    const onClose = vi.fn();

    const items: NotificationItem[] = [
      makeNotification({
        notification_id: "n-info",
        priority: "INFO",
        type: "FORECAST_DONE",
        title: "이번 주 추천발주가 준비됐어요",
      }),
      makeNotification({
        notification_id: "n-urgent",
        priority: "URGENT",
        type: "EXPIRY_D1",
        title: "루꼴라 소비기한이 내일까지예요",
      }),
    ];

    render(
      <MemoryRouter initialEntries={["/"]}>
        <NotificationPopover
          open={true}
          onClose={onClose}
          items={items}
          isPosAlert={true}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
        />
        <LocationProbe />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole("dialog", { name: "알림" });
    const listItems = dialog.querySelectorAll("li");
    expect(listItems.length).toBe(3);

    // 맨 위 고정 항목은 POS 연동 끊김 경고여야 한다.
    expect(listItems[0]?.textContent).toContain("POS 연동이 끊겼어요");
    expect(listItems[0]?.querySelector("a")?.getAttribute("href")).toBe("/settings/pos");

    // 그 다음은 URGENT → INFO 순이어야 한다.
    expect(listItems[1]?.textContent).toContain("루꼴라 소비기한이 내일까지예요");
    expect(listItems[2]?.textContent).toContain("이번 주 추천발주가 준비됐어요");

    // 모두 읽음 클릭
    fireEvent.click(screen.getByRole("button", { name: "모두 읽음" }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);

    // 개별 알림 클릭 시 읽음 처리 후 대상 화면(/inventory)으로 이동
    const urgentLink = listItems[1]?.querySelector("a");
    expect(urgentLink).not.toBeNull();
    if (urgentLink) fireEvent.click(urgentLink);
    expect(onMarkRead).toHaveBeenCalledWith("n-urgent");
    expect(screen.getByTestId("loc").textContent).toBe("/inventory");
  });
});

describe("FollowPanel wheel drop", () => {
  it("calculates wheel drop at page bottom and pulls back up on reverse wheel", () => {
    // 페이지 바닥에서 아래로 휠 → roomBelow 범위 안에서 판을 내린다.
    const down1 = calcFollowPanelDrop({
      currentDrop: 0,
      deltaY: 120,
      atPageBottom: true,
      roomBelow: 200,
    });
    expect(down1).toEqual({ nextDrop: 120, consumed: true });

    // 남은 공간(80px)보다 크게 내리면 남은 공간만큼만 내려간다.
    const down2 = calcFollowPanelDrop({
      currentDrop: 120,
      deltaY: 150,
      atPageBottom: true,
      roomBelow: 80,
    });
    expect(down2).toEqual({ nextDrop: 200, consumed: true });

    // 위로 휠을 굴리면 페이지 스크롤보다 먼저 판을 끌어올린다.
    const up1 = calcFollowPanelDrop({
      currentDrop: 200,
      deltaY: -90,
      atPageBottom: true,
      roomBelow: 0,
    });
    expect(up1).toEqual({ nextDrop: 110, consumed: true });

    const up2 = calcFollowPanelDrop({
      currentDrop: 110,
      deltaY: -150,
      atPageBottom: true,
      roomBelow: 90,
    });
    expect(up2).toEqual({ nextDrop: 0, consumed: true });
  });

  it("renders FollowPanel with title and close buttons", () => {
    const onClose = vi.fn();
    render(
      <FollowPanel title="새 재료" onClose={onClose}>
        <p>패널 본문</p>
      </FollowPanel>,
    );

    expect(screen.getByRole("complementary", { name: "새 재료" })).toBeInTheDocument();
    expect(screen.getByText("패널 본문")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DateField calendar month stepping and min/max bounds", () => {
  it("steps calendar months across year boundaries and checks min/max range", () => {
    expect(stepCalendarMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(stepCalendarMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(stepCalendarMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });

    expect(isDateOutOfRange("2026-10-09", "2026-10-10", "2026-10-20")).toBe(true);
    expect(isDateOutOfRange("2026-10-10", "2026-10-10", "2026-10-20")).toBe(false);
    expect(isDateOutOfRange("2026-10-21", "2026-10-10", "2026-10-20")).toBe(true);
  });

  it("opens calendar dialog, navigates months, disables out-of-range dates, and emits selected date", () => {
    const onChange = vi.fn();
    render(
      <DateField
        aria-label="소비기한"
        value="2026-10-15"
        min="2026-10-10"
        max="2026-11-05"
        optional
        onChange={onChange}
      />,
    );

    // 웹 트리거 버튼 클릭 → 달력 다이얼로그 열림
    const trigger = screen.getByRole("button", { name: "소비기한" });
    expect(trigger.textContent).toContain("2026. 10. 15.");
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "날짜 고르기" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("2026년 10월")).toBeInTheDocument();

    // min(2026-10-10) 이전 날짜는 비활성화되어야 한다.
    const day9 = dialog.querySelector<HTMLButtonElement>('[data-day="2026-10-09"]');
    const day10 = dialog.querySelector<HTMLButtonElement>('[data-day="2026-10-10"]');
    expect(day9?.disabled).toBe(true);
    expect(day10?.disabled).toBe(false);

    // 다음 달(2026년 11월)로 이동 후 max(2026-11-05) 이후 날짜 비활성화 확인
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByText("2026년 11월")).toBeInTheDocument();

    const nov5 = dialog.querySelector<HTMLButtonElement>('[data-day="2026-11-05"]');
    const nov6 = dialog.querySelector<HTMLButtonElement>('[data-day="2026-11-06"]');
    expect(nov5?.disabled).toBe(false);
    expect(nov6?.disabled).toBe(true);

    // 활성 날짜 선택 시 onChange 호출 및 팝오버 닫힘
    if (nov5) fireEvent.click(nov5);
    expect(onChange).toHaveBeenCalledWith("2026-11-05");
    expect(screen.queryByRole("dialog", { name: "날짜 고르기" })).not.toBeInTheDocument();
  });
});

describe("MainShell navigation and app top bar shrink", () => {
  it("renders web pill nav, app bottom 5-tab bar, and shrinks app header on scroll", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/inventory"]}>
          <MainShell active="inventory">
            <div>재고 본문</div>
          </MainShell>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // 웹 주 메뉴에서 활성 항목(재고 관리)은 aria-current="page"를 가진다.
    const mainNav = screen.getByRole("navigation", { name: "주 메뉴" });
    const activeWebLink = mainNav.querySelector('[aria-current="page"]');
    expect(activeWebLink?.textContent).toContain("재고 관리");

    // 앱 하단 메뉴는 5탭을 렌더링한다.
    const bottomNav = screen.getByRole("navigation", { name: "하단 메뉴" });
    expect(bottomNav.querySelectorAll("li").length).toBe(5);

    // 스크롤 시 앱 상단 바(header[data-shrink])에 is-shrunk 클래스가 붙는다.
    const shrinkHeader = container.querySelector("header[data-shrink]");
    expect(shrinkHeader).not.toBeNull();
    expect(shrinkHeader?.classList.contains("is-shrunk")).toBe(false);

    Object.defineProperty(window, "scrollY", { value: 60, configurable: true });
    fireEvent.scroll(window);
    expect(shrinkHeader?.classList.contains("is-shrunk")).toBe(true);

    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    fireEvent.scroll(window);
    expect(shrinkHeader?.classList.contains("is-shrunk")).toBe(false);
  });
});
