import "server-only";

/* Veo (Google video model) client. Generation is a long-running operation:
   start → poll the operation → download the resulting video URI. All calls use
   the same GEMINI_API_KEY as Nano Banana. */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

const MODELS: Record<string, string> = {
  quality: "veo-3.1-generate-preview",
  fast: "veo-3.1-fast-generate-preview",
};

function key(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

export type VeoOpts = { model?: string; aspectRatio?: string; resolution?: string; seconds?: number };

/* Kick off a generation. Returns the operation name to poll. */
export async function startVeo(prompt: string, opts: VeoOpts): Promise<{ name?: string; error?: string }> {
  const apiKey = key();
  if (!apiKey) return { error: "Video generation isn't configured (GEMINI_API_KEY)." };
  const model = MODELS[opts.model ?? "quality"] ?? MODELS.quality;

  const parameters: Record<string, unknown> = {
    aspectRatio: opts.aspectRatio || "16:9",
    resolution: opts.resolution || "1080p",
  };
  if (opts.seconds) parameters.durationSeconds = opts.seconds;

  const res = await fetch(`${BASE}/models/${model}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [{ prompt }], parameters }),
  }).catch(() => null);
  if (!res) return { error: "Couldn't reach Google." };
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    let msg = "";
    try {
      msg = (JSON.parse(txt) as { error?: { message?: string } })?.error?.message ?? "";
    } catch {
      /* non-JSON */
    }
    return { error: msg || `Google returned ${res.status}.` };
  }
  const j = (await res.json().catch(() => ({}))) as { name?: string };
  return j.name ? { name: j.name } : { error: "No operation returned." };
}

type VeoStatus = { done: boolean; uri?: string; error?: string };

/* Check a generation operation. When done, returns the downloadable video URI. */
export async function pollVeo(operation: string): Promise<VeoStatus> {
  const apiKey = key();
  if (!apiKey) return { done: false, error: "Not configured." };
  const res = await fetch(`${BASE}/${operation}`, { headers: { "x-goog-api-key": apiKey }, cache: "no-store" }).catch(
    () => null,
  );
  if (!res || !res.ok) return { done: false, error: res ? `Status ${res.status}.` : "Unreachable." };
  const j = (await res.json().catch(() => ({}))) as {
    done?: boolean;
    error?: { message?: string };
    response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] } };
  };
  if (j.error?.message) return { done: true, error: j.error.message };
  if (!j.done) return { done: false };
  const uri = j.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  return uri ? { done: true, uri } : { done: true, error: "No video in the response." };
}

/* Download the finished video bytes (the URI needs the API key). */
export async function downloadVeo(uri: string): Promise<{ data: Buffer; mime: string } | null> {
  const apiKey = key();
  if (!apiKey) return null;
  const res = await fetch(uri, { headers: { "x-goog-api-key": apiKey } }).catch(() => null);
  if (!res || !res.ok) return null;
  const mime = res.headers.get("content-type") || "video/mp4";
  return { data: Buffer.from(await res.arrayBuffer()), mime };
}
