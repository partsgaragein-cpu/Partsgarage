"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="yl-btn-primary">
      Print / Save as PDF
    </button>
  );
}
