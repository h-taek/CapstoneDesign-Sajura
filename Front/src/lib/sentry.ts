// Sentry — 10_frontend_design.md §1, research/frontend/11_observability.md.
// PII scrubbing + release tagging (sentry release = git-<sha-short>).
import * as Sentry from "@sentry/react";

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? "development",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    sendDefaultPii: false,
    sampleRate: 1.0,
    tracesSampleRate: 0.05,
    beforeSend(event) {
      // PII 마스킹: Authorization·Cookie·이메일·전화·사업자번호
      if (event.request?.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
      }
      return event;
    },
  });
}
