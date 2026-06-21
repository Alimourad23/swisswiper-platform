"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { speak, stopSpeaking } from "@/lib/bridge/voice";
import { createTask, setStatus } from "@/lib/tasks/actions";
import { createEmailDraft, createReplyDraft, sendEmail } from "@/lib/google/gmail-actions";
import { createEvent, rescheduleEvent, cancelEvent } from "@/lib/google/calendar-actions";
import { dateInputToIso } from "@/lib/tasks/format";
import type { TaskPriority, TaskStatus, TaskVisibility } from "@/lib/tasks/types";
import ActionPanel, { type PanelOption } from "@/components/bridge/ActionPanel";
import TaskReview, { type TaskDraft } from "@/components/bridge/TaskReview";
import EmailReview, { type EmailDraftState } from "@/components/bridge/EmailReview";
import EventReview, { type EventDraftState } from "@/components/bridge/EventReview";

/* Push-to-talk conversation with Alfred — VOICE ONLY. Every proposal opens ONE
   consistent review panel (wide card + on-screen options + spoken choices).
   Options are available as buttons AND voice; a "Revise" intent on any panel
   re-opens the conversation so Alfred adjusts the proposal in place. Nothing
   changes data without an explicit confirmation. */

type ChatMessage = { role: "user" | "assistant"; content: string };
type ActionCall = { id: string; name: string; input: Record<string, unknown> };
type Person = { id: string; name: string; first: string; email: string };
type EmailRef = { ref: string; messageId: string; from: string; fromEmail: string; subject: string };
type EventRef = { ref: string; id: string; title: string; start: string; end: string; when: string };
type Directory = {
  profiles: Person[];
  openTasks: { id: string; title: string }[];
  emails: EmailRef[];
  events: EventRef[];
  userEmail?: string;
  userRole?: "member" | "founder";
};
type Confirm = { description: string; danger?: boolean; run: () => Promise<string> };

const NAV: Record<string, string> = {
  overview: "/dashboard/overview",
  tasks: "/dashboard/tasks",
  calendar: "/dashboard/calendar",
  emails: "/dashboard/emails",
  marketing: "/dashboard/marketing",
  bridge: "/bridge",
};

