"use client";

export default function ShareButton({ reg, name }: { reg: string; name: string }) {
  const handleShare = () => {
    const link = `${window.location.origin}/car/${reg}`;
    const text = encodeURIComponent(`Parts available for ${name} (${reg}): ${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <button onClick={handleShare} className="yl-btn-whatsapp">
      Share Gallery Link
    </button>
  );
}
