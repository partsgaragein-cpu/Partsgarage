"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_STATUSES, Vehicle } from "@/lib/types";

// Collapsed by default so the vehicle page stays tidy; "Edit details" opens it.
export default function EditVehicleForm({ vehicle }: { vehicle: Vehicle }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const [reg, setReg] = useState(vehicle.registration_number);
  const [make, setMake] = useState(vehicle.make || "");
  const [model, setModel] = useState(vehicle.model || "");
  const [year, setYear] = useState(vehicle.year || "");
  const [vin, setVin] = useState(vehicle.vin || "");
  const [fuelType, setFuelType] = useState(vehicle.fuel_type || FUEL_TYPES[0]);
  const [transmission, setTransmission] = useState(vehicle.transmission || TRANSMISSIONS[0]);
  const [purchaseDate, setPurchaseDate] = useState(vehicle.purchase_date || "");
  const [status, setStatus] = useState(vehicle.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const newReg = reg.trim().toUpperCase();
    if (!newReg) { setError("Registration number can't be empty."); return; }
    setSaving(true);
    setError("");
    setSaved(false);

    // Keep the display name in step with make/model; fall back to the old name if both are blank.
    const carName = `${make} ${model}`.trim() || vehicle.car_name;

    const { error: updateError } = await supabase.from("vehicles").update({
      registration_number: newReg, make, model, car_name: carName, year, vin,
      fuel_type: fuelType, transmission, purchase_date: purchaseDate || null, status,
    }).eq("id", vehicle.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message.includes("duplicate") ? "Another vehicle already has that registration number." : `Could not save: ${updateError.message}`);
      return;
    }
    setSaved(true);
    // The page address contains the registration number, so move to the new one if it changed.
    if (newReg !== vehicle.registration_number) router.replace(`/vehicles/${newReg}`);
    router.refresh();
  };

  if (!open) {
    return <button onClick={() => setOpen(true)} className="yl-btn-ghost" style={{ marginBottom: 20 }}>Edit details</button>;
  }

  return (
    <div className="yl-card" style={{ padding: "20px 22px", marginBottom: 20 }}>
      <label className="yl-label">Registration Number</label>
      <input value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} className="yl-input yl-mono" style={{ width: "100%", marginBottom: 16 }} />

      <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label className="yl-label">Make</label><input value={make} onChange={(e) => setMake(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
        <div style={{ flex: 1 }}><label className="yl-label">Model</label><input value={model} onChange={(e) => setModel(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
        <div style={{ flex: 1 }}><label className="yl-label">Year</label><input value={year} onChange={(e) => setYear(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
      </div>

      <label className="yl-label">VIN / Chassis Number</label>
      <input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} className="yl-input yl-mono" style={{ width: "100%", marginBottom: 16 }} />

      <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label className="yl-label">Fuel Type</label><select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="yl-input" style={{ width: "100%" }}>{FUEL_TYPES.map((f) => <option key={f}>{f}</option>)}</select></div>
        <div style={{ flex: 1 }}><label className="yl-label">Transmission</label><select value={transmission} onChange={(e) => setTransmission(e.target.value)} className="yl-input" style={{ width: "100%" }}>{TRANSMISSIONS.map((t) => <option key={t}>{t}</option>)}</select></div>
      </div>

      <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
        <div style={{ flex: 1 }}><label className="yl-label">Purchase Date</label><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="yl-input" style={{ width: "100%" }} /></div>
        <div style={{ flex: 1 }}><label className="yl-label">Status</label><select value={status} onChange={(e) => setStatus(e.target.value)} className="yl-input" style={{ width: "100%" }}>{VEHICLE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>

      {error && <div style={{ fontSize: 12.5, color: "#E5484D", marginBottom: 12 }}>{error}</div>}

      <div className="yl-row yl-items-center yl-justify-between">
        <button onClick={() => setOpen(false)} className="yl-btn-ghost">Close</button>
        <div className="yl-row yl-gap-2 yl-items-center">
          {saved && !saving && <span style={{ fontSize: 12, color: "var(--whatsapp)" }}>Saved</span>}
          <button onClick={handleSave} disabled={saving} className="yl-btn-primary">{saving ? "Saving…" : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}