const YES = /\b(yes|yeah|yep|yup|confirm|create|create it|go ahead|please|sure|affirmative|correct|aye|ok|okay)\b/;
const NO = /\b(no|nope|nah|cancel|don'?t|stop|never\s?mind|negative|leave it|discard)\b/;
const SEND = /\b(send it|send now|send|fire it off)\b/;
const SAVE = /\b(save (draft|it|as draft)?|draft it|just draft|keep it as a draft)\b/;
const REVISE = /\b(revise|redraft|re-?draft|rewrite|re-?write|redo|re-?do|not quite|amend|adjust|tweak|change (it|that|this)|edit it|make changes?)\b/;
const DISMISS =
  /\b(that'?s all|that'?ll be all|that is all|dismiss|go away|goodbye|good bye|thank you alfred|thanks alfred|nothing else|that'?s it)\b/;

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
  onPanelOpenChange,
  active = true,
  onDismiss,
  autoListenKey = 0,
}: {
  onSpeakingChange: (speaking: boolean) => void;
  onListeningChange: (listening: boolean) => void;
  /** Fires whenever a review/confirm panel opens or closes (parent hides the
   *  greeting/briefing while one is open). */
  onPanelOpenChange?: (open: boolean) => void;
  active?: boolean;
  onDismiss?: () => void;
  autoListenKey?: number;
}) {
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  // One interactive panel at a time.
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [emailDraft, setEmailDraft] = useState<EmailDraftState | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraftState | null>(null);
  const [roster, setRoster] = useState<Person[]>([]);
  const [canFounders, setCanFounders] = useState(false);

  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const confirmRef = useRef<Confirm | null>(null);
  const taskRef = useRef<TaskDraft | null>(null);
  const emailRefState = useRef<EmailDraftState | null>(null);
  const eventRefState = useRef<EventDraftState | null>(null);
  const rosterRef = useRef<Person[]>([]);
  const revisingRef = useRef(false);
  const timeZone = useRef("UTC");

  const panelOpen = !!(taskDraft || emailDraft || eventDraft || confirm);

  const hasPending = useCallback(
    () => !!(taskRef.current || emailRefState.current || eventRefState.current || confirmRef.current),
    [],
  );

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

  useEffect(() => onListeningChange(listening), [listening, onListeningChange]);
  useEffect(() => onPanelOpenChange?.(panelOpen), [panelOpen, onPanelOpenChange]);

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

  const clearPendings = useCallback(() => {
    taskRef.current = null;
    emailRefState.current = null;
    eventRefState.current = null;
    confirmRef.current = null;
    setTaskDraft(null);
    setEmailDraft(null);
    setEventDraft(null);
    setConfirm(null);
  }, []);

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
        const dir: Directory = data.directory ?? { profiles: [], openTasks: [], emails: [], events: [] };

        const nav = actions.find((a) => a.name === "navigate");
        if (nav) {
          const path = NAV[String(nav.input.destination ?? "")];
          if (path) router.push(path);
        }

        let spoken = (data.reply ?? "").trim();
        const act = actions.find((a) => a.name !== "navigate");

        // Apply atomically: clear the old panel and set the new one in one tick
        // (no greeting flash when revising in place).
        clearPendings();
        if (act) {
          const built = interpret(act, dir, timeZone.current);
          if (built.error) {
            spoken = built.error;
          } else {
            if (built.task) {
              taskRef.current = built.task;
              setTaskDraft(built.task);
              setRoster(dir.profiles);
              rosterRef.current = dir.profiles;
              setCanFounders(dir.userRole === "founder");
            } else if (built.email) {
              emailRefState.current = built.email;
              setEmailDraft(built.email);
            } else if (built.event) {
              eventRefState.current = built.event;
              setEventDraft(built.event);
            } else if (built.confirm) {
              confirmRef.current = built.confirm;
              setConfirm(built.confirm);
            }
            if (built.spoken) spoken = built.spoken;
          }
        }
        if (!spoken && nav) spoken = "Right away.";

        addAssistant(spoken);
        speakLine(spoken, () => {
          if (hasPending()) startListening();
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    // startListening defined below; stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, router, addAssistant, speakLine, clearPendings, hasPending],
  );

  /* ── Result + offer ───────────────────────────────────────────────────── */

  const finishWithResult = useCallback(
    (line: string, offer?: Confirm) => {
      setBusy(false);
      addAssistant(line);
      if (offer) {
        confirmRef.current = offer;
        setConfirm(offer);
        speakLine(line, () => {
          if (confirmRef.current) startListening();
        });
      } else {
        speakLine(line);
      }
    },
    // startListening defined below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addAssistant, speakLine],
  );

  /* ── Submit handlers ──────────────────────────────────────────────────── */

  const submitTask = useCallback(async () => {
    const d = taskRef.current;
    if (!d) return;
    if (!d.title.trim()) return speakLine("It will need a title first.");
    recRef.current?.abort();
    taskRef.current = null;
    setTaskDraft(null);
    setBusy(true);
    try {
      const r = await createTask({
        title: d.title.trim(),
        assigneeIds: d.assigneeIds,
        dueAt: d.due ? dateInputToIso(d.due) : null,
        priority: d.priority,
        visibility: d.visibility,
      });
      if (r.ok && r.id) {
        const id = r.id;
        finishWithResult(`Done — I've created “${d.title.trim()}”. Shall I take you to it?`, {
          description: `Open “${d.title.trim()}” now?`,
          run: async () => {
            router.push(`/dashboard/tasks?task=${id}`);
            onDismiss?.();
            return "";
          },
        });
      } else {
        finishWithResult(r.ok ? "Done." : `I couldn't create that: ${r.error}`);
      }
    } catch {
      finishWithResult("I couldn't create that, I'm afraid.");
    }
  }, [speakLine, finishWithResult, router, onDismiss]);

  const submitEmailDraft = useCallback(async () => {
    const d = emailRefState.current;
    if (!d) return;
    if (!d.to.trim()) return speakLine("It needs a recipient first.");
    recRef.current?.abort();
    emailRefState.current = null;
    setEmailDraft(null);
    setBusy(true);
    try {
      const r = d.messageId
        ? await createReplyDraft({ messageId: d.messageId, to: d.to, subject: d.subject, body: d.body })
        : await createEmailDraft({ to: d.to, subject: d.subject, body: d.body });
      finishWithResult(r.ok ? "I've drafted it in your Gmail." : `I couldn't draft it: ${r.error}`);
    } catch {
      finishWithResult("I couldn't do that with your email, I'm afraid.");
    }
  }, [speakLine, finishWithResult]);

  const submitEmailSend = useCallback(async () => {
    const d = emailRefState.current;
    if (!d) return;
    if (!d.to.trim()) return speakLine("It needs a recipient first.");
    recRef.current?.abort();
    emailRefState.current = null;
    setEmailDraft(null);
    setBusy(true);
    try {
      const r = await sendEmail({ to: d.to, subject: d.subject, body: d.body, messageId: d.messageId });
      finishWithResult(r.ok ? "Sent." : `I couldn't send it: ${r.error}`);
    } catch {
      finishWithResult("I couldn't send that, I'm afraid.");
    }
  }, [speakLine, finishWithResult]);

  const submitEvent = useCallback(async () => {
    const d = eventRefState.current;
    if (!d) return;
    recRef.current?.abort();
    eventRefState.current = null;
    setEventDraft(null);
    setBusy(true);
    try {
      if (d.mode === "reschedule" && d.eventId) {
        const r = await rescheduleEvent({ eventId: d.eventId, start: d.start, end: d.end, timeZone: timeZone.current });
        finishWithResult(r.ok ? `Done — I've moved “${d.title}”.` : `I couldn't move it: ${r.error}`);
      } else {
        const r = await createEvent({
          title: d.title,
          start: d.start,
          end: d.end,
          attendees: d.attendees.split(",").map((s) => s.trim()).filter(Boolean),
          description: d.description,
          timeZone: timeZone.current,
        });
        finishWithResult(r.ok ? `Done — “${d.title}” is on your calendar.` : `I couldn't create it: ${r.error}`);
      }
    } catch {
      finishWithResult("I couldn't do that with your calendar, I'm afraid.");
    }
  }, [finishWithResult]);

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

  const cancelPending = useCallback(() => {
    recRef.current?.abort();
    revisingRef.current = false;
    clearPendings();
    const line = "Very good — I'll leave it.";
    addAssistant(line);
    speakLine(line);
  }, [clearPendings, addAssistant, speakLine]);

  /* ── Revise: keep the panel, ask what to change, re-propose in place ────── */

  const triggerRevise = useCallback(() => {
    if (!(taskRef.current || emailRefState.current || eventRefState.current)) return;
    revisingRef.current = true;
    speakLine("Of course — what would you like to change?", () => startListening());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakLine]);

  const reviseSend = useCallback(
    (instruction: string) => {
      const msg = buildReviseMessage(instruction, rosterRef.current, {
        task: taskRef.current,
        email: emailRefState.current,
        event: eventRefState.current,
      });
      if (msg) void send(msg);
    },
    [send],
  );

  /* ── Voice routing ────────────────────────────────────────────────────── */

  const resolveByVoice = useCallback(
    (text: string) => {
      const t = text.toLowerCase();
      const relisten = () => {
        if (hasPending()) startListening();
      };
      if (REVISE.test(t) && (taskRef.current || emailRefState.current || eventRefState.current)) {
        triggerRevise();
        return;
      }
      if (emailRefState.current) {
        if (SEND.test(t)) void submitEmailSend();
        else if (SAVE.test(t) || YES.test(t)) void submitEmailDraft();
        else if (NO.test(t)) cancelPending();
        else speakLine("Send, save draft, redraft, or cancel?", relisten);
      } else if (taskRef.current) {
        if (YES.test(t)) void submitTask();
        else if (NO.test(t)) cancelPending();
        else speakLine("Create, revise, or cancel?", relisten);
      } else if (eventRefState.current) {
        if (YES.test(t)) void submitEvent();
        else if (NO.test(t)) cancelPending();
        else speakLine("Confirm, revise, or cancel?", relisten);
      } else if (confirmRef.current) {
        if (YES.test(t)) void doConfirm();
        else if (NO.test(t)) cancelPending();
        else speakLine("Confirm or cancel?", relisten);
      }
    },
    // startListening defined below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submitTask, submitEmailDraft, submitEmailSend, submitEvent, doConfirm, cancelPending, triggerRevise, speakLine, hasPending],
  );

  const startListening = useCallback(() => {
    setError(null);
    stopSpeaking();
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
      if (revisingRef.current) {
        revisingRef.current = false;
        reviseSend(text);
        return;
      }
      if (hasPending()) resolveByVoice(text);
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
  }, [onSpeakingChange, send, resolveByVoice, reviseSend, onDismiss, hasPending]);

  useEffect(() => {
    if (active) return;
    recRef.current?.abort();
    stopSpeaking();
    setListening(false);
    onSpeakingChange(false);
  }, [active, onSpeakingChange]);

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

  /* ── Panel options ────────────────────────────────────────────────────── */

  const taskOptions: PanelOption[] = [
    { label: "Create", kind: "primary", onClick: () => void submitTask() },
    { label: "Revise", kind: "ghost", onClick: triggerRevise },
    { label: "Cancel", kind: "ghost", onClick: cancelPending },
  ];
  const emailOptions: PanelOption[] = [
    { label: "Send", kind: "send", onClick: () => void submitEmailSend() },
    { label: "Redraft", kind: "ghost", onClick: triggerRevise },
    { label: "Save draft", kind: "primary", onClick: () => void submitEmailDraft() },
    { label: "Cancel", kind: "ghost", onClick: cancelPending },
  ];
  const eventOptions: PanelOption[] = [
    {
      label: eventDraft?.mode === "reschedule" ? "Reschedule" : "Create",
      kind: "primary",
      onClick: () => void submitEvent(),
    },
    { label: "Revise", kind: "ghost", onClick: triggerRevise },
    { label: "Cancel", kind: "ghost", onClick: cancelPending },
  ];
  const confirmOptions: PanelOption[] = [
    { label: "Confirm", kind: confirm?.danger ? "danger" : "primary", onClick: () => void doConfirm() },
    { label: "Cancel", kind: "ghost", onClick: cancelPending },
  ];

  const hint = !supported
    ? "Voice input isn't supported in this browser."
    : error
      ? ""
      : panelOpen
        ? "Tap a choice, or just say it"
        : listening
          ? "Listening… tap to stop"
          : busy
            ? "One moment…"
            : "Tap to talk to Alfred";

  return (
    <div className="mt-8 flex w-full flex-col items-center">
      {taskDraft && (
        <ActionPanel title="New task — review" say="Create · Revise · Cancel" options={taskOptions} busy={busy}>
          <TaskReview
            draft={taskDraft}
            profiles={roster}
            canFounders={canFounders}
            onChange={(patch) =>
              setTaskDraft((d) => {
                if (!d) return d;
                const nd = { ...d, ...patch };
                taskRef.current = nd;
                return nd;
              })
            }
          />
        </ActionPanel>
      )}

      {emailDraft && (
        <ActionPanel
          title={emailDraft.messageId ? "Reply draft — review" : "Email draft — review"}
          say="Send · Redraft · Save draft · Cancel"
          options={emailOptions}
          busy={busy}
        >
          <EmailReview
            draft={emailDraft}
            onChange={(patch) =>
              setEmailDraft((d) => {
                if (!d) return d;
                const nd = { ...d, ...patch };
                emailRefState.current = nd;
                return nd;
              })
            }
          />
        </ActionPanel>
      )}

      {eventDraft && (
        <ActionPanel
          title={eventDraft.mode === "reschedule" ? "Reschedule event — review" : "New event — review"}
          say={`${eventDraft.mode === "reschedule" ? "Reschedule" : "Create"} · Revise · Cancel`}
          options={eventOptions}
          busy={busy}
        >
          <EventReview
            draft={eventDraft}
            onChange={(patch) =>
              setEventDraft((d) => {
                if (!d) return d;
                const nd = { ...d, ...patch };
                eventRefState.current = nd;
                return nd;
              })
            }
          />
        </ActionPanel>
      )}

      {confirm && (
        <ActionPanel title="Please confirm" say="Confirm · Cancel" options={confirmOptions} busy={busy}>
          <p className="text-sm font-light leading-relaxed text-[#eef1f8]">{confirm.description}</p>
        </ActionPanel>
      )}

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
        {listening && <span className="absolute inset-0 animate-ping rounded-full border border-[#cad1e8]/40" />}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>

      <p className="mt-3 h-4 text-xs font-light tracking-wide text-[#8e9ae0]/60">{hint}</p>
      {error && <p className="mt-1 text-xs font-light text-[#e6a3a3]/90">{error}</p>}
    </div>
  );
}

/* ── Pure interpreters: tool call → review/confirm + spoken proposal ─────── */

type Interpretation = {
  task?: TaskDraft;
  email?: EmailDraftState;
  event?: EventDraftState;
  confirm?: Confirm;
  spoken?: string;
  error?: string;
};

function interpret(act: ActionCall, dir: Directory, _tz: string): Interpretation {
  const input = act.input;
  switch (act.name) {
    case "create_task":
      return interpretTask(input, dir);
    case "set_task_status":
      return interpretStatus(input, dir);
    case "draft_reply":
      return interpretDraftReply(input, dir);
    case "draft_email":
      return interpretDraftEmail(input, dir);
    case "send_email":
      return interpretSendEmail(input, dir);
    case "create_event":
      return interpretCreateEvent(input);
    case "reschedule_event":
      return interpretReschedule(input, dir);
    case "cancel_event":
      return interpretCancel(input, dir);
    default:
      return {};
  }
}

function interpretTask(input: Record<string, unknown>, dir: Directory): Interpretation {
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
    } else unresolved.push(name);
  }
  const due = toDateInput(input.dueDate ? String(input.dueDate).trim() : "");
  const dueLabel = due ? prettyDate(dateInputToIso(due) ?? "") : "";
  const priority = oneOf(input.priority, ["low", "normal", "high"], "normal") as TaskPriority;
  const visibility = oneOf(input.visibility, ["team", "personal", "founders"], "team") as TaskVisibility;
  const who = resolvedFirst.length ? `assigned to ${joinNames(resolvedFirst)}` : "unassigned";
  let spoken = `I've drafted a task: ${title}, ${who}${dueLabel ? `, due ${dueLabel}` : ""}.`;
  if (unresolved.length) spoken += ` I couldn't place ${joinNames(unresolved)}.`;
  spoken += " Say create, revise, or cancel.";
  return { task: { title, assigneeIds, due, priority, visibility }, spoken };
}

