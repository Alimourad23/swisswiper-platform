"use client";

/* Editable marketing-post FIELDS, rendered inside an ActionPanel (which supplies
   the card shell + Create/Revise/Cancel buttons). Creating a post here only
   plans it in the pipeline — the caption is written in the Content Studio,
   where Alfred auto-drafts it from the seed idea. */

export type PostDraft = {
  title: string;
  channel: string; // linkedin | instagram | tiktok | youtube | website
  date: string; // YYYY-MM-DD, "" = undated (backlog idea)
  seedIdea: string; // one-line creative brief for the Studio auto-draft
  goal: string; // "" | awareness | followers | inquiries | community
};

const CHANNELS: { value: string; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "website", label: "Website" },
];

const GOALS: { value: string; label: string }[] = [
  { value: "", label: "None" },
  { value: "awareness", label: "Awareness" },
  { value: "followers", label: "Followers" },
  { value: "inquiries", label: "Inquiries" },
  { value: "community", label: "Community" },
];

const inputCls =
  "w-full rounded-[var(--radius-control)] border border-[#8e9ae0]/25 bg-white/[0.04] px-3 py-2 text-sm text-[#eef1f8] placeholder:text-[#8e9ae0]/40 focus:border-[#8e9ae0]/60 focus:outline-none";

export default function PostReview({
  draft,
  onChange,
}: {
  draft: PostDraft;
  onChange: (patch: Partial<PostDraft>) => void;
}) {
  return (
    <>
      <Field label="Post topic">
        <input
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Working title or topic"
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Channel">
          <select
            value={draft.channel}
            onChange={(e) => onChange({ channel: e.target.value })}
            style={{ colorScheme: "dark" }}
            className={inputCls}
          >
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Post date">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => onChange({ date: e.target.value })}
            style={{ colorScheme: "dark" }}
            className={inputCls}
          />
        </Field>
        <Field label="Goal">
          <select
            value={draft.goal}
            onChange={(e) => onChange({ goal: e.target.value })}
            style={{ colorScheme: "dark" }}
            className={inputCls}
          >
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Idea brief (Alfred drafts the caption from this in the Studio)">
        <textarea
          value={draft.seedIdea}
          onChange={(e) => onChange({ seedIdea: e.target.value })}
          rows={2}
          placeholder="One line on the angle — e.g. 'Hard water etches glass permanently; STILL CLEAR is the answer.'"
          className={`${inputCls} resize-y`}
        />
      </Field>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#8e9ae0]/60">{label}</span>
      {children}
    </label>
  );
}
