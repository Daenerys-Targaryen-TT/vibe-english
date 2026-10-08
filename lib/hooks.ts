"use client";

import { useEffect, useState } from "react";

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