function interpretStatus(input: Record<string, unknown>, dir: Directory): Interpretation {
  const ref = String(input.taskTitleOrId ?? "").trim();
  const status = oneOf(input.status, ["todo", "in_progress", "done"], "done") as TaskStatus;
  const task = resolveTask(ref, dir.openTasks);
  if (!task) return { error: `I couldn't find an open task called “${ref}”. Which one did you mean?` };
  const label = status === "done" ? "done" : status === "in_progress" ? "in progress" : "to do";
  return {
    confirm: {
      description: `Mark “${task.title}” as ${label}.`,
      run: async () => {
        try {
          const r = await setStatus(task.id, status);
          return r.ok ? `Done — “${task.title}” is now ${label}.` : `I couldn't update that: ${r.error}`;
        } catch {
          return "I couldn't update that, I'm afraid.";
        }
      },
    },
    spoken: `Shall I mark ${task.title} as ${label}? Say confirm or cancel.`,
  };
}

function interpretDraftReply(input: Record<string, unknown>, dir: Directory): Interpretation {
  const email = resolveEmail(String(input.emailRef ?? "").trim(), dir.emails);
  if (!email) return { error: "I couldn't find which email to reply to. Which one did you mean?" };
  const subject = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`;
  return {
    email: { to: email.fromEmail || email.from, subject, body: String(input.body ?? ""), messageId: email.messageId, fromName: email.from },
    spoken: `I've drafted a reply to ${email.from}. Say send, save draft, redraft, or cancel.`,
  };
}

