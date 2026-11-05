"use client";

import { useState, useTransition } from "react";
import type { Interest } from "@/lib/db";
import { leadMessage, telegramLink, whatsappLink } from "@/lib/lead-message";
import { TIME_ZONE } from "@/lib/site";
import { setHandled } from "./actions";
import { Transcript } from "./transcript";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export function InterestRow({ interest }: { interest: Interest }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const wa = whatsappLink(interest);
  const tg = telegramLink(interest);

  async function openTelegram() {
    await navigator.clipboard.writeText(leadMessage(interest)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    window.open(tg!, "_blank", "noopener");
  }

  return (
    <li className={`card space-y-1.5 p-3 ${interest.handled ? "opacity-50" : ""} ${pending ? "animate-pulse" : ""}`}>
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
        <span className="truncate font-medium text-accent-ink">{interest.item_title}</span>
        <time className="shrink-0">{timeFormat.format(new Date(interest.created_at))}</time>
      </div>
      <div className="font-medium">
        {interest.name || <span className="text-muted">No name</span>}
        {interest.contact && <span className="font-normal text-muted"> · {interest.contact}</span>}
        {interest.app === "telegram" && <span className="pill ml-1.5 bg-sky-100 text-sky-950">Telegram</span>}
        <span className="pill ml-1.5 bg-surface-2 text-muted">{interest.language === "pt" ? "Português" : "English"}</span>
      </div>
      {interest.pickup_when && <p className="text-sm"><span className="text-muted">Pickup:</span> {interest.pickup_when}</p>}
      {interest.offer && <p className="text-sm"><span className="text-muted">Offer:</span> {interest.offer}</p>}
      <p className="text-sm whitespace-pre-line text-muted">{interest.message}</p>
      {interest.chat_messages && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">View chat ({interest.chat_messages.length} messages)</summary>
          <div className="mt-1.5">
            <Transcript messages={interest.chat_messages} />
          </div>
        </details>
      )}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-sm border-[#1ea952] bg-[#25d366] font-semibold text-[#0b3d1d] hover:bg-[#25d366] hover:brightness-95">
            Message on WhatsApp
          </a>
        )}
        {tg && interest.app === "telegram" && (
          <button className="btn btn-sm" onClick={openTelegram}>
            {copied ? "Message copied, paste it ✓" : "Copy message & open Telegram"}
          </button>
        )}
        <button className="btn btn-sm" onClick={() => start(() => setHandled(interest.id, !interest.handled))}>
          {interest.handled ? "Mark as new" : "Mark as handled"}
        </button>
      </div>
    </li>
  );
}
