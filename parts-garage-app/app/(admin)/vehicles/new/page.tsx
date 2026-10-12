"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadAndRecordMedia } from "@/lib/uploadMedia";
import MediaUploader from "@/components/MediaUploader";
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_STATUSES } from "@/lib/types";

export default function NewVehiclePage() {
  const router = useRouter();
  const supabase = createClient();
  const [reg, setReg] = useState(""); const [make, setMake] = useState(""); const [model, setModel] = useState("");
  const [year, setYear] = useState(""); const [status, setStatus] = useState(VEHICLE_STATUSES[0]);
  const [vin, setVin] = useState(""); const [fuelType, setFuelType] = useState(FUEL_TYPES[0]); const [transmission, setTransmission] = useState(TRANSMISSIONS[0]);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Set when the vehicle saved but its photos did not — we stay on the page and say why.
  const [savedReg, setSavedReg] = useState("");
  const [uploadError, setUploadError] = useState("");

  const handleSave = async () => {
    if (!reg || !make) return;
    setSaving(true);
    setError("");

    const { data: vehicle, error: insertError } = await supabase
      .from("vehicles")
      .insert({
        registration_number: reg.toUpperCase(),
        make, model, car_name: `${make} ${model}`.trim(),
        year, status, vin, fuel_type: fuelType, transmission,
        purchase_date: purchaseDate || null,
      })
      .select()
      .single();

    if (insertError || !vehicle) {
      setError(insertError?.message.includes("duplicate") ? "That registration number already exists." : "Something went wrong saving the vehicle.");
      setSaving(false);
      return;
    }

    if (files.length > 0) {
      try {
        await uploadAndRecordMedia(supabase, files, `vehicles/${vehicle.registration_number}`, { vehicle_id: vehicle.id });
      } catch (e: any) {
        // The vehicle itself is saved. Don't hide the photo problem — show it, and let
        // them open the vehicle (photos can be added again from there).
        setSavedReg(vehicle.registration_number);
        setUploadError(e?.message || "The photos could not be uploaded.");
        setSaving(false);
        return;
      }
    }

    router.push(`/vehicles/${vehicle.registration_number}`);
    router.refresh();
  };

  return (
    <div>
      <div className="yl-topbar"><h1 className="yl-display yl-fw-600" style={{ fontSize: 18, color: "var(--text)", marginLeft: 30 }}>Register New Car</h1></div>
      <div className="yl-page" style={{ maxWidth: 560 }}>
        <label className="yl-label">Registration Number</label>
        <input value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} placeholder="MP09AB1234" className="yl-input yl-mono" style={{ width: "100%", marginBottom: 16 }} />

        <div className="yl-row yl-gap-3" style={{ marginBottom: 16 }}>
          <div style={{ flex: 1 }}><label className="yl-label">Make</label><input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Maruti" className="yl-input" style={{ width: "100%" }} /></div>
          <div style={{ flex: 1 }}><label className="yl-label">Model</label><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Swift" className="yl-input" style={{ width: "100%" }} /></div>
          <div style={{ flex: 1 }}><label className="yl-label">Year</label><input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2016" className="yl-input" style={{ width: "100%" }} /></div>
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

        <MediaUploader files={files} setFiles={setFiles} />

        {error && <div style={{ fontSize: 12.5, color: "#E5484D", marginBottom: 16 }}>{error}</div>}

        {savedReg ? (
          <div>
            <div style={{ fontSize: 12.5, color: "#E5484D", background: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.3)", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
              <strong>The vehicle was saved, but its photos did not upload.</strong><br />{uploadError}
            </div>
            <button onClick={() => { router.push(`/vehicles/${savedReg}`); router.refresh(); }} className="yl-btn-primary" style={{ width: "100%" }}>
              Open vehicle (add photos again from there)
            </button>
          </div>
        ) : (
          <button onClick={handleSave} disabled={!reg || !make || saving} className="yl-btn-primary" style={{ width: "100%" }}>
            {saving ? (files.length > 0 ? "Saving & uploading…" : "Saving…") : "Save Vehicle"}
          </button>
        )}
      </div>
    </div>
  );
}
