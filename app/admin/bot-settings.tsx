"use client";

import { useActionState } from "react";
import { saveBotSettings, type SaveState } from "./actions";

export function BotSettings({ instructions }: { instructions: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveBotSettings, { ok: false });
  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="field">
        <span>Instructions for the chat bot</span>
        <textarea name="instructions" rows={8} defaultValue={instructions} />
      </label>
      <p className="text-xs text-muted">
        Plain English is fine. Say what it should check before registering someone&apos;s interest, and anything it should know
        (pickup times, payment, which items are negotiable). Leave empty to use the defaults.
      </p>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : state.savedAt ? "Saved ✓" : "Save"}
      </button>
    </form>
  );
}
