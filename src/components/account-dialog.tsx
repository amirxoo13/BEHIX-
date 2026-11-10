import { useEffect, useRef, useState } from "react";
import { LogOut, UserRound, X } from "lucide-react";
import { sendPasswordReset, signIn, signOut, signUp } from "@/lib/user-auth";
import { useUser } from "@/lib/use-user";

/** دکمهٔ حساب در نوار بالا؛ ساخت صدا و برنامهٔ فیلم با Gemini فقط برای کاربر واردشده است. */
export function AccountButton() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={user ? "icon-btn is-on" : "icon-btn"} onClick={() => setOpen(true)} aria-label={user ? `حساب: ${user.email}` : "ورود به حساب"} title={user ? user.email : "ورود به حساب"}>
        <UserRound size={18} aria-hidden />
      </button>
      {open && <AccountDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AccountDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const user = useUser();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  useEffect(() => ref.current?.showModal(), []);

  const run = async (f: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setNote(null);
    try {
      await f();
      if (ok) setNote({ text: ok, error: false });
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : "انجام نشد.", error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="export-dialog account-dialog" aria-labelledby="account-title" onClose={onClose}>
      <header className="export-head">
        <h2 id="account-title">{user ? "حساب کاربری" : mode === "in" ? "ورود" : "ساخت حساب"}</h2>
        <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="بستن"><X size={18} aria-hidden /></button>
      </header>
      <div className="export-body">
        {user ? (
          <>
            <p className="account-email" dir="ltr">{user.email}</p>
            <p className="muted">ساخت صدا، موسیقی و برنامهٔ فیلم با Gemini برای این حساب فعال است.</p>
            <button type="button" className="btn" onClick={() => signOut()}><LogOut size={16} aria-hidden /> خروج از حساب</button>
          </>
        ) : (
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => (mode === "in" ? signIn(email, password) : signUp(email, password)));
            }}
          >
            <p className="muted">برای ساخت صدا و برنامهٔ فیلم با هوش مصنوعی وارد شوید. بقیهٔ استودیو بدون حساب هم کار می‌کند.</p>
            <label className="field">
              <span>ایمیل</span>
              <input type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} />
            </label>
            <label className="field">
              <span>رمز</span>
              <input type="password" dir="ltr" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            </label>
            {note && <p className={note.error ? "form-note is-error" : "form-note"} role={note.error ? "alert" : "status"}>{note.text}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "صبر کنید…" : mode === "in" ? "ورود" : "ساخت حساب"}</button>
            <div className="account-links">
              <button type="button" className="link-btn" disabled={busy} onClick={() => { setMode(mode === "in" ? "up" : "in"); setNote(null); }}>
                {mode === "in" ? "حساب ندارید؟ ساخت حساب" : "حساب دارید؟ ورود"}
              </button>
              {mode === "in" && (
                <button type="button" className="link-btn" disabled={busy || !email.includes("@")} onClick={() => void run(() => sendPasswordReset(email), "اگر این ایمیل حساب داشته باشد، پیوند تغییر رمز فرستاده شد.")}>
                  فراموشی رمز
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
