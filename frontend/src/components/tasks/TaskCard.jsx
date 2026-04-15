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
    <Card className="group flex h-[280px] w-full flex-col rounded-[20px] border border-[#2B2B3C] bg-[#1E1E2E] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="truncate text-xl font-semibold text-white transition-colors group-hover:text-[#FFD600]">
              {task.title}
            </h3>
            <span
              className={[
                "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
                diffClass,
              ].join(" ")}
            >
              {difficultyLabels[task.difficulty] ?? `Уровень ${task.difficulty}`}
            </span>
          </div>
          {taskTypeLabel && (
            <p className="mt-3 text-sm uppercase tracking-[0.18em] text-slate-400">{taskTypeLabel}</p>
          )}
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-4 border-t border-[#2B2B3C] pt-4">
        <div className="text-sm text-slate-300">
          Лимит:{" "}
          <span className="font-semibold text-white tabular-nums">
            {task.time_limit_minutes} мин
          </span>
          {showPts ? (
            <>
              <span className="mx-2 text-slate-500">·</span>
              <span className="font-semibold tabular-nums text-white">+{ptsForDifficulty(task.difficulty)} PTS</span>
            </>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={onSolve}
          className="h-12 w-full rounded-[16px] bg-[#FFD600] px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(255,214,0,0.3)] transition-colors duration-200 hover:bg-[#f9d400] md:w-auto"
        >
          {actionLabel}
        </Button>
      </div>
    </Card>
  );
}
