"use client";

import { useState } from "react";
import { publishInstagramNow, updatePost } from "@/lib/marketing/schedule-actions";

/* One-click publishing for a single post.
   - Instagram publishes straight through the app (publishInstagramNow) — it needs
     an image/video attached; the engine returns a friendly error otherwise.
   - LinkedIn has no publishing API (read-only weekly export), so it offers a
     copy + open-LinkedIn flow for a manual post.
   Shared by the pipeline row (variant="row") and the Content Studio composer
   footer (variant="bar"), so both places behave identically. */

const LINKEDIN_URL = "https://www.linkedin.com/feed/";

export default function PublishNow({
  postId,
  channel,
  getText,
  onPublished,
  variant = "row",
}: {
  postId: string;
  channel: string;
  /** Latest post copy — saved to the row before publishing / used for Copy. */
  getText?: () => string;
  onPublished?: (permalink: string | null) => void;
  variant?: "row" | "bar";
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string | null } | null>(null);

  const isIG = channel === "instagram";
  const isLI = channel === "linkedin";

  async function publishIG() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    if (getText) await updatePost(postId, { body: getText(), channel: "instagram" });
    const res = await publishInstagramNow(postId);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Published", link: res.permalink ?? null });
      onPublished?.(res.permalink ?? null);
    } else {
      setMsg({ ok: false, text: res.error ?? "Couldn't publish." });
    }
  }

  function copyLI() {
    const t = (getText?.() ?? "").trim();
    void navigator.clipboard?.writeText(t);
    setMsg({ ok: true, text: "Copied — paste it into LinkedIn" });
  }

  // Nothing to publish from here for other channels (e.g. website).
  if (!isIG && !isLI) return null;

  if (variant === "row") {
    return (
      <span className="flex shrink-0 items-center gap-2">
        {isIG ? (
          <button
            type="button"
            onClick={publishIG}
            disabled={busy}
            className="rounded-full bg-peri-deep px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Publish now"}
          </button>
        ) : (
          <button
            type="button"
            onClick={copyLI}
            className="rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-peri-deep transition-colors hover:brightness-95"
          >
            Copy for LinkedIn
          </button>
        )}
        {msg && (
          <span className={`text-[11px] ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
            {msg.link ? (
              <>
                {" · "}
                <a href={msg.link} target="_blank" rel="noopener noreferrer" className="underline">
                  view ↗
                </a>
              </>
            ) : null}
          </span>
        )}
      </span>
    );
  }

  // variant === "bar" — full-width footer used inside the Studio composer.
  return (
    <div className="flex flex-col gap-2 border-t border-hairline bg-surface px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] text-muted">
        {msg ? (
          <span className={msg.ok ? "font-medium text-emerald-600" : "font-medium text-red-600"}>
            {msg.text}
            {msg.link ? (
              <>
                {" — "}
                <a href={msg.link} target="_blank" rel="noopener noreferrer" className="text-peri-deep underline">
                  view ↗
                </a>
              </>
            ) : null}
          </span>
        ) : isIG ? (
          "Attach an image in the Studio, then publish straight to @swisswiper."
        ) : (
          "LinkedIn posting is manual — copy your text and post it on LinkedIn."
        )}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {isIG ? (
          <button
            type="button"
            onClick={publishIG}
            disabled={busy}
            className="rounded-full bg-peri-deep px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-60"
          >
            {busy ? "Publishing…" : "Publish to Instagram now"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={copyLI}
              className="rounded-full border border-hairline px-4 py-2 text-[12.5px] font-medium text-ink transition-colors hover:bg-bg"
            >
              Copy text
            </button>
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-peri-deep px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-[#4d5793]"
            >
              Open LinkedIn ↗
            </a>
          </>
        )}
      </div>
    </div>
  );
}