function interpretDraftEmail(input: Record<string, unknown>, dir: Directory): Interpretation {
  const rawTo = String(input.to ?? "").trim();
  const to = rawTo.includes("@") ? rawTo : resolveProfileEmail(rawTo, dir.profiles) || rawTo;
  return {
    email: { to, subject: String(input.subject ?? ""), body: String(input.body ?? "") },
    spoken: `I've drafted an email${to ? ` to ${shortRecipient(to)}` : ""}. Say send, save draft, redraft, or cancel.`,
  };
}

function interpretSendEmail(input: Record<string, unknown>, dir: Directory): Interpretation {
  const refStr = input.emailRef ? String(input.emailRef).trim() : "";
  const body = String(input.body ?? "");
  if (refStr) {
    const email = resolveEmail(refStr, dir.emails);
    if (!email) return { error: "I couldn't find which email to send a reply to. Which one?" };
    const subject = /^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`;
    return {
      email: { to: email.fromEmail || email.from, subject, body, messageId: email.messageId, fromName: email.from },
      spoken: `Ready to reply to ${email.from}. Say send to send now, save draft, redraft, or cancel.`,
    };
  }
  const rawTo = String(input.to ?? "").trim();
  const to = rawTo.includes("@") ? rawTo : resolveProfileEmail(rawTo, dir.profiles) || rawTo;
  return {
    email: { to, subject: String(input.subject ?? ""), body },
    spoken: `Ready to email${to ? ` ${shortRecipient(to)}` : ""}. Say send to send now, save draft, redraft, or cancel.`,
  };
}

function interpretCreateEvent(input: Record<string, unknown>): Interpretation {
  const title = String(input.title ?? "").trim();
  if (!title) return { error: "I didn't catch the event title." };
  const start = toLocalInput(String(input.start ?? ""));
  if (!start) return { error: "I didn't catch a valid start time." };
  const end = input.end ? toLocalInput(String(input.end)) : addMinutesLocal(start, 60);
  const attendees = Array.isArray(input.attendees)
    ? (input.attendees as unknown[]).map((a) => String(a ?? "").trim()).filter(Boolean)
    : [];
  return {
    event: { mode: "create", title, start, end, attendees: attendees.join(", "), description: String(input.description ?? "") },
    spoken: `I've drafted an event: ${title}, ${whenLabel(start)}. Say create, revise, or cancel.`,
  };
}

