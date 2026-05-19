/**
 * Metadata for the solo "Собеседование" matchmaking mode.
 *
 * Pure on-call incident response sim: 4 services, noisy logs, action
 * cooldowns, a 60–120s timer and a cascade waiting to fire. Replays
 * randomize one of 5 scenarios so the round is never the same.
 * Backend coupling is one POST to /matchmaking/interview/complete.
 */
import { InterviewMode } from "./InterviewMode.jsx";

export const interviewMeta = {
  id: "interview",
  title: "Собеседование",
  short: "Соло",
  icon: "🚨",
  blurb: "Ты — дежурный SRE. Найди причину инцидента и примени правильный фикс до того, как каскад уронит соседние сервисы.",
  partySize: 1,
  requiresMatchmaking: false,
  Component: InterviewMode,
};
