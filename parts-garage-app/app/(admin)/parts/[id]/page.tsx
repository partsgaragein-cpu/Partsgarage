import { createClient } from "@/lib/supabase/server";
import MediaGrid from "@/components/MediaGrid";
import EditPartForm from "@/components/EditPartForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddPartMedia from "./AddPartMedia";
import { signMedia } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function PartDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const id = decodeURIComponent(params.id);

  const [{ data: part }, { data: vehicles }] = await Promise.all([
    supabase.from("parts").select("*, vehicles(registration_number, car_name)").eq("id", id).single(),
    supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
  ]);
  if (!part) notFound();

  const { data: mediaRaw } = await supabase.from("media").select("*").eq("part_id", id);
  const media = await signMedia(mediaRaw);

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)" }}>{part.name}</h1></div>
      <div className="yl-page" style={{ maxWidth: 720 }}>
        <Link href="/parts" className="yl-link-btn" style={{ display: "inline-block", marginBottom: 16 }}>← Back to parts</Link>
        <div className="yl-mono" style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 12 }}>{part.id}</div>

        <EditPartForm part={part} vehicles={vehicles || []} />

        <h2 className="yl-section-label" style={{ marginBottom: 12, display: "block" }}>Media ({(media || []).length})</h2>
        <MediaGrid media={media} />
        <AddPartMedia partId={part.id} />
      </div>
    </div>
  );
}
