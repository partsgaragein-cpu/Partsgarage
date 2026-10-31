"use client";

import { useEffect, useRef, useState } from "react";
import { Media } from "@/lib/types";

type Item = Pick<Media, "id" | "type" | "storage_path">;

// Photo/video grid. Tapping a photo opens it full screen (swipe or use the arrows to move between photos,
// tap outside the photo or press Esc to close). Videos keep their normal inline player.
export default function MediaGrid({
  media,
  emptyLabel = "No media uploaded yet.",
  size = "yl-grid-4",
}: {
  media: Item[] | null | undefined;
  emptyLabel?: string;
  size?: string;
}) {
  const images = (media || []).filter((m) => m.type !== "video");
  const [index, setIndex] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  const open = index !== null;
  const count = images.length;
  const go = (step: number) => setIndex((i) => (i === null || count === 0 ? i : (i + step + count) % count));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [open, count]);

  if (!media || media.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>{emptyLabel}</div>;
  }

  const navBtn = (side: "left" | "right", label: string, step: number) => (
    <button
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); go(step); }}
      style={{ position: "absolute", top: "50%", [side]: 10, transform: "translateY(-50%)", width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(255,255,255,0.16)", color: "#fff", fontSize: 26, cursor: "pointer" }}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );

  return (
    <>
      <div className={size}>
        {media.map((m) => (
          <div key={m.id} className="yl-media-card">
            {m.type === "video" ? (
              <video src={m.storage_path} controls style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.storage_path}
                alt="Tap to enlarge"
                onClick={() => setIndex(images.findIndex((i) => i.id === m.id))}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, cursor: "zoom-in" }}
              />
            )}
          </div>
        ))}
      </div>

      {open && images[index!] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setIndex(null)}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 60 && count > 1) go(dx < 0 ? 1 : -1);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.94)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[index!].storage_path}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100vw", maxHeight: "100vh", objectFit: "contain" }}
          />
          <button
            aria-label="Close photo"
            onClick={(e) => { e.stopPropagation(); setIndex(null); }}
            style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", right: 12, width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(255,255,255,0.16)", color: "#fff", fontSize: 20, cursor: "pointer" }}
          >
            ✕
          </button>
          {count > 1 && navBtn("left", "Previous photo", -1)}
          {count > 1 && navBtn("right", "Next photo", 1)}
          {count > 1 && (
            <div style={{ position: "absolute", bottom: "max(14px, env(safe-area-inset-bottom))", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.8)", fontSize: 12.5 }}>
              {index! + 1} / {count}
            </div>
          )}
        </div>
      )}
    </>
  );
}
