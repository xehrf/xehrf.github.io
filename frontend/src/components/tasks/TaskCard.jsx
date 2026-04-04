import { Button } from "../ui/Button.jsx";
import { Card } from "../ui/Card.jsx";
import { ptsForDifficulty } from "../../utils/taskPts.js";

const difficultyLabels = {
  1: "Лёгкая",
  2: "Средняя",
  3: "Сложная",
  4: "Эксперт",
  5: "Легенда",
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
 */
export function TaskCard({ task, onSolve, actionLabel = "Решить", showPts = false }) {
  const diffClass = difficultyColors[task.difficulty] ?? difficultyColors[2];
  const taskTypeLabel =
    task.task_type === "solo" ? "Solo" : task.task_type === "match" ? "Match" : task.task_type;

  return (
    <Card className="group flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-accent">
            {task.title}
          </h3>
          {taskTypeLabel && (
            <p className="mt-0.5 text-xs uppercase tracking-wider text-muted">{taskTypeLabel}</p>
          )}
        </div>
        <span
          className={[
            "rounded-full border px-2.5 py-1 text-xs font-medium",
            diffClass,
          ].join(" ")}
        >
          {difficultyLabels[task.difficulty] ?? `Уровень ${task.difficulty}`}
        </span>
      </div>
      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="text-sm text-muted">
          Лимит:{" "}
          <span className="font-semibold text-accent tabular-nums">
            {task.time_limit_minutes} мин
          </span>
          {showPts ? (
            <>
              <span className="mx-2 text-border">·</span>
              <span className="font-semibold tabular-nums text-accent">+{ptsForDifficulty(task.difficulty)} PTS</span>
            </>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={onSolve}
          className="h-12 w-full shrink-0 justify-center rounded-[12px] text-base md:h-auto md:w-auto md:rounded-btn md:text-sm"
        >
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
