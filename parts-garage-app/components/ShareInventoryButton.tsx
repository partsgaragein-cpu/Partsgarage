"use client";

import SharePanel from "@/components/SharePanel";

export default function ShareInventoryButton() {
  return (
    <SharePanel
      label="Share Full Inventory"
      title="Share full inventory"
      description="One link where customers can browse and search every car and part in stock."
      path="/inventory"
      message="Full parts inventory — browse and search our cars and available parts: {link}"
    />
  );
}
