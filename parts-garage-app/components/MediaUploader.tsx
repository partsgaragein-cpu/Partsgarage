"use client";

export default function MediaUploader({
  files,
  setFiles,
  label = "Photos & Videos",
}: {
  files: File[];
  setFiles: (files: File[]) => void;
  label?: string;
}) {
  const removeAt = (i: number) => setFiles(files.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginBottom: 16 }}>
      <label className="yl-label">{label}</label>
      <label className="yl-dropzone">
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Tap to upload — or drag files here</span>
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          style={{ display: "none" }}
          onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])])}
        />
      </label>
      {files.length > 0 && (
        <div className="yl-grid-4" style={{ marginTop: 10 }}>
          {files.map((f, i) => (
            <div key={i} className="yl-media-card" style={{ position: "relative" }}>
              {f.type.startsWith("video") ? (
                <video src={URL.createObjectURL(f)} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                style={{
                  position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
