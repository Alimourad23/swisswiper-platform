import { Suspense } from "react";
import ModuleHeader from "@/components/ModuleHeader";
import { AutoTag, ServiceBadge } from "@/components/Pill";
import { channels } from "@/lib/marketing/channels";
import { getInstagramAnalytics, type InstagramAnalytics } from "@/lib/marketing/instagram-data";

export const dynamic = "force-dynamic";

/* Instagram analytics — LIVE from the Instagram API on every visit (no cron,
   no export). Each visit also records today's snapshot so the follower-growth
   history builds up day by day. */

export default function InstagramPage() {
  const icon = channels.find((c) => c.key === "instagram")?.icon;
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ModuleHeader
        icon={icon}
        title="Instagram"
        subtitle="Account performance, fetched live from Instagram each time you open this page."
        right={
          <div className="flex items-center gap-2">
            <AutoTag label="Live API" />
            <ServiceBadge label="Instagram" />
          </div>
        }
      />
      <Suspense fallback={<Skeleton />}>
        <InstagramData />
      </Suspense>
    </div>
  );
}

async function InstagramData() {
  const data = await getInstagramAnalytics();

  if (!data.connected) {
    return (
      <div className="sw-card flex flex-col items-start gap-2 p-6">
        <h3 className="text-base font-medium">Instagram isn&apos;t reachable right now</h3>
        <p className="text-sm text-muted">{data.reason}</p>
        <p className="text-xs text-hint">
          If this mentions an expired or invalid token: regenerate it in the Meta dashboard (API setup with
          Instagram login → Generate token) and update INSTAGRAM_ACCESS_TOKEN in Vercel, then redeploy.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs font-medium uppercase tracking-wider text-hint">
        @{data.username} · live from Instagram
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Followers" value={fmt(data.followers)} note={growthNote(data)} />
        <Kpi label="Posts" value={fmt(data.mediaCount)} />
        <Kpi
          label="Avg engagement / post"
          value={fmt(data.avgEngagementPerPost)}
          note={`likes + comments, last ${data.media.length} posts`}
        />
        {data.reach28 !== null ? (
          <Kpi label="Reach (28 days)" value={fmt(data.reach28)} />
        ) : (
          <Kpi label="Total likes" value={fmt(data.totalLikes)} note={`last ${data.media.length} posts`} />
        )}
      </section>

      {data.reach28 === null && (
        <p className="-mt-2 text-xs text-hint">
          Reach &amp; impressions aren&apos;t available with the current Instagram connection — followers and
          per-post engagement are live. (Deeper insights are a planned upgrade.)
        </p>
      )}

      {/* Recent posts */}
      <div className="sw-card">
        <div className="border-b border-hairline px-6 py-4">
          <h3 className="text-base font-medium">Recent posts</h3>
          <p className="text-xs text-hint">Likes and comments straight from Instagram — includes posts made outside the platform.</p>
        </div>
        {data.media.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">
            No posts on the account yet — the first ones will appear here with their live engagement.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-px sm:grid-cols-2">
            {data.media.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-6 py-4">
                {thumb(m.mediaType, m.mediaUrl, m.thumbnailUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb(m.mediaType, m.mediaUrl, m.thumbnailUrl) as string}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-[var(--radius-control)] border border-hairline object-cover"
                  />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[var(--radius-control)] bg-bg text-xs text-hint">
                    {m.mediaType === "VIDEO" ? "Reel" : "Post"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{m.caption || <span className="text-hint">No caption</span>}</p>
                  <p className="mt-1 text-xs text-hint">
                    {fmtDate(m.timestamp)} · {m.mediaType === "VIDEO" ? "Reel" : m.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : "Post"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    ♥ {fmt(m.likeCount)} · 💬 {fmt(m.commentsCount)}
                  </p>
                </div>
                {m.permalink && (
                  <a
                    href={m.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-medium text-peri-deep hover:underline"
                  >
                    Open ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-hint">
        A follower snapshot is saved each day this page is viewed — the growth story builds from today onward.
      </p>
    </div>
  );
}

function growthNote(d: Extract<InstagramAnalytics, { connected: true }>): string | undefined {
  if (d.snapshots.length < 2) return undefined;
  const first = d.snapshots[0];
  const delta = d.followers - first.followers;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} since ${fmtDate(first.snap_date)}`;
}

function thumb(type: string, mediaUrl: string | null, thumbnailUrl: string | null): string | null {
  if (type === "VIDEO") return thumbnailUrl ?? null;
  return mediaUrl ?? thumbnailUrl ?? null;
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="sw-card flex flex-col p-5">
      <p className="text-xs text-hint">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight text-ink">{value}</p>
      {note && <p className="mt-1 text-[11px] text-hint">{note}</p>}
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sw-card h-24 animate-pulse" />
        ))}
      </div>
      <div className="sw-card h-64 animate-pulse" />
    </div>
  );
}
