// A saved chat conversation, as bubbles. The bot's greeting isn't stored, so it starts with the visitor.
export type ChatMessage = { role: "user" | "assistant"; content: string };

export function Transcript({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-1.5 rounded-xl bg-surface-2 p-2.5">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`w-fit max-w-[90%] rounded-xl px-2.5 py-1.5 text-[13px] leading-snug whitespace-pre-line ${
            m.role === "user" ? "ml-auto bg-accent text-white" : "bg-surface"
          }`}
        >
          {m.content}
        </div>
      ))}
    </div>
  );
}
