// Section list shared by the Export page (browser) and the export API (server). No server code here.
export const EXPORT_SECTIONS = [
  { key: "cars", label: "Cars", dateField: "date added" },
  { key: "parts", label: "Parts", dateField: "date added" },
  { key: "photos", label: "Photos & videos list", dateField: "date added" },
  { key: "expenses", label: "Expenses", dateField: "expense date" },
  { key: "invoices", label: "Invoices (one row per invoice)", dateField: "invoice date" },
  { key: "invoice_lines", label: "Invoice lines (one row per part sold)", dateField: "invoice date" },
  { key: "activity", label: "Activity log (who changed what)", dateField: "date of change" },
] as const;

export type ExportSectionKey = (typeof EXPORT_SECTIONS)[number]["key"];
