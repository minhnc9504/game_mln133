"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer, WebSocket } = require("ws");
const { RoomManager, normalizeRoomCode } = require("./room-manager");
const { GameManager, GameError } = require("./game-manager");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "congminh";
const AUCTION_MS = Math.round((Number(process.env.AUCTION_SECONDS) || 30) * 1000);
const ANSWER_MS = Math.round((Number(process.env.ANSWER_SECONDS) || 30) * 1000);
const MAX_PLAYERS_PER_ROOM = Number(process.env.MAX_PLAYERS_PER_ROOM) || 100;
const QUIET = process.env.QUIET === "1";

const PLAYER_RETENTION_MS = 30 * 60 * 1000;
const ROOM_IDLE_TTL_MS = 3 * 60 * 60 * 1000;
const HEARTBEAT_MS = 25_000;
const SWEEP_MS = 60_000;
const RATE_LIMIT_PER_SECOND = 100;
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MS = 60_000;
const MAX_NAME_LENGTH = 40;
const INDEX_FILE = path.join(__dirname, "..", "index.html");

function log(tag, message, force = false) {
  if (QUIET && !force) return;
  console.log(`${new Date().toISOString().slice(11, 19)} [${tag}] ${message}`);
}

const rooms = new RoomManager({ maxPlayersPerRoom: MAX_PLAYERS_PER_ROOM });
const game = new GameManager({ auctionMs: AUCTION_MS, answerMs: ANSWER_MS, emit: emitToRoom, sync: syncRoom, log });

