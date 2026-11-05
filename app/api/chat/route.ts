import Anthropic from "@anthropic-ai/sdk";
import { sql, formatPrice, toItems, withFutureDates, type Item } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AREA, PICKUP_PLACE, SELLER, TIME_ZONE } from "@/lib/site";

const MODEL = "claude-haiku-5-5";
const DAILY_LIMIT = 80; // chat requests per visitor per day
const MAX_TURNS = 30;
const MAX_CHARS = 1000;

type ChatTurn = { role: "user" | "assistant"; content: string };
// Set when the bot registered the visitor's interest for the seller to follow up.
type Registered = { registered: true };

// Leads saved because the visitor typed a number before the bot registered them start with this,
// so a later proper registration replaces them.
const AUTO_NOTE = "Left their number in the chat before the bot finished. Read the chat for details.";

// The first thing in the visitor's messages that looks like a phone number (9–15 digits), or null.
function phoneIn(turns: ChatTurn[]) {
  for (const t of turns) {
    if (t.role !== "user") continue;
    for (const m of t.content.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []) {
      const digits = m.replace(/\D/g, "").length;
      if (digits >= 9 && digits <= 15) return m.trim();
    }
  }
  return null;
}

const REGISTER_TOOL: Anthropic.Tool = {
  name: "register_interest",
  description:
    `Register the visitor's interest so ${SELLER} can contact them to arrange the purchase. Call it as soon as you have their phone number; nothing else is needed. Afterwards, tell them it's registered and ${SELLER} will get in touch.`,
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["item_ids", "name", "phone", "app", "pickup_when", "offer", "language", "summary"],
    properties: {
      item_ids: { type: "array", items: { type: "integer" }, description: "IDs of the items they want." },
      name: { type: "string", description: "The visitor's name if they gave it, otherwise an empty string." },
      phone: { type: "string", description: "Their phone number, as they gave it (with country code if they gave one)." },
      app: { type: "string", enum: ["whatsapp", "telegram"], description: "telegram only if they said so; otherwise whatsapp." },
      pickup_when: { type: "string", description: "When they could pick up, in their own words, or an empty string if they didn't say." },
      offer: { type: "string", description: "Their price offer if they made one below the listed price, otherwise an empty string." },
      language: { type: "string", enum: ["pt", "en"], description: "The language the visitor is writing in." },
      summary: { type: "string", description: `One or two sentences in English for ${SELLER}: what they want and anything notable.` },
    },
  },
};

function priceText(cents: number | null) {
  const p = formatPrice(cents);
  return typeof p === "string" ? p : `${p.en} / ${p.pt}`;
}

function localNow() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE,
  }).format(new Date());
}

