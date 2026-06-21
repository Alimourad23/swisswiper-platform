"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { speak } from "@/lib/bridge/voice";
import { createTask, setStatus } from "@/lib/tasks/actions";
import { dateInputToIso } from "@/lib/tasks/format";
import type { TaskPriority, TaskStatus, TaskVisibility } from "@/lib/tasks/types";

/* Push-to-talk conversation with Alfred — VOICE ONLY. Tap the mic → the browser
   transcribes speech → /api/alfred/chat → speak the reply. The star is the only
   ambient feedback (listening = inward cue, speaking = outward flare).

   Alfred can also ACT, via a whitelist:
   • navigate — safe + immediate (router.push), Alfred just confirms aloud.
   • create_task / set_task_status — data changes that REQUIRE confirmation:
     a small on-brand card (Confirm / Cancel) that's also answerable by voice
     ("yes" / "no"). Only on confirm do we call the existing server actions. */

type ChatMessage = { role: "user" | "assistant"; content: string };
type ActionCall = { id: string; name: string; input: Record<string, unknown> };
type Directory = {
  profiles: { id: string; name: string; first: string }[];
  openTasks: { id: string; title: string }[];
};
type Confirm = { description: string; run: () => Promise<string> };

const NAV: Record<string, string> = {
  overview: "/dashboard/overview",
  tasks: "/dashboard/tasks",
  calendar: "/dashboard/calendar",
  emails: "/dashboard/emails",
  marketing: "/dashboard/marketing",
  bridge: "/bridge",
};

/* Minimal shape of the browser SpeechRecognition we use. */
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error: string };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

