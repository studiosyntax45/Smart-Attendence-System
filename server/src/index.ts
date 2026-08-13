
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { createApp } from "./app";
import { config } from "./config/env";
import { attachSocketIO } from "./sockets/index";
import { pruneExpiredRevokedTokens } from "./services/auth";

const app = createApp();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: config.webOrigin, credentials: true },
});
attachSocketIO(io);

httpServer.listen(config.port, () => {
  console.log(`[server] local demo backend: http://localhost:${config.port} (frontend: ${config.webOrigin})`);
  pruneExpiredRevokedTokens().catch((err) =>
    console.warn("[auth] token prune failed (non-fatal):", err)
  );
});
app.set("io", io);