function systemPrompt(items: Item[], picked: Item[], instructions: string, lang: "pt" | "en" | null) {
  const catalog = items
    .map((i) => `#${i.id} | ${i.title_pt} / ${i.title_en} | ${priceText(i.price_cents)} | ${i.status}` +
      (i.available_from ? ` | still in use, can be reserved now, pickup from ${i.available_from}` : "") +
      (i.description_en ? ` | ${i.description_en}` : ""))
    .join("\n");
  return `You are the chat assistant on ${SELLER}'s personal sale page (they are selling their own things). Visitors open this chat by tapping "I'm interested" on an item.

Your job: answer their questions about the items, pickup and availability, and get a phone number ${SELLER} can message on WhatsApp, then register their interest with the register_interest tool. ${SELLER} contacts them afterwards to handle payment, exact times and anything you don't know. Never give out a phone number or contact for ${SELLER}.

Keep it short, people drop long chats. The phone number is the only thing you need. As soon as they want an item or show real interest (asking to reserve, making an offer, asking when they can pick up), ask for their phone number in that same reply. The moment they give a number, call register_interest: don't ask for their name, pickup time or anything else first. Include their name, pickup time and offer only if they already said them. Assume WhatsApp unless they mention Telegram, and never ask which app. Don't accept email, Instagram or other contacts: if they offer one, kindly say ${SELLER} uses WhatsApp or Telegram and ask for a phone number.

Pickup: write the place exactly as "${PICKUP_PLACE}" (it becomes a map link). When they ask when they can pick up, tell them the availability from the seller's instructions; if they propose a day and time inside it (including today), say yes and that ${SELLER} will reach out to confirm the exact time. If they propose a time outside it, don't turn them away: say ${SELLER} will work out a time with them, and get their number.

Language: ${lang === "pt" ? "the visitor chose to chat in Portuguese, so always reply in European Portuguese, even if they switch." : lang === "en" ? "the visitor chose to chat in English, so always reply in English, even if they switch." : "always reply in the language of the visitor's latest message."} If they write in English, reply in English; if in Portuguese, reply in European Portuguese with informal "tu" (never "você" or "pode-me"). The catalog has Portuguese titles, but that does not decide the reply language.

Style: Never mention item ids or "#" numbers; refer to items by name. Be brief and friendly, like a text message: one to three short sentences, no lists, no markdown. Ask at most one question at a time. Never invent facts about an item that aren't in the catalog; say ${SELLER} can tell them when they get in touch. Don't promise or hold items; reserved items may still fall through, so say ${SELLER} can tell them. Sold items are not available. Stay on the topic of this sale.

Selling (gently): be warm and helpful, never pushy. At most one of these per reply, and none when they're only asking for information:
- Make reserving feel easy and low-commitment: "I can reserve it for you and ${SELLER} will confirm the time."
- Don't suggest other items they didn't ask about.
- If price is the concern, mention they could pick up several things in one trip, and that you'll pass any offer on to ${SELLER}.
- Never refuse an offer; note it and say ${SELLER} decides.
- Don't invent urgency: never say others are interested or that stock is running out. You may give an item's own available-from date when it has one, and any end date the seller's instructions mention.

Some items are still in use and only available from a later date (marked in the catalog). They can be reserved now: treat a reservation like a purchase, and for pickup ask roughly when after that date they could come. Mention the date when it's relevant.

Right now it is ${localNow()} (${TIME_ZONE}).

Seller's instructions:
${instructions}

Catalog (id | Portuguese / English title | price | status | notes):
${catalog}

${picked.length > 1
    ? `The visitor picked several items and opened one chat about all of them: ${picked.map((i) => `#${i.id} (${i.title_en})`).join(", ")}. Treat them as one purchase: check availability of each, and register their interest once for all the ones they still want.`
    : `The visitor opened the chat from item #${picked[0].id} (${picked[0].title_en}).`} They were already greeted with a message saying the item is available, its price, that pickup is in ${AREA.en}, and asking if they want to reserve it, so don't greet them again. A short "yes", "quero" or "I want it" means they want to reserve. Register interest at most once per conversation; after that, just answer questions and remind them ${SELLER} will get in touch.`;
}

