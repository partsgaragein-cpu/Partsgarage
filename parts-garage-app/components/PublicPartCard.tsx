import { Media, PublicPart, inr } from "@/lib/types";
import MediaGrid from "@/components/MediaGrid";

export default function PublicPartCard({
  part,
  media,
}: {
  part: PublicPart;
  media: Pick<Media, "id" | "type" | "storage_path">[];
}) {
  return (
    <div className="yl-card" style={{ padding: 14, marginBottom: 12 }}>
      <div className="yl-row yl-items-center yl-justify-between" style={{ marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{part.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{part.category} · {part.condition}</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{inr(part.expected_price)}</div>
      </div>
      <MediaGrid media={media} size="yl-grid-3" emptyLabel="No photos yet — call to confirm condition." />
    </div>
  );
}
