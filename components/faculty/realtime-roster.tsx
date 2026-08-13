
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket, disconnectSocket } from "@/lib/socket-client";
import { apiConfigured } from "@/lib/utils";


export function RealtimeRoster({
  sessionId,
  fallbackSeconds = 60,
}: {
  sessionId: string;
  fallbackSeconds?: number;
}) {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    if (!apiConfigured()) return;
    const socket = getSocket();
    let fallback: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    const refresh = () =>
      queryClientRef.current.invalidateQueries({ queryKey: ["faculty-dashboard"] });

    const startFallback = () => {
      if (disposed) return;
      if (fallback === null) fallback = setInterval(refresh, fallbackSeconds * 1000);
    };
    const stopFallback = () => {
      if (fallback !== null) {
        clearInterval(fallback);
        fallback = null;
      }
    };

    const onConnect = () => {
      socket.emit("join-session", { sessionId });
    };
    const onNew = () => refresh();
    const onUpdated = () => refresh();
    const onClosed = () => refresh();
    const onDisconnect = () => startFallback();
    const onError = (err: { message?: string }) => {
      if (err?.message === "not-your-session") {
        stopFallback();
      }
    };

    if (socket.connected) {
      onConnect();
      stopFallback();
    } else {
      startFallback();
    }
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("attendance:new", onNew);
    socket.on("attendance:updated", onUpdated);
    socket.on("session:closed", onClosed);
    socket.on("error", onError);

    return () => {
      disposed = true;
      stopFallback();
      socket.emit("leave-session", { sessionId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("attendance:new", onNew);
      socket.off("attendance:updated", onUpdated);
      socket.off("session:closed", onClosed);
      socket.off("error", onError);
      disconnectSocket();
    };
  }, [sessionId, fallbackSeconds]);

  return null;
}
