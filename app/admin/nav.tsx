import Link from "next/link";
import { logout } from "./actions";
import { MarkDevice } from "./mark-device";

// Admin header: switch between the item list and the Tracking screen.
export function AdminNav({ active }: { active: "items" | "tracking" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${on ? "bg-foreground text-background" : "hover:bg-surface-2"}`}>
      {label}
    </Link>
  );
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-8">
      <MarkDevice />
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <nav className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {tab("/admin", "Items", active === "items")}
          {tab("/admin/tracking", "Tracking", active === "tracking")}
        </nav>
      </div>
      <div className="flex gap-2">
        <Link href="/" className="btn btn-sm" target="_blank">
          View site ↗
        </Link>
        <form action={logout}>
          <button className="btn btn-sm">Log out</button>
        </form>
      </div>
    </header>
  );
}
