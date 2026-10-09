"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending }: { children: React.ReactNode; pending: string }) {
  const { pending: busy } = useFormStatus();
  return <button className="auth-button" type="submit" disabled={busy}>{busy ? pending : children}</button>;
}
