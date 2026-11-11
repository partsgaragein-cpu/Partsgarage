import type { StoredFile } from "@/lib/storage";

export type BackupStatus = { level: "ok" | "late" | "none" | "unknown"; text: string; detail?: string };

const HOUR = 60 * 60 * 1000;
export const BACKUP_MAX_AGE_HOURS = 26; // one nightly backup + a little slack

export const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

// Turns "newest file in the backups folder" into a plain-language status line.
export function describeBackup(latest: StoredFile | undefined, now = new Date()): BackupStatus {
  if (!latest) return { level: "none", text: "No backup found yet", detail: "The first one runs at about midnight." };
  const ageH = (now.getTime() - latest.lastModified.getTime()) / HOUR;
  const when = latest.lastModified.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const base = `Last backup: ${when} · ${formatSize(latest.size)}`;
  if (ageH > BACKUP_MAX_AGE_HOURS) {
    const days = Math.floor(ageH / 24);
    return { level: "late", text: base, detail: `Overdue — about ${days >= 1 ? `${days} day${days === 1 ? "" : "s"}` : `${Math.round(ageH)} hours`} old. Check the backup.` };
  }
  return { level: "ok", text: base };
}
