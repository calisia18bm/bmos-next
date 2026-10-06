"use client";

import { useState } from "react";
import { toggleFollowUp } from "./actions";

export default function FollowUpCheckbox({
  id,
  completed,
}: {
  id: string;
  completed: boolean;
}) {
  const [checked, setChecked] = useState(completed);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const newValue = !checked;
    setChecked(newValue);
    await toggleFollowUp(id, newValue);
    setLoading(false);
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={loading}
      onChange={handleToggle}
      className="w-4 h-4 accent-bmos-primary cursor-pointer"
    />
  );
}
