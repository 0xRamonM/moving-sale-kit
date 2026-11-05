"use client";

import Image from "next/image";
import { capture } from "@/lib/track";
import { useEffect, useRef, useState } from "react";

// Photo carousel for a card: swipe on touch screens, arrows with a mouse, dots show where you are.
// Tapping a photo opens it full screen, uncropped; tapping outside the photo closes it.
export function Gallery({ images, alt, priority }: { images: string[]; alt: string; priority: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState(false);
  const many = images.length > 1;

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const next = (to + images.length) % images.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  function closeViewer(at: number) {
    setViewing(false);
    // Leave the card showing the photo they last looked at.
    const el = track.current;
    if (el) el.scrollTo({ left: at * el.clientWidth });
  }

  return (
    <div className="group/gallery relative h-full">
      <div
        ref={track}
        className="gallery"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            className="relative block cursor-zoom-in"
            aria-label="Ver foto em ecrã inteiro / View photo full screen"
            onClick={() => {
              setViewing(true);
              capture("photo_viewer_opened", { item: alt, photos: images.length });
            }}
          >
            <Image
              src={src}
              alt={many ? `${alt} (${i + 1}/${images.length})` : alt}
              fill
              sizes="(min-width: 1024px) 380px, 50vw"
              className="object-cover"
              priority={priority && i === 0}
              loading={i === 0 ? undefined : "lazy"}
            />
          </button>
        ))}
      </div>

      {many && (
        <>
          {/* Arrows only for mouse users; touch users swipe. */}
          <button
            type="button"
            aria-label="Foto anterior / Previous photo"
            onClick={() => go(index - 1)}
            className="gallery-arrow left-2"
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            aria-label="Foto seguinte / Next photo"
            onClick={() => go(index + 1)}
            className="gallery-arrow right-2"
          >
            <Chevron dir="right" />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {images.map((src, i) => (
              <span
                key={src}
                className={`size-1.5 rounded-full shadow-[0_0_2px_rgba(0,0,0,0.6)] transition ${i === index ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}

      {viewing && <Viewer images={images} alt={alt} start={index} onClose={closeViewer} />}
    </div>
  );
}

function Viewer({
  images,
  alt,
  start,
  onClose,
}: {
  images: string[];
  alt: string;
  start: number;
  onClose: (at: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const indexRef = useRef(start);
  const onCloseRef = useRef(onClose);
  const many = images.length > 1;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    document.documentElement.style.overflow = "hidden";
    if (track.current) track.current.scrollLeft = start * track.current.clientWidth;
    const closed = () => onCloseRef.current(indexRef.current);
    el.addEventListener("close", closed);
    return () => {
      el.removeEventListener("close", closed);
      document.documentElement.style.overflow = "";
    };
  }, [start]);

  function go(to: number) {
    const el = track.current;
    if (!el) return;
    const next = (to + images.length) % images.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label={alt}
      // Anything that isn't the photo itself or a control closes the viewer.
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("img, button")) dialog.current?.close();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div
        ref={track}
        className="gallery"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          indexRef.current = i;
          setIndex(i);
        }}
      >
        {images.map((src, i) => (
          <div key={src} className="flex items-center justify-center p-3 sm:p-12">
            {/* Plain img so its box is exactly the visible photo; taps beside it close the viewer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={many ? `${alt} (${i + 1}/${images.length})` : alt}
              className="max-h-full max-w-full rounded-lg object-contain"
              loading={Math.abs(i - start) <= 1 ? "eager" : "lazy"}
              draggable={false}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Fechar / Close"
        onClick={() => dialog.current?.close()}
        className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-white/15 text-2xl leading-none text-white hover:bg-white/25"
      >
        ×
      </button>

      {many && (
        <>
          <span className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 text-sm text-white/80 tabular-nums">
            {index + 1} / {images.length}
          </span>
          <button
            type="button"
            aria-label="Foto anterior / Previous photo"
            onClick={() => go(index - 1)}
            className="lightbox-arrow left-4"
          >
            <Chevron dir="left" />
          </button>
          <button
            type="button"
            aria-label="Foto seguinte / Next photo"
            onClick={() => go(index + 1)}
            className="lightbox-arrow right-4"
          >
            <Chevron dir="right" />
          </button>
        </>
      )}
    </dialog>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
