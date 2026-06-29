"use client";
import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 900, enabled = true): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const fromRef = useRef(enabled ? 0 : target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      setValue(v);
      fromRef.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);

  return value;
}
