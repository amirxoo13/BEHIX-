import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CAST, MAX_CUSTOM } from "@/studio/characters";
import { fa } from "@/studio/format";
import { useStudio } from "@/studio/store";
import { authFetch } from "@/lib/user-auth";
import { useUser } from "@/lib/use-user";
import type { CharacterKit } from "@/studio/kit/kit";

const API = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE ?? "").replace(/\/$/, "");

/** عکس را حداکثر ۱۰۲۴ پیکسل و JPEG می‌کند تا آپلود سبک باشد (Gemini بیشتر از این لازم ندارد). */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.9);
}

/**
 * ساخت شخصیت با Gemini: عکس سر واقعی + توضیح لباس و ظاهر → تکه‌های بدن، سر کارتونی، ۹ دهان لب‌خوانی و پلک،
 * روی اسکلت آمادهٔ موتور. حدود یک دقیقه طول می‌کشد و ورود به حساب لازم است.
 */
export function KitMaker() {
  const user = useUser();
  const count = useStudio((s) => s.characters.length);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sec, setSec] = useState(0);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const make = async () => {
    if (!photo || !name.trim() || desc.trim().length < 3) {
      setNote({ text: "اسم، توضیح ظاهر و لباس، و عکس سر لازم است.", error: true });
      return;
    }
    setBusy(true);
    setNote(null);
    setSec(0);
    timer.current = window.setInterval(() => setSec((s) => s + 1), 1000);
    try {
      const r = await authFetch(`${API}/api/kit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), description: desc.trim(), photo }) });
      const j = (await r.json().catch(() => null)) as { kit?: CharacterKit; message?: string } | null;
      if (!r.ok || !j?.kit) throw new Error(j?.message ?? `خطای ${r.status}`);
      const base = CAST[0];
      const ok = useStudio.getState().addCharacter({ ...base, id: `u-${Math.random().toString(36).slice(2, 10)}`, name: name.trim(), skin: j.kit.skin, scale: 0.74, kit: j.kit, head: undefined });
      if (!ok) throw new Error(`حداکثر ${fa(MAX_CUSTOM)} شخصیت در یک پروژه.`);
      setNote({ text: `«${name.trim()}» ساخته شد و در کتابخانهٔ شخصیت است. در سناریو بنویسید «${name.trim()}: …».`, error: false });
      setName("");
      setDesc("");
      setPhoto(null);
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : "ساخت شخصیت انجام نشد.", error: true });
    } finally {
      if (timer.current) window.clearInterval(timer.current);
      setBusy(false);
    }
  };

  return (
    <section className="panel mt-6">
      <h2 className="flex items-center gap-2 font-bold"><Sparkles size={18} aria-hidden /> ساخت شخصیت با Gemini</h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        یک عکس از روبه‌روی صورت و توضیح ظاهر و لباس بدهید. Gemini سر کارتونی، تکه‌های بدن، ۹ حالت دهان برای لب‌خوانی و پلک را می‌کشد و
        روی اسکلت آمادهٔ موتور سوار می‌کند. حدود یک دقیقه.
      </p>
      {!user && <p className="mt-2 text-sm text-cyan">برای ساخت شخصیت اول وارد حساب شوید (دکمهٔ آدمک بالای صفحه).</p>}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-bold">
          اسم شخصیت
          <input className="field" maxLength={30} value={name} disabled={busy} onChange={(e) => setName(e.target.value)} placeholder="مثلاً پرویز" />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          عکس سر (روبه‌رو)
          <input
            className="field"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try { setPhoto(await shrink(f)); } catch { setNote({ text: "این عکس خوانده نشد.", error: true }); }
            }}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold md:col-span-2">
          ظاهر و لباس (هرچه دقیق‌تر بهتر)
          <textarea className="field" rows={3} maxLength={600} value={desc} disabled={busy} onChange={(e) => setDesc(e.target.value)} placeholder="مرد حدود ۴۰ ساله، لاغر، کت سرمه‌ای و پیراهن سفید، شلوار طوسی، کفش چرم قهوه‌ای" />
        </label>
      </div>
      {photo && <img src={photo} alt="عکس سر" className="mt-3 h-24 w-24 rounded-xl object-cover" />}
      <button type="button" className="btn btn-primary mt-3 w-full" disabled={busy || !user || count >= MAX_CUSTOM} onClick={() => void make()}>
        {busy ? `Gemini در حال کشیدن شخصیت… ${fa(sec)} ثانیه` : "ساخت شخصیت"}
      </button>
      {note && <p className={note.error ? "mt-2 text-sm text-danger" : "mt-2 text-sm text-cyan"} role={note.error ? "alert" : "status"}>{note.text}</p>}
    </section>
  );
}
