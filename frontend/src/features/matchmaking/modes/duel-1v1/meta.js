/**
 * Metadata descriptor for the "Дуэль 1v1" matchmaking mode.
 *
 * Kept separate from the component itself so the mode registry (and any
 * future mode-picker UI) can read meta without paying the cost of pulling
 * in the full duel implementation.
 */
import { DuelMode } from "./DuelMode.jsx";

export const duelMeta = {
  id: "duel-1v1",
  title: "Дуэль 1v1",
  short: "Дуэль",
  icon: "⚔",
  blurb: "Найди соперника по PTS, сыграй квиз из 5 раундов. Победил — забираешь рейтинг.",
  partySize: 2,
  // Whether the mode requires an opponent / matchmaking queue. Solo modes
  // skip that infrastructure entirely.
  requiresMatchmaking: true,
  Component: DuelMode,
};
