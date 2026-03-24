import { useState, useEffect, useCallback, useRef } from "react";
import { api, type HealthResponse } from "../lib/api";

export type HealthState =
  | "connecting"    // Initiale Verbindung
  | "loading"       // Backend erreichbar, Modelle laden noch
  | "ready"         // Alles bereit
  | "error";        // Backend nicht erreichbar

interface HealthCheckResult {
  state: HealthState;
  health: HealthResponse | null;
  error: string | null;
  retry: () => void;
}

const POLL_INTERVAL_MS = 3000;
const READY_POLL_INTERVAL_MS = 30000;

export function useHealthCheck(): HealthCheckResult {
  const [state, setState] = useState<HealthState>("connecting");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    try {
      const res = await api.health();
      if (!mountedRef.current) return;

      setHealth(res);
      setError(null);

      if (res.status === "ok" || res.status === "healthy" || res.status === "ready") {
        setState("ready");
      } else if (res.status === "loading") {
        setState("loading");
      } else {
        setState("loading");
      }
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e.message || "Backend nicht erreichbar");
      setState((prev) => (prev === "ready" ? "error" : "connecting"));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const poll = () => {
      check().finally(() => {
        if (!mountedRef.current) return;
        const interval =
          state === "ready" ? READY_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
        timerRef.current = setTimeout(poll, interval);
      });
    };

    poll();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [check, state]);

  const retry = useCallback(() => {
    setState("connecting");
    setError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    check();
  }, [check]);

  return { state, health, error, retry };
}