function interpretReschedule(input: Record<string, unknown>, dir: Directory): Interpretation {
  const ev = resolveEvent(String(input.eventRef ?? "").trim(), dir.events);
  if (!ev) return { error: "I couldn't find which event to move. Which one did you mean?" };
  const start = toLocalInput(String(input.newStart ?? ""));
  if (!start) return { error: "I didn't catch a valid new time." };
  let end: string;
  if (input.newEnd) end = toLocalInput(String(input.newEnd));
  else {
    const durMs = Date.parse(ev.end) - Date.parse(ev.start);
    end = addMinutesLocal(start, Number.isFinite(durMs) && durMs > 0 ? durMs / 60000 : 60);
  }
  return {
    event: { mode: "reschedule", title: ev.title, start, end, attendees: "", description: "", eventId: ev.id },
    spoken: `Move ${ev.title} to ${whenLabel(start)}? Say reschedule, revise, or cancel.`,
  };
}

function interpretCancel(input: Record<string, unknown>, dir: Directory): Interpretation {
  const ev = resolveEvent(String(input.eventRef ?? "").trim(), dir.events);
  if (!ev) return { error: "I couldn't find which event to cancel. Which one did you mean?" };
  return {
    confirm: {
      danger: true,
      description: `Cancel “${ev.title}” (${ev.when})? It will be removed from your calendar.`,
      run: async () => {
        try {
          const r = await cancelEvent({ eventId: ev.id });
          return r.ok ? `Done — I've cancelled “${ev.title}”.` : `I couldn't cancel it: ${r.error}`;
        } catch {
          return "I couldn't cancel it, I'm afraid.";
        }
      },
    },
    spoken: `Shall I cancel ${ev.title} on ${ev.when}? Say confirm or cancel.`,
  };
}

