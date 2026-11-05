"use client";

import { AREA, MAP_URL, PICKUP_PLACE, SELLER } from "@/lib/site";
import { capture, context } from "@/lib/track";
import { useEffect, useRef, useState } from "react";
import { Bi, BiInline } from "./bi";

type Turn = { role: "user" | "assistant"; content: string };
type Lang = "pt" | "en";

const ERRORS: Record<string, { pt: string; en: string }> = {
  limit: {
    pt: "Muitas mensagens por hoje. Tenta amanhã.",
    en: "Too many messages for today. Please try again tomorrow.",
  },
  default: {
    pt: "O chat não está a funcionar agora. Tenta daqui a pouco.",
    en: "The chat isn't working right now. Please try again in a bit.",
  },
};

export type ChatItem = {
  id: number;
  titlePt: string;
  titleEn: string;
  price: { pt: string; en: string }; // "30 €", or "aceito propostas" / "make an offer"
  availableFrom: { pt: string; en: string } | null; // still in use until then
};

type Reply = { pt: string; en: string; sendPt: string; sendEn: string };
const r = (pt: string, en: string, sendPt = pt, sendEn = en): Reply => ({ pt, en, sendPt, sendEn });

// Tappable answers shown above the text box.
// One tap to say they want it; the bot then asks for their phone number.
const OPENING_REPLIES = [r("Quero reservar", "I want it", "Quero reservar", "I'd like to reserve it")];
const WHEN_REPLIES = [r("Hoje", "Today"), r("Amanhã", "Tomorrow"), r("Este fim de semana", "This weekend")];
const ASKS_WHEN = /\b(quando|que dia|a que horas|when|which day|what day|what time)\b/i;
const NUDGE_AFTER_MS = 30_000;
const NUDGE = {
  pt: "Dúvidas sobre o estado ou a recolha? Pergunta à vontade, ou toca em «Quero reservar» e deixa o teu número.",
  en: "Questions about condition or pickup? Just ask, or tap “I want it” and leave your number.",
};
const DONE = {
  pt: `✓ Pedido registado. ${SELLER} vai entrar em contacto contigo.`,
  en: `✓ Request registered. ${SELLER} will get in touch with you.`,
};

function greeting(items: ChatItem[]) {
  if (items.length > 1) {
    const pt = items.map((i) => `${i.titlePt} (${i.price.pt})`).join(", ");
    const en = items.map((i) => `${i.titleEn} (${i.price.en})`).join(", ");
    return {
      pt: `Olá! Escolheste ${items.length} artigos: ${pt}. Recolha em ${AREA.pt}, tudo de uma vez. Queres reservar?`,
      en: `Hi! You picked ${items.length} items: ${en}. Pickup in ${AREA.en}, all in one go. Want to reserve them?`,
    };
  }
  const [i] = items;
  if (i.availableFrom) {
    return {
      pt: `Olá! «${i.titlePt}» (${i.price.pt}) fica disponível a partir de ${i.availableFrom.pt}, mas podes reservar já. Recolha em ${AREA.pt}. Queres reservar?`,
      en: `Hi! The “${i.titleEn}” (${i.price.en}) is available from ${i.availableFrom.en}, and you can reserve it now. Pickup in ${AREA.en}. Want to reserve it?`,
    };
  }
  return {
    pt: `Olá! «${i.titlePt}» ainda está disponível, por ${i.price.pt}. Recolha em ${AREA.pt}. Queres reservar?`,
    en: `Hi! The “${i.titleEn}” is still available for ${i.price.en}. Pickup in ${AREA.en}. Want to reserve it?`,
  };
}

export function ChatButton({ item }: { item: ChatItem }) {
  const reserve = !!item.availableFrom; // item still in use: offer to reserve it instead
  const itemId = item.id;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary btn-card w-full" onClick={() => {
          setOpen(true);
          capture("chat_opened", { itemIds: [itemId] });
        }}
      >
        {/* A short, slim label on phone cards so the photo stays the focus. */}
        <span className="sm:hidden">
          {reserve ? <BiInline pt="Reservar" en="Reserve" /> : <BiInline pt="Quero" en="I want it" />}
        </span>
        <span className="hidden sm:inline">
          {reserve ? <BiInline pt="Reservar" en="Reserve" /> : <BiInline pt="Tenho interesse" en="I'm interested" />}
        </span>
      </button>
      <ChatDialog items={[item]} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// The chat window. Works for one item or several picked at once.
