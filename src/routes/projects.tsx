import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/home-page";

/** نشانی قدیمی فهرست پروژه‌ها؛ همان صفحهٔ خانه را نشان می‌دهد تا پیوندهای قبلی نشکنند. */
export const Route = createFileRoute("/projects")({ component: HomePage });
