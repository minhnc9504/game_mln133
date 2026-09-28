"use strict";

const crypto = require("crypto");
const DEFAULT_QUESTIONS = require("./questions");

const START_SCORE = 100;
const JACKPOT_EVERY = 10;
const LETTERS = "ABCDEFGH";

class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "GameError";
    this.code = code;
  }
}

/**
 * status: waiting | playing | ended
 * phase while playing:
 *   ready    – question selected, waiting for Admin to open the auction
 *   auction  – players are bidding (server timer running)
 *   winner   – auction finalized, waiting for Admin to open the question
 *   question – only the winner may answer (server timer running)
 *   result   – scored; jackpot may be spun here when due
 */
function createInitialGame() {
  return {
    status: "waiting",
    phase: "waiting",
    currentQuestion: 0,
    roundSeq: 0,
    auctionOpen: false,
    auctionEndAt: null,
    answerOpen: false,
    answerEndAt: null,
    winningPlayerId: null,
    winningPlayerName: null,
    winningBid: 0,
    roundSkipped: false,
    result: null,
    jackpot: 0,
    jackpotAwarded: false,
    jackpotWinnerId: null,
    jackpotWinnerName: null,
    jackpotAwardAmount: 0
  };
}

const letterOf = index => (Number.isInteger(index) && index >= 0 ? LETTERS[index] : "—");

