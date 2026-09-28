"use strict";

const crypto = require("crypto");
const { GameError, createInitialGame, START_SCORE } = require("./game-manager");

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_DIGITS = "23456789";
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeRoomCode(code) {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * In-memory storage for rooms, players and admin sessions. Every read/write
 * goes through this class, so it can later be backed by SQLite/PostgreSQL/Redis
 * without touching the game rules in game-manager.js.
 *
 * Runtime-only fields (connections, timers) must stay out of any persisted copy.
 */
class RoomManager {
  constructor({ maxPlayersPerRoom = 100 } = {}) {
    this.rooms = new Map();
    this.adminSessions = new Map();
    this.maxPlayersPerRoom = maxPlayersPerRoom;
  }

  get size() {
    return this.rooms.size;
  }

  list() {
    return [...this.rooms.values()];
  }

  // ------------------------------------------------------------------
  // Admin sessions
  // ------------------------------------------------------------------

  createAdminSession() {
    const token = randomToken();
    this.adminSessions.set(token, { token, roomCode: null, lastUsed: Date.now() });
    return token;
  }

  getAdminSession(token) {
    if (typeof token !== "string" || !token) return null;
    const session = this.adminSessions.get(token) || null;
    if (session) session.lastUsed = Date.now();
    return session;
  }

  expireAdminSessions(now = Date.now()) {
    for (const [token, session] of this.adminSessions) {
      const roomGone = session.roomCode && !this.rooms.has(session.roomCode);
      if (now - session.lastUsed > ADMIN_SESSION_TTL_MS || roomGone) this.adminSessions.delete(token);
    }
  }

  // ------------------------------------------------------------------
  // Rooms
  // ------------------------------------------------------------------

  generateCode() {
    for (;;) {
      let code = "";
      for (let i = 0; i < 3; i++) code += CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)];
      for (let i = 0; i < 3; i++) code += CODE_DIGITS[crypto.randomInt(CODE_DIGITS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  createRoom(adminToken) {
    const code = this.generateCode();
    const now = Date.now();
    const room = {
      code,
      adminToken,
      adminConnections: new Set(),
      players: new Map(),
      game: createInitialGame(),
      timers: { auction: null, answer: null },
      createdAt: now,
      lastActivity: now
    };
    this.rooms.set(code, room);
    const session = this.adminSessions.get(adminToken);
    if (session) session.roomCode = code;
    return room;
  }

  getRoom(code) {
    return this.rooms.get(normalizeRoomCode(code)) || null;
  }

  requireRoom(code) {
    const normalized = normalizeRoomCode(code);
    if (!normalized) throw new GameError("ROOM_CODE_REQUIRED", "Vui lòng nhập mã phòng.");
    const room = this.rooms.get(normalized);
    if (!room) throw new GameError("ROOM_NOT_FOUND", `Không tìm thấy phòng ${normalized}.`);
    return room;
  }

  deleteRoom(code) {
    this.rooms.delete(normalizeRoomCode(code));
  }

  hasConnections(room) {
    if (room.adminConnections.size) return true;
    for (const p of room.players.values()) if (p.connections.size) return true;
    return false;
  }

  // ------------------------------------------------------------------
  // Players
  // ------------------------------------------------------------------

  addPlayer(room, name) {
    if (room.players.size >= this.maxPlayersPerRoom) {
      throw new GameError("ROOM_FULL", `Phòng đã đủ ${this.maxPlayersPerRoom} người chơi.`);
    }
    const now = Date.now();
    const player = {
      id: crypto.randomUUID(),
      playerToken: randomToken(),
      name,
      score: START_SCORE,
      bid: 0,
      bidAt: 0,
      answered: false,
      selectedAnswer: null,
      connections: new Set(),
      joinedAt: now,
      disconnectedAt: null
    };
    room.players.set(player.id, player);
    return player;
  }

  getPlayer(room, playerId) {
    return typeof playerId === "string" ? room.players.get(playerId) || null : null;
  }
}

module.exports = { RoomManager, normalizeRoomCode, randomToken };
