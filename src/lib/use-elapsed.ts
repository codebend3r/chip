import { useEffect, useState } from "react";

type UseElapsedOptions = {
  startedAt: number;
  /** Null while the run is still going; the clock ticks once a second until it is set. */
  finishedAt: number | null;
};

/** Milliseconds since `startedAt`, frozen at `finishedAt` once the run ends. */
export function useElapsed({ startedAt, finishedAt }: UseElapsedOptions): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (finishedAt !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt, finishedAt]);

  return Math.max(0, (finishedAt ?? now) - startedAt);
}
