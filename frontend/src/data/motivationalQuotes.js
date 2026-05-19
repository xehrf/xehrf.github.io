export const MOTIVATIONAL_QUOTES = [
  "Keep it simple and clear.",
  "One step at a time.",
  "Small progress beats perfect plans.",
  "Ship, then iterate.",
  "Fail fast, learn faster.",
  "Make it work; then make it beautiful.",
  "Tests save time later.",
  "Refactor ruthlessly.",
  "Read the code; write less.",
  "Automate the boring stuff.",
  "Measure, don’t guess.",
  "Prefer clarity over cleverness.",
  "Design for the next developer.",
  "Keep dependencies minimal.",
  "Optimize for real users.",
  "Ask for help when stuck.",
  "Write code you can explain.",
  "Make decisions reversible.",
  "Avoid premature optimization.",
  "Debug, then document.",
  "Celebrate small wins.",
  "Practice consistently, improve steadily.",
  "Keep your promises to users.",
  "Ship small, deliver value.",
  "Name things well.",
  "One test per bug.",
  "You can always refactor later.",
  "Keep interfaces simple and stable.",
  "Make it obvious, then simplify.",
  "Readability beats cleverness.",
  "Break big problems into small ones.",
  "Prioritize what hurts users most.",
  "Document assumptions, not steps.",
  "Be kind to future you.",
];

export function quoteForTask(taskId) {
  const s = String(taskId);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return MOTIVATIONAL_QUOTES[h % MOTIVATIONAL_QUOTES.length];
}
