/**
 * Matchmaking mode registry.
 *
 * Adding a new mode is a three-file change:
 *   1. modes/<your-id>/<YourMode>.jsx       — the component
 *   2. modes/<your-id>/meta.js              — descriptor (id, title, etc.)
 *   3. add the meta import to MODES below
 *
 * MatchmakingPage doesn't know anything about specific modes — it just
 * iterates the registry, renders ModePicker, and mounts the selected
 * mode's Component. That keeps the page small as we add more modes.
 */
import { duelMeta } from "./duel-1v1/meta.js";
import { practiceMeta } from "./practice/meta.js";

export const MODES = [duelMeta, practiceMeta];
export const DEFAULT_MODE_ID = duelMeta.id;

export function getModeById(id) {
  return MODES.find((mode) => mode.id === id) ?? MODES[0];
}
