// Every public string is shown in Portuguese first, then English in a quieter style.

// Two lines: Portuguese, with English underneath. `even` keeps both the same size (used in the chat).
export function Bi({ pt, en, className = "", even = false }: { pt: React.ReactNode; en: React.ReactNode; className?: string; even?: boolean }) {
  // Names like "Nintendo Wii" are the same in both languages; show them once.
  if (typeof pt === "string" && pt === en) return <span className={`block ${className}`}>{pt}</span>;
  return (
    <span className={`block ${className}`}>
      <span lang="pt" className="block">{pt}</span>
      <span lang="en" className={`block font-normal text-muted ${even ? "mt-1" : "text-[0.82em]"}`}>{en}</span>
    </span>
  );
}

// One line, for buttons, labels and badges: "Português · English".
export function BiInline({ pt, en }: { pt: React.ReactNode; en: React.ReactNode }) {
  // Wrapped in one span so flex parents (buttons) don't swallow the spaces around the dot.
  return (
    <span>
      <span lang="pt">{pt}</span>
      <span lang="en" className="font-normal opacity-65">
        {" · "}
        {en}
      </span>
    </span>
  );
}
