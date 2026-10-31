import { Media, PublicPart } from "@/lib/types";
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
          <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
            {part.category} · {part.condition}{part.part_number ? ` · Part no. ${part.part_number}` : ""}
          </div>
          {part.compatible_models && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>Fits: {part.compatible_models}</div>
          )}
        </div>
      </div>
      <MediaGrid media={media} size="yl-grid-3" emptyLabel="No photos yet — call to confirm condition." />
    </div>
  );
}
