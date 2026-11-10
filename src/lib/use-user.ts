import { useRef, useSyncExternalStore } from "react";
import { currentUser, onUserChange, type User } from "@/lib/user-auth";

/** کاربر واردشده (یا null)، هم‌گام با هر ورود و خروج. */
export function useUser(): User | null {
  const cache = useRef<{ key: string; user: User | null }>({ key: "", user: null });
  return useSyncExternalStore(onUserChange, () => {
    const u = currentUser();
    const key = u ? `${u.uid}|${u.email}` : "";
    if (cache.current.key !== key) cache.current = { key, user: u };
    return cache.current.user;
  }, () => null);
}
