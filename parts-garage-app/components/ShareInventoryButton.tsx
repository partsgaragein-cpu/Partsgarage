"use client";

export default function ShareInventoryButton() {
  const handleShare = () => {
    const link = `${window.location.origin}/inventory`;
    const text = encodeURIComponent(`Full parts inventory — browse cars and available parts: ${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <button onClick={handleShare} className="yl-btn-whatsapp">
      Share Full Inventory
    </button>
  );
}
