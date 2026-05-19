/**
 * Metadata for the solo "Собеседование" matchmaking mode.
 *
 * Solo, no opponent, no WebSocket. The only backend coupling is a single
 * POST to /matchmaking/interview/complete at the end of the round — the
 * questions themselves come from the shared `questionBank`, so the mode
 * adds no new DB tables or queue infrastructure.
 */
import { InterviewMode } from "./InterviewMode.jsx";

export const interviewMeta = {
  id: "interview",
  title: "Собеседование",
  short: "Соло",
  icon: "💼",
  blurb: "Скрининг + soft skills. Выбери грейд (Junior / Middle / Senior), получи Offer — забираешь PTS.",
  partySize: 1,
  requiresMatchmaking: false,
  Component: InterviewMode,
};
