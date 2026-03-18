import { useState, useEffect, useCallback } from "react";

interface BackendStatus {
  state: string;
  docker: boolean;
  qdrant: boolean;
  backend: boolean;
  error?: string;
  log: string[];
}

const DEFAULT_STATUS: BackendStatus = {
  state: "stopped",
  docker: false,
  qdrant: false,
  backend: false,
  log: [],
};

export function useBackend() {
  const [status, setStatus] = useState<BackendStatus>(DEFAULT_STATUS);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    // Initial status
    window.electronAPI?.backend.getStatus().then(setStatus).catch(() => {});

    // Listen for updates
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
    status.state === "starting_docker" ||
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
