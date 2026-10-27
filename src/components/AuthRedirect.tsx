"use client";
import { useEffect } from "react";
export default function AuthRedirect() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (
      window.location.pathname !== "/admin" &&
      ["invite", "recovery"].includes(hash.get("type") ?? "") &&
      hash.has("access_token")
    )
      window.location.replace("/admin" + window.location.hash);
  }, []);
  return null;
}
