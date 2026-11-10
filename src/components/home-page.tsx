import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ProjectsHome } from "@/components/story/projects-home";
import { idbKV, IDB_KEY, parseProject } from "@/studio/persist";

/** صفحهٔ خانهٔ سایت: گالری داستان‌ها به‌علاوهٔ ورود به مسیر پیشرفتهٔ «عکس‌سر». */
export function HomePage() {
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<{ title: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const raw = await idbKV(indexedDB)?.get(IDB_KEY);
        if (raw == null) return;
        const parsed = parseProject(raw);
        if (parsed.ok && alive) setPhoto({ title: parsed.data.title });
      } catch {
        /* پروژهٔ عکس‌سر اختیاری است */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <ProjectsHome
      brand={(content) => <Link to="/" className="studio-brand" aria-label="BEHIX، خانه">{content}</Link>}
      onOpen={(id) => navigate({ to: "/story", search: { project: id } })}
      extra={
        <section className="home-section home-photo" aria-labelledby="photo-title">
          <div>
            <h2 id="photo-title">مسیر پیشرفته: عکس‌سر</h2>
            <p>نما به نما، با عکس چهرهٔ واقعی و صدای ضبط‌شده؛ برای کسانی که کنترل کامل دوربین و صدا می‌خواهند.</p>
          </div>
          <Link to="/photo" className="btn btn-ghost">{photo ? `ادامهٔ «${photo.title}»` : "شروع مسیر عکس‌سر"}</Link>
        </section>
      }
    />
  );
}
