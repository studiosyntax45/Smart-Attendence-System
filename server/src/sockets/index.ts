
import type { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "../config/db";
import { verifyAccessToken } from "../services/auth";

let io: SocketIOServer | null = null;
export function getIO(): SocketIOServer | null {
  return io;
}

interface AuthedSocket extends Socket {
  data: { userId: string; role: "student" | "faculty" | "admin"; fullName: string };
}

export function attachSocketIO(server: SocketIOServer): void {
  io = server;
  server.use((socket, next) => {
    const token =
      (socket.handshake.auth as { token?: string })?.token ??
      (typeof socket.handshake.query.token === "string" ? socket.handshake.query.token : undefined);
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).data = {
        userId: payload.sub,
        role: payload.role,
        fullName: payload.fullName,
      };
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  server.on("connection", (socket) => {
    const s = socket as AuthedSocket;
    const { userId, role } = s.data;

    if (role === "faculty" || role === "admin") {
      s.join(`faculty:${userId}`);
    }

    s.on("join-session", async (payload: { sessionId?: string }) => {
      const sessionId = payload?.sessionId;
      if (!sessionId) return s.emit("error", { message: "Missing sessionId" });
      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!session) return s.emit("error", { message: "session-not-found" });
      if (role === "faculty" && session.facultyId !== userId) {
        return s.emit("error", { message: "not-your-session" });
      }
      s.join(`session:${sessionId}`);
      s.emit("joined-session", { sessionId });
    });

    s.on("leave-session", (payload: { sessionId?: string }) => {
      if (payload?.sessionId) s.leave(`session:${payload.sessionId}`);
    });
  });
}
