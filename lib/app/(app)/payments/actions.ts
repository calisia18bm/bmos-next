"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addPayment(formData: {
  studentId: string;
  studentName: string;
  amount: string;
  paymentDate: string;
  method: string;
  notes: string;
}) {
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("payments")
    .select("transaction_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.transaction_code) {
    const match = last.transaction_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const transactionCode = `TRX${String(nextNumber).padStart(5, "0")}`;

  const { error } = await supabase.from("payments").insert({
    transaction_code: transactionCode,
    student_id: formData.studentId || null,
    student_name: formData.studentName,
    amount: Number(formData.amount) || 0,
    payment_date: formData.paymentDate,
    method: formData.method,
    notes: formData.notes,
    status: "CONFIRMED",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/payments");
  return { success: true, message: "Pembayaran berhasil dicatat." };
}
