"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approvePayroll, markPayrollPaid } from "./actions";

export default function PayrollRowActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    await approvePayroll(id);
    setLoading(false);
    router.refresh();
  }

  async function handleMarkPaid() {
    setLoading(true);
    await markPayrollPaid(id);
    setLoading(false);
    router.refresh();
  }

  if (status === "DRAFT") {
    return (
      <button
        onClick={handleApprove}
        disabled={loading}
        className="text-xs font-semibold text-bmos-primary hover:underline disabled:opacity-50"
      >
        Setujui
      </button>
    );
  }

  if (status === "APPROVED") {
    return (
      <button
        onClick={handleMarkPaid}
        disabled={loading}
        className="text-xs font-semibold text-green-700 hover:underline disabled:opacity-50"
      >
        Tandai Dibayar
      </button>
    );
  }

  return <span className="text-xs text-bmos-text-light">-</span>;
}