/* ── Revise message — current proposal + the requested change ───────────── */

function buildReviseMessage(
  instruction: string,
  roster: Person[],
  pend: { task: TaskDraft | null; email: EmailDraftState | null; event: EventDraftState | null },
): string | null {
  const change = instruction.trim();
  if (!change) return null;
  if (pend.task) {
    const t = pend.task;
    const names = t.assigneeIds
      .map((id) => roster.find((p) => p.id === id)?.first)
      .filter(Boolean)
      .join(", ");
    return `Please revise the task we're about to create. Current — title: "${t.title}"; assignees: ${
      names || "none"
    }; due: ${t.due || "none"}; priority: ${t.priority}; visibility: ${t.visibility}. The change: ${change}. Re-propose it with create_task.`;
  }
  if (pend.email) {
    const e = pend.email;
    const kind = e.messageId ? `reply to ${e.fromName || e.to}` : `email to ${e.to}`;
    return `Please revise the ${kind} we're drafting (subject "${e.subject}"). Current body: "${e.body}". The change: ${change}. Re-propose the same email as a draft.`;
  }
  if (pend.event) {
    const v = pend.event;
    return `Please revise the event we're proposing. Current — title: "${v.title}"; start: ${v.start}; end: ${v.end}; attendees: ${
      v.attendees || "none"
    }. The change: ${change}. Re-propose it.`;
  }
  return null;
}

