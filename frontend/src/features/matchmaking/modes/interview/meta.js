/**
 * Metadata for the solo "Собеседование" matchmaking mode.
 *
 * Solo, no opponent, no WebSocket. Each session randomly picks one of two
 * mini-games (Bug Hunter or branching HR dialog) so replays feel different.
 * The only backend coupling is a single POST to
 * /matchmaking/interview/complete at the end of the round.
 */
import { InterviewMode } from "./InterviewMode.jsx";

export const interviewMeta = {
  id: "interview",
  title: "Собеседование",
  short: "Соло",
  icon: "💼",
  blurb: "Рандомный режим: либо охота на баги в файле, либо диалог с HR на 6 ходов. Получи Offer — забираешь PTS.",
  partySize: 1,
  requiresMatchmaking: false,
  Component: InterviewMode,
};
