"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CONDITIONS, PART_STATUSES, Part, Vehicle } from "@/lib/types";
import ArchivePartButton from "@/components/ArchivePartButton";
import DeletePartButton from "@/components/DeletePartButton";

export default function EditPartForm({ part, vehicles }: { part: Part & { vehicles?: { registration_number: string } | null }; vehicles: Vehicle[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [hasVehicle, setHasVehicle] = useState(!!part.vehicle_id);
  const [vehicleReg, setVehicleReg] = useState(part.vehicles?.registration_number || vehicles[0]?.registration_number || "");
  const [name, setName] = useState(part.name);
  const [partNumber, setPartNumber] = useState(part.part_number || "");
  const [hsnSac, setHsnSac] = useState(part.hsn_sac || "");
  const [compatibleModels, setCompatibleModels] = useState(part.compatible_models || "");
  const [category, setCategory] = useState(part.category);
  const [condition, setCondition] = useState(part.condition);
  const [quantity, setQuantity] = useState(part.quantity);
  const [location, setLocation] = useState(part.storage_location || "");
  const [expectedPrice, setExpectedPrice] = useState(String(part.expected_price ?? ""));
  const [minPrice, setMinPrice] = useState(String(part.min_price ?? ""));
  const [actualPrice, setActualPrice] = useState(String(part.actual_price ?? ""));
  const [status, setStatus] = useState(part.status);
  const [notes, setNotes] = useState(part.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    setSaved(false);

    let vehicleId: string | null = null;
    if (hasVehicle) {
      const match = vehicles.find((v) => v.registration_number === vehicleReg);
      vehicleId = match?.id || null;
    }

    await supabase.from("parts").update({
      vehicle_id: vehicleId, name, part_number: partNumber, hsn_sac: hsnSac,
      compatible_models: compatibleModels, category, condition, quantity,
      storage_location: location, expected_price: Number(expectedPrice) || 0,
      min_price: Number(minPrice) || 0, actual_price: Number(actualPrice) || null,
      status, notes,
    }).eq("id", part.id);

    setSaving(false);
    setSaved(true);
    router.refresh();
  };

  return (
    <div className="yl-card" style={{ padding: "20px 22px", marginBottom: 20 }}>
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

      <label className="yl-label">Compatible Models</label>
      <input value={compatibleModels} onChange={(e) => setCompatibleModels(e.target.value)} placeholder="e.g. Swift, Dzire" className="yl-input" style={{ width: "100%", marginBottom: 16 }} />

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
        <div style={{ flex: 1 }}><label className="yl-label">Actual Price (₹)</label><input type="number" value={actualPrice} onChange={(e) => setActualPrice(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
      </div>

      <label className="yl-label">Notes / Defects</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="yl-input" style={{ width: "100%", marginBottom: 20, resize: "vertical" }} />

      <div className="yl-row yl-items-center yl-justify-between" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <ArchivePartButton partId={part.id} archived={part.archived} />
        <div className="yl-row yl-gap-2 yl-items-center">
          {saved && !saving && <span style={{ fontSize: 12, color: "var(--whatsapp)" }}>Saved</span>}
          <button onClick={handleSave} disabled={!name || saving} className="yl-btn-primary">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed var(--border)", marginTop: 20, paddingTop: 16 }}>
        <div className="yl-mini-label" style={{ marginBottom: 8 }}>Danger zone</div>
        <DeletePartButton partId={part.id} partName={part.name} />
      </div>
    </div>
  );
}
