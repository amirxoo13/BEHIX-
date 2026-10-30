/**
 * ورودی اپ اندروید (Capacitor): خانه (گالری پروژه‌ها) و ویرایشگر «داستان به فیلم»، کاملاً روی خود گوشی و بدون سرور.
 * با `npm run android:web` در پوشهٔ dist-android ساخته می‌شود.
 */
import "@/styles.css";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight } from "lucide-react";
import { ProjectsHome } from "@/components/story/projects-home";
import { StoryApp } from "@/components/story/story-app";
import { useStoryWorkspace } from "@/studio/stick/use-workspace";

const brand = (content: React.ReactNode) => <div className="studio-brand">{content}</div>;

/** ویرایشگر یک پروژه؛ پیش از برگشت به خانه، ذخیره کامل می‌شود. */
function Editor({ id, onHome }: { id: string; onHome: () => void }) {
  const workspace = useStoryWorkspace("", id);
  return (
    <StoryApp
      workspace={workspace}
      brand={brand}
      projectsLink={
        <button type="button" className="back-btn" onClick={() => void workspace.flush().then((ok) => ok && onHome())}>
          <ArrowRight size={18} aria-hidden />
          <span>پروژه‌ها</span>
        </button>
      }
    />
  );
}

function AndroidApp() {
  const [open, setOpen] = useState<string | null>(null);
  return open ? <Editor key={open} id={open} onHome={() => setOpen(null)} /> : <ProjectsHome brand={brand} onOpen={(id) => setOpen(id)} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("ریشهٔ صفحه پیدا نشد.");

createRoot(root).render(
  <StrictMode>
    <AndroidApp />
  </StrictMode>,
);
