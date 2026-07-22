"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ManualTag } from "@/components/Pill";

export type Engager = { id: string; name: string; note: string };

export default function NotableEngagers({ initial }: { initial: Engager[] }) {
  const [items, setItems] = useState<Engager[]>(initial);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notable_engagers")
      .insert({ name: name.trim(), note: note.trim() })
      .select("id, name, note")
      .single();
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setItems([{ id: data.id, name: data.name, note: data.note ?? "" }, ...items]);
    setName("");
    setNote("");
  }

  async function remove(id: string) {
    setItems(items.filter((i) => i.id !== id));
    const supabase = createClient();
    await supabase.from("notable_engagers").delete().eq("id", id);
  }

  return (
    <div className="sw-card">
      <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-medium">Notable engagers</h3>
          <ManualTag />
        </div>
        <span className="text-xs text-hint">You fill this in</span>
      </div>

      <div className="px-6 py-5">
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Sanitas Troesch)"
            className="h-10 flex-1 rounded-[var(--radius-control)] border border-hairline bg-bg px-3 text-sm text-ink outline-none focus:border-peri-deep/40"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (e.g. commented on launch post)"
            className="h-10 flex-1 rounded-[var(--radius-control)] border border-hairline bg-bg px-3 text-sm text-ink outline-none focus:border-peri-deep/40"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-peri-deep px-5 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-60"
          >
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {items.length > 0 ? (
          <ul className="mt-4 flex flex-col">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between gap-3 border-t border-hairline py-2.5 first:border-t-0"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-ink">{it.name}</span>
                  {it.note && <p className="truncate text-sm text-muted">{it.note}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => remove(it.id)}
                  className="shrink-0 text-xs text-hint hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-hint">
            No engagers added yet. Add the people and companies worth following up with.
          </p>
        )}
      </div>
    </div>
  );
}
