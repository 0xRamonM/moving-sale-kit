"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card mx-auto mt-20 w-full max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-semibold">Admin</h1>
      <label className="field">
        <span>Password</span>
        <input type="password" name="password" required autoFocus autoComplete="current-password" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Checking…" : "Log in"}
      </button>
    </form>
  );
}