export function ChatDialog({ items, open, onClose }: { items: ChatItem[]; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<keyof typeof ERRORS | null>(null);
  const [pending, setPending] = useState(false);
  const [nudged, setNudged] = useState(false);
  // Picked first, so the seller knows which language to message them in.
  const [lang, setLang] = useState<Lang | null>(null);
  const chatId = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  const several = items.length > 1;
  const namesPt = items.map((i) => i.titlePt).join(", ");
  const hello = greeting(items);
  const lastBot = turns.at(-1)?.role === "assistant" ? turns.at(-1)!.content : "";
  const replies = !lang || pending || registered ? [] : turns.length === 0 ? OPENING_REPLIES : ASKS_WHEN.test(lastBot) ? WHEN_REPLIES : [];

  // One gentle follow-up if they open the chat and don't write anything.
  useEffect(() => {
    if (!open || !lang || turns.length > 0 || nudged) return;
    const t = setTimeout(() => {
      setNudged(true);
      capture("chat_nudge_shown", { itemIds: items.map((i) => i.id) });
    }, NUDGE_AFTER_MS);
    return () => clearTimeout(t);
  }, [open, lang, turns.length, nudged, items]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending, registered, error, nudged, lang]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = dialog.current;
    if (!open || !el) return;
    el.showModal();
    // Keep the page behind the chat from scrolling (CSS alone isn't reliable on iOS).
    document.documentElement.style.overflow = "hidden";

    // iOS doesn't shrink the page when the keyboard opens, so keep the sheet above it
    // by fitting it to the visible area.
    const vv = window.visualViewport;
    const mobile = vv && !matchMedia("(min-width: 640px)").matches;
    const fit = () => {
      if (!vv) return;
      el.style.height = `${Math.min(vv.height - 8, window.innerHeight * 0.85)}px`;
      el.style.marginBottom = `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`;
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    };
    if (mobile) {
      fit();
      vv.addEventListener("resize", fit);
      vv.addEventListener("scroll", fit);
    }
    const closed = () => onCloseRef.current();
    el.addEventListener("close", closed);
    return () => {
      el.removeEventListener("close", closed);
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      el.style.height = "";
      el.style.marginBottom = "";
      document.documentElement.style.overflow = "";
      if (el.open) el.close();
    };
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setError(null);
    setPending(true);
    capture("chat_message_sent", { itemIds: items.map((i) => i.id), turn: next.length });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds: items.map((i) => i.id),
          messages: next,
          registered,
          lang,
          chatId: (chatId.current ??= crypto.randomUUID()),
          visitor: context().visitor,
          ref: context().ref,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === "limit" ? "limit" : "default");
        setTurns(turns); // drop the unanswered message so a retry starts clean
        if (input.current) input.current.value = content;
        return;
      }
      if (data.reply) setTurns([...next, { role: "assistant", content: data.reply }]);
      if (data.registered && !registered) {
        setRegistered(true);
        capture("lead_registered", { itemIds: items.map((i) => i.id) });
      }
    } catch {
      setError("default");
      setTurns(turns);
      if (input.current) input.current.value = content;
    } finally {
      setPending(false);
    }
  }

  function chooseLang(l: Lang) {
    setLang(l);
    capture("chat_language_chosen", { itemIds: items.map((i) => i.id), lang: l });
    // On phones, don't pop the keyboard over the greeting; let people tap the box when ready.
    if (matchMedia("(pointer: fine)").matches) setTimeout(() => input.current?.focus(), 0);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.current?.value ?? "";
    if (input.current) input.current.value = "";
    send(text);
  }

  return (
    <>
      <dialog
        ref={dialog}
        className="chat-modal"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        {/* Rendered only while open so closed chats cost nothing on a page of 34 items. */}
        {open && <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            {several ? (
              <div className="min-w-0">
                <h2 className="leading-snug font-semibold">
                  <BiInline pt={`${items.length} artigos`} en={`${items.length} items`} />
                </h2>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted">{namesPt}</p>
              </div>
            ) : (
              <h2 className="leading-snug font-semibold">
                <Bi even pt={items[0].titlePt} en={items[0].titleEn} />
              </h2>
            )}
            <button
              type="button"
              aria-label="Fechar / Close"
              className="-mt-2 -mr-3 flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-muted hover:bg-surface-2"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {lang ? (
              <div className="bubble bubble-bot" lang={lang}>{hello[lang]}</div>
            ) : (
              <div className="bubble bubble-bot">
                <Bi even className="text-[0.9rem]" pt="Olá! Preferes falar em português ou em inglês?" en="Hi! Would you like to chat in Portuguese or English?" />
              </div>
            )}

            {lang && nudged && turns.length === 0 && (
              <div className="bubble bubble-bot" lang={lang}>{NUDGE[lang]}</div>
            )}

            {turns.map((t, i) => (
              <div key={i} className={`bubble whitespace-pre-line ${t.role === "user" ? "bubble-user" : "bubble-bot"}`}>
                {t.role === "assistant" ? <WithMapLink text={t.content} /> : t.content}
              </div>
            ))}

            {pending && (
              <div className="bubble bubble-bot inline-flex gap-1" aria-label="…">
                <span className="dot" />
                <span className="dot [animation-delay:150ms]" />
                <span className="dot [animation-delay:300ms]" />
              </div>
            )}

            {registered && (
              <p className="rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-2.5 text-sm text-accent-ink">
                {DONE[lang ?? "pt"]}
              </p>
            )}

            {error && (
              <p className="text-sm text-red-700">
                {lang ? ERRORS[error][lang] : <Bi even pt={ERRORS[error].pt} en={ERRORS[error].en} />}
              </p>
            )}
          </div>

          {!lang && (
            <div className="grid grid-cols-2 gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button type="button" lang="pt" className="btn btn-primary min-h-14 text-base" onClick={() => chooseLang("pt")}>
                Português
              </button>
              <button type="button" lang="en" className="btn btn-primary min-h-14 text-base" onClick={() => chooseLang("en")}>
                English
              </button>
            </div>
          )}

          {replies.length > 0 && lang && (
            <div className={`grid gap-1.5 border-t border-border px-3 pt-3 ${replies.length === 1 ? "grid-cols-1" : replies.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {replies.map((q) => (
                <button
                  key={q.en}
                  type="button"
                  className="rounded-xl border border-accent/40 bg-accent-soft px-2.5 py-1.5 text-left leading-tight text-accent-ink hover:brightness-95"
                  onClick={() => {
                    capture("quick_reply_tapped", { itemIds: items.map((i) => i.id), reply: q.en });
                    send(lang === "pt" ? q.sendPt : q.sendEn);
                  }}
                >
                  <span lang={lang} className="block text-sm font-medium">{q[lang]}</span>
                </button>
              ))}
            </div>
          )}

          {lang && <form onSubmit={onSubmit} className={`flex items-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${replies.length ? "" : "border-t border-border"}`}>
            <textarea
              ref={input}
              rows={1}
              maxLength={1000}
              placeholder={lang === "pt" ? "Mensagem" : "Message"}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button className="btn btn-primary size-11 shrink-0 px-0" disabled={pending} aria-label={lang === "pt" ? "Enviar" : "Send"}>
              <SendIcon />
            </button>
          </form>}
        </div>}
      </dialog>
    </>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

// Turns the pickup place's name in bot replies into a Google Maps link.
function WithMapLink({ text }: { text: string }) {
  const parts = text.split(PICKUP_PLACE);
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <a key={i} href={MAP_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">
            {PICKUP_PLACE}
          </a>,
          part,
        ],
  );
}
