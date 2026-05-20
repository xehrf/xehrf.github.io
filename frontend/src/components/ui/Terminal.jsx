import { useEffect, useState } from "react";

/**
 * Shared bits for the "Compyra terminal" look-and-feel.
 *
 * `useTypewriter(text, active, speed)` reveals `text` one character at a
 * time while `active` is true. Flip it back to false and the buffer resets,
 * so callers can re-trigger the type-out on mount or on prop change.
 *
 * `<BlinkCursor />` is the gold caret that blinks at the end of the typed
 * line. It piggybacks on a single global keyframe (`compyraTermBlink`)
 * injected once on first import.
 */

export function useTypewriter(text, active, speed = 28) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!active) {
      setShown("");
      return undefined;
    }
    let i = 0;
    setShown("");
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, active, speed]);
  return shown;
}

export function BlinkCursor() {
  return (
    <span
      className="ml-1 inline-block h-4 w-[9px] align-[-3px] bg-accent"
      style={{ animation: "compyraTermBlink 1s steps(2) infinite" }}
    />
  );
}

if (typeof document !== "undefined" && !document.getElementById("compyra-term-anim")) {
  const style = document.createElement("style");
  style.id = "compyra-term-anim";
  style.textContent = `@keyframes compyraTermBlink { 50% { opacity: 0.15; } }`;
  document.head.appendChild(style);
}