/* ── Resolution + formatting helpers ───────────────────────────────────── */

function resolveProfile(name: string, profiles: Person[]): Person | null {
  const want = name.trim().toLowerCase();
  const exact = profiles.find((p) => p.first.toLowerCase() === want || p.name.toLowerCase() === want);
  if (exact) return exact;
  const subs = profiles.filter((p) => p.name.toLowerCase().includes(want));
  return subs.length === 1 ? subs[0] : null;
}

function resolveProfileEmail(name: string, profiles: Person[]): string {
  return resolveProfile(name, profiles)?.email ?? "";
}

function resolveTask(ref: string, openTasks: { id: string; title: string }[]): { id: string; title: string } | null {
  const byId = openTasks.find((t) => t.id === ref);
  if (byId) return byId;
  const want = ref.trim().toLowerCase();
  const exact = openTasks.find((t) => t.title.toLowerCase() === want);
  if (exact) return exact;
  const subs = openTasks.filter((t) => t.title.toLowerCase().includes(want));
  return subs.length === 1 ? subs[0] : null;
}

function resolveEmail(ref: string, emails: EmailRef[]): EmailRef | null {
  if (!ref) return emails[0] ?? null;
  const want = ref.trim().toLowerCase();
  const byId = emails.find((e) => e.messageId === ref);
  if (byId) return byId;
  const hit = emails.find(
    (e) =>
      e.from.toLowerCase().includes(want) ||
      e.subject.toLowerCase().includes(want) ||
      want.includes(e.from.toLowerCase()),
  );
  return hit ?? null;
}

function resolveEvent(ref: string, events: EventRef[]): EventRef | null {
  if (!ref) return events[0] ?? null;
  const want = ref.trim().toLowerCase();
  const byId = events.find((e) => e.id === ref);
  if (byId) return byId;
  const hit = events.find((e) => e.title.toLowerCase().includes(want) || e.when.toLowerCase().includes(want));
  return hit ?? null;
}

function oneOf(value: unknown, allowed: string[], fallback: string): string {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function toDateInput(d: string): string {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const t = Date.parse(d);
  if (Number.isNaN(t)) return "";
  return formatLocalDate(new Date(t));
}

function toLocalInput(s: string): string {
  const t = s.trim();
  const m = t.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (m) return `${m[1]}T${m[2]}`;
  const parsed = Date.parse(t);
  if (Number.isNaN(parsed)) return "";
  return formatLocalDateTime(new Date(parsed));
}

function addMinutesLocal(local: string, minutes: number): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  d.setMinutes(d.getMinutes() + Math.round(minutes));
  return formatLocalDateTime(d);
}

function formatLocalDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function formatLocalDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${formatLocalDate(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function prettyDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function whenLabel(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function shortRecipient(to: string): string {
  return to.split("@")[0] || to;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
