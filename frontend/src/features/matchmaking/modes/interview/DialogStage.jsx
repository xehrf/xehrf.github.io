import { useEffect, useState } from "react";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { MAX_MOOD, MIN_MOOD } from "./dialog.js";

/**
 * Narrative HR dialog stage.
 *
 * The player walks through N questions in fixed order. Each answer carries
 * a `moodDelta` that shifts the interviewer's mood gauge at the top.
 * Successful answers (moodDelta > 0) count toward the final score
 * reported via onSubmit.
 *
 * The "branching" feel comes from the gauge animating per answer and the
 * interviewer's reaction text — not from a literal tree. We keep questions
 * linear because a full branching graph (4 options × 6 turns) is 4096
 * dialogue nodes, which is dead content for a side-mode.
 */
export function DialogStage({ slots, onSubmit }) {
  const [index, setIndex] = useState(0);
  const [mood, setMood] = useState(0);
  const [goodAnswers, setGoodAnswers] = useState(0);
  const [chosenIdx, setChosenIdx] = useState(null);
  const [reaction, setReaction] = useState(null);
  const [done, setDone] = useState(false);

  const current = slots[index];

  function pickOption(optIdx) {
    if (chosenIdx != null || done) return;
    const opt = current.options[optIdx];
    setChosenIdx(optIdx);
    setReaction(opt.reaction);
    setMood((prev) => Math.max(MIN_MOOD, Math.min(MAX_MOOD, prev + opt.moodDelta)));
    if (opt.moodDelta > 0) {
      setGoodAnswers((prev) => prev + 1);
    }
  }

  function advance() {
    const nextIndex = index + 1;
    if (nextIndex >= slots.length) {
      setDone(true);
      onSubmit({ correct: goodAnswers, total: slots.length, mood });
      return;
    }
    setIndex(nextIndex);
    setChosenIdx(null);
    setReaction(null);
  }

  // Map mood [-18..+18] to a 0..100 gauge fill.
  const moodPct = useMoodGauge(mood);
  const moodColor = mood >= 6 ? "bg-emerald-500" : mood >= 0 ? "bg-amber-400" : "bg-red-500";
  const moodLabel = mood >= 6 ? "увлечён" : mood >= 0 ? "нейтрален" : mood >= -6 ? "скептичен" : "разочарован";

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full border border-indigo-400/40 bg-indigo-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
            🗣 Диалог с HR
          </span>
          <span className="text-xs text-muted">
            {current.slotTitle} · {index + 1}/{slots.length}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted">Настроение</p>
          <p className="font-mono text-sm font-bold text-foreground">{moodLabel}</p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-elevated/40">
        <div
          className={`h-full transition-all duration-500 ${moodColor}`}
          style={{ width: `${moodPct}%` }}
        />
      </div>

      <div className="mt-5 rounded-btn border border-border bg-elevated/30 px-4 py-4">
        <p className="text-[10px] uppercase tracking-wider text-muted">Интервьюер</p>
        <p className="mt-1 text-lg font-semibold leading-snug text-foreground">{current.question}</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        {current.options.map((option, optIdx) => {
          const isChosen = chosenIdx === optIdx;
          const isRevealed = chosenIdx != null;
          let cls = "border-border bg-elevated/40 text-foreground hover:border-accent/40";
          if (isRevealed) {
            if (isChosen) {
              cls =
                option.moodDelta > 0
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                  : option.moodDelta < 0
                    ? "border-red-500/60 bg-red-500/15 text-red-200"
                    : "border-border bg-elevated/40 text-foreground";
            } else {
              cls = "border-border bg-elevated/20 text-muted";
            }
          }
          return (
            <button
              key={optIdx}
              type="button"
              onClick={() => pickOption(optIdx)}
              disabled={chosenIdx != null}
              className={`rounded-btn border px-3 py-3 text-left text-sm font-medium transition-all disabled:cursor-not-allowed ${cls}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>{option.text}</span>
                {isRevealed && isChosen ? (
                  <span className="font-mono text-xs text-muted">
                    {option.moodDelta > 0 ? `+${option.moodDelta}` : option.moodDelta}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {reaction ? (
        <div className="mt-4 rounded-btn border border-border bg-elevated/30 px-4 py-3 text-sm italic text-muted">
          <p className="text-[10px] uppercase tracking-wider text-accent">Реакция</p>
          <p className="mt-1 text-foreground">{reaction}</p>
        </div>
      ) : null}

      {chosenIdx != null && !done ? (
        <div className="mt-4 flex justify-end">
          <Button onClick={advance}>
            {index + 1 >= slots.length ? "Завершить интервью" : "Следующий вопрос →"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function useMoodGauge(mood) {
  // Smoothly animate to the new mood percent on every update.
  const [pct, setPct] = useState(50);
  useEffect(() => {
    const target = ((mood - MIN_MOOD) / (MAX_MOOD - MIN_MOOD)) * 100;
    setPct(Math.max(0, Math.min(100, target)));
  }, [mood]);
  return pct;
}
