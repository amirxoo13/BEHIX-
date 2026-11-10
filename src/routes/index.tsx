import { createFileRoute, redirect } from "@tanstack/react-router";

/** خانهٔ BEHIX = استودیوی انیمیشن دوبعدی (مرحلهٔ «پروژه»). */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/photo", replace: true });
  },
});
