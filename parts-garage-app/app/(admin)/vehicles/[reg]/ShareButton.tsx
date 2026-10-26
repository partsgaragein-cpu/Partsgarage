"use client";

import SharePanel from "@/components/SharePanel";

export default function ShareButton({ reg, name }: { reg: string; name: string }) {
  return (
    <SharePanel
      label="Share Gallery Link"
      title="Share this car"
      description="A link to this car's photos and the parts available from it."
      path={`/car/${reg}`}
      message={`Parts available for ${name} (${reg}): {link}`}
    />
  );
}
