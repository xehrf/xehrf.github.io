import { describe, expect, it } from "vitest";
import { resolveHostUserId, shouldHandleIncomingGameEvent } from "./MatchArena.jsx";

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
});
