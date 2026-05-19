import { useMemo, useState } from "react";
import { Button } from "../../../../components/ui/Button.jsx";
import { Card } from "../../../../components/ui/Card.jsx";
import { REVIEW_CATEGORIES, scoreCodeReviewAnswer } from "./codeReview.js";

const CATEGORY_LABELS = {
  problem: {
    title: "Проблема",
    prompt: "Что важно заметить первым?",
  },
  improvement: {
    title: "Улучшение",
    prompt: "Какой вариант лучше предложить?",
  },
  comment: {
    title: "Senior-комментарий",
    prompt: "Как это сформулировать в ревью?",
  },
};

function CodeBlock({ code }) {
  const lines = code.split("\n");
  return (
    <div className="overflow-x-auto rounded-btn border border-border bg-black/60">
      <div className="font-mono text-[13px] leading-[1.55]">
        {lines.map((line, idx) => (
          <div key={`${idx}-${line}`} className="flex min-w-max items-start gap-3 px-3 py-0.5">
            <span className="w-8 shrink-0 select-none text-right text-muted">{idx + 1}</span>
            <span className="whitespace-pre text-emerald-200">{line || " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewChoiceGroup({ category, choices, selectedId, expectedId, revealed, onSelect }) {
  const meta = CATEGORY_LABELS[category];
  return (
    <section className="rounded-btn border border-border bg-elevated/30 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">{meta.title}</h3>
          <p className="text-[11px] text-muted">{meta.prompt}</p>
        </div>
        {revealed ? (
          <span className={`font-mono text-xs font-bold ${selectedId === expectedId ? "text-emerald-300" : "text-red-300"}`}>
            {selectedId === expectedId ? "+1" : "0"}
          </span>
        ) : null}
      </div>

      <div className="grid gap-2">
        {choices.map((choice) => {
          const selected = selectedId === choice.id;
          const expected = expectedId === choice.id;
          let cls = "border-border bg-elevated/40 text-foreground hover:border-accent/40";

          if (revealed) {
            if (expected) cls = "border-emerald-500/60 bg-emerald-500/15 text-emerald-100";
            else if (selected) cls = "border-red-500/60 bg-red-500/15 text-red-100";
            else cls = "border-border bg-elevated/20 text-muted";
          } else if (selected) {
            cls = "border-accent/60 bg-accent/10 text-foreground";
          }

          return (
            <button
              key={choice.id}
              type="button"
              disabled={revealed}
              onClick={() => onSelect(category, choice.id)}
              className={`rounded-btn border px-3 py-2 text-left text-sm transition-all disabled:cursor-default ${cls}`}
            >
              <span className="font-medium">{choice.text}</span>
              {revealed && (selected || expected) ? (
                <span className="mt-1 block text-xs text-muted">{choice.rationale}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AnswerComparison({ scenario, result, onFinish }) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-btn border border-border bg-elevated/30 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold text-foreground">
            Разбор: {result.correct}/{result.total}
          </p>
          <p className="font-mono text-xs text-accent">
            {Math.round((result.correct / result.total) * 100)}%
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-btn border border-border bg-black/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Как ответил бы junior</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{scenario.juniorAnswer}</p>
        </div>
        <div className="rounded-btn border border-accent/40 bg-accent/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Как ответил бы senior</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{scenario.seniorAnswer}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Эталонное улучшение</p>
        <CodeBlock code={scenario.improvedCode} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => onFinish({ correct: result.correct, total: result.total })}>
          Завершить интервью
        </Button>
      </div>
    </div>
  );
}

export function CodeReviewStage({ scenario, onSubmit }) {
  const [selections, setSelections] = useState({});
  const [revealed, setRevealed] = useState(false);
  const result = useMemo(() => scoreCodeReviewAnswer(scenario, selections), [scenario, selections]);
  const ready = REVIEW_CATEGORIES.every((category) => selections[category]);

  function selectChoice(category, choiceId) {
    if (revealed) return;
    setSelections((prev) => ({ ...prev, [category]: choiceId }));
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full border border-sky-400/40 bg-sky-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
            Code Review
          </span>
          <span className="text-xs text-muted">{scenario.role}</span>
        </div>
        <p className="font-mono text-xs text-accent">
          {Object.keys(selections).length}/{REVIEW_CATEGORIES.length}
        </p>
      </div>

      <h2 className="mt-3 text-xl font-bold text-foreground">{scenario.title}</h2>

      <div className="mt-4">
        <CodeBlock code={scenario.code} />
      </div>

      <div className="mt-4 grid gap-3">
        {REVIEW_CATEGORIES.map((category) => (
          <ReviewChoiceGroup
            key={category}
            category={category}
            choices={scenario.choices[category]}
            selectedId={selections[category]}
            expectedId={scenario.answers[category]}
            revealed={revealed}
            onSelect={selectChoice}
          />
        ))}
      </div>

      {!revealed ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {ready ? "Ответ готов к разбору." : "Выбери проблему, улучшение и комментарий."}
          </p>
          <Button disabled={!ready} onClick={() => setRevealed(true)}>
            Проверить ответ
          </Button>
        </div>
      ) : (
        <AnswerComparison scenario={scenario} result={result} onFinish={onSubmit} />
      )}
    </Card>
  );
}
