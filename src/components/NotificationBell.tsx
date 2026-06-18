"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { playChime } from "@/lib/chime";

export type AppNotification = {
  id: string;
  task_id: string | null;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
};

const MUTE_KEY = "sw-notif-muted";

/* Top-bar bell. Subscribes to the current user's notifications via Realtime,
   shows an unread badge, and opens a dropdown of recent items. Clicking one
   opens its task and marks it read.

   New notifications that arrive while the page is open also surface as a soft
   toast (top-right, under the bell) with a subtle chime. Existing items loaded
   on page render never toast — only live INSERTs do. */
export default function NotificationBell({
  userId,
  initial,
}: {
  userId: string;
  initial: AppNotification[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>(initial);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [muted, setMuted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Ids we've already surfaced as toasts — guards against any double delivery.
  const seen = useRef<Set<string>>(new Set());
  // Read inside the realtime callback without re-subscribing on every toggle.
  const mutedRef = useRef(false);

  useEffect(() => setNow(Date.now()), []);

  // Restore the mute preference (kept on this device).
  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* localStorage unavailable — default to unmuted */
    }
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev;
            return [n, ...prev].slice(0, 30);
          });
          // Surface a live toast (once per id) + a soft chime.
          if (!seen.current.has(n.id)) {
            seen.current.add(n.id);
            setToasts((prev) => [n, ...prev].slice(0, 4));
            if (!mutedRef.current) playChime();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function markRead(n: AppNotification) {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).eq("id", n.id);
  }

  async function open_(n: AppNotification) {
    setOpen(false);
    await markRead(n);
    if (n.task_id) router.push(`/dashboard/tasks?task=${n.task_id}`);
  }

  async function openFromToast(n: AppNotification) {
    dismissToast(n.id);
    await markRead(n);
    if (n.task_id) router.push(`/dashboard/tasks?task=${n.task_id}`);
  }

  async function markAll() {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    const supabase = createClient();
    await supabase.from("notifications").update({ read: true }).in("id", ids);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-full text-muted ring-1 ring-hairline transition-colors hover:bg-bg hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-peri-deep px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Live toasts — render regardless of the dropdown being open. */}
      <ToastStack
        toasts={toasts}
        muted={muted}
        onOpen={openFromToast}
        onDismiss={dismissToast}
        onToggleMute={toggleMute}
      />

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-[var(--radius-control)] border border-hairline bg-surface shadow-[var(--shadow-card-hover)]">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <span className="text-sm font-medium text-ink">Notifications</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute notification sound" : "Mute notification sound"}
                title={muted ? "Sound off" : "Sound on"}
                className="text-muted transition-colors hover:text-ink"
              >
                <SoundIcon muted={muted} />
              </button>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="text-xs font-medium text-peri-deep hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-hint">You&rsquo;re all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => open_(n)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg"
                >
                  <span
                    className={[
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.read ? "bg-transparent" : "bg-peri-deep",
                    ].join(" ")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={["block text-sm", n.read ? "text-muted" : "text-ink"].join(" ")}>
                      {n.message}
                    </span>
                    <span className="mt-0.5 block text-xs text-hint">{relTime(n.created_at, now)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Toasts ─────────────────────────────────────────────────────────────── */

function ToastStack({
  toasts,
  muted,
  onOpen,
  onDismiss,
  onToggleMute,
}: {
  toasts: AppNotification[];
  muted: boolean;
  onOpen: (n: AppNotification) => void;
  onDismiss: (id: string) => void;
  onToggleMute: () => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed right-4 top-[4.25rem] z-[60] flex w-[20rem] max-w-[calc(100vw-2rem)] flex-col gap-2 sm:right-6">
      {toasts.map((n) => (
        <Toast
          key={n.id}
          n={n}
          muted={muted}
          onOpen={() => onOpen(n)}
          onDismiss={() => onDismiss(n.id)}
          onToggleMute={onToggleMute}
        />
      ))}
    </div>
  );
}

function Toast({
  n,
  muted,
  onOpen,
  onDismiss,
  onToggleMute,
}: {
  n: AppNotification;
  muted: boolean;
  onOpen: () => void;
  onDismiss: () => void;
  onToggleMute: () => void;
}) {
  const [shown, setShown] = useState(false);

  // Slide/fade in on mount, then auto-dismiss after ~5s.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = setTimeout(onDismiss, 5000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "pointer-events-auto overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card-hover)] transition-all duration-300 ease-out",
        shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      ].join(" ")}
    >
      <div className="flex items-start gap-3 p-3.5 pl-4">
        {/* Periwinkle accent rail */}
        <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-peri-deep" aria-hidden />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-hint">
            New notification
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-ink">{n.message}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? "Unmute notification sound" : "Mute notification sound"}
            title={muted ? "Sound off" : "Sound on"}
            className="grid h-6 w-6 place-items-center rounded-full text-hint transition-colors hover:bg-bg hover:text-ink"
          >
            <SoundIcon muted={muted} small />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="grid h-6 w-6 place-items-center rounded-full text-hint transition-colors hover:bg-bg hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function SoundIcon({ muted, small }: { muted: boolean; small?: boolean }) {
  const s = small ? 14 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      {muted ? (
        <path d="M22 9l-6 6M16 9l6 6" />
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

function relTime(iso: string, now: number): string {
  if (!now) return "";
  const diff = now - Date.parse(iso);
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}
