import { Media } from "@/lib/types";

export default function MediaGrid({
  media,
  emptyLabel = "No media uploaded yet.",
  size = "yl-grid-4",
}: {
  media: Pick<Media, "id" | "type" | "storage_path">[] | null | undefined;
  emptyLabel?: string;
  size?: string;
}) {
  if (!media || media.length === 0) {
    return <div style={{ color: "var(--text-faint)", fontSize: 13 }}>{emptyLabel}</div>;
  }
  return (
    <div className={size}>
      {media.map((m) => (
        <div key={m.id} className="yl-media-card">
          {m.type === "video" ? (
            <video src={m.storage_path} controls style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.storage_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
          )}
        </div>
      ))}
    </div>
  );
}
