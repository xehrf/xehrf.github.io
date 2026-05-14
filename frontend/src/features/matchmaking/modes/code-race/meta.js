/**
 * Metadata for the "Code Race 1v1" mode.
 *
 * Same matchmaking queue infrastructure as Duel 1v1, but instead of playing
 * a quiz in a shared WebSocket room, both players are sent straight to the
 * match's coding task. First passing submission wins.
 */
import { CodeRaceMode } from "./CodeRaceMode.jsx";

export const codeRaceMeta = {
  id: "code-race",
  title: "Гонка кода",
  short: "Гонка",
  icon: "🏁",
  blurb: "Открывается одна задача — кто первым прогонит все тесты, тот победил.",
  partySize: 2,
  requiresMatchmaking: true,
  Component: CodeRaceMode,
};
