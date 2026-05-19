import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";

/**
 * Bug Hunter — one round of code review against the clock.
 *
 * The player sees a full file (numbered, monospace) and has to click every
 * line that contains a bug before the timer runs out. Selected lines are
 * scored on submit:
 *   correct = (true_positives - false_positives), clamped to [0, total_bugs]
 *
 * Submitting auto-fires on timeout so the parent always gets a result.
 *
 * Props:
 *   scenario:        {title, code, bugs: [{line, explanation}]}
 *   durationSeconds: countdown, seconds
 *   onSubmit({correct, total, picked, scenario}): fired exactly once
 */
export function BugHunterStage({ scenario, durationSeconds, onSubmit }) {
  const lines = useMemo(() => scenario.code.split("\n"), [scenario.code]);
  const bugLines = useMemo(() => new Set(scenario.bugs.map((b) => b.line)), [scenario.bugs]);

  const [picked, setPicked] = useState(() => new Set());
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [submitted, setSubmitted] = useState(false);
  const submitGuardRef = useRef(false);
  const timerRef = useRef(null);

  function togglePick(lineNumber) {
    if (submitted) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(lineNumber)) next.delete(lineNumber);
      else next.add(lineNumber);
      return next;
    });
  }

  function submitNow(currentPicked) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    setSubmitted(true);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const truePositives = [...currentPicked].filter((ln) => bugLines.has(ln)).length;
    const falsePositives = [...currentPicked].filter((ln) => !bugLines.has(ln)).length;
    const total = bugLines.size;
    const correct = Math.max(0, Math.min(total, truePositives - falsePositives));

    onSubmit({ correct, total, picked: [...currentPicked], scenario });
  }

  // Countdown timer — submits the player's current selection on timeout
  // so they don't have to remember to hit the button.
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
          submitNow(picked);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submitNow reads picked imperatively, intentional
  }, []);

  const total = bugLines.size;
  const truePositives = [...picked].filter((ln) => bugLines.has(ln)).length;
  const falsePositives = picked.size - truePositives;
  const timerColor = timeLeft > durationSeconds * 0.5 ? "text-accent" : timeLeft > durationSeconds * 0.25 ? "text-orange-400" : "text-red-400";

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-300">
            🐛 Bug Hunter
          </span>
          <span className="text-xs text-muted">{scenario.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted">Выбрано</p>
            <p className="font-mono text-lg font-bold text-foreground">
              {picked.size} <span className="text-xs text-muted">/ ~{total}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted">Время</p>
            <p className={`font-mono text-2xl font-bold tabular-nums ${timerColor}`}>{timeLeft}</p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        Кликни на каждую строку, где видишь баг. False positives вычитают очки.
      </p>

      <div className="mt-4 overflow-x-auto rounded-btn border border-border bg-black/60">
        <div className="font-mono text-[13px] leading-[1.5]">
          {lines.map((line, idx) => {
            const lineNumber = idx + 1;
            const isPicked = picked.has(lineNumber);
            const isActuallyBug = bugLines.has(lineNumber);
            let bg = "hover:bg-elevated/40";
            if (submitted) {
              if (isPicked && isActuallyBug) bg = "bg-emerald-500/20";
              else if (isPicked && !isActuallyBug) bg = "bg-red-500/20";
              else if (!isPicked && isActuallyBug) bg = "bg-orange-500/15";
            } else if (isPicked) {
              bg = "bg-orange-500/15";
            }
            return (
              <button
                key={lineNumber}
                type="button"
                onClick={() => togglePick(lineNumber)}
                disabled={submitted}
                className={`flex w-full items-start gap-3 px-3 py-0.5 text-left transition-colors disabled:cursor-default ${bg}`}
              >
                <span className="w-8 shrink-0 select-none text-right text-muted">{lineNumber}</span>
                <span className="flex-1 whitespace-pre text-emerald-200">{line || " "}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!submitted ? (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted">
            {truePositives > 0 || falsePositives > 0
              ? `Отметил ${picked.size} строк — ответ скрыт до сабмита`
              : "Ещё ничего не отмечено"}
          </span>
          <Button onClick={() => submitNow(picked)}>Сдать ответ</Button>
        </div>
      ) : (
        <div className="mt-4 rounded-btn border border-border bg-elevated/30 px-4 py-3 text-sm">
          <p className="font-bold text-foreground">
            Найдено {truePositives} из {total}
            {falsePositives > 0 ? ` (ложных тревог: ${falsePositives})` : ""}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {scenario.bugs.map((bug) => {
              const found = picked.has(bug.line);
              return (
                <li key={bug.line} className={found ? "text-emerald-300" : "text-orange-300"}>
                  <span className="font-mono">L{bug.line}</span> {found ? "✅" : "❌"} — {bug.explanation}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
