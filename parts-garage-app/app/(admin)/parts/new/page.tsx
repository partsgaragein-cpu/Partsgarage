"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadFilesToR2 } from "@/lib/uploadMedia";
import { CATEGORIES, CONDITIONS, PART_STATUSES, Vehicle } from "@/lib/types";
import MediaUploader from "@/components/MediaUploader";

function NewPartForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const defaultReg = searchParams.get("vehicle") || "";

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [hasVehicle, setHasVehicle] = useState<boolean>(!!defaultReg || true);
  const [vehicleReg, setVehicleReg] = useState(defaultReg);
  const [name, setName] = useState(""); const [partNumber, setPartNumber] = useState("");
  const [hsnSac, setHsnSac] = useState(""); const [compatibleModels, setCompatibleModels] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]); const [condition, setCondition] = useState(CONDITIONS[0]);
  const [quantity, setQuantity] = useState(1); const [location, setLocation] = useState("");
  const [expectedPrice, setExpectedPrice] = useState(""); const [minPrice, setMinPrice] = useState("");
  const [status, setStatus] = useState("Available"); const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("vehicles").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setVehicles(data || []);
      if (!defaultReg && data && data[0]) setVehicleReg(data[0].registration_number);
    });
  }, []);

  const handleSave = async () => {
    if (!name || (hasVehicle && !vehicleReg)) return;
    setSaving(true);

    let vehicleId: string | null = null;
    if (hasVehicle) {
      const match = vehicles.find((v) => v.registration_number === vehicleReg);
      vehicleId = match?.id || null;
    }

    const { count } = await supabase.from("parts").select("*", { count: "exact", head: true });
    const idPrefix = hasVehicle ? vehicleReg.slice(-4) : "LOOSE";
    const partId = `PG-${idPrefix}-${category.slice(0, 3).toUpperCase()}-${String((count || 0) + 1).padStart(3, "0")}`;

    await supabase.from("parts").insert({
      id: partId, vehicle_id: vehicleId, name, part_number: partNumber, hsn_sac: hsnSac,
      compatible_models: compatibleModels, category, condition, quantity,
      storage_location: location, expected_price: Number(expectedPrice) || 0,
      min_price: Number(minPrice) || 0, status, notes,
    });

    if (files.length > 0) {
      try {
        const uploaded = await uploadFilesToR2(files, `parts/${partId}`);
        await supabase.from("media").insert(
          uploaded.map((u) => ({ part_id: partId, type: u.type, storage_path: u.publicUrl }))
        );
      } catch {
        // Part is already saved — media upload failure shouldn't block navigation.
        // More photos can always be added later from the part's detail page.
      }
    }

    router.push(`/parts/${partId}`);
    router.refresh();
  };

  return (
    <div className="yl-page" style={{ maxWidth: 560 }}>
      <div className="yl-row yl-items-center yl-justify-between" style={{ background: "var(--surface-2)", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{hasVehicle ? "Linked to a vehicle" : "Standalone part — no vehicle"}</div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{hasVehicle ? "Part came from a scrapped car" : "Bought loose, not tied to any car"}</div>
        </div>
        <span className={`yl-switch${hasVehicle ? " on" : ""}`} onClick={() => setHasVehicle(!hasVehicle)}><span className="yl-switch-knob" /></span>
      </div>

      {hasVehicle && (
        <div style={{ marginBottom: 16 }}>
          <label className="yl-label">Source Vehicle</label>
          <select value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} className="yl-input" style={{ width: "100%" }}>
            {vehicles.map((v) => <option key={v.registration_number} value={v.registration_number}>{v.registration_number} — {v.car_name}</option>)}
          </select>
        </div>
      )}

      <label className="yl-label">Part Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="yl-input" style={{ width: "100%", marginBottom: 16 }} />

      <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label className="yl-label">Part Number</label><input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} className="yl-input yl-mono" style={{ width: "100%" }} /></div>
        <div style={{ flex: 1 }}><label className="yl-label">HSN/SAC Code</label><input value={hsnSac} onChange={(e) => setHsnSac(e.target.value)} className="yl-input yl-mono" style={{ width: "100%" }} /></div>
      </div>

      <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label className="yl-label">Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="yl-input" style={{ width: "100%" }}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="yl-label">Condition</label><select value={condition} onChange={(e) => setCondition(e.target.value)} className="yl-input" style={{ width: "100%" }}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>

      <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label className="yl-label">Quantity</label><input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="yl-input" style={{ width: "100%" }} /></div>
        <div style={{ flex: 2 }}><label className="yl-label">Expected Price (₹)</label><input type="number" value={expectedPrice} onChange={(e) => setExpectedPrice(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
      </div>

      <label className="yl-label">Storage Location</label>
      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Rack B → Shelf 3 → Box 2" className="yl-input" style={{ width: "100%", marginBottom: 16 }} />

      <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label className="yl-label">Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className="yl-input" style={{ width: "100%" }}>{PART_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="yl-label">Min Price (₹)</label><input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
      </div>

      <label className="yl-label">Notes / Defects</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="yl-input" style={{ width: "100%", marginBottom: 16, resize: "vertical" }} />

      <MediaUploader files={files} setFiles={setFiles} />

      <button onClick={handleSave} disabled={!name || saving} className="yl-btn-primary" style={{ width: "100%" }}>
        {saving ? "Saving…" : "Save Part"}
      </button>
    </div>
  );
}

export default function NewPartPage() {
  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Add Part</h1></div>
      <Suspense fallback={null}><NewPartForm /></Suspense>
    </div>
  );
}
