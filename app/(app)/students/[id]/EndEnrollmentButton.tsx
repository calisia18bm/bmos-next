"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { endEnrollment } from "../actions";

export default function EndEnrollmentButton({
  enrollmentId,
  studentId,
}: {
  enrollmentId: string;
  studentId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm("Hentikan kelas ini buat murid ini?")) return;
    setLoading(true);
    await endEnrollment(enrollmentId, studentId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
    >
      Hentikan
    </button>
  );
}
