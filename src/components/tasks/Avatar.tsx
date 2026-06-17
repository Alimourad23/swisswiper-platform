"use client";

import { useState } from "react";
import type { Profile } from "@/lib/tasks/types";
import { initialsOf, displayName } from "@/lib/tasks/format";

const SIZE = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs" };

export default function Avatar({
  profile,
  size = "sm",
}: {
  profile: Profile | undefined;
  size?: keyof typeof SIZE;
}) {
  const [failed, setFailed] = useState(false);
  const name = displayName(profile?.full_name ?? null, profile?.email ?? null);
  const initials = initialsOf(profile?.full_name ?? null, profile?.email ?? null);
  const cls = `inline-grid shrink-0 place-items-center rounded-full ring-1 ring-hairline ${SIZE[size]}`;

  if (profile?.avatar_url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={profile.avatar_url}
        alt={name}
        title={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${cls} object-cover`}
      />
    );
  }
  return (
    <span className={`${cls} bg-peri-soft font-medium text-peri-deep`} title={name}>
      {initials}
    </span>
  );
}

/* A small overlapping stack of assignee avatars. */
export function AvatarStack({
  ids,
  byId,
  max = 3,
}: {
  ids: string[];
  byId: Map<string, Profile>;
  max?: number;
}) {
  if (!ids.length) return <span className="text-xs text-hint">Unassigned</span>;
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((id) => (
        <Avatar key={id} profile={byId.get(id)} />
      ))}
      {extra > 0 && (
        <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-bg text-[10px] font-medium text-muted ring-1 ring-hairline">
          +{extra}
        </span>
      )}
    </div>
  );
}
