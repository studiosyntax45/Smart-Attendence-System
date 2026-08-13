
import { io as createSocket, type Socket } from "socket.io-client";
import { API_BASE_URL, getAccessToken } from "./api-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }
  socket = createSocket(API_BASE_URL, {
    transports: ["websocket"],
    auth: { token: getAccessToken() ?? "" },
    reconnection: true,
    reconnectionDelayMax: 10_000,
  });
  return socket;
}


export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
