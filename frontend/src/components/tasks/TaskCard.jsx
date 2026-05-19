import { useEffect, useState } from "react";
import { Button } from "../ui/Button.jsx";
import { Card } from "../ui/Card.jsx";
import { ptsForDifficulty } from "../../utils/taskPts.js";
import { quoteForTask } from "../../data/motivationalQuotes.js";

/**
 * TaskCard with 3D flip + terminal-style motivational quote on the back.
 *
 * Клик в любое место карточки (кроме кнопки) — 3D-переворот. На оборотной
 * стороне терминал: цитата печатается по буквам, моргает курсор.
 * Каждой задаче стабильно своя цитата (через quoteForTask(task.id)).
 *
 * При наведении карточка приподнимается на 20px и получает золотое
 * свечение — чтобы чётко выделяться над сеткой.
 */
export function TaskCard({
  task,
  onSolve,
  actionLabel = "Решить",
  showPts = false, // kept for API compat
  solved = false,
}) {
  const reward = ptsForDifficulty(task.difficulty);
  const quote = quoteForTask(task.id);
  const [flipped, setFlipped] = useState(false);
  const typed = useTypewriter(quote, flipped, 38);

  function onCardClick(e) {
    // Не переворачиваем при клике по кнопке/ссылке
    if (e.target.closest("button, a")) return;
    setFlipped((f) => !f);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setFlipped((f) => !f);
    }
    if (e.key === "Escape") setFlipped(false);
  }

  return (
    <div
      onClick={onCardClick}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      className="group block w-full cursor-pointer select-none focus:outline-none"
      style={{ perspective: "1400px", height: 240 }}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 700ms cubic-bezier(0.2, 0.7, 0.2, 1.05)",
        }}
      >
        {/* ───── FRONT ───── */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          <Card
            className={`relative flex h-full w-full flex-col overflow-hidden p-5 transition-[transform,border-color,box-shadow] duration-200 group-hover:-translate-y-5 group-hover:border-accent ${
              solved ? "border-accent/40 bg-accent/[0.03]" : ""
            }`}
            style={{
              boxShadow: undefined, // let CSS class drive base; hover via inline below
            }}
          >
            {/* Hover halo + lift shadow */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(255,215,0,0.30), 0 40px 60px -12px rgba(0,0,0,0.75), 0 0 80px -8px rgba(255,215,0,0.40)",
              }}
            />

            {/* Solved tag */}
            {solved ? (
              <span className="absolute right-4 top-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
                ✓ DONE
              </span>
            ) : null}

            {/* Top row: stars + corner curl */}
            <div className="mb-3 flex items-center justify-between">
              <Stars n={task.difficulty} />
              <CornerCurl />
            </div>

            <h3 className="font-sans text-[22px] font-bold leading-snug tracking-tight text-foreground">
              {task.title}
            </h3>

            <div className="flex-1" />

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 font-mono text-xs text-muted">
                <span>{task.time_limit_minutes} мин</span>
                <span className="text-border">·</span>
                <span>
                  +<span className="font-bold text-accent">{reward}</span> PTS
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSolve?.();
                }}
                className="inline-flex items-center gap-1.5 rounded-btn border border-accent px-4 py-2 font-sans text-[13px] font-bold tracking-tight text-accent transition-colors hover:bg-accent/10"
              >
                {actionLabel}
                <span className="font-mono opacity-70">→</span>
              </button>
            </div>
          </Card>
        </div>

        {/* ───── BACK (terminal) ───── */}
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div
            className="relative flex h-full w-full flex-col overflow-hidden rounded-card border border-accent bg-black p-5"
            style={{
              boxShadow:
                "0 0 0 1px rgba(255,215,0,0.25), 0 0 36px rgba(255,215,0,0.15) inset",
            }}
          >
            {/* scanlines */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,215,0,0.05) 2px 3px)",
              }}
            />
            {/* center glow */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: "120%",
                height: "120%",
                background:
                  "radial-gradient(closest-side, rgba(255,215,0,0.10), transparent 65%)",
              }}
            />

            {/* Terminal header */}
            <div className="relative flex items-center justify-between border-b border-accent/30 pb-2.5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
                compyra ~ motivation
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-accent/60">
                {`0x${String(task.id).slice(0, 6).toUpperCase().padStart(6, "0")}`}
              </span>
            </div>

            {/* Prompt + typed quote */}
            <div className="relative mt-3.5 flex flex-1 flex-col">
              <div className="font-mono text-xs text-accent/50">$ cat wisdom.txt</div>
              <div
                className="mt-2 break-words font-mono text-[16px] font-semibold leading-snug text-accent"
                style={{ textShadow: "0 0 12px rgba(255,215,0,0.5)" }}
              >
                &gt; {typed}
                <BlinkCursor />
              </div>
            </div>

            {/* Footer */}
            <div className="relative flex items-center justify-between border-t border-accent/30 pt-2 font-mono text-[10px] tracking-[0.08em] text-accent/70">
              <span>[ click to close ]</span>
              <span className="opacity-60">esc · enter</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Small parts ──────────────────────────────────────────────────────── */

function Stars({ n }) {
  return (
    <span className="font-mono text-xs tracking-[0.05em] text-accent">
      {"★".repeat(n)}
      <span className="text-muted/40">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function CornerCurl() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className="text-accent opacity-40 transition-opacity duration-200 group-hover:opacity-100"
    >
      <path d="M 18 4 L 20 4 L 20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M 12 4 L 20 4 L 20 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
      <path d="M 14 14 L 20 14 L 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.3" />
    </svg>
  );
}

function BlinkCursor() {
  return (
    <span
      className="ml-1 inline-block h-4 w-[9px] align-[-3px] bg-accent"
      style={{ animation: "tcBlink 1s steps(2) infinite" }}
    />
  );
}

/* Typewriter hook: returns substring of `text` based on time since `active` flipped to true. */
function useTypewriter(text, active, speed = 38) {
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

/* Inject keyframes once. Safe to be evaluated multiple times. */
if (typeof document !== "undefined" && !document.getElementById("taskcard-flip-anim")) {
  const style = document.createElement("style");
  style.id = "taskcard-flip-anim";
  style.textContent = `@keyframes tcBlink { 50% { opacity: 0.15; } }`;
  document.head.appendChild(style);
}
