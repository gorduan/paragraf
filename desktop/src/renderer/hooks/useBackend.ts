import { useState, useEffect, useCallback } from "react";

interface BackendStatus {
  state: string;
  qdrant: boolean;
  backend: boolean;
  mcp: boolean;
  error?: string;
  log: string[];
  loadingProgress: number;
  loadingStage: string;
}

const DEFAULT_STATUS: BackendStatus = {
  state: "stopped",
  qdrant: false,
  backend: false,
  mcp: false,
  log: [],
  loadingProgress: 0,
  loadingStage: "",
};

export function useBackend() {
  const [status, setStatus] = useState<BackendStatus>(DEFAULT_STATUS);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    window.electronAPI?.backend.getStatus().then(setStatus).catch(() => {});

    const unsubscribe = window.electronAPI?.backend.onStatus(setStatus);
    return () => unsubscribe?.();
  }, []);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      await window.electronAPI?.backend.start();
    } finally {
      setStarting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setStopping(true);
    try {
      await window.electronAPI?.backend.stop();
    } finally {
      setStopping(false);
    }
  }, []);

  const isReady = status.state === "ready";
  const isError = status.state === "error";
  const isLoading =
    status.state === "starting_qdrant" ||
    status.state === "starting_backend" ||
    status.state === "loading_models";

  return {
    status,
    isReady,
    isError,
    isLoading,
    starting,
    stopping,
    start,
    stop,
  };
}
