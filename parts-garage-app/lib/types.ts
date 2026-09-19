export type Vehicle = {
  id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  car_name: string;
  year: string | null;
  vin: string | null;
  fuel_type: string | null;
  transmission: string | null;
  purchase_date: string | null;
  status: string;
  fully_sold_at: string | null;
  created_at: string;
};

export type Media = {
  id: string;
  vehicle_id: string | null;
  part_id: string | null;
  type: "image" | "video";
  storage_path: string;
  created_at: string;
};

// Shape returned by the public `parts_public` view — a deliberately
// trimmed-down Part with no min_price/actual_price/notes/location.
export type PublicPart = {
  id: string;
  vehicle_id: string | null;
  name: string;
  part_number: string | null;
  category: string;
  condition: string;
  quantity: number;
  expected_price: number;
  status: string;
  created_at: string;
};

export type Part = {
  id: string;
  vehicle_id: string | null;
  name: string;
  part_number: string | null;
  hsn_sac: string | null;
  compatible_models: string | null;
  category: string;
  condition: string;
  quantity: number;
  storage_location: string | null;
  expected_price: number;
  min_price: number | null;
  actual_price: number | null;
  status: string;
  notes: string | null;
  archived: boolean;
  created_at: string;
};

export type Expense = {
  id: string;
  vehicle_id: string | null;
  category: string;
  amount: number;
  expense_date: string;
  note: string | null;
};

export type Invoice = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  place_of_supply: string | null;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_gstin: string | null;
  buyer_vehicle: string | null;
  buyer_state: string | null;
  payment_terms: string | null;
  due_date: string | null;
  amount_received: number;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  part_id: string;
  description: string;
  category: string | null;
  hsn_sac: string | null;
  qty: number;
  taxable_value: number;
  gst_percent: number;
};

export const CATEGORIES = [
  "Mechanical", "Electrical", "Engine components", "Transmission", "Suspension",
  "Brakes", "Body parts", "Interior", "Cooling system", "AC components",
  "Wheels & tyres", "Miscellaneous",
];
export const CONDITIONS = ["Good", "Fair", "Poor"];
export const PART_STATUSES = ["Available", "Reserved", "Sold", "Scrap", "Under Testing", "Returned"];
export const VEHICLE_STATUSES = ["In dismantling", "Inventory complete", "Fully sold", "Closed"];
export const EXPENSE_CATEGORIES = [
  "Purchase", "Transport", "Towing", "Dismantling", "Repairs", "Testing",
  "Labour", "Rent", "Electricity", "Packaging", "Delivery", "Marketing", "Tools", "Miscellaneous",
];
export const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"];
export const TRANSMISSIONS = ["Manual", "Automatic"];
export const GST_RATES = [0, 5, 12, 18, 28];
export const PAYMENT_TERMS = ["Due on Delivery", "NET 7 Days", "NET 15 Days", "NET 30 Days"];
export const TERMS_DAYS: Record<string, number> = {
  "Due on Delivery": 0, "NET 7 Days": 7, "NET 15 Days": 15, "NET 30 Days": 30,
};

export const inr = (n: number | null | undefined) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export const COMPANY = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || "Parts Garage",
  gstin: process.env.NEXT_PUBLIC_COMPANY_GSTIN || "",
  state: process.env.NEXT_PUBLIC_COMPANY_STATE || "",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "",
};
