import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import InvoiceForm from "@/components/InvoiceForm";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: invoice } = await supabase.from("invoices").select("*, invoice_items(*)").eq("id", params.id).single();
  if (!invoice) notFound();
  const { invoice_items, ...inv } = invoice as any;
  return <InvoiceForm initial={{ invoice: inv, items: invoice_items || [] }} />;
}