export default function AlfredChat({
  onSpeakingChange,
  onListeningChange,
}: {
  onSpeakingChange: (speaking: boolean) => void;
  onListeningChange: (listening: boolean) => void;
}) {
  const router = useRouter();

  // Conversation history is kept only to send context to the API — never shown.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const confirmRef = useRef<Confirm | null>(null);
  const timeZone = useRef("UTC");

  useEffect(() => {
    try {
      timeZone.current = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      /* keep UTC */
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) setSupported(false);
  }, []);

  useEffect(() => {
    onListeningChange(listening);
  }, [listening, onListeningChange]);

  const addAssistant = useCallback((text: string) => {
    if (text) setMessages((m) => [...m, { role: "assistant", content: text }]);
  }, []);

  const speakLine = useCallback(
    (text: string, afterEnd?: () => void) => {
      if (!text) {
        afterEnd?.();
        return;
      }
      speak(text, {
        onStart: () => onSpeakingChange(true),
        onEnd: () => {
          onSpeakingChange(false);
          afterEnd?.();
        },
      });
    },
    [onSpeakingChange],
  );

  /* Resolve + execute a proposed data action against real data. */
  const buildConfirm = useCallback(
    (act: ActionCall, dir: Directory): { confirm?: Confirm; proposal?: string; error?: string } => {
      const input = act.input;

      if (act.name === "create_task") {
        const title = String(input.title ?? "").trim();
        if (!title) return { error: "I didn't catch the task title — could you say it again?" };

        const assigneeName = input.assigneeName ? String(input.assigneeName).trim() : "";
        let assigneeId: string | undefined;
        let assigneeLabel = "";
        if (assigneeName) {
          const m = resolveProfile(assigneeName, dir.profiles);
          if (m) {
            assigneeId = m.id;
            assigneeLabel = m.first;
          } else {
            assigneeLabel = `${assigneeName} (not found — will be unassigned)`;
          }
        }

        const dueRaw = input.dueDate ? String(input.dueDate).trim() : "";
        const dueIso = toIso(dueRaw);
        const dueLabel = dueIso ? prettyDate(dueIso) : "";

        const priority = oneOf(input.priority, ["low", "normal", "high"], "normal") as TaskPriority;
        const visibility = oneOf(
          input.visibility,
          ["team", "personal", "founders"],
          "team",
        ) as TaskVisibility;

        const bits = [
          `Create task: “${title}”`,
          assigneeName ? `for ${assigneeLabel}` : "",
          dueLabel ? `due ${dueLabel}` : "",
          priority !== "normal" ? `${priority} priority` : "",
        ].filter(Boolean);
        const description = bits.join("  ·  ");
        const proposal = `Shall I create the task ${title}${assigneeId ? `, for ${assigneeLabel}` : ""}${
          dueLabel ? `, due ${dueLabel}` : ""
        }?`;

        const run = async () => {
          try {
            const r = await createTask({
              title,
              assigneeIds: assigneeId ? [assigneeId] : [],
              dueAt: dueIso,
              priority,
              visibility,
            });
            return r.ok
              ? `Done — I've added “${title}” to the list.`
              : `I couldn't create that, I'm afraid: ${r.error}`;
          } catch {
            return "I couldn't create that, I'm afraid. Do try again.";
          }
        };
        return { confirm: { description, run }, proposal };
      }

      if (act.name === "set_task_status") {
        const ref = String(input.taskTitleOrId ?? "").trim();
        const status = oneOf(input.status, ["todo", "in_progress", "done"], "done") as TaskStatus;
        const task = resolveTask(ref, dir.openTasks);
        if (!task) {
          return { error: `I couldn't find an open task called “${ref}”. Which one did you mean?` };
        }
        const label = status === "done" ? "done" : status === "in_progress" ? "in progress" : "to do";
        const description = `Mark “${task.title}” as ${label}`;
        const proposal = `Shall I mark ${task.title} as ${label}?`;
        const run = async () => {
          try {
            const r = await setStatus(task.id, status);
            return r.ok
              ? `Done — “${task.title}” is now ${label}.`
              : `I couldn't update that: ${r.error}`;
          } catch {
            return "I couldn't update that, I'm afraid. Do try again.";
          }
        };
        return { confirm: { description, run }, proposal };
      }

      return {};
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const next: ChatMessage[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setError(null);
      setBusy(true);
      try {
        const res = await fetch("/api/alfred/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next, timeZone: timeZone.current }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          reply?: string;
          actions?: ActionCall[];
          directory?: Directory;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "Alfred is unavailable right now.");

        const actions = data.actions ?? [];
        const dir = data.directory ?? { profiles: [], openTasks: [] };

        // Navigation — safe + immediate.
        const nav = actions.find((a) => a.name === "navigate");
        if (nav) {
          const path = NAV[String(nav.input.destination ?? "")];
          if (path) router.push(path);
        }

        // Data action — propose, confirm before executing.
        const act = actions.find((a) => a.name === "create_task" || a.name === "set_task_status");
        let nextConfirm: Confirm | null = null;
        let spoken = (data.reply ?? "").trim();
        if (act) {
          const built = buildConfirm(act, dir);
          if (built.error) {
            spoken = built.error; // clear, don't act on an unresolved proposal
          } else if (built.confirm) {
            nextConfirm = built.confirm;
            if (!spoken) spoken = built.proposal ?? "";
          }
        }
        if (!spoken && nav) spoken = "Right away.";

        confirmRef.current = nextConfirm;
        setConfirm(nextConfirm);
        addAssistant(spoken);
        speakLine(spoken, () => {
          // After proposing, listen for a spoken yes/no.
          if (confirmRef.current) startListening();
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    // startListening is defined below; it's stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, router, addAssistant, speakLine, buildConfirm],
  );

  const doConfirm = useCallback(async () => {
    const c = confirmRef.current;
    if (!c) return;
    recRef.current?.abort();
    confirmRef.current = null;
    setConfirm(null);
    setBusy(true);
    const result = await c.run();
    setBusy(false);
    addAssistant(result);
    speakLine(result);
  }, [addAssistant, speakLine]);

  const doCancel = useCallback(() => {
    recRef.current?.abort();
    confirmRef.current = null;
    setConfirm(null);
    const line = "Very good — I'll leave it.";
    addAssistant(line);
    speakLine(line);
  }, [addAssistant, speakLine]);

  const resolveByVoice = useCallback(
    (text: string) => {
      const t = text.toLowerCase();
      if (/\b(yes|yeah|yep|yup|confirm|do it|go ahead|please|sure|affirmative|correct|aye)\b/.test(t)) {
        void doConfirm();
      } else if (/\b(no|nope|nah|cancel|don'?t|stop|never\s?mind|negative|leave it)\b/.test(t)) {
        doCancel();
      } else {
        speakLine("Sorry — was that a yes or a no?", () => {
          if (confirmRef.current) startListening();
        });
      }
    },
    // startListening defined below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doConfirm, doCancel, speakLine],
  );

  const startListening = useCallback(() => {
    setError(null);
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    onSpeakingChange(false);

    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }

    const rec = new Ctor();
    rec.lang = "en-GB";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    finalRef.current = "";

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("I can't hear you — microphone access is blocked.");
      } else if (e.error === "no-speech") {
        setError("I didn't catch anything. Tap and try again.");
      } else if (e.error !== "aborted") {
        setError("I had trouble listening. Do try again.");
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = finalRef.current.trim();
      if (!text) return;
      if (confirmRef.current) resolveByVoice(text);
      else void send(text);
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("I couldn't start listening. Do try again.");
    }
  }, [onSpeakingChange, send, resolveByVoice]);

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (busy) return;
    startListening();
  }

  return (
    <div className="mt-8 flex w-full flex-col items-center">
      {/* Confirm step for data-changing actions (tap, or say yes/no). */}
      {confirm && (
        <div className="mb-5 flex w-full max-w-md flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[#8e9ae0]/25 bg-white/[0.04] px-5 py-4 text-center">
          <p className="text-sm font-light leading-relaxed text-[#eef1f8]">{confirm.description}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void doConfirm()}
              className="rounded-full bg-[#cad1e8] px-5 py-2 text-sm font-medium text-[#06070f] transition-opacity hover:opacity-90"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={doCancel}
              className="rounded-full border border-[#8e9ae0]/30 px-5 py-2 text-sm font-light text-[#cad1e8] transition-colors hover:bg-white/[0.05]"
            >
              Cancel
            </button>
          </div>
          <p className="text-[11px] font-light tracking-wide text-[#8e9ae0]/60">
            or say “yes” or “no”
          </p>
        </div>
      )}

      {/* Mic control — the star carries the ambient feedback. */}
      <button
        type="button"
        onClick={toggleMic}
        disabled={!supported || busy}
        aria-label={listening ? "Stop listening" : "Talk to Alfred"}
        aria-pressed={listening}
        className={[
          "group relative grid h-14 w-14 place-items-center rounded-full border transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8e9ae0]/40 disabled:opacity-40",
          listening
            ? "border-[#cad1e8]/70 bg-[#cad1e8]/15 text-white"
            : "border-[#8e9ae0]/30 bg-white/[0.03] text-[#cad1e8] hover:border-[#8e9ae0]/60 hover:bg-white/[0.06]",
        ].join(" ")}
      >
        {listening && (
          <span className="absolute inset-0 animate-ping rounded-full border border-[#cad1e8]/40" />
        )}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>

      <p className="mt-3 h-4 text-xs font-light tracking-wide text-[#8e9ae0]/60">
        {!supported
          ? "Voice input isn't supported in this browser."
          : error
            ? ""
            : confirm
              ? "Tap Confirm, or say yes / no"
              : listening
                ? "Listening… tap to stop"
                : busy
                  ? "One moment…"
                  : "Tap to talk to Alfred"}
      </p>
      {error && <p className="mt-1 text-xs font-light text-[#e6a3a3]/90">{error}</p>}
    </div>
  );
}

/* ── Resolution helpers ────────────────────────────────────────────────── */

function resolveProfile(
  name: string,
  profiles: Directory["profiles"],
): Directory["profiles"][number] | null {
  const want = name.trim().toLowerCase();
  const exact = profiles.find(
    (p) => p.first.toLowerCase() === want || p.name.toLowerCase() === want,
  );
  if (exact) return exact;
  const subs = profiles.filter((p) => p.name.toLowerCase().includes(want));
  return subs.length === 1 ? subs[0] : null;
}

function resolveTask(
  ref: string,
  openTasks: Directory["openTasks"],
): Directory["openTasks"][number] | null {
  const byId = openTasks.find((t) => t.id === ref);
  if (byId) return byId;
  const want = ref.trim().toLowerCase();
  const exact = openTasks.find((t) => t.title.toLowerCase() === want);
  if (exact) return exact;
  const subs = openTasks.filter((t) => t.title.toLowerCase().includes(want));
  return subs.length === 1 ? subs[0] : null;
}

function oneOf(value: unknown, allowed: string[], fallback: string): string {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function toIso(d: string): string | null {
  if (!d) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return dateInputToIso(d);
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function prettyDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
