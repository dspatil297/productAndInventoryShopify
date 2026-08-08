"use client";

import { useFormStatus } from "react-dom";

export function CreateProductSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="mf-btn-primary" disabled={pending}>
      {pending ? "Creating… (wait, upload can take time)" : "Create product"}
    </button>
  );
}
