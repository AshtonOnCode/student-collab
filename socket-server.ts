// Load env first so anything imported afterwards (e.g. prisma) can read it
import "dotenv/config";

import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "socket.io";
import { prisma } from "./src/lib/prisma";

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const PORT = 3001;
const CLIENT_ORIGIN = "http://localhost:3000";
const MAX_BODY_BYTES = 100_000; // 100KB is far more than a chat message needs

/* -------------------------------------------------------------------------- */
/* Generic helpers                                                            */
/* -------------------------------------------------------------------------- */

class PayloadTooLargeError extends Error {}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

function getCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}

function isValidId(id: unknown): id is number {
  return Number.isSafeInteger(id) && (id as number) > 0;
}

/* -------------------------------------------------------------------------- */
/* Internal HTTP API (called by the Next.js backend)                          */
/* -------------------------------------------------------------------------- */

function isAuthorized(req: IncomingMessage) {
  const expected = process.env.SOCKET_INTERNAL_SECRET;
  const provided = req.headers["x-internal-secret"];

  if (!expected || typeof provided !== "string") return false;
  return timingSafeEqual(sha256(expected), sha256(provided));
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new PayloadTooLargeError();
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res: ServerResponse, status: number, body = "", headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

// `io` is declared below; this only runs per-request, after it exists.
async function handleInternalRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST" || req.url !== "/internal/broadcast-message") {
    return send(res, 404, "Not found");
  }

  if (!isAuthorized(req)) {
    return send(res, 401, "Unauthorized");
  }

  try {
    const { channelId, message } = await readJson(req);

    if (!isValidId(channelId) || !message) {
      return send(res, 400, "Invalid payload");
    }

    io.to(`channel:${channelId}`).emit("message:new", message);

    send(res, 200, JSON.stringify({ ok: true }), {
      "Content-Type": "application/json",
    });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return send(res, 413, "Payload too large", { Connection: "close" });
    }
    console.error("Message broadcast failed:", error);
    send(res, 400, "Invalid request");
  }
}

/* -------------------------------------------------------------------------- */
/* Authorization (database checks)                                            */
/* -------------------------------------------------------------------------- */

async function canAccessChannel(userId: number, channelId: number): Promise<boolean> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, type: true, teamId: true, projectId: true },
  });

  // The channel doesn't exist.
  if (!channel) return false;

  // Every channel must belong to a team.
  const teamId = channel.teamId;
  if (!teamId) return false;

  // The user must belong to the channel's team.
  const teamMembership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { userId: true },
  });
  if (!teamMembership) return false;

  // Team channels only require team membership.
  if (channel.type === "TEAM") return true;

  // Project channels also require project membership.
  if (channel.type === "PROJECT") {
    if (!channel.projectId) return false;

    const projectMembership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: channel.projectId, userId } },
      select: { userId: true },
    });

    return projectMembership !== null;
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* Server setup                                                               */
/* -------------------------------------------------------------------------- */

const httpServer = createServer(handleInternalRequest);

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
  },
});

/* -------------------------------------------------------------------------- */
/* Socket authentication middleware                                           */
/* -------------------------------------------------------------------------- */

io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;

    const sessionToken =
      getCookie(cookieHeader, "authjs.session-token") ??
      getCookie(cookieHeader, "__Secure-authjs.session-token");

    if (!sessionToken) {
      return next(new Error("Authentication required"));
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!session || session.expires <= new Date()) {
      return next(new Error("Invalid or expired session"));
    }

    socket.data.userId = session.user.id;
    next();
  } catch (error) {
    console.error("Socket authentication failed:", error);
    next(new Error("Authentication failed"));
  }
});

/* -------------------------------------------------------------------------- */
/* Socket event handlers                                                      */
/* -------------------------------------------------------------------------- */

io.on("connection", (socket) => {
  console.log("Authenticated socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });

  socket.on("channel:join", async (channelId: number, callback) => {
    if (typeof callback !== "function") return;

    try {
      if (!isValidId(channelId)) {
        return callback({ ok: false, error: "Invalid channel ID" });
      }

      const userId = socket.data.userId as number;

      if (!(await canAccessChannel(userId, channelId))) {
        return callback({ ok: false, error: "You cannot access this channel" });
      }

      await socket.join(`channel:${channelId}`);
      callback({ ok: true });
    } catch (error) {
      console.error("Channel join failed:", error);
      callback({ ok: false, error: "Unable to join channel" });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Start                                                                      */
/* -------------------------------------------------------------------------- */

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
