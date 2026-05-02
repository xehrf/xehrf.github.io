import { describe, expect, it } from "vitest";
import { getOpponentFromParticipants, resolveHostUserId, resolveReadinessState, resolveStartControlState, shouldHandleIncomingGameEvent, updateReadinessParticipant } from "./MatchArena.jsx";

describe("MatchArena host resolution", () => {
  it("uses activeMatch data while room_state participants are still empty", () => {
    const hostUserId = resolveHostUserId({
      participants: [],
      activeMatch: {
        opponent: { user_id: 7, nickname: "Host" },
      },
      myUserId: "12",
    });

    expect(hostUserId).toBe("12");
  });

  it("recalculates from room_state participants when they arrive", () => {
    const hostUserId = resolveHostUserId({
      participants: [
        { user_id: 100, nickname: "You" },
        { user_id: 42, nickname: "Host" },
      ],
      activeMatch: {
        opponent: { user_id: 42, nickname: "Host" },
      },
      myUserId: "100",
    });

    expect(hostUserId).toBe("100");
  });

  it("does not guess a host before two distinct participants are known", () => {
    const hostUserId = resolveHostUserId({
      participants: [],
      activeMatch: {},
      myUserId: "12",
    });

    expect(hostUserId).toBeNull();
  });
});

describe("MatchArena opponent resolution", () => {
  it("finds the opponent even when websocket ids and auth ids use different types", () => {
    const opponent = getOpponentFromParticipants(
      [
        { user_id: 12, nickname: "You" },
        { user_id: "7", nickname: "Opponent" },
      ],
      "12",
    );

    expect(opponent).toEqual({ user_id: "7", nickname: "Opponent" });
  });
});

describe("MatchArena game event filtering", () => {
  it("ignores its own echoed game_start even when user ids have different types", () => {
    const shouldHandle = shouldHandleIncomingGameEvent({
      eventName: "game_start",
      envelopeData: { user_id: 12 },
      gameData: { host: "12" },
      myUserId: "12",
    });

    expect(shouldHandle).toBe(false);
  });

  it("accepts opponent game_start from websocket chat", () => {
    const shouldHandle = shouldHandleIncomingGameEvent({
      eventName: "game_start",
      envelopeData: { user_id: 7 },
      gameData: { host: "7" },
      myUserId: "12",
    });

    expect(shouldHandle).toBe(true);
  });

  it("falls back to senderUserId inside the game payload when envelope data is absent", () => {
    const shouldHandle = shouldHandleIncomingGameEvent({
      eventName: "game_next_round",
      envelopeData: {},
      gameData: { roundIndex: 1, senderUserId: "12" },
      myUserId: "12",
    });

    expect(shouldHandle).toBe(false);
  });

  it("always accepts start cancellation events, including local cancellations", () => {
    const shouldHandle = shouldHandleIncomingGameEvent({
      eventName: "game_start_cancelled",
      envelopeData: { user_id: 12 },
      gameData: { user_id: 12 },
      myUserId: "12",
    });

    expect(shouldHandle).toBe(true);
  });
});

describe("MatchArena start readiness", () => {
  it("keeps host start disabled until both players are online in the match room", () => {
    const state = resolveStartControlState({
      myUserId: 12,
      hostUserId: "12",
      opponentUserId: 7,
      onlineIds: [12],
      roomSocketOpen: true,
    });

    expect(state.canStartGame).toBe(false);
    expect(state.opponentOnline).toBe(false);
    expect(state.startButtonLabel).toBe("⏳ Ждём соперника");
  });

  it("allows the host to start once both players are online", () => {
    const state = resolveStartControlState({
      myUserId: 12,
      hostUserId: "12",
      opponentUserId: 7,
      onlineIds: [12, 7],
      roomSocketOpen: true,
    });

    expect(state.canStartGame).toBe(true);
    expect(state.opponentOnline).toBe(true);
    expect(state.startButtonLabel).toBe("🚀 Начать игру!");
  });

  it("keeps the non-host in waiting mode even when both players are online", () => {
    const state = resolveStartControlState({
      myUserId: 7,
      hostUserId: "12",
      opponentUserId: 12,
      onlineIds: [12, 7],
      roomSocketOpen: true,
    });

    expect(state.canStartGame).toBe(false);
    expect(state.startButtonLabel).toBe("Ожидаем готовность");
  });
});

describe("MatchArena readiness state", () => {
  it("resolves both player statuses from websocket room readiness", () => {
    const state = resolveReadinessState({
      myUserId: 12,
      opponentUserId: 7,
      roomSocketOpen: true,
      readiness: {
        all_ready: false,
        participants: [
          { user_id: 12, nickname: "You", ready: true },
          { user_id: 7, nickname: "izi_500", ready: false },
        ],
      },
    });

    expect(state.myReady).toBe(true);
    expect(state.opponentReady).toBe(false);
    expect(state.allReady).toBe(false);
    expect(state.canToggleReady).toBe(true);
    expect(state.opponentLabel).toBe("izi_500");
  });

  it("marks the room ready only when the server says both players are ready", () => {
    const state = resolveReadinessState({
      myUserId: 12,
      opponentUserId: 7,
      roomSocketOpen: true,
      readiness: {
        all_ready: true,
        participants: [
          { user_id: 12, nickname: "You", ready: true },
          { user_id: 7, nickname: "izi_500", ready: true },
        ],
      },
    });

    expect(state.allReady).toBe(true);
    expect(state.myReady).toBe(true);
    expect(state.opponentReady).toBe(true);
  });

  it("updates the current player's status optimistically", () => {
    const readiness = updateReadinessParticipant(
      {
        all_ready: false,
        participants: [
          { user_id: 12, nickname: "You", ready: false },
          { user_id: 7, nickname: "izi_500", ready: true },
        ],
      },
      "12",
      true,
    );

    expect(readiness.participants[0].ready).toBe(true);
    expect(readiness.participants[1].ready).toBe(true);
    expect(readiness.all_ready).toBe(true);
  });
});
