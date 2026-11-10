import { createFileRoute, redirect } from "@tanstack/react-router";

/** نشانی قدیمی فهرست پروژه‌ها؛ به استودیوی دوبعدی می‌رود تا پیوندهای قبلی نشکنند. */
export const Route = createFileRoute("/projects")({
  beforeLoad: () => {
    throw redirect({ to: "/photo", replace: true });
  },
});
