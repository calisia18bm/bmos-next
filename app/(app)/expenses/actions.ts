"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Cuma Owner/Admin yang boleh catat pengeluaran.
async function requireStaff(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Belum login.";

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const myRoles = myProfile?.roles || [];
  if (!myRoles.includes("OWNER") && !myRoles.includes("ADMIN")) {
    return "Kamu ga punya akses buat catat pengeluaran.";
  }
  return null;
}

export async function addExpense(formData: {
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
}) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("expenses")
    .select("expense_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.expense_code) {
    const match = last.expense_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const expenseCode = `EXP${String(nextNumber).padStart(5, "0")}`;

  const { error } = await supabase.from("expenses").insert({
    expense_code: expenseCode,
    category: formData.category,
    description: formData.description,
    amount: Number(formData.amount) || 0,
    expense_date: formData.expenseDate,
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/expenses");
  return { success: true, message: "Pengeluaran berhasil dicatat." };
}
