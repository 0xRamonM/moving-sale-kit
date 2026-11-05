"use client";

import { useState } from "react";
import { marketplaceListing, type ListingInput } from "@/lib/marketplace";

// Everything needed to post an item on Facebook Marketplace: copyable title, price and description, and the photos.
export function MarketplaceKit({ item, images }: { item: ListingInput; images: string[] }) {
  const { title, description, price } = marketplaceListing(item);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
  }

  async function savePhotos() {
    setSaving(true);
    try {
      const slug = item.title_en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const files = await Promise.all(
        images.map(async (src, i) => {
          const blob = await (await fetch(src)).blob();
          return new File([blob], `${slug}-${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
        }),
      );
      // Phones: the share sheet has "Save images", which puts them straight in the photo gallery.
      if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files })) {
        await navigator.share({ files }).catch(() => {});
        return;
      }
      // Desktop: download each file.
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 250));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Title" value={title} copied={copied === "title"} onCopy={() => copy("title", title)} />
      {price !== null && (
        <Field label="Price (€)" value={String(price)} copied={copied === "price"} onCopy={() => copy("price", String(price))} />
      )}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm font-medium">
          Description
          <button type="button" className="btn btn-sm" onClick={() => copy("description", description)}>
            {copied === "description" ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <textarea
          readOnly
          value={description}
          rows={12}
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" disabled={!images.length || saving} onClick={savePhotos}>
          {saving ? "Preparing…" : images.length ? `Save ${images.length} photo${images.length > 1 ? "s" : ""}` : "No photos yet"}
        </button>
        <span className="text-xs text-muted">On your phone, choose “Save images” in the share sheet.</span>
      </div>
    </div>
  );
}

function Field({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex gap-2">
        <input readOnly value={value} className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn btn-sm shrink-0" onClick={onCopy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}