async function underDailyLimit(ip: string) {
  const [row] = await sql`
    insert into chat_usage (ip, count) values (${ip}, 1)
    on conflict (ip, day) do update set count = chat_usage.count + 1
    returning count`;
  return (row.count as number) <= DAILY_LIMIT;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { itemId?: number; itemIds?: number[]; messages?: ChatTurn[]; registered?: boolean; lang?: string; chatId?: string; visitor?: string; ref?: string | null } | null;
  const turns = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (turns[0]?.role !== "user" || turns.at(-1)?.role !== "user") {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // The language they picked at the start of the chat; the seller messages them in it.
  const lang = body?.lang === "pt" || body?.lang === "en" ? body.lang : null;
  const chatId = /^[0-9a-f-]{36}$/i.test(String(body?.chatId ?? "")) ? String(body!.chatId) : null;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!(await underDailyLimit(ip))) return Response.json({ error: "limit" }, { status: 429 });

  const [itemRows, settings] = await Promise.all([
    sql`select * from items where visible order by position, id`,
    getSettings(),
  ]);
  const items = withFutureDates(toItems(itemRows));
  const ids = (body?.itemIds ?? [body?.itemId]).map(Number).slice(0, 40);
  const picked = items.filter((i) => ids.includes(i.id));
  if (!picked.length) return Response.json({ error: "not_found" }, { status: 404 });

  let response: Anthropic.Message;
  try {
    response = await new Anthropic().messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: systemPrompt(items, picked, settings.instructions, lang),
      // Once this chat has registered a lead, keep answering but don't register again.
      tools: body?.registered ? [] : [REGISTER_TOOL],
      messages: turns,
    });
  } catch (error) {
    console.error("chat error", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return Response.json({ error: "unavailable" }, { status: 503 });
  }

  const reply = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

  let registered: Registered | null = null;
  let text = reply;
  if (toolUse) {
    const input = toolUse.input as Record<string, unknown>;
    const pt = lang ? lang === "pt" : input.language === "pt";
    const name = String(input.name ?? "").trim();
    const phone = String(input.phone ?? "").trim();
    // Never register a lead the seller can't act on: ask for the number instead.
    if (phone.replace(/\D/g, "").length < 8) {
      text = pt
        ? `Qual é o teu número de telemóvel? ${SELLER} vai contactar-te por WhatsApp ou Telegram.`
        : `What's your phone number? ${SELLER} will message you on WhatsApp or Telegram.`;
    } else {
      if (!text) {
        text = pt
          ? `Obrigado${name ? ` ${name}` : ""}! O teu pedido ficou registado e ${SELLER} vai entrar em contacto contigo em breve.`
          : `Thanks${name ? ` ${name}` : ""}! Your request is registered and ${SELLER} will get in touch with you soon.`;
      }
      const ids = (input.item_ids as number[]).filter((id) => items.some((i) => i.id === id));
      const chosen = items.filter((i) => ids.includes(i.id) && i.status !== "sold");
      const forLead = chosen.length ? chosen : picked.filter((i) => i.status !== "sold");
      registered = { registered: true };
      if (chatId) await sql`delete from interests where chat_id = ${chatId} and message = ${AUTO_NOTE}`;
      for (const item of forLead) {
        await sql`
          insert into interests (item_id, name, contact, message, language, pickup_when, offer, app, chat_id)
          values (${item.id}, ${name}, ${phone}, ${String(input.summary ?? "")}, ${pt ? "pt" : "en"},
                  ${String(input.pickup_when ?? "")}, ${String(input.offer ?? "")}, ${String(input.app ?? "whatsapp")}, ${chatId})`;
      }
    }
  }

  const admin = await isAdmin();

  // Safety net: if they typed a number and the bot hasn't registered them, save it anyway so the seller sees it.
  const typedPhone = phoneIn(turns);
  if (!registered && !body?.registered && typedPhone && chatId && !admin) {
    const [{ n }] = (await sql`select count(*)::int as n from interests where chat_id = ${chatId}`) as { n: number }[];
    if (!n) {
      const pt = lang ? lang === "pt" : /[ãõç]|\b(olá|ola|quero|sim|obrigad|amanhã|hoje|reservar)\b/i.test(turns.filter((t) => t.role === "user").map((t) => t.content).join(" "));
      for (const item of picked.filter((i) => i.status !== "sold")) {
        await sql`
          insert into interests (item_id, name, contact, message, language, pickup_when, offer, app, chat_id)
          values (${item.id}, '', ${typedPhone}, ${AUTO_NOTE}, ${pt ? "pt" : "en"}, '', '', 'whatsapp', ${chatId})`;
      }
    }
  }

  // Keep the transcript so the seller can read it in the admin, lead or not.
  if (chatId && !admin) {
    const transcript = JSON.stringify([...turns, { role: "assistant", content: text }]);
    await sql`
      insert into chats (id, visitor, ref, item_ids, messages, lead)
      values (${chatId}, ${String(body?.visitor ?? "").slice(0, 64)}, ${body?.ref ? String(body.ref).slice(0, 40) : null},
              ${picked.map((i) => i.id)}, ${transcript}::jsonb, ${!!registered})
      on conflict (id) do update set messages = excluded.messages, updated_at = now(), lead = chats.lead or excluded.lead`;
  }

  return Response.json({ reply: text, registered });
}