function toInteger(raw) {
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

class GameManager {
  /**
   * @param {object} deps
   * @param {Array}  [deps.questions]
   * @param {number} deps.auctionMs
   * @param {number} deps.answerMs
   * @param {(room, message, target?) => void} deps.emit  send an event to (part of) a room
   * @param {(room) => void} deps.sync                    push personalized room_state to everyone in the room
   * @param {(tag, message) => void} deps.log
   */
  constructor({ questions = DEFAULT_QUESTIONS, auctionMs, answerMs, emit, sync, log }) {
    this.questions = questions;
    this.auctionMs = auctionMs;
    this.answerMs = answerMs;
    this.emit = emit;
    this.sync = sync;
    this.log = log;
  }

  // ------------------------------------------------------------------
  // Rules / derived state
  // ------------------------------------------------------------------

  currentQuestion(room) {
    return this.questions[room.game.currentQuestion] || null;
  }

  isLastQuestion(room) {
    return room.game.currentQuestion >= this.questions.length - 1;
  }

  isJackpotDue(room) {
    return (room.game.currentQuestion + 1) % JACKPOT_EVERY === 0 || this.isLastQuestion(room);
  }

  canSpinJackpot(room) {
    const g = room.game;
    return g.status === "playing" && g.phase === "result" && this.isJackpotDue(room) && g.jackpot > 0 && !g.jackpotAwarded;
  }

  canNextQuestion(room) {
    const g = room.game;
    if (g.status !== "playing") return false;
    if (g.phase === "result") return !this.canSpinJackpot(room);
    return g.phase === "ready" && g.roundSkipped;
  }

  roundId(room) {
    return `${room.game.currentQuestion}:${room.game.roundSeq}`;
  }

  onlineCount(room) {
    let online = 0;
    for (const p of room.players.values()) if (p.connections.size) online++;
    return online;
  }

  scoreboard(room) {
    return [...room.players.values()]
      .map(p => ({ name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }

  notifyPlayersChanged(room, event, name) {
    this.emit(room, { type: "players_updated", event, name, online: this.onlineCount(room), total: room.players.size }, "admins");
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  clearTimers(room) {
    clearTimeout(room.timers.auction);
    clearTimeout(room.timers.answer);
    room.timers.auction = null;
    room.timers.answer = null;
  }

  resetPlayersForRound(room) {
    for (const p of room.players.values()) {
      p.bid = 0;
      p.bidAt = 0;
      p.answered = false;
      p.selectedAnswer = null;
    }
  }

  /** Clears everything that belongs to a single question. Jackpot total and scores are kept. */
  resetRound(room) {
    this.clearTimers(room);
    const g = room.game;
    Object.assign(g, {
      roundSeq: g.roundSeq + 1,
      auctionOpen: false,
      auctionEndAt: null,
      answerOpen: false,
      answerEndAt: null,
      winningPlayerId: null,
      winningPlayerName: null,
      winningBid: 0,
      roundSkipped: false,
      result: null,
      jackpotAwarded: false,
      jackpotWinnerId: null,
      jackpotWinnerName: null,
      jackpotAwardAmount: 0
    });
    this.resetPlayersForRound(room);
  }

  requirePlaying(room) {
    const status = room.game.status;
    if (status === "waiting") throw new GameError("GAME_NOT_STARTED", "Game chưa bắt đầu.");
    if (status === "ended") throw new GameError("GAME_ENDED", "Game đã kết thúc.");
  }

  runSafely(label, fn) {
    try {
      fn();
    } catch (err) {
      this.log("ERROR", `${label}: ${err && err.stack ? err.stack : err}`);
    }
  }

  // ------------------------------------------------------------------
  // Admin commands
  // ------------------------------------------------------------------

  startGame(room) {
    const g = room.game;
    if (g.status === "playing") throw new GameError("GAME_ALREADY_STARTED", "Game đang diễn ra.");
    if (g.status === "ended") throw new GameError("GAME_ENDED", "Game đã kết thúc. Hãy reset phòng để chơi lại.");
    if (!this.questions.length) throw new GameError("NO_QUESTIONS", "Chưa có câu hỏi nào trong server/questions.js.");

    g.status = "playing";
    g.currentQuestion = 0;
    this.resetRound(room);
    g.phase = "ready";

    this.log("GAME", `${room.code} started (${this.questions.length} câu)`);
    this.emit(room, { type: "game_started", questionNumber: 1, totalQuestions: this.questions.length });
    this.sync(room);
  }

  openAuction(room) {
    this.requirePlaying(room);
    const g = room.game;
    if (g.phase === "auction") throw new GameError("AUCTION_ALREADY_OPEN", "Phiên đấu giá đang mở.");
    if (g.phase !== "ready") throw new GameError("INVALID_PHASE", "Chỉ mở đấu giá khi câu hỏi đang chờ (chưa có người thắng).");

    this.resetPlayersForRound(room);
    g.roundSeq += 1;
    g.roundSkipped = false;
    g.auctionOpen = true;
    g.auctionEndAt = Date.now() + this.auctionMs;
    g.phase = "auction";

    clearTimeout(room.timers.auction);
    room.timers.auction = setTimeout(() => {
      room.timers.auction = null;
      this.runSafely(`auto-finalize ${room.code}`, () => this.finalizeAuction(room, { auto: true }));
    }, this.auctionMs);

    this.log("AUCTION", `${room.code} started (câu ${g.currentQuestion + 1})`);
    this.emit(room, { type: "auction_started", questionNumber: g.currentQuestion + 1, auctionEndAt: g.auctionEndAt });
    this.sync(room);
  }

  /**
   * Called by Admin or by the server timer. The phase guard guarantees the
   * auction is finalized exactly once.
   */
  finalizeAuction(room, { auto = false } = {}) {
    const g = room.game;
    if (g.status !== "playing" || g.phase !== "auction") {
      if (auto) return;
      throw new GameError("AUCTION_NOT_OPEN", "Phiên đấu giá chưa mở hoặc đã được chốt.");
    }

    const candidates = [...room.players.values()]
      .filter(p => p.bid > 0)
      .sort((a, b) => b.bid - a.bid || a.bidAt - b.bidAt);
    const winner = candidates[0];

    if (!winner && !auto) {
      throw new GameError("NO_BIDS", "Chưa có người chơi nào gửi cược. Hãy chờ thêm hoặc để hết giờ.");
    }

    clearTimeout(room.timers.auction);
    room.timers.auction = null;
    g.auctionOpen = false;
    g.auctionEndAt = null;

    if (!winner) {
      g.phase = "ready";
      g.roundSkipped = true;
      this.log("AUCTION", `${room.code} finished without bids`);
      this.emit(room, { type: "auction_finished", auto, winner: null });
      this.sync(room);
      return;
    }

    g.winningPlayerId = winner.id;
    g.winningPlayerName = winner.name;
    g.winningBid = winner.bid;
    g.phase = "winner";

    this.log("AUCTION", `${room.code} winner ${winner.name} ${winner.bid}${auto ? " (hết giờ)" : ""}`);
    this.emit(room, { type: "auction_finished", auto, winner: { playerId: winner.id, name: winner.name, bid: winner.bid } });
    this.sync(room);
  }

  openQuestion(room) {
    this.requirePlaying(room);
    const g = room.game;
    if (g.phase === "question") throw new GameError("QUESTION_ALREADY_OPEN", "Câu hỏi đang được mở.");
    if (g.phase !== "winner") throw new GameError("INVALID_PHASE", "Hãy chốt người thắng đấu giá trước.");

    const winner = room.players.get(g.winningPlayerId);
    if (!winner) {
      this.cancelRound(room, "Người thắng đã rời phòng. Hãy mở lại phiên đấu giá.");
      throw new GameError("WINNER_LEFT", "Người thắng đã rời phòng. Hãy mở lại phiên đấu giá.");
    }

    const q = this.currentQuestion(room);
    g.answerOpen = true;
    g.answerEndAt = Date.now() + this.answerMs;
    g.phase = "question";

    clearTimeout(room.timers.answer);
    room.timers.answer = setTimeout(() => {
      room.timers.answer = null;
      this.runSafely(`answer-timeout ${room.code}`, () => this.closeAnswerOnTimeout(room));
    }, this.answerMs);

    this.log("QUESTION", `${room.code} Question ${g.currentQuestion + 1} opened for ${winner.name}`);

    const base = {
      type: "question_opened",
      questionNumber: g.currentQuestion + 1,
      answerEndAt: g.answerEndAt,
      winner: { playerId: winner.id, name: winner.name, bid: g.winningBid }
    };
    const content = { section: q.section, question: q.question, options: q.options };
    this.emit(room, { ...base, ...content, correct: q.correct }, "admins");
    this.emit(room, { ...base, ...content }, { player: winner.id });
    this.emit(room, base, { playersExcept: winner.id });
    this.sync(room);
  }

  /**
   * Scores the round. Uses the winner's submitted answer; if the winner has not
   * submitted (e.g. answered out loud), Admin must pass the answer to grade.
   */
  submitAnswer(room, rawAnswer) {
    this.requirePlaying(room);
    const g = room.game;
    if (g.phase !== "question") throw new GameError("ANSWER_NOT_OPEN", "Câu hỏi chưa được mở hoặc đã được chấm.");

    const winner = room.players.get(g.winningPlayerId);
    let answer;
    if (winner && winner.answered) {
      answer = winner.selectedAnswer;
    } else {
      answer = this.validateAnswer(room, rawAnswer, "Người thắng chưa gửi đáp án. Hãy chọn đáp án thay họ (nếu trả lời miệng) rồi bấm Chấm.");
      if (winner) {
        winner.answered = true;
        winner.selectedAnswer = answer;
      }
      this.log("ANSWER", `${room.code} Admin chọn hộ ${g.winningPlayerName}: ${letterOf(answer)}`);
    }
    this.scoreRound(room, answer, { timedOut: false });
  }

  spinJackpot(room) {
    this.requirePlaying(room);
    const g = room.game;
    if (g.jackpotAwarded) throw new GameError("JACKPOT_ALREADY_AWARDED", "Jackpot của mốc này đã được quay.");
    if (g.phase !== "result") throw new GameError("INVALID_PHASE", "Chỉ quay Jackpot sau khi đã chấm câu hỏi.");
    if (!this.isJackpotDue(room)) throw new GameError("JACKPOT_NOT_DUE", `Jackpot chỉ được quay sau mỗi ${JACKPOT_EVERY} câu hoặc ở câu cuối.`);
    if (g.jackpot <= 0) throw new GameError("JACKPOT_EMPTY", "Jackpot hiện đang bằng 0.");

    const all = [...room.players.values()];
    const online = all.filter(p => p.connections.size > 0);
    const eligible = online.length ? online : all;
    if (!eligible.length) throw new GameError("NO_PLAYERS", "Chưa có người chơi để quay Jackpot.");

    const winner = eligible[crypto.randomInt(eligible.length)];
    const amount = g.jackpot;
    winner.score += amount;
    g.jackpot = 0;
    g.jackpotAwarded = true;
    g.jackpotWinnerId = winner.id;
    g.jackpotWinnerName = winner.name;
    g.jackpotAwardAmount = amount;

    this.log("JACKPOT", `${room.code} ${winner.name} +${amount}`);
    this.emit(room, { type: "jackpot_result", playerId: winner.id, name: winner.name, amount });
    this.emit(room, { type: "jackpot_updated", jackpot: 0 });
    this.emit(room, { type: "score_updated", scoreboard: this.scoreboard(room) });
    this.sync(room);
  }

  nextQuestion(room) {
    this.requirePlaying(room);
    const g = room.game;
    if (!this.canNextQuestion(room)) {
      if (this.canSpinJackpot(room)) throw new GameError("JACKPOT_PENDING", `Hãy quay Jackpot sau khi hoàn thành câu ${g.currentQuestion + 1}.`);
      throw new GameError("ROUND_NOT_FINISHED", "Câu hiện tại chưa được xử lý xong.");
    }

    this.log("QUESTION", `${room.code} Question ${g.currentQuestion + 1} finished`);
    if (this.isLastQuestion(room)) {
      this.endGame(room);
      return;
    }

    g.currentQuestion += 1;
    this.resetRound(room);
    g.phase = "ready";

    this.emit(room, { type: "question_changed", questionNumber: g.currentQuestion + 1, totalQuestions: this.questions.length });
    this.sync(room);
  }

  endGame(room) {
    const g = room.game;
    if (g.status === "ended") throw new GameError("GAME_ENDED", "Game đã kết thúc.");
    this.clearTimers(room);
    Object.assign(g, { status: "ended", phase: "ended", auctionOpen: false, auctionEndAt: null, answerOpen: false, answerEndAt: null });

    this.log("GAME", `${room.code} ended`);
    this.emit(room, { type: "game_ended", scoreboard: this.scoreboard(room) });
    this.sync(room);
  }

  resetRoom(room) {
    this.clearTimers(room);
    room.game = { ...createInitialGame(), roundSeq: room.game.roundSeq + 1 };
    for (const p of room.players.values()) p.score = START_SCORE;
    this.resetPlayersForRound(room);

    this.log("GAME", `${room.code} reset`);
    this.emit(room, { type: "room_reset" });
    this.sync(room);
  }

  // ------------------------------------------------------------------
  // Player commands
  // ------------------------------------------------------------------

  placeBid(room, player, rawBid) {
    const g = room.game;
    if (g.status !== "playing" || g.phase !== "auction" || !g.auctionOpen) {
      if (g.status === "playing" && ["winner", "question", "result"].includes(g.phase)) {
        throw new GameError("AUCTION_CLOSED", "Phiên đấu giá đã kết thúc.");
      }
      throw new GameError("AUCTION_NOT_OPEN", "Phiên đấu giá chưa mở.");
    }
    if (Date.now() >= g.auctionEndAt) throw new GameError("AUCTION_CLOSED", "Phiên đấu giá đã kết thúc.");
    if (player.bid > 0) throw new GameError("ALREADY_BID", "Bạn đã gửi cược cho câu này.");

    const bid = toInteger(rawBid);
    if (bid === null) throw new GameError("INVALID_BID", "Số điểm cược phải là số nguyên.");
    if (bid <= 0) throw new GameError("INVALID_BID", "Số điểm cược phải lớn hơn 0.");
    if (bid > player.score) throw new GameError("INSUFFICIENT_SCORE", `Không thể cược vượt quá số điểm hiện có (${player.score}).`);

    player.bid = bid;
    player.bidAt = Date.now();

    this.log("BID", `${room.code} ${player.name} -> ${bid}`);
    const bids = [...room.players.values()].filter(p => p.bid > 0).map(p => ({ playerId: p.id, name: p.name, bid: p.bid }));
    this.emit(room, { type: "auction_updated", bidCount: bids.length, bids }, "admins");
    this.sync(room);
    return bid;
  }

  /** Winner submits an answer; Admin (or the answer timer) then scores it. */
  playerAnswer(room, player, rawAnswer) {
    const g = room.game;
    if (g.status !== "playing" || g.phase !== "question" || !g.answerOpen) {
      throw new GameError("ANSWER_NOT_OPEN", "Chưa đến lượt trả lời hoặc câu hỏi đã đóng.");
    }
    if (player.id !== g.winningPlayerId) throw new GameError("NOT_WINNER", "Chỉ người thắng đấu giá mới được trả lời.");
    if (player.answered) throw new GameError("ALREADY_ANSWERED", "Bạn đã gửi đáp án.");
    if (Date.now() > g.answerEndAt) throw new GameError("ANSWER_CLOSED", "Đã hết thời gian trả lời.");
    const answer = this.validateAnswer(room, rawAnswer, "Đáp án không hợp lệ.");

    player.answered = true;
    player.selectedAnswer = answer;
    this.log("ANSWER", `${room.code} ${player.name} answered ${letterOf(answer)}`);
    this.emit(room, { type: "answer_submitted", name: player.name, answer }, "admins");
    this.sync(room);
    return answer;
  }

  /**
   * Player pressed "Thoát" or was offline too long. After the game has ended
   * the player stays on the final leaderboard (just offline).
   */
  playerLeft(room, player, event = "left") {
    const g = room.game;

    if (g.status === "ended") {
      this.log("PLAYER", `${player.name} left ${room.code} (giữ trên bảng điểm cuối)`);
      this.notifyPlayersChanged(room, event, player.name);
      this.sync(room);
      return;
    }

    if (g.status === "playing" && g.winningPlayerId === player.id) {
      if (g.phase === "winner") {
        this.cancelRound(room, `${player.name} đã rời phòng. Admin hãy mở lại phiên đấu giá.`);
      } else if (g.phase === "question") {
        this.scoreRound(room, player.answered ? player.selectedAnswer : null, { timedOut: !player.answered });
      }
    }

    room.players.delete(player.id);
    this.log("PLAYER", `${player.name} ${event === "left" ? "left" : "removed (offline quá lâu)"} ${room.code}`);
    this.notifyPlayersChanged(room, event, player.name);
    this.sync(room);
  }

  cancelRound(room, message) {
    this.resetRound(room);
    room.game.phase = "ready";
    this.emit(room, { type: "round_cancelled", message });
    this.sync(room);
  }

  // ------------------------------------------------------------------
  // Scoring
  // ------------------------------------------------------------------

  validateAnswer(room, rawAnswer, message) {
    const q = this.currentQuestion(room);
    const answer = toInteger(rawAnswer);
    if (answer === null || answer < 0 || answer >= q.options.length) throw new GameError("INVALID_ANSWER", message);
    return answer;
  }

  closeAnswerOnTimeout(room) {
    const g = room.game;
    if (g.status !== "playing" || g.phase !== "question") return;
    const winner = room.players.get(g.winningPlayerId);
    const answered = !!(winner && winner.answered);
    this.log("ANSWER", `${room.code} hết giờ trả lời (${g.winningPlayerName}${answered ? " đã gửi đáp án" : " chưa trả lời"})`);
    this.scoreRound(room, answered ? winner.selectedAnswer : null, { timedOut: !answered });
  }

  /** Runs at most once per round: the phase guard blocks repeated scoring. */
  scoreRound(room, answer, { timedOut }) {
    const g = room.game;
    if (g.phase !== "question") return;

    clearTimeout(room.timers.answer);
    room.timers.answer = null;
    g.answerOpen = false;
    g.answerEndAt = null;

    const q = this.currentQuestion(room);
    const winner = room.players.get(g.winningPlayerId);
    const stake = g.winningBid;
    const correct = answer !== null && answer === q.correct;

    if (winner) winner.score = correct ? winner.score + stake : Math.max(0, winner.score - stake);
    if (!correct) g.jackpot += stake;

    g.result = { playerId: g.winningPlayerId, name: g.winningPlayerName, answer, correct, delta: correct ? stake : -stake, timedOut };
    g.phase = "result";

    this.log("SCORE", `${room.code} ${g.winningPlayerName} ${correct ? "+" : "-"}${stake}${correct ? "" : ` (jackpot = ${g.jackpot})`}`);

    const publicResult = { type: "answer_result", name: g.winningPlayerName, correct, delta: g.result.delta, timedOut };
    this.emit(room, { ...publicResult, answer, correctAnswer: q.correct }, "admins");
    if (winner) {
      this.emit(room, { ...publicResult, answer, isYou: true }, { player: winner.id });
      this.emit(room, publicResult, { playersExcept: winner.id });
    } else {
      this.emit(room, publicResult, "players");
    }
    this.emit(room, { type: "score_updated", scoreboard: this.scoreboard(room) });
    if (!correct) this.emit(room, { type: "jackpot_updated", jackpot: g.jackpot, added: stake });
    this.sync(room);
  }

  // ------------------------------------------------------------------
  // Views – the only game data that leaves the server
  // ------------------------------------------------------------------

  /**
   * Players never receive `correct`/`explanation`, other players' bids or
   * chosen answers, or the question text unless they are the winner while
   * the question is open.
   */
  buildStateFor(room, viewer) {
    const g = room.game;
    const isAdmin = viewer.role === "admin";
    const me = isAdmin ? null : room.players.get(viewer.playerId) || null;
    const isWinner = !!me && me.id === g.winningPlayerId;
    const q = this.currentQuestion(room);

    let question = null;
    if (g.status === "playing" && q) {
      question = { number: g.currentQuestion + 1, section: q.section };
      const adminCanSee = isAdmin && ["winner", "question", "result"].includes(g.phase);
      const winnerCanSee = isWinner && g.phase === "question";
      if (adminCanSee || winnerCanSee) {
        question.question = q.question;
        question.options = q.options;
      }
      if (adminCanSee) {
        question.correct = q.correct;
        question.explanation = q.explanation;
      }
    }

    let result = null;
    if (g.result) {
      result = { name: g.result.name, correct: g.result.correct, delta: g.result.delta, timedOut: g.result.timedOut };
      if (isAdmin || (me && me.id === g.result.playerId)) result.answer = g.result.answer;
    }

    const players = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(p => {
        const view = { id: p.id, name: p.name, score: p.score, connected: p.connections.size > 0, hasBid: p.bid > 0 };
        if (isAdmin) {
          view.bid = p.bid;
          view.answered = p.answered;
          view.selectedAnswer = p.selectedAnswer;
        }
        return view;
      });

    return {
      roomCode: room.code,
      role: isAdmin ? "admin" : "player",
      serverNow: Date.now(),
      roundId: this.roundId(room),
      adminConnected: room.adminConnections.size > 0,
      you: me
        ? { playerId: me.id, name: me.name, score: me.score, bid: me.bid, hasBid: me.bid > 0, answered: me.answered, selectedAnswer: me.selectedAnswer }
        : null,
      game: {
        status: g.status,
        phase: g.phase,
        currentQuestion: g.currentQuestion,
        totalQuestions: this.questions.length,
        auctionOpen: g.auctionOpen,
        auctionEndAt: g.auctionEndAt,
        answerOpen: g.answerOpen,
        answerEndAt: g.answerEndAt,
        winningPlayerId: g.winningPlayerId,
        winningPlayerName: g.winningPlayerName,
        winningBid: g.winningBid,
        roundSkipped: g.roundSkipped,
        result,
        jackpot: g.jackpot,
        jackpotAwarded: g.jackpotAwarded,
        jackpotWinnerId: g.jackpotWinnerId,
        jackpotWinnerName: g.jackpotWinnerName,
        jackpotAwardAmount: g.jackpotAwardAmount,
        canSpinJackpot: this.canSpinJackpot(room),
        canNextQuestion: this.canNextQuestion(room),
        isLastQuestion: this.isLastQuestion(room)
      },
      question,
      players
    };
  }

  /** Full question bank incl. answers – only ever sent to an authenticated Admin. */
  questionsForAdmin() {
    return this.questions.map(q => ({
      id: q.id,
      section: q.section,
      question: q.question,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation
    }));
  }
}

module.exports = { GameManager, GameError, createInitialGame, START_SCORE, JACKPOT_EVERY };
