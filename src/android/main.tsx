/**
 * ورودی اپ اندروید (Capacitor): همان استودیوی انیمیشن دوبعدی سایت (۷ مرحله)، کاملاً روی خود گوشی.
 * مسیرها همان فایل‌های src/routes هستند؛ چون اپ سرور ندارد، تاریخچه hash است (#/stage) و ریشه فقط <Outlet/> است.
 * با `npm run android:web` در پوشهٔ dist-android ساخته می‌شود.
 */
import "@/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashHistory, createRootRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { Route as IndexRoute } from "@/routes/index";
import { Route as PhotoRoute } from "@/routes/photo";
import { Route as ScenarioRoute } from "@/routes/scenario";
import { Route as CastRoute } from "@/routes/cast";
import { Route as WorldRoute } from "@/routes/world";
import { Route as BoardRoute } from "@/routes/board";
import { Route as StageRoute } from "@/routes/stage";
import { Route as SoundRoute } from "@/routes/sound";
import { Route as DeliverRoute } from "@/routes/deliver";
import { Route as ProjectsRoute } from "@/routes/projects";

const rootRoute = createRootRoute({ component: Outlet });
const pages = [
  [IndexRoute, "/"],
  [PhotoRoute, "/photo"],
  [ScenarioRoute, "/scenario"],
  [CastRoute, "/cast"],
  [WorldRoute, "/world"],
  [BoardRoute, "/board"],
  [StageRoute, "/stage"],
  [SoundRoute, "/sound"],
  [DeliverRoute, "/deliver"],
  [ProjectsRoute, "/projects"],
] as const;
// همان کاری که routeTree.gen.ts برای سایت می‌کند: هر مسیر زیر ریشهٔ اپ.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- انواع مسیرهای سایت به routeTree.gen گره خورده‌اند؛ اینجا درخت جدا ساخته می‌شود.
const routeTree = rootRoute.addChildren(pages.map(([r, path]) => (r as any).update({ id: path, path, getParentRoute: () => rootRoute })));
const router = createRouter({ routeTree, history: createHashHistory() });

const root = document.getElementById("root");
if (!root) throw new Error("ریشهٔ صفحه پیدا نشد.");

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
