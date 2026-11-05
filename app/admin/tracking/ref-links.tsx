"use client";

import { useActionState, useState } from "react";
import { createRef, deleteRef, type SaveState } from "../actions";

import { SITE_URL } from "@/lib/site";

export type RefRow = { slug: string; label: string; visitors: number; leads: number };

// Create named links (your-site/?ref=slug) to see which channel brings visitors and buyers.
export function RefLinks({ refs }: { refs: RefRow[] }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(createRef, { ok: false });
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(slug: string) {
    await navigator.clipboard.writeText(`${SITE_URL}/?ref=${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1500);
  }

  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-2" key={state.savedAt}>
        <label className="field min-w-40 flex-1">
          <span>Name</span>
          <input name="label" placeholder="e.g. Instagram story, neighbourhood WhatsApp group" required maxLength={60} />
        </label>
        <label className="field w-36">
          <span>Code (optional)</span>
          <input name="slug" placeholder="auto" maxLength={40} />
        </label>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create link"}
        </button>
      </form>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <ul className="divide-y divide-border">
        {refs.map((r) => (
          <li key={r.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{r.label}</div>
              <div className="truncate text-xs text-muted">
                {SITE_URL.replace("https://", "")}/?ref={r.slug}
              </div>
            </div>
            <div className="text-right text-xs text-muted tabular-nums">
              {r.visitors} visitors · {r.leads} leads
            </div>
            <div className="flex gap-1.5">
              <button type="button" className="btn btn-sm" onClick={() => copy(r.slug)}>
                {copied === r.slug ? "Copied ✓" : "Copy link"}
              </button>
              <button
                type="button"
                className="btn btn-sm text-red-700"
                onClick={() => confirm(`Delete the “${r.label}” link? Its past visits stay in the stats.`) && deleteRef(r.slug)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
