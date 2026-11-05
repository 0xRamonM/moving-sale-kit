"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useRef, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { saveItem, type SaveState } from "./actions";

type Initial = {
  id?: number;
  title_pt?: string;
  title_en?: string;
  description_pt?: string;
  description_en?: string;
  price?: string;
  position?: number;
  category?: Category;
  available_from?: string | null;
  images?: string[];
};

// Shrinks phone photos to max 1600px JPEG before upload.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read image"))), "image/jpeg", 0.85),
  );
}

export function ItemForm({ initial = {}, onDone }: { initial?: Initial; onDone?: () => void }) {
  const [images, setImages] = useState<string[]>(initial.images ?? []);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isNew = !initial.id;
  const [state, action, pending] = useActionState<SaveState, FormData>(async (prev, form) => {
    const result = await saveItem(prev, form);
    if (result.savedAt) {
      if (isNew) {
        formRef.current?.reset();
        setImages([]);
      }
      onDone?.();
    }
    return result;
  }, { ok: false });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError(null);
    setUploading((n) => n + files.length);
    await Promise.all(
      Array.from(files).map(async (file) => {
        try {
          const blob = await shrink(file);
          const name = file.name.replace(/\.[^.]+$/, "") || "photo";
          const res = await upload(`items/${name}.jpg`, blob, {
            access: "public",
            handleUploadUrl: "/api/upload",
            contentType: "image/jpeg",
          });
          setImages((prev) => [...prev, res.url]);
        } catch (e) {
          setUploadError(`${file.name}: ${(e as Error).message}`);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  function move(i: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Title (Português)</span>
          <input name="title_pt" required defaultValue={initial.title_pt} />
        </label>
        <label className="field">
          <span>Title (English)</span>
          <input name="title_en" required defaultValue={initial.title_en} />
        </label>
        <label className="field">
          <span>Description (Português)</span>
          <textarea name="description_pt" rows={3} defaultValue={initial.description_pt} />
        </label>
        <label className="field">
          <span>Description (English)</span>
          <textarea name="description_en" rows={3} defaultValue={initial.description_en} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:w-[40rem] sm:grid-cols-4">
        <label className="field">
          <span>Category</span>
          <select name="category" defaultValue={initial.category ?? "house"}>
            {(Object.keys(CATEGORIES) as Category[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].en}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Available from</span>
          <input name="available_from" type="date" defaultValue={initial.available_from ?? ""} />
        </label>
        <label className="field">
          <span>Price (€)</span>
          <input name="price" inputMode="decimal" placeholder="blank = offer" defaultValue={initial.price} />
        </label>
        <label className="field">
          <span>Order</span>
          <input name="position" type="number" defaultValue={initial.position ?? 0} />
        </label>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Photos</span>
        <div className="flex flex-wrap gap-2">
          {images.map((src, i) => (
            <div key={src} className="group relative size-24 overflow-hidden rounded-lg border border-border bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
              {i === 0 && <span className="pill absolute top-1 left-1 bg-black/60 text-[10px] text-white">Cover</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 text-white">
                <button type="button" className="px-2" onClick={() => move(i, -1)} aria-label="Move left">‹</button>
                <button type="button" className="px-2" onClick={() => setImages((p) => p.filter((u) => u !== src))} aria-label="Remove">×</button>
                <button type="button" className="px-2" onClick={() => move(i, 1)} aria-label="Move right">›</button>
              </div>
            </div>
          ))}
          <label className="flex size-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted hover:bg-surface-2">
            <span className="text-2xl leading-none">+</span>
            {uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending || uploading > 0}>
          {pending ? "Saving…" : isNew ? "Add item" : "Save"}
        </button>
        {onDone && !isNew && (
          <button type="button" className="btn" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
