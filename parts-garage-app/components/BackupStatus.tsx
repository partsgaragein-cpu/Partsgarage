import { listFiles } from "@/lib/storage";
import { BackupStatus as Status, describeBackup } from "@/lib/backupStatus";

const COLORS = { ok: "#30A46C", late: "#E5484D", none: "#F5A524", unknown: "var(--text-faint)" } as const;

// "Last backup" line, read straight from the Backblaze bucket so it shows what is really there.
export default async function BackupStatus() {
  let status: Status;
  try {
    const files = await listFiles("backups/");
    status = describeBackup(files[0]);
  } catch {
    status = { level: "unknown", text: "Backup status unavailable", detail: "Could not read the backup storage just now." };
  }
  return (
    <div className="yl-card" style={{ padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
      <span style={{ width: 9, height: 9, borderRadius: 5, background: COLORS[status.level], flexShrink: 0 }} />
      <span style={{ color: "var(--text)" }}>{status.text}</span>
      {status.detail && <span style={{ color: status.level === "late" ? "#E5484D" : "var(--text-faint)" }}>{status.detail}</span>}
    </div>
  );
}
