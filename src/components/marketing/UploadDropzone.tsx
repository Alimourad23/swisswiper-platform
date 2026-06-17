"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = { kind: "idle" | "busy" | "ok" | "error"; message?: string };

export default function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const form = new FormData();
    Array.from(fileList).forEach((f) => form.append("files", f));
    setStatus({ kind: "busy" });
    try {
      const res = await fetch("/api/linkedin/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: json.error ?? "Upload failed." });
        return;
      }
      setStatus({
        kind: "ok",
        message: `Updated — ${json.followers} followers, ${json.impressions.toLocaleString()} impressions.`,
      });
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Upload failed. Please try again." });
    }
  }

  return (
    <div className="sw-card px-6 py-5" id="upload">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Upload weekly export</h3>
        <span className="text-xs text-hint">Content · Followers · Visitors (.xls)</span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(e.dataTransfer.files);
        }}
        className={[
          "mt-4 flex w-full flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-peri-deep bg-peri-soft" : "border-[rgba(92,102,166,0.3)] bg-peri-soft/40",
        ].join(" ")}
      >
        <span className="text-sm font-medium text-ink">Drop your LinkedIn export files here</span>
        <span className="mt-1 text-sm text-muted">or click to choose — you can select all three at once</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      {status.kind === "busy" && <p className="mt-3 text-sm text-muted">Parsing…</p>}
      {status.kind === "ok" && <p className="mt-3 text-sm font-medium text-live">{status.message}</p>}
      {status.kind === "error" && (
        <p className="mt-3 text-sm font-medium text-red-600">{status.message}</p>
      )}
    </div>
  );
}
