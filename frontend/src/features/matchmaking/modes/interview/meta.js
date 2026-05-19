/**
 * Metadata for the solo "Собеседование" matchmaking mode.
 *
 * Solo, no opponent, no WebSocket. Each session randomly picks one of three
 * mini-games (Bug Hunter, Code Review, or branching HR dialog) so replays feel different.
 * The only backend coupling is a single POST to
 * /matchmaking/interview/complete at the end of the round.
 */
import { InterviewMode } from "./InterviewMode.jsx";

export const interviewMeta = {
  id: "interview",
  title: "Собеседование",
  short: "Соло",
  icon: "💼",
  blurb: "Рандомный режим: баги в файле, code review с senior-разбором или диалог с HR. Offer даёт PTS.",
  partySize: 1,
  requiresMatchmaking: false,
  Component: InterviewMode,
};
