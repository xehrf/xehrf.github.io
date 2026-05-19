import { useEffect, useRef, useState } from "react";
import { Card } from "../../../../components/ui/Card.jsx";
import { ACTIONS, SERVICES, computeGlitchScore } from "./glitch.js";

/**
 * GlitchStage — single incident-response round.
 *
 * Player has `durationSeconds` to investigate and apply the correct fix.
 * Investigation actions reveal logs / metrics; fix actions either resolve
 * the incident, partially relieve it (delaying cascade), or burn time.
 *
 * The round ends on:
 *   - correct fix applied            → score submitted immediately
 *   - timer hits zero                → score submitted with current state
 *   - cascade fires AND timer < 10s  → cosmetic, doesn't end the round
 *
 * onSubmit({correct, total, history, scenario, outcome})
 */
export function GlitchStage({ scenario, durationSeconds, onSubmit }) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [history, setHistory] = useState([]);
  const [pendingAction, setPendingAction] = useState(null); // action awaiting target
  const [cooldowns, setCooldowns] = useState({}); // { [actionId]: unlockTimestamp }
  const [terminal, setTerminal] = useState([
    {
      kind: "system",
      text: `🚨 INCIDENT: ${scenario.title}`,
    },
    {
      kind: "system",
      text: scenario.summary,
    },
    {
      kind: "system",
      text: `Available actions: ${ACTIONS.map((a) => a.label).join(" · ")}`,
    },
  ]);
  const [alerts, setAlerts] = useState([
    {
      id: `${scenario.id}:start`,
      tone: "critical",
      text: `${scenario.title}: ${scenario.summary}`,
    },
  ]);
  const [outcome, setOutcome] = useState(null); // null | "fixed" | "timeout" | "cascaded"
  const [health, setHealth] = useState(scenario.initialHealth);
  const [cascadeFired, setCascadeFired] = useState(false);

  const startTsRef = useRef(Date.now());
  const historyRef = useRef([]);
  const submitGuardRef = useRef(false);
  const timerRef = useRef(null);
  const terminalRef = useRef(null);

  // Auto-scroll the terminal to the bottom whenever new lines arrive.
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminal]);

  function pushTerminal(entries) {
    setTerminal((prev) => [...prev, ...entries]);
  }

  function pushAlert(text, tone = "warning") {
    const id = `${Date.now()}:${Math.random()}`;
    setAlerts((prev) => [...prev.slice(-3), { id, tone, text }]);
  }

  function commitHistory(nextHistory) {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    return nextHistory;
  }

  function elapsedSeconds() {
    return Math.floor((Date.now() - startTsRef.current) / 1000);
  }

  function finalize(outcomeReason, historyOverride = historyRef.current) {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    setOutcome(outcomeReason);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const score = computeGlitchScore(scenario, historyOverride);
    onSubmit({
      correct: score.correct,
      total: score.total,
      outcome: outcomeReason,
      scenario,
      history: historyOverride,
      breakdown: score,
    });
  }

  // Countdown — drives cascade firing and timeout finalization.
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          finalize("timeout");
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finalize reads history imperatively
  }, []);

  // Cascade trigger — when N seconds elapse without correctFix, a second
  // service flips to critical. Purely cosmetic + dramatic; doesn't end the
  // round but tells the player time is running out.
  useEffect(() => {
    if (cascadeFired || outcome) return undefined;
    const cascade = scenario.cascade;
    if (!cascade) return undefined;
    const id = window.setTimeout(() => {
      setCascadeFired(true);
      setHealth((prev) => ({ ...prev, [cascade.service]: "critical" }));
      pushAlert(cascade.narrative, "critical");
      pushTerminal([
        { kind: "system", text: `⚠️ CASCADE: ${cascade.narrative}` },
      ]);
    }, cascade.afterSeconds * 1000);
    return () => window.clearTimeout(id);
  }, [scenario, cascadeFired, outcome]);

  // Live cooldown tick so disabled buttons re-enable visibly.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  function isOnCooldown(actionId) {
    const unlock = cooldowns[actionId];
    return unlock != null && unlock > now;
  }

  function cooldownRemaining(actionId) {
    const unlock = cooldowns[actionId];
    if (unlock == null) return 0;
    return Math.max(0, Math.ceil((unlock - now) / 1000));
  }

  function applyCooldown(actionId, seconds) {
    setCooldowns((prev) => ({ ...prev, [actionId]: Date.now() + seconds * 1000 }));
  }

  function executeAction(action, target) {
    if (outcome) return;
    applyCooldown(action.id, action.cooldown);
    const at = elapsedSeconds();

    if (action.id === "tail") {
      const lines = scenario.logs[target] ?? [];
      pushTerminal([
        { kind: "cmd", text: `$ tail logs ${target}` },
        ...lines.map((entry) => ({
          kind: "log",
          text: entry.text,
          signal: entry.signal,
          service: target,
        })),
      ]);
      commitHistory([
        ...historyRef.current,
        { kind: "investigation", action: "tail", target, at },
      ]);
      return;
    }

    if (action.id === "inspect") {
      const metrics = scenario.metrics[target] ?? {};
      pushTerminal([
        { kind: "cmd", text: `$ inspect metric ${target}` },
        ...Object.entries(metrics).map(([k, v]) => ({
          kind: "metric",
          text: `  ${k.padEnd(14)} ${v}`,
        })),
      ]);
      commitHistory([
        ...historyRef.current,
        { kind: "investigation", action: "inspect", target, at },
      ]);
      return;
    }

    // FIX actions — judge against the scenario's correctFix / partialFix /
    // wrongFix tables.
    const fixKey = target ? `${action.id}:${target}` : action.id;
    const cmdLine = target ? `$ ${action.label} ${target}` : `$ ${action.label}`;
    const commandPrelude = [{ kind: "cmd", text: cmdLine }];
    if (action.id === "check_locks") {
      const lockLines = scenario.dbLocks ?? [
        "no blocking locks",
        "oldest transaction age=1.8s",
        "long_queries=0",
      ];
      commandPrelude.push(
        ...lockLines.map((text) => ({
          kind: text.includes("no blocking") || text.includes("long_queries=0") ? "metric" : "warn",
          text,
        })),
      );
    }

    if (
      scenario.correctFix.action === action.id &&
      (scenario.correctFix.target ?? null) === (target ?? null)
    ) {
      pushTerminal([
        ...commandPrelude,
        { kind: "success", text: `✓ Incident contained. ${scenario.explanation}` },
      ]);
      pushAlert("Incident contained. Blast radius stopped.", "success");
      setOutcome("fixed");
      setHealth((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, "ok"])));
      const nextHistory = [
        ...historyRef.current,
        { kind: "fix", action: action.id, target: target ?? null, result: "correct", at },
      ];
      commitHistory(nextHistory);
      // Wait a beat so the player reads the explanation, then finalize.
      window.setTimeout(() => {
        if (!submitGuardRef.current) {
          submitGuardRef.current = true;
          setOutcome("fixed");
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          const score = computeGlitchScore(scenario, nextHistory);
          onSubmit({
            correct: score.correct,
            total: score.total,
            outcome: "fixed",
            scenario,
            history: nextHistory,
            breakdown: score,
          });
        }
      }, 2200);
      return;
    }

    const partial = scenario.partialFix[fixKey];
    if (partial) {
      pushTerminal([
        ...commandPrelude,
        { kind: "warn", text: `~ Частичный фикс: ${partial.narrative}` },
      ]);
      pushAlert("Partial mitigation. Root cause is still active.", "warning");
      commitHistory([
        ...historyRef.current,
        { kind: "fix", action: action.id, target: target ?? null, result: "partial", at },
      ]);
      return;
    }

    const wrong = scenario.wrongFix[fixKey];
    const nextHistory = [
      ...historyRef.current,
      { kind: "fix", action: action.id, target: target ?? null, result: "wrong", at },
    ];
    pushTerminal([
      ...commandPrelude,
      { kind: "error", text: `✗ ${wrong ?? "Действие ничего не дало."}` },
    ]);
    pushAlert("Wrong action burned time and increased cascade pressure.", "critical");
    commitHistory(nextHistory);
    setTimeLeft((prev) => {
      const next = Math.max(0, prev - (action.penaltySeconds ?? 5));
      if (next <= 0) {
        window.setTimeout(() => finalize("timeout", nextHistory), 0);
      }
      return next;
    });
  }

  function handleActionClick(action) {
    if (outcome) return;
    if (isOnCooldown(action.id)) return;
    if (action.needsTarget) {
      setPendingAction(action);
    } else {
      executeAction(action, null);
    }
  }

  function handleServiceClick(serviceId) {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    executeAction(action, serviceId);
  }

  const timerColor =
    timeLeft > durationSeconds * 0.5
      ? "text-accent"
      : timeLeft > durationSeconds * 0.25
        ? "text-orange-400"
        : "text-red-400";

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-300">
            🚨 Incident response
          </span>
          <span className="text-xs text-muted">{scenario.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted">Time</p>
            <p className={`font-mono text-2xl font-bold tabular-nums ${timerColor}`}>
              {timeLeft}s
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.4fr]">
        <ServicePanel
          health={health}
          pendingAction={pendingAction}
          onServiceClick={handleServiceClick}
          onCancel={() => setPendingAction(null)}
        />
        <div className="grid gap-3">
          <AlertStack alerts={alerts} />
          <TerminalView entries={terminal} terminalRef={terminalRef} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {ACTIONS.map((action) => {
          const onCooldown = isOnCooldown(action.id);
          const isPending = pendingAction?.id === action.id;
          const remaining = cooldownRemaining(action.id);
          const baseColor = action.kind === "investigation"
            ? "border-indigo-400/30 text-indigo-200 hover:border-indigo-400/60"
            : "border-red-400/30 text-red-200 hover:border-red-400/60";
          return (
            <button
              key={action.id}
              type="button"
              disabled={onCooldown || outcome != null}
              onClick={() => handleActionClick(action)}
              title={action.description}
              className={`rounded-btn border bg-elevated/40 px-3 py-2 text-left text-xs transition-all disabled:cursor-not-allowed disabled:opacity-50 ${baseColor} ${
                isPending ? "ring-2 ring-accent" : ""
              }`}
            >
              <div className="font-mono text-sm">{action.label}</div>
              {onCooldown ? (
                <div className="font-mono text-[10px] text-muted">cooldown {remaining}s</div>
              ) : (
                <div className="text-[10px] text-muted">
                  {action.needsTarget ? "→ выбрать сервис" : "global"}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {pendingAction ? (
        <p className="mt-3 text-xs text-accent">
          Выбран <b>{pendingAction.label}</b> — кликни сервис сверху или нажми отмена.
        </p>
      ) : null}
    </Card>
  );
}

function AlertStack({ alerts }) {
  return (
    <div className="grid gap-2">
      {alerts.slice(-3).map((alert) => {
        const tone =
          alert.tone === "success"
            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
            : alert.tone === "critical"
              ? "border-red-400/40 bg-red-500/10 text-red-200"
              : "border-amber-400/40 bg-amber-500/10 text-amber-200";
        return (
          <div
            key={alert.id}
            className={`animate-pulse rounded-btn border px-3 py-2 text-xs shadow-lg ${tone}`}
          >
            <p className="font-mono font-bold uppercase tracking-wider">alert</p>
            <p className="mt-0.5 text-foreground/90">{alert.text}</p>
          </div>
        );
      })}
    </div>
  );
}

function ServicePanel({ health, pendingAction, onServiceClick, onCancel }) {
  return (
    <div className="rounded-btn border border-border bg-elevated/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Services</p>
        {pendingAction ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] text-muted underline hover:text-accent"
          >
            cancel
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {SERVICES.map((service) => {
          const state = health[service.id] ?? "ok";
          const dot =
            state === "critical"
              ? "bg-red-500 animate-pulse"
              : state === "warning"
                ? "bg-amber-400"
                : "bg-emerald-500";
          const border = pendingAction ? "border-accent/60 hover:border-accent" : "border-border";
          return (
            <button
              key={service.id}
              type="button"
              disabled={!pendingAction}
              onClick={() => onServiceClick(service.id)}
              className={`flex items-center gap-2 rounded-btn border bg-black/30 px-3 py-2 text-left transition-all disabled:cursor-default ${border}`}
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
              <div className="flex-1">
                <div className="font-mono text-xs text-foreground">{service.label}</div>
                <div className="text-[10px] text-muted">{service.role}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TerminalView({ entries, terminalRef }) {
  return (
    <div
      ref={terminalRef}
      className="h-72 overflow-y-auto rounded-btn border border-border bg-black/70 p-3 font-mono text-[12px] leading-[1.5]"
    >
      {entries.map((entry, idx) => {
        let cls = "text-emerald-200";
        if (entry.kind === "cmd") cls = "text-accent";
        else if (entry.kind === "system") cls = "text-muted";
        else if (entry.kind === "metric") cls = "text-cyan-300";
        else if (entry.kind === "warn") cls = "text-amber-300";
        else if (entry.kind === "error") cls = "text-red-300";
        else if (entry.kind === "success") cls = "text-emerald-400 font-bold";
        else if (entry.kind === "log") {
          // Don't highlight signal lines during the live game — only in the
          // post-game breakdown would we reveal which lines mattered.
          cls = "text-emerald-200";
        }
        return (
          <div key={idx} className={`whitespace-pre-wrap ${cls}`}>
            {entry.text}
          </div>
        );
      })}
    </div>
  );
}