// ====================================================================
// HTTP – serves the client, so http(s)://host and ws(s)://host always match
// ====================================================================

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Method not allowed");
  }

  if (pathname === "/" || pathname === "/index.html") {
    return fs.readFile(INDEX_FILE, (err, data) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Không đọc được index.html");
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  }

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, connections: wss.clients.size, uptime: Math.round(process.uptime()) }));
  }

  if (pathname === "/favicon.ico") {
    res.writeHead(204);
    return res.end();
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

// ====================================================================
// WebSocket plumbing
// ====================================================================

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
const loginFailuresByIp = new Map();

const emptyCtx = () => ({ role: null, roomCode: null, playerId: null });

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

wss.on("connection", (ws, req) => {
  ws.ip = clientIp(req);
  ws.isAlive = true;
  ws.ctx = emptyCtx();
  ws.adminToken = null;
  ws.rate = { windowStart: Date.now(), count: 0 };

  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", (data, isBinary) => handleRawMessage(ws, data, isBinary));
  ws.on("close", () => detach(ws));
  ws.on("error", err => log("WS", `Lỗi kết nối từ ${ws.ip}: ${err.message}`));

  send(ws, { type: "hello", serverNow: Date.now() });
});

function sendRaw(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(payload);
}

function send(ws, message) {
  sendRaw(ws, JSON.stringify(message));
}

function sendError(ws, code, message, command) {
  send(ws, { type: "error", code, message, command: command || null });
}

/** target: "all" | "admins" | "players" | { player: id } | { playersExcept: id } */
function emitToRoom(room, message, target = "all") {
  const payload = JSON.stringify({ ...message, roomCode: room.code, serverNow: Date.now() });
  if (target === "all" || target === "admins") {
    for (const ws of room.adminConnections) sendRaw(ws, payload);
  }
  if (target === "admins") return;
  for (const p of room.players.values()) {
    const include =
      target === "all" || target === "players" ||
      (typeof target === "object" && target.player !== undefined && p.id === target.player) ||
      (typeof target === "object" && target.playersExcept !== undefined && p.id !== target.playersExcept);
    if (include) for (const ws of p.connections) sendRaw(ws, payload);
  }
}

/** Pushes a personalized snapshot to every connection in the room. */
function syncRoom(room) {
  room.lastActivity = Date.now();
  if (room.adminConnections.size) {
    const payload = JSON.stringify({ type: "room_state", state: game.buildStateFor(room, { role: "admin" }) });
    for (const ws of room.adminConnections) sendRaw(ws, payload);
  }
  for (const p of room.players.values()) {
    if (!p.connections.size) continue;
    const payload = JSON.stringify({ type: "room_state", state: game.buildStateFor(room, { role: "player", playerId: p.id }) });
    for (const ws of p.connections) sendRaw(ws, payload);
  }
}

// ====================================================================
// Connection binding
// ====================================================================

function attachAdmin(ws, room) {
  detach(ws);
  ws.ctx = { role: "admin", roomCode: room.code, playerId: null };
  room.adminConnections.add(ws);
}

function attachPlayer(ws, room, player) {
  detach(ws);
  ws.ctx = { role: "player", roomCode: room.code, playerId: player.id };
  player.connections.add(ws);
  player.disconnectedAt = null;
}

function detach(ws) {
  const { role, roomCode, playerId } = ws.ctx || emptyCtx();
  ws.ctx = emptyCtx();
  if (!role) return;
  const room = rooms.getRoom(roomCode);
  if (!room) return;

  if (role === "admin") {
    room.adminConnections.delete(ws);
    if (!room.adminConnections.size) {
      log("ADMIN", `Disconnected from ${room.code}`);
      syncRoom(room);
    }
    return;
  }

  const player = room.players.get(playerId);
  if (player && player.connections.delete(ws) && player.connections.size === 0) {
    player.disconnectedAt = Date.now();
    log("PLAYER", `${player.name} disconnected from ${room.code}`);
    game.notifyPlayersChanged(room, "disconnected", player.name);
    syncRoom(room);
  }
}

function requireAdmin(ws, msg) {
  if (ws.ctx.role !== "admin") {
    throw new GameError("ADMIN_NOT_AUTHENTICATED", "Bạn chưa đăng nhập Admin hoặc phiên Admin đã hết hạn.");
  }
  const room = rooms.getRoom(ws.ctx.roomCode);
  if (!room) {
    ws.ctx = emptyCtx();
    throw new GameError("ROOM_NOT_FOUND", "Phòng không còn tồn tại trên server.");
  }
  if (msg.roomCode !== undefined && normalizeRoomCode(msg.roomCode) !== room.code) {
    throw new GameError("ROOM_MISMATCH", "Lệnh không thuộc phòng bạn đang điều khiển.");
  }
  return room;
}

function requirePlayer(ws, msg) {
  if (ws.ctx.role !== "player") throw new GameError("PLAYER_NOT_JOINED", "Bạn chưa tham gia phòng nào.");
  const room = rooms.getRoom(ws.ctx.roomCode);
  if (!room) {
    ws.ctx = emptyCtx();
    throw new GameError("ROOM_NOT_FOUND", "Phòng không còn tồn tại trên server.");
  }
  const player = room.players.get(ws.ctx.playerId);
  if (!player) {
    ws.ctx = emptyCtx();
    throw new GameError("PLAYER_NOT_FOUND", "Không tìm thấy người chơi trong phòng. Hãy tham gia lại.");
  }
  if (msg.roomCode !== undefined && normalizeRoomCode(msg.roomCode) !== room.code) {
    throw new GameError("ROOM_MISMATCH", "Bạn chỉ được thao tác trong phòng đã tham gia.");
  }
  if (msg.playerId !== undefined && msg.playerId !== player.id) {
    throw new GameError("FORBIDDEN", "Không được thao tác thay người chơi khác.");
  }
  return { room, player };
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function sanitizeName(name) {
  return String(name ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

// ====================================================================
// Command handlers
// ====================================================================

function handleAdminLogin(ws, msg) {
  const now = Date.now();
  const record = loginFailuresByIp.get(ws.ip) || { failures: 0, lockedUntil: 0, lastFailureAt: 0 };
  if (record.lockedUntil > now) {
    throw new GameError("TOO_MANY_ATTEMPTS", `Nhập sai quá nhiều lần. Thử lại sau ${Math.ceil((record.lockedUntil - now) / 1000)} giây.`);
  }
  if (typeof msg.password !== "string" || !msg.password) {
    throw new GameError("PASSWORD_REQUIRED", "Vui lòng nhập mật khẩu Admin.");
  }
  if (!safeEqual(msg.password, ADMIN_PASSWORD)) {
    record.failures += 1;
    record.lastFailureAt = now;
    if (record.failures >= MAX_LOGIN_FAILURES) {
      record.failures = 0;
      record.lockedUntil = now + LOGIN_LOCK_MS;
    }
    loginFailuresByIp.set(ws.ip, record);
    log("AUTH", `Sai mật khẩu Admin từ ${ws.ip}`);
    throw new GameError("WRONG_PASSWORD", "Sai mật khẩu Admin.");
  }
  loginFailuresByIp.delete(ws.ip);

  ws.adminToken = rooms.createAdminSession();
  log("AUTH", `Admin đăng nhập từ ${ws.ip}`);
  send(ws, { type: "admin_session", adminToken: ws.adminToken });
}

function handleCreateRoom(ws, msg) {
  const token = typeof msg.adminToken === "string" ? msg.adminToken : ws.adminToken;
  const session = rooms.getAdminSession(token);
  if (!session) throw new GameError("ADMIN_NOT_AUTHENTICATED", "Bạn cần đăng nhập Admin trước khi tạo phòng.");

  ws.adminToken = session.token;
  const room = rooms.createRoom(session.token);
  attachAdmin(ws, room);
  log("ROOM", `Created ${room.code}`);
  send(ws, { type: "room_created", roomCode: room.code });
  syncRoom(room);
}

function handleAdminResume(ws, msg) {
  const session = rooms.getAdminSession(msg.adminToken);
  if (!session) throw new GameError("ADMIN_SESSION_EXPIRED", "Phiên Admin đã hết hạn. Vui lòng đăng nhập lại.");
  const room = rooms.requireRoom(msg.roomCode);
  if (!safeEqual(room.adminToken, session.token)) {
    throw new GameError("FORBIDDEN", "Phiên Admin này không có quyền điều khiển phòng " + room.code + ".");
  }
  ws.adminToken = session.token;
  attachAdmin(ws, room);
  log("ADMIN", `Reconnected to ${room.code}`);
  send(ws, { type: "admin_resumed", roomCode: room.code });
  syncRoom(room);
}

function handleAdminLeave(ws, msg) {
  const room = requireAdmin(ws, msg);
  detach(ws);
  ws.adminToken = null;
  log("ADMIN", `Left ${room.code}`);
  send(ws, { type: "ack", command: "admin_leave" });
}

function resumePlayer(ws, room, player) {
  attachPlayer(ws, room, player);
  log("PLAYER", `${player.name} reconnected ${room.code}`);
  send(ws, { type: "joined", roomCode: room.code, playerId: player.id, playerToken: player.playerToken, name: player.name, reconnected: true });
  game.notifyPlayersChanged(room, "reconnected", player.name);
  syncRoom(room);
}

function handleJoinRoom(ws, msg) {
  const room = rooms.requireRoom(msg.roomCode);

  const existing = rooms.getPlayer(room, msg.playerId);
  if (existing && typeof msg.playerToken === "string" && safeEqual(msg.playerToken, existing.playerToken)) {
    return resumePlayer(ws, room, existing);
  }

  if (room.game.status === "ended") throw new GameError("ROOM_ENDED", "Phòng đã kết thúc.");
  const name = sanitizeName(msg.name);
  if (name.length < 2) throw new GameError("INVALID_NAME", `Tên người chơi phải có từ 2 đến ${MAX_NAME_LENGTH} ký tự.`);

  const player = rooms.addPlayer(room, name);
  attachPlayer(ws, room, player);
  log("PLAYER", `${player.name} joined ${room.code}`);
  send(ws, { type: "joined", roomCode: room.code, playerId: player.id, playerToken: player.playerToken, name: player.name, reconnected: false });
  game.notifyPlayersChanged(room, "joined", player.name);
  syncRoom(room);
}

function handleReconnect(ws, msg) {
  const room = rooms.requireRoom(msg.roomCode);
  const player = rooms.getPlayer(room, msg.playerId);
  if (!player || typeof msg.playerToken !== "string" || !safeEqual(msg.playerToken, player.playerToken)) {
    throw new GameError("PLAYER_NOT_FOUND", "Không tìm thấy người chơi trong phòng. Hãy tham gia lại.");
  }
  // A second tab sharing localStorage must not silently hijack a live player;
  // the same tab (sessionStorage, takeover: true) may always resume.
  if (player.connections.size > 0 && msg.takeover !== true) {
    throw new GameError("PLAYER_IN_USE", "Người chơi này đang mở ở tab/thiết bị khác.");
  }
  resumePlayer(ws, room, player);
}

function handlePlayerLeave(ws, msg) {
  const { room, player } = requirePlayer(ws, msg);
  const connections = [...player.connections];
  for (const c of connections) c.ctx = emptyCtx();
  player.connections.clear();
  player.disconnectedAt = Date.now();
  game.playerLeft(room, player, "left");
  for (const c of connections) send(c, { type: "left", roomCode: room.code });
}

const adminCommand = fn => (ws, msg) => fn(requireAdmin(ws, msg), msg);

const handlers = {
  ping: ws => send(ws, { type: "pong", serverNow: Date.now() }),

  admin_login: handleAdminLogin,
  create_room: handleCreateRoom,
  admin_resume: handleAdminResume,
  admin_leave: handleAdminLeave,

  join_room: handleJoinRoom,
  reconnect: handleReconnect,
  player_leave: handlePlayerLeave,

  admin_start_game: adminCommand(room => game.startGame(room)),
  admin_open_auction: adminCommand(room => game.openAuction(room)),
  admin_finalize_auction: adminCommand(room => game.finalizeAuction(room, { auto: false })),
  admin_open_question: adminCommand(room => game.openQuestion(room)),
  admin_submit_answer: adminCommand((room, msg) => game.submitAnswer(room, msg.answer)),
  admin_next_question: adminCommand(room => game.nextQuestion(room)),
  admin_spin_jackpot: adminCommand(room => game.spinJackpot(room)),
  admin_end_game: adminCommand(room => game.endGame(room)),
  admin_reset_room: adminCommand(room => game.resetRoom(room)),
  admin_get_questions: (ws, msg) => {
    requireAdmin(ws, msg);
    send(ws, { type: "questions_list", questions: game.questionsForAdmin() });
  },

  player_bid: (ws, msg) => {
    const { room, player } = requirePlayer(ws, msg);
    const bid = game.placeBid(room, player, msg.bid);
    send(ws, { type: "ack", command: "player_bid", bid });
  },
  player_answer: (ws, msg) => {
    const { room, player } = requirePlayer(ws, msg);
    const answer = game.playerAnswer(room, player, msg.answer);
    send(ws, { type: "ack", command: "player_answer", answer });
  }
};

function handleRawMessage(ws, data, isBinary) {
  const now = Date.now();
  if (now - ws.rate.windowStart >= 1000) {
    ws.rate.windowStart = now;
    ws.rate.count = 0;
  }
  ws.rate.count += 1;
  if (ws.rate.count > RATE_LIMIT_PER_SECOND) {
    if (ws.rate.count === RATE_LIMIT_PER_SECOND + 1) sendError(ws, "RATE_LIMITED", "Bạn thao tác quá nhanh, vui lòng chậm lại.");
    return;
  }

  if (isBinary) return sendError(ws, "INVALID_MESSAGE", "Chỉ chấp nhận tin nhắn JSON dạng text.");

  let msg;
  try {
    msg = JSON.parse(data.toString("utf8"));
  } catch {
    return sendError(ws, "INVALID_JSON", "Tin nhắn không phải JSON hợp lệ.");
  }
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || typeof msg.type !== "string") {
    return sendError(ws, "INVALID_MESSAGE", "Tin nhắn thiếu trường type.");
  }

  const handler = Object.prototype.hasOwnProperty.call(handlers, msg.type) ? handlers[msg.type] : null;
  if (!handler) return sendError(ws, "UNKNOWN_COMMAND", `Lệnh không hợp lệ: ${msg.type.slice(0, 40)}`, msg.type);

  try {
    handler(ws, msg);
  } catch (err) {
    if (err instanceof GameError) {
      log("REJECT", `${msg.type} -> ${err.code}${ws.ctx.roomCode ? ` (${ws.ctx.roomCode})` : ""}`);
      return sendError(ws, err.code, err.message, msg.type);
    }
    log("ERROR", `${msg.type}: ${err && err.stack ? err.stack : err}`, true);
    sendError(ws, "INTERNAL_ERROR", "Máy chủ gặp lỗi khi xử lý lệnh.", msg.type);
  }
}

// ====================================================================
// Housekeeping
// ====================================================================

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const room of rooms.list()) {
    for (const player of [...room.players.values()]) {
      const offlineTooLong = !player.connections.size && player.disconnectedAt && now - player.disconnectedAt > PLAYER_RETENTION_MS;
      const inActiveRound = room.game.winningPlayerId === player.id && ["winner", "question"].includes(room.game.phase);
      if (offlineTooLong && !inActiveRound && room.game.status !== "ended") game.playerLeft(room, player, "timed out");
    }
    if (!rooms.hasConnections(room) && now - room.lastActivity > ROOM_IDLE_TTL_MS) {
      game.clearTimers(room);
      rooms.deleteRoom(room.code);
      log("ROOM", `Deleted ${room.code} (không hoạt động)`);
    }
  }
  rooms.expireAdminSessions(now);
  for (const [ip, record] of loginFailuresByIp) {
    if (record.lockedUntil < now && now - record.lastFailureAt > LOGIN_LOCK_MS) loginFailuresByIp.delete(ip);
  }
}, SWEEP_MS);

wss.on("close", () => {
  clearInterval(heartbeat);
  clearInterval(sweeper);
});

process.on("uncaughtException", err => log("ERROR", `uncaughtException: ${err && err.stack ? err.stack : err}`, true));
process.on("unhandledRejection", err => log("ERROR", `unhandledRejection: ${err && err.stack ? err.stack : err}`, true));

function shutdown() {
  log("SERVER", "Đang tắt...", true);
  for (const ws of wss.clients) ws.close(1001, "Server shutting down");
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, HOST, () => {
  log("SERVER", `WebSocket started on ws://localhost:${PORT} (HTTP: http://localhost:${PORT})`, true);
  log("SERVER", `Auction ${AUCTION_MS / 1000}s • Answer ${ANSWER_MS / 1000}s • ${game.questions.length} câu hỏi`, true);
  if (!process.env.ADMIN_PASSWORD) log("SERVER", "ADMIN_PASSWORD chưa được đặt – đang dùng mật khẩu mặc định cho demo.", true);
});
