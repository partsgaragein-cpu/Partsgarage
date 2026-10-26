"use client";

import { useEffect, useState } from "react";

// A button that opens a small window with the link to send: the link itself,
// a Copy button, an Open-in-WhatsApp link, and a preview of what the customer
// will see. Nothing depends on a pop-up being allowed, so it always responds.
//
// `message` is the text pre-filled in WhatsApp; write {link} where the link goes.
export default function SharePanel({
  label,
  title,
  description,
  path,
  message,
}: {
  label: string;
  title: string;
  description: string;
  path: string;
  message: string;
}) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  // The address is only known in the browser (it's whatever domain the owner is on).
  useEffect(() => {
    setLink(`${window.location.origin}${path}`);
  }, [path]);

  // Esc closes the window.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const waHref = `https://wa.me/?text=${encodeURIComponent(message.replace("{link}", link))}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Some browsers block the clipboard API; fall back to the older way.
      const box = document.createElement("textarea");
      box.value = link;
      document.body.appendChild(box);
      box.select();
      document.execCommand("copy");
      document.body.removeChild(box);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="yl-btn-whatsapp">
        {label}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className="yl-card"
            style={{ width: "100%", maxWidth: 420, padding: 22 }}
          >
            <div className="yl-display yl-fw-600" style={{ fontSize: 17, color: "var(--text)", marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 16 }}>{description}</div>

            <label className="yl-label">Link</label>
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="yl-input yl-mono"
              style={{ width: "100%", fontSize: 12, marginBottom: 14 }}
            />

            <div className="yl-row yl-gap-2" style={{ marginBottom: 14, flexWrap: "wrap" }}>
              <button type="button" onClick={copy} className="yl-btn-ghost" style={{ flex: 1 }}>
                {copied ? "Copied ✓" : "Copy link"}
              </button>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="yl-btn-whatsapp"
                style={{ flex: 1, textAlign: "center" }}
              >
                Open in WhatsApp
              </a>
            </div>

            <div className="yl-row yl-items-center yl-justify-between">
              <a href={path} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: "var(--accent)", textDecoration: "none" }}>
                Preview what customers see →
              </a>
              <button type="button" onClick={() => setOpen(false)} className="yl-link-btn" style={{ color: "var(--text-muted)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
