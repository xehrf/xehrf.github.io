/**
 * Metadata for the "Тренировка" (solo practice) matchmaking mode.
 *
 * Pure-frontend mode: no opponent, no WebSocket, no PTS — just lets the
 * player rehearse the same question bank used in real duels and tracks a
 * personal best in localStorage.
 */
import { PracticeMode } from "./PracticeMode.jsx";

export const practiceMeta = {
  id: "practice",
  title: "Тренировка",
  short: "Соло",
  icon: "🎯",
  blurb: "Разогрев перед дуэлью: реши все вопросы, побей свой рекорд. Без соперника, без потери PTS.",
  partySize: 1,
  requiresMatchmaking: false,
  Component: PracticeMode,
};
