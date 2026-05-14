import { Button } from "../ui/Button.jsx";
import { Card } from "../ui/Card.jsx";
import { ptsForDifficulty } from "../../utils/taskPts.js";

const difficultyLabels = {
  1: "Лёгкие",
  2: "Средняя",
  3: "Сложные",
  4: "Эксперт",
  5: "Легендарные",
};

const difficultyColors = {
  1: "border-emerald-500/40 text-emerald-400",
  2: "border-accent/40 text-accent",
  3: "border-orange-500/40 text-orange-400",
  4: "border-red-500/40 text-red-400",
  5: "border-fuchsia-500/40 text-fuchsia-400",
};

/**
 * @param {object} props
 * @param {{ id: string | number, title: string, difficulty: number, time_limit_minutes: number, task_type?: string }} props.task
 * @param {() => void} [props.onSolve]
 * @param {string} [props.actionLabel]
 * @param {boolean} [props.showPts]
 * @param {boolean} [props.solved] — Дополнительная отметка "уже решено".
 */
export function TaskCard({
  task,
  onSolve,
  actionLabel = "Решить",
  showPts = false,
  solved = false,
}) {
  const diffClass = difficultyColors[task.difficulty] ?? difficultyColors[2];
  const reward = ptsForDifficulty(task.difficulty);

  return (
    <Card
      className={`group relative flex min-h-[220px] w-full flex-col overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40 ${
        solved ? "border-accent/30 bg-accent/[0.03]" : ""
      }`}
    >
      {/* Solved checkmark badge */}
      {solved ? (
        <div className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-[11px] font-bold text-accent">
          ✓
        </div>
      ) : null}

      <div className="flex min-h-[72px] items-start justify-between gap-3 pr-8">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-foreground transition-colors group-hover:text-accent">
            {task.title}
          </h3>
          <span
            className={[
              "mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              diffClass,
            ].join(" ")}
          >
            {difficultyLabels[task.difficulty] ?? `Уровень ${task.difficulty}`}
          </span>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-border/60 pt-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-3">
            <span>
              ⏱{" "}
              <span className="font-mono text-foreground">
                {task.time_limit_minutes}
              </span>{" "}
              мин
            </span>
            {showPts || true ? (
              <>
                <span className="text-border">·</span>
                <span>
                  💰{" "}
                  <span className="font-mono font-bold text-accent">+{reward}</span>{" "}
                  PTS
                </span>
              </>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          onClick={onSolve}
          variant={solved ? "secondary" : "primary"}
          className="w-full"
        >
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
