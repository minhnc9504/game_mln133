"use strict";

/*
 * End-to-end test: starts the real server with short timers, then drives
 * 1 admin + several players over WebSocket through a full game.
 *
 *   npm test            (VERBOSE=1 npm test to see server logs)
 */
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const assert = require("assert/strict");
const WebSocket = require("ws");
const questions = require("../server/questions");

const PORT = 3999;
const URL = `ws://localhost:${PORT}`;

class Client {
  constructor(label) {
    this.label = label;
    this.history = [];
    this.state = null;
    this.listeners = new Set();
  }

  open() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(URL);
      this.ws.on("open", resolve);
      this.ws.on("error", reject);
      this.ws.on("message", data => {
        const m = JSON.parse(data);
        this.history.push(m);
        if (m.type === "room_state") this.state = m.state;
        for (const l of [...this.listeners]) l(m);
      });
    });
  }

  send(type, payload = {}) {
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  wait(pred, ms = 5000, label = "message") {
    return new Promise((resolve, reject) => {
      const l = m => {
        if (pred(m)) {
          clearTimeout(t);
          this.listeners.delete(l);
          resolve(m);
        }
      };
      const t = setTimeout(() => {
        this.listeners.delete(l);
        reject(new Error(`${this.label}: timeout waiting for ${label}`));
      }, ms);
      this.listeners.add(l);
    });
  }

  async request(type, payload, expectType) {
    const w = this.wait(m => m.type === expectType || (m.type === "error" && m.command === type), 5000, `${type} -> ${expectType}`);
    this.send(type, payload);
    const m = await w;
    if (m.type === "error") throw new Error(`${this.label} ${type} failed: ${m.code} ${m.message}`);
    return m;
  }

  async expectError(type, payload, code) {
    const w = this.wait(m => m.type === "error", 5000, `error ${code}`);
    this.send(type, payload);
    const m = await w;
    assert.equal(m.code, code, `${this.label} ${type}: expected ${code}, got ${m.code} (${m.message})`);
    return m;
  }

  waitState(pred, ms = 5000, label = "state") {
    if (this.state && pred(this.state)) return Promise.resolve(this.state);
    return this.wait(m => m.type === "room_state" && pred(m.state), ms, label).then(m => m.state);
  }

  close() {
    return new Promise(resolve => {
      if (this.ws.readyState === WebSocket.CLOSED) return resolve();
      this.ws.once("close", resolve);
      this.ws.close();
    });
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let step = 0;
function ok(msg) {
  console.log(`  ✔ ${String(++step).padStart(2, "0")} ${msg}`);
}

function httpGet(p) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${p}`, res => {
      let body = "";
      res.on("data", c => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], {
      env: { ...process.env, PORT: String(PORT), AUCTION_SECONDS: "2", ANSWER_SECONDS: "1.5", ADMIN_PASSWORD: "congminh", QUIET: process.env.VERBOSE ? "0" : "1" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let started = false;
    child.stdout.on("data", d => {
      const s = d.toString();
      if (process.env.VERBOSE) process.stdout.write(s);
      if (!started && s.includes("WebSocket started")) {
        started = true;
        resolve(child);
      }
    });
    child.stderr.on("data", d => process.stderr.write(d));
    child.on("exit", code => {
      if (!started) reject(new Error(`Server exited early (${code})`));
    });
  });
}

async function playRound({ admin, bidder, bid, answer }) {
  await admin.request("admin_open_auction", {}, "auction_started");
  await bidder.request("player_bid", { bid }, "ack");
  await admin.request("admin_finalize_auction", {}, "auction_finished");
  await admin.request("admin_open_question", {}, "question_opened");
  await bidder.request("player_answer", { answer }, "ack");
  await admin.request("admin_submit_answer", {}, "answer_result");
}

async function main() {
  const server = await startServer();
  const clients = [];
  const make = async label => {
    const c = new Client(label);
    await c.open();
    clients.push(c);
    return c;
  };

  try {
    /* ---------- HTTP ---------- */
    const page = await httpGet("/");
    assert.equal(page.status, 200);
    assert.ok(page.body.includes("MLN133"));
    assert.ok(!/supabase/i.test(page.body), "index.html must not reference Supabase");
    assert.ok(!page.body.includes("congminh"), "admin password must not be in index.html");
    assert.ok(!page.body.includes("correct:"), "questions/answers must not be in index.html");
    assert.equal((await httpGet("/server/questions.js")).status, 404);
    ok("HTTP serves index.html without Supabase, password or answers; server files are not exposed");

    /* ---------- Admin auth + room ---------- */
    const admin = await make("Admin");
    await admin.expectError("admin_login", { password: "sai" }, "WRONG_PASSWORD");
    await admin.expectError("create_room", {}, "ADMIN_NOT_AUTHENTICATED");
    const { adminToken } = await admin.request("admin_login", { password: "congminh" }, "admin_session");
    const { roomCode } = await admin.request("create_room", { adminToken }, "room_created");
    assert.match(roomCode, /^[A-Z]{3}[0-9]{3}$/);
    ok(`Admin login via server + room created (${roomCode})`);

    /* ---------- Players join ---------- */
    const minh = await make("Minh");
    const nam = await make("Nam");
    const an = await make("An");
    await minh.expectError("player_bid", { bid: 10 }, "PLAYER_NOT_JOINED");
    await minh.expectError("admin_open_auction", {}, "ADMIN_NOT_AUTHENTICATED");
    await minh.expectError("join_room", { roomCode: "ZZZ999", name: "Minh" }, "ROOM_NOT_FOUND");
    await minh.expectError("join_room", { roomCode, name: "M" }, "INVALID_NAME");

    const jm = await minh.request("join_room", { roomCode, name: "Minh" }, "joined");
    await admin.waitState(s => s.players.some(p => p.name === "Minh"), 2000, "admin sees Minh");
    const jn = await nam.request("join_room", { roomCode: roomCode.toLowerCase(), name: "Nam" }, "joined");
    await admin.waitState(s => s.players.some(p => p.name === "Nam"), 2000, "admin sees Nam");
    const ja = await an.request("join_room", { roomCode, name: "An" }, "joined");
    let s = await admin.waitState(s => s.players.length === 3, 2000, "admin sees 3 players");
    assert.deepEqual(s.players.map(p => [p.name, p.score, p.connected]), [["Minh", 100, true], ["Nam", 100, true], ["An", 100, true]]);
    ok("Admin sees Minh, Nam, An join in realtime (100 points, online)");

    const minh2 = await make("Minh#2");
    const j2 = await minh2.request("join_room", { roomCode, name: "Minh" }, "joined");
    assert.notEqual(j2.playerId, jm.playerId);
    await admin.waitState(s => s.players.length === 4, 2000, "4 players");
    await minh2.request("player_leave", {}, "left");
    await admin.waitState(s => s.players.length === 3, 2000, "back to 3 players");
    ok("Duplicate names get distinct UUIDs; player_leave updates the admin in realtime");

    /* ---------- Independent second room ---------- */
    const admin2 = await make("Admin2");
    const { adminToken: token2 } = await admin2.request("admin_login", { password: "congminh" }, "admin_session");
    const { roomCode: room2 } = await admin2.request("create_room", { adminToken: token2 }, "room_created");
    const hung = await make("Hùng");
    await hung.request("join_room", { roomCode: room2, name: "Hùng" }, "joined");
    await admin2.waitState(s => s.players.length === 1);
    assert.ok(!admin.state.players.some(p => p.name === "Hùng"));
    await hung.expectError("player_bid", { roomCode, bid: 5 }, "ROOM_MISMATCH");
    ok(`Rooms ${roomCode} and ${room2} are isolated`);

    /* ---------- Start game ---------- */
    await nam.expectError("player_bid", { bid: 10 }, "AUCTION_NOT_OPEN");
    await admin.request("admin_start_game", {}, "game_started");
    s = await minh.waitState(s => s.game.status === "playing");
    assert.equal(s.question.question, undefined, "player must not see question text before winning");
    assert.equal(s.question.correct, undefined);
    ok("Game started; players see only the question number");

    /* ---------- Round 1: auction auto-finalized by server ---------- */
    await admin.request("admin_open_auction", {}, "auction_started");
    await an.expectError("player_bid", { bid: 1000 }, "INSUFFICIENT_SCORE");
    await an.expectError("player_bid", { bid: "abc" }, "INVALID_BID");
    await an.expectError("player_bid", { bid: 0 }, "INVALID_BID");
    await an.expectError("player_bid", { bid: 2.5 }, "INVALID_BID");
    await an.expectError("player_bid", { bid: 10, playerId: jn.playerId }, "FORBIDDEN");
    const adminBidUpdate = admin.wait(m => m.type === "auction_updated" && m.bidCount === 3, 3000, "admin bids");
    await minh.request("player_bid", { bid: 30 }, "ack");
    await nam.request("player_bid", { bid: 50 }, "ack");
    await an.request("player_bid", { bid: 40 }, "ack");
    const upd = await adminBidUpdate;
    assert.deepEqual(upd.bids.map(b => [b.name, b.bid]), [["Minh", 30], ["Nam", 50], ["An", 40]]);
    await minh.expectError("player_bid", { bid: 60 }, "ALREADY_BID");
    await minh.expectError("admin_finalize_auction", {}, "ADMIN_NOT_AUTHENTICATED");
    assert.ok(minh.state.players.every(p => p.bid === undefined), "players must not see other bids");
    ok("Bids validated server-side; admin receives bids in realtime; players cannot finalize");

    const finishedMinh = await minh.wait(m => m.type === "auction_finished", 4000, "auto finalize");
    assert.equal(finishedMinh.winner.name, "Nam");
    assert.equal(finishedMinh.winner.bid, 50);
    assert.equal(finishedMinh.auto, true);
    await sleep(300);
    for (const c of [admin, minh, nam, an]) {
      assert.equal(c.history.filter(m => m.type === "auction_finished").length, 1, `${c.label} got auction_finished exactly once`);
    }
    await admin.expectError("admin_finalize_auction", {}, "AUCTION_NOT_OPEN");
    await admin.expectError("admin_next_question", {}, "ROUND_NOT_FINISHED");
    ok("Server auto-finalized after the timer: winner Nam (50), exactly once");

    const namQ = nam.wait(m => m.type === "question_opened", 3000, "nam question");
    const minhQ = minh.wait(m => m.type === "question_opened", 3000, "minh question");
    const adminQ = admin.wait(m => m.type === "question_opened", 3000, "admin question");
    admin.send("admin_open_question");
    const [nq, mq, aq] = await Promise.all([namQ, minhQ, adminQ]);
    assert.equal(nq.question, questions[0].question);
    assert.equal(nq.options.length, 4);
    assert.equal(nq.correct, undefined, "winner must not receive the correct answer");
    assert.equal(mq.question, undefined);
    assert.equal(mq.options, undefined);
    assert.equal(mq.correct, undefined);
    assert.equal(aq.correct, questions[0].correct);
    assert.ok(nq.answerEndAt > Date.now());
    s = await minh.waitState(s => s.game.phase === "question");
    assert.equal(s.question.question, undefined);
    assert.equal(s.question.correct, undefined);
    ok("Question opened: only winner gets text/options, nobody but admin gets `correct`, answerEndAt sent");

    await minh.expectError("player_answer", { answer: 0 }, "NOT_WINNER");
    await nam.expectError("player_answer", { answer: 9 }, "INVALID_ANSWER");
    await nam.request("player_answer", { answer: questions[0].correct }, "ack");
    await nam.expectError("player_answer", { answer: 1 }, "ALREADY_ANSWERED");
    const minhResult = minh.wait(m => m.type === "answer_result", 3000, "answer_result");
    await admin.request("admin_submit_answer", {}, "answer_result");
    const mr = await minhResult;
    assert.equal(mr.correct, true);
    assert.equal(mr.answer, undefined, "non-winners do not receive the chosen answer");
    s = await admin.waitState(s => s.game.phase === "result");
    assert.equal(s.players.find(p => p.name === "Nam").score, 150);
    assert.equal(s.players.find(p => p.name === "Minh").score, 100);
    ok("Nam answered correctly, server scored +50 (Nam = 150)");

    /* ---------- Round 2: reset + answer timeout ---------- */
    await admin.request("admin_next_question", {}, "question_changed");
    s = await minh.waitState(s => s.game.currentQuestion === 1);
    assert.equal(s.you.bid, 0);
    assert.equal(s.you.hasBid, false);
    assert.equal(s.you.answered, false);
    s = await admin.waitState(s => s.game.currentQuestion === 1);
    assert.ok(s.players.every(p => p.bid === 0 && !p.answered && p.selectedAnswer === null), "all bids/answers reset");
    ok("Question 2: server reset bid/answered/selectedAnswer for every player");

    await admin.request("admin_open_auction", {}, "auction_started");
    await minh.request("player_bid", { bid: 100 }, "ack");
    await admin.request("admin_finalize_auction", {}, "auction_finished");
    await admin.request("admin_open_question", {}, "question_opened");
    const jackpotUpd = nam.wait(m => m.type === "jackpot_updated", 4000, "jackpot_updated");
    const timeoutResult = await minh.wait(m => m.type === "answer_result", 4000, "timeout result");
    assert.equal(timeoutResult.timedOut, true);
    assert.equal((await jackpotUpd).jackpot, 100);
    s = await admin.waitState(s => s.game.phase === "result");
    assert.equal(s.players.find(p => p.name === "Minh").score, 0);
    assert.equal(s.game.jackpot, 100);
    ok("Question 2: Minh bid 100 and timed out -> server scored -100, jackpot = 100");

    /* ---------- Round 3: no bids -> auction closes, admin may skip ---------- */
    await admin.request("admin_next_question", {}, "question_changed");
    await admin.request("admin_open_auction", {}, "auction_started");
    await minh.expectError("player_bid", { bid: 1 }, "INSUFFICIENT_SCORE");
    await admin.expectError("admin_finalize_auction", {}, "NO_BIDS");
    const noWinner = await admin.wait(m => m.type === "auction_finished", 4000, "no-bid close");
    assert.equal(noWinner.winner, null);
    s = await admin.waitState(s => s.game.roundSkipped && s.game.canNextQuestion);
    ok("Question 3: nobody bid -> server closed auction, admin can move on");

    /* ---------- Questions 4..10 with wrong answers, then jackpot ---------- */
    await admin.request("admin_next_question", {}, "question_changed");
    for (let qi = 3; qi <= 9; qi++) {
      const q = questions[qi];
      await playRound({ admin, bidder: nam, bid: 1, answer: (q.correct + 1) % q.options.length });
      s = await admin.waitState(st => st.game.phase === "result" && st.game.currentQuestion === qi);
      if (qi < 9) await admin.request("admin_next_question", {}, "question_changed");
    }
    assert.equal(s.game.jackpot, 107);
    assert.equal(s.game.canSpinJackpot, true);
    assert.equal(s.game.canNextQuestion, false);
    await admin.expectError("admin_next_question", {}, "JACKPOT_PENDING");
    ok("Questions 4–10 played; after question 10 'next' is blocked until the jackpot (107) is spun");

    const jr = await admin.request("admin_spin_jackpot", {}, "jackpot_result");
    assert.equal(jr.amount, 107);
    await admin.expectError("admin_spin_jackpot", {}, "JACKPOT_ALREADY_AWARDED");
    const players = { [jm.playerId]: minh, [jn.playerId]: nam, [ja.playerId]: an };
    const winnerClient = players[jr.playerId];
    s = await winnerClient.waitState(st => st.game.jackpotAwarded);
    assert.equal(s.game.jackpotWinnerId, s.you.playerId);
    assert.equal(s.game.jackpotAwardAmount, 107);
    assert.equal(s.game.jackpot, 0);
    ok(`Jackpot: ${jr.name} received +107 (jackpotAwardAmount = 107, not +0)`);

    await admin.request("admin_next_question", {}, "question_changed");
    s = await admin.waitState(st => st.game.currentQuestion === 10);
    assert.equal(s.game.jackpotAwardAmount, 0);
    ok("Question 11 reached after the jackpot");

    /* ---------- Player reconnect ---------- */
    const namScore = admin.state.players.find(p => p.name === "Nam").score;
    await nam.close();
    await admin.waitState(st => st.players.find(p => p.name === "Nam").connected === false, 3000, "Nam offline");
    const bad = await make("Nam-bad");
    await bad.expectError("reconnect", { roomCode, playerId: jn.playerId, playerToken: "nope" }, "PLAYER_NOT_FOUND");
    const nam2 = await make("Nam-reconnect");
    const rj = await nam2.request("reconnect", { roomCode, playerId: jn.playerId, playerToken: jn.playerToken, takeover: true }, "joined");
    assert.equal(rj.playerId, jn.playerId);
    assert.equal(rj.reconnected, true);
    s = await admin.waitState(st => st.players.find(p => p.name === "Nam").connected === true, 3000, "Nam online");
    assert.equal(s.players.length, 3);
    assert.equal(s.players.find(p => p.name === "Nam").score, namScore);
    const inUse = await make("Nam-tab2");
    await inUse.expectError("reconnect", { roomCode, playerId: jn.playerId, playerToken: jn.playerToken, takeover: false }, "PLAYER_IN_USE");
    ok("Player disconnect shows 🔴, reconnect restores the same player and score (no duplicate)");

    /* ---------- Admin reload ---------- */
    await admin.close();
    const adminB = await make("Admin-reload");
    await adminB.expectError("admin_resume", { adminToken: "fake", roomCode }, "ADMIN_SESSION_EXPIRED");
    await adminB.expectError("admin_resume", { adminToken: token2, roomCode }, "FORBIDDEN");
    await adminB.request("admin_resume", { adminToken, roomCode }, "admin_resumed");
    s = await adminB.waitState(st => st.roomCode === roomCode);
    assert.equal(s.game.currentQuestion, 10);
    assert.equal(s.players.length, 3);
    await adminB.request("admin_open_auction", {}, "auction_started");
    ok("Admin reload: admin_resume restores control of the same room and state");

    /* ---------- Admin grades for a winner who answered out loud ---------- */
    const q11 = questions[10];
    const anBefore = adminB.state.players.find(p => p.name === "An").score;
    await an.request("player_bid", { bid: 5 }, "ack");
    await adminB.request("admin_finalize_auction", {}, "auction_finished");
    await adminB.request("admin_open_question", {}, "question_opened");
    await adminB.expectError("admin_submit_answer", {}, "INVALID_ANSWER");
    await adminB.request("admin_submit_answer", { answer: q11.correct }, "answer_result");
    s = await adminB.waitState(st => st.game.phase === "result" && st.game.currentQuestion === 10);
    assert.equal(s.players.find(p => p.name === "An").score, anBefore + 5);
    ok("Admin graded on behalf of the winner (answered out loud): An +5");

    /* ---------- Winner leaves while answering ---------- */
    await adminB.request("admin_next_question", {}, "question_changed");
    await adminB.request("admin_open_auction", {}, "auction_started");
    await an.request("player_bid", { bid: 5 }, "ack");
    await adminB.request("admin_finalize_auction", {}, "auction_finished");
    await adminB.request("admin_open_question", {}, "question_opened");
    const jackpotBefore = adminB.state.game.jackpot;
    const leaveResult = adminB.wait(m => m.type === "answer_result", 3000, "leave result");
    await an.request("player_leave", {}, "left");
    assert.equal((await leaveResult).timedOut, true);
    s = await adminB.waitState(st => st.players.length === 2 && st.game.phase === "result");
    assert.equal(s.game.jackpot, jackpotBefore + 5);
    assert.equal(s.game.canNextQuestion, true);
    ok("Winner left mid-question: server scored it as a timeout (stake -> jackpot), removed An, round can continue");

    /* ---------- Protocol errors ---------- */
    adminB.ws.send("not json");
    assert.equal((await adminB.wait(m => m.type === "error")).code, "INVALID_JSON");
    await adminB.expectError("hack_the_game", {}, "UNKNOWN_COMMAND");
    ok("Invalid JSON and unknown commands return clear errors");

    /* ---------- End ---------- */
    await adminB.request("admin_end_game", {}, "game_ended");
    s = await minh.waitState(st => st.game.status === "ended");
    assert.equal(s.players.length, 2);
    await minh.request("player_leave", {}, "left");
    s = await adminB.waitState(st => st.players.find(p => p.name === "Minh").connected === false);
    assert.equal(s.players.length, 2, "final leaderboard keeps players who leave after the game");
    ok("Game ended for everyone; final leaderboard preserved");

    console.log(`\nALL ${step} CHECKS PASSED`);
  } finally {
    for (const c of clients) c.ws.terminate();
    server.kill();
  }
}

main().catch(err => {
  console.error("\nTEST FAILED:", err.stack || err);
  process.exit(1);
});
