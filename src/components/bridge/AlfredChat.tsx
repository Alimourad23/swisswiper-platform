"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { speak } from "@/lib/bridge/voice";
import { createTask, setStatus } from "@/lib/tasks/actions";
import { dateInputToIso } from "@/lib/tasks/format";
import type { TaskPriority, TaskStatus, TaskVisibility } from "@/lib/tasks/types";
import TaskReview, { type TaskDraft } from "@/components/bridge/TaskReview";

/* Push-to-talk conversation with Alfred — VOICE ONLY. Tap the mic → the browser
   transcribes speech → /api/alfred/chat → speak the reply. The star is the only
   ambient feedback (listening = inward cue, speaking = outward flare).

   Alfred can ACT via a whitelist:
   • navigate — safe + immediate (router.push), Alfred confirms aloud.
   • create_task — Alfred drafts it; an EDITABLE prefilled review panel appears
     (title, multi-assignee, due, priority, visibility). Alfred speaks a short
     summary; the user reviews/edits and confirms (button or voice "yes") to
     create. Nothing is created until confirmed; afterwards he offers to open it.
   • set_task_status — a small Confirm/Cancel card, answerable by voice. */

type ChatMessage = { role: "user" | "assistant"; content: string };
type ActionCall = { id: string; name: string; input: Record<string, unknown> };
type Person = { id: string; name: string; first: string };
type Directory = {
  profiles: Person[];
  openTasks: { id: string; title: string }[];
  userRole?: "member" | "founder";
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

const YES = /\b(yes|yeah|yep|yup|confirm|create it|do it|go ahead|please|sure|affirmative|correct|aye)\b/;
const NO = /\b(no|nope|nah|cancel|don'?t|stop|never\s?mind|negative|leave it)\b/;
const DISMISS =
  /\b(that'?s all|that'?ll be all|that is all|dismiss|go away|goodbye|good bye|thank you alfred|thanks alfred|nothing else|that'?s it)\b/;

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
  active = true,
  onDismiss,
  autoListenKey = 0,
}: {
  onSpeakingChange: (speaking: boolean) => void;
  onListeningChange: (listening: boolean) => void;
  /** When false (e.g. overlay closed), Alfred stops listening/speaking but
   *  keeps the conversation in memory. Defaults true (the Bridge). */
  active?: boolean;
  /** If provided, saying "that's all" dismisses Alfred (used by the overlay). */
  onDismiss?: () => void;
  /** Increment to make Alfred start listening immediately (e.g. on wake word). */
  autoListenKey?: number;
}) {
  const router = useRouter();

  // Conversation history is kept only to send context to the API — never shown.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  // set_task_status / post-create offer use the simple confirm.
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // create_task uses the editable review panel.
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [roster, setRoster] = useState<Person[]>([]);
  const [canFounders, setCanFounders] = useState(false);

  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const confirmRef = useRef<Confirm | null>(null);
  const draftRef = useRef<TaskDraft | null>(null);
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

  // Keep the ref in step with edits made in the review panel.
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

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

  /* ── create_task → editable draft ─────────────────────────────────────── */
  const buildDraft = useCallback(
    (act: ActionCall, dir: Directory): { draft?: TaskDraft; summary?: string; error?: string } => {
      const input = act.input;
      const title = String(input.title ?? "").trim();
      if (!title) return { error: "I didn't catch the task title — could you say it again?" };

      const namesRaw: unknown[] = Array.isArray(input.assigneeNames)
        ? input.assigneeNames
        : input.assigneeName
          ? [input.assigneeName]
          : [];
      const assigneeIds: string[] = [];
      const resolvedFirst: string[] = [];
      const unresolved: string[] = [];
      for (const n of namesRaw) {
        const name = String(n ?? "").trim();
        if (!name) continue;
        const m = resolveProfile(name, dir.profiles);
        if (m) {
          if (!assigneeIds.includes(m.id)) {
            assigneeIds.push(m.id);
            resolvedFirst.push(m.first);
          }
        } else {
          unresolved.push(name);
        }
      }

      const due = toDateInput(input.dueDate ? String(input.dueDate).trim() : "");
      const dueLabel = due ? prettyDate(dateInputToIso(due) ?? "") : "";
      const priority = oneOf(input.priority, ["low", "normal", "high"], "normal") as TaskPriority;
      const visibility = oneOf(
        input.visibility,
        ["team", "personal", "founders"],
        "team",
      ) as TaskVisibility;

      const who = resolvedFirst.length ? `assigned to ${joinNames(resolvedFirst)}` : "unassigned for now";
      let summary = `I've drafted a task: ${title}, ${who}${dueLabel ? `, due ${dueLabel}` : ""} — shall I create it?`;
      if (unresolved.length) {
        summary += ` I couldn't place ${joinNames(unresolved)}; do add ${
          unresolved.length > 1 ? "them" : "them"
        } yourself if you like.`;
      }

      return { draft: { title, assigneeIds, due, priority, visibility }, summary };
    },
    [],
  );

  /* ── set_task_status → simple confirm ─────────────────────────────────── */
  const buildStatusConfirm = useCallback(
    (act: ActionCall, dir: Directory): { confirm?: Confirm; proposal?: string; error?: string } => {
      const input = act.input;
      const ref = String(input.taskTitleOrId ?? "").trim();
      const status = oneOf(input.status, ["todo", "in_progress", "done"], "done") as TaskStatus;
      const task = resolveTask(ref, dir.openTasks);
      if (!task) {
        return { error: `I couldn't find an open task called “${ref}”. Which one did you mean?` };
      }
      const label = status === "done" ? "done" : status === "in_progress" ? "in progress" : "to do";
      const proposal = `Shall I mark ${task.title} as ${label}?`;
      const run = async () => {
        try {
          const r = await setStatus(task.id, status);
          return r.ok ? `Done — “${task.title}” is now ${label}.` : `I couldn't update that: ${r.error}`;
        } catch {
          return "I couldn't update that, I'm afraid. Do try again.";
        }
      };
      return { confirm: { description: `Mark “${task.title}” as ${label}`, run }, proposal };
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
        const dir: Directory = data.directory ?? { profiles: [], openTasks: [] };

        // Navigation — safe + immediate.
        const nav = actions.find((a) => a.name === "navigate");
        if (nav) {
          const path = NAV[String(nav.input.destination ?? "")];
          if (path) router.push(path);
        }

        let spoken = (data.reply ?? "").trim();
        let nextDraft: TaskDraft | null = null;
        let nextConfirm: Confirm | null = null;

        const createAct = actions.find((a) => a.name === "create_task");
        const statusAct = actions.find((a) => a.name === "set_task_status");

        if (createAct) {
          const built = buildDraft(createAct, dir);
          if (built.error) spoken = built.error;
          else {
            nextDraft = built.draft ?? null;
            setRoster(dir.profiles);
            setCanFounders(dir.userRole === "founder");
            spoken = built.summary ?? spoken; // speak the deterministic summary
          }
        } else if (statusAct) {
          const built = buildStatusConfirm(statusAct, dir);
          if (built.error) spoken = built.error;
          else if (built.confirm) {
            nextConfirm = built.confirm;
            if (!spoken) spoken = built.proposal ?? "";
          }
        }

        if (!spoken && nav) spoken = "Right away.";

        draftRef.current = nextDraft;
        setDraft(nextDraft);
        confirmRef.current = nextConfirm;
        setConfirm(nextConfirm);

        addAssistant(spoken);
        speakLine(spoken, () => {
          // After a proposal/summary, listen for a spoken yes/no.
          if (draftRef.current || confirmRef.current) startListening();
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    // startListening is defined below; stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, router, addAssistant, speakLine, buildDraft, buildStatusConfirm],
  );

  const submitDraft = useCallback(async () => {
    const d = draftRef.current;
    if (!d) return;
    if (!d.title.trim()) {
      speakLine("It will need a title first.");
      return;
    }
    recRef.current?.abort();
    draftRef.current = null;
    setDraft(null);
    setBusy(true);
    let line = "";
    let createdId: string | undefined;
    try {
      const r = await createTask({
        title: d.title.trim(),
        assigneeIds: d.assigneeIds,
        dueAt: d.due ? dateInputToIso(d.due) : null,
        priority: d.priority,
        visibility: d.visibility,
      });
      if (r.ok) {
        createdId = r.id;
        line = `Done — I've created “${d.title.trim()}”. Shall I take you to it?`;
      } else {
        line = `I couldn't create that, I'm afraid: ${r.error}`;
      }
    } catch {
      line = "I couldn't create that, I'm afraid. Do try again.";
    }
    setBusy(false);
    addAssistant(line);

    if (createdId) {
      const id = createdId;
      const offer: Confirm = {
        description: `Open “${d.title.trim()}” now?`,
        run: async () => {
          router.push(`/dashboard/tasks?task=${id}`);
          onDismiss?.(); // reveal the task — close the overlay if we're in one
          return "";
        },
      };
      confirmRef.current = offer;
      setConfirm(offer);
      speakLine(line, () => {
        if (confirmRef.current) startListening();
      });
    } else {
      speakLine(line);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addAssistant, speakLine, router, onDismiss]);

  const cancelDraft = useCallback(() => {
    recRef.current?.abort();
    draftRef.current = null;
    setDraft(null);
    const line = "Very good — I'll leave it.";
    addAssistant(line);
    speakLine(line);
  }, [addAssistant, speakLine]);

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
      const relisten = () => {
        if (draftRef.current || confirmRef.current) startListening();
      };
      if (draftRef.current) {
        if (YES.test(t)) void submitDraft();
        else if (NO.test(t)) cancelDraft();
        else speakLine("Sorry — shall I create it? Yes or no.", relisten);
        return;
      }
      if (confirmRef.current) {
        if (YES.test(t)) void doConfirm();
        else if (NO.test(t)) doCancel();
        else speakLine("Sorry — was that a yes or a no?", relisten);
      }
    },
    // startListening defined below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submitDraft, cancelDraft, doConfirm, doCancel, speakLine],
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
      if (draftRef.current || confirmRef.current) resolveByVoice(text);
      else if (onDismiss && DISMISS.test(text.toLowerCase())) onDismiss();
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
  }, [onSpeakingChange, send, resolveByVoice, onDismiss]);

  // When deactivated (overlay closed), stop listening/speaking — keep the
  // conversation in memory so it resumes on reopen.
  useEffect(() => {
    if (active) return;
    recRef.current?.abort();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setListening(false);
    onSpeakingChange(false);
  }, [active, onSpeakingChange]);

  // Wake word / auto-listen: start listening as soon as Alfred is summoned.
  useEffect(() => {
    if (autoListenKey > 0 && active) startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoListenKey]);

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
      {/* Editable review panel for create_task. */}
      {draft && (
        <TaskReview
          draft={draft}
          profiles={roster}
          canFounders={canFounders}
          busy={busy}
          onChange={(patch) =>
            setDraft((d) => {
              if (!d) return d;
              const nd = { ...d, ...patch };
              draftRef.current = nd;
              return nd;
            })
          }
          onConfirm={() => void submitDraft()}
          onCancel={cancelDraft}
        />
      )}

      {/* Simple confirm for set_task_status / "open it" offer. */}
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
            : draft
              ? "Review and edit, then Create — or say yes"
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

function resolveProfile(name: string, profiles: Person[]): Person | null {
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
  openTasks: { id: string; title: string }[],
): { id: string; title: string } | null {
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

function toDateInput(d: string): string {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const t = Date.parse(d);
  if (Number.isNaN(t)) return "";
  const dt = new Date(t);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
