import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { MediaAsset } from "../components/ui/MediaAsset.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";
import { isVideoAsset } from "../utils/media.js";
import { jsPDF } from "jspdf";
import * as html2canvasModule from "html2canvas";

// Level thresholds match backend/app/rating/pts.py
const LEVELS = [
  { id: "beginner", label: "Beginner", min: 0, max: 100 },
  { id: "junior", label: "Junior", min: 100, max: 300 },
  { id: "strong_junior", label: "Strong Junior", min: 300, max: 600 },
  { id: "middle", label: "Middle", min: 600, max: Infinity },
];

function getLevelInfo(pts) {
  const safePts = Math.max(0, Number(pts || 0));
  const current = LEVELS.find((l) => safePts >= l.min && safePts < l.max) ?? LEVELS[LEVELS.length - 1];
  const next = LEVELS[LEVELS.indexOf(current) + 1] ?? null;
  const pctInLevel = next
    ? Math.min(100, Math.round(((safePts - current.min) / (current.max - current.min)) * 100))
    : 100;
  const ptsToNext = next ? Math.max(0, next.min - safePts) : 0;
  return { current, next, pctInLevel, ptsToNext };
}

function deriveAchievements({ pts, completedCount, bestStreak }) {
  // Single source of truth for achievement metadata. Each one shows on the
  // profile whether earned or not — locked tiles are dimmed.
  return [
    { id: "first_step", icon: "🎯", title: "Первый шаг", desc: "Решена первая задача", earned: completedCount >= 1 },
    { id: "five_tasks", icon: "⚡", title: "Разогрев", desc: "5 задач решено", earned: completedCount >= 5 },
    { id: "ten_tasks", icon: "💪", title: "Серьёзно", desc: "10 задач решено", earned: completedCount >= 10 },
    { id: "streak_3", icon: "🔥", title: "В огне", desc: "Серия 3 победы", earned: bestStreak >= 3 },
    { id: "streak_7", icon: "🔥🔥", title: "Легенда", desc: "Серия 7 побед", earned: bestStreak >= 7 },
    { id: "pts_300", icon: "🏆", title: "Strong Junior", desc: "300+ PTS", earned: pts >= 300 },
    { id: "pts_600", icon: "👑", title: "Middle", desc: "600+ PTS", earned: pts >= 600 },
    { id: "pts_1000", icon: "💎", title: "Тысячник", desc: "1000+ PTS", earned: pts >= 1000 },
  ];
}

function StatTile({ label, value, sub }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 font-mono text-2xl font-bold text-accent">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </Card>
  );
}

function LevelProgressBar({ pts }) {
  const { current, next, pctInLevel, ptsToNext } = getLevelInfo(pts);
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Текущий уровень</p>
          <p className="mt-1 text-xl font-bold text-foreground">{current.label}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
            {next ? "До следующего" : "Достигнут потолок"}
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-accent">
            {next ? `+${ptsToNext} PTS → ${next.label}` : "Middle"}
          </p>
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent/70 to-accent transition-all duration-700"
          style={{ width: `${pctInLevel}%` }}
        />
      </div>
      <p className="mt-2 text-right font-mono text-[10px] text-muted">{pctInLevel}%</p>
    </Card>
  );
}

function AchievementGrid({ achievements }) {
  const earnedCount = achievements.filter((a) => a.earned).length;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Достижения</h2>
        <span className="font-mono text-xs text-accent">
          {earnedCount}/{achievements.length}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {achievements.map((a) => (
          <div
            key={a.id}
            title={`${a.title} — ${a.desc}`}
            className={`flex flex-col items-center rounded-btn border p-3 text-center transition-all ${
              a.earned
                ? "border-accent/40 bg-accent/5 hover:border-accent/70"
                : "border-border bg-elevated/30 opacity-40"
            }`}
          >
            <div className={`text-2xl ${a.earned ? "" : "grayscale"}`}>{a.icon}</div>
            <div className="mt-2 text-[11px] font-semibold text-foreground">{a.title}</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted">{a.desc}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

async function generateResumePDF(profile, completedTasks, skillChips) {

  const avatarUrl = resolveAssetUrl(profile.avatar_url || "");
  const canRenderAvatarImage = avatarUrl && !isVideoAsset(avatarUrl);
  const now = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

  // Build HTML string for the resume
  const html = `
    <div style="
      width: 794px;
      min-height: 1123px;
      background: #0f0f14;
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #fff;
      position: relative;
      box-sizing: border-box;
    ">
      <!-- Header -->
      <div style="background: #191923; padding: 32px 40px 28px; position: relative; border-bottom: 3px solid #FFD600;">
        <div style="position: absolute; top: 20px; right: 40px; text-align: right;">
          <div style="color: #FFD600; font-size: 14px; font-weight: 700; letter-spacing: 1px;">CodeArena</div>
          <div style="color: #888; font-size: 11px; margin-top: 2px;">Player Resume</div>
          <div style="color: #666; font-size: 10px; margin-top: 4px;">Сформировано: ${now}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 24px;">
          <div style="
            width: 90px; height: 90px; border-radius: 50%;
            border: 3px solid #FFD600;
            overflow: hidden; flex-shrink: 0;
            background: #2a2a35;
            display: flex; align-items: center; justify-content: center;
            font-size: 36px; font-weight: 700; color: #FFD600;
          ">
            ${canRenderAvatarImage
              ? `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" />`
              : (profile.nickname || profile.display_name || "?")[0].toUpperCase()
            }
          </div>
          <div>
            <div style="font-size: 30px; font-weight: 700; color: #fff; line-height: 1.1;">
              ${profile.nickname || profile.display_name || "Unknown"}
            </div>
            <div style="font-size: 13px; color: #aaa; margin-top: 4px;">
              @${profile.nickname || profile.display_name}
            </div>
            <div style="
              display: inline-block;
              background: #FFD600; color: #111;
              font-size: 10px; font-weight: 700;
              letter-spacing: 1px; text-transform: uppercase;
              padding: 4px 14px; border-radius: 20px; margin-top: 10px;
            ">${profile.level || "beginner"}</div>
          </div>
        </div>
      </div>

      <div style="padding: 28px 40px;">

        <!-- Stats -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px;">
          ${[
            { label: "PTS", value: profile.pts ?? 0 },
            { label: "Задач решено", value: completedTasks.length },
            { label: "Навыков", value: skillChips.filter(s => s.type === "skill").length },
            { label: "Уровень", value: profile.level || "beginner" },
          ].map(s => `
            <div style="background: #1e1e2a; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #2a2a3a;">
              <div style="font-size: 24px; font-weight: 700; color: #FFD600;">${s.value}</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">${s.label}</div>
            </div>
          `).join("")}
        </div>

        ${profile.bio ? `
        <!-- Bio -->
        <div style="margin-bottom: 28px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="width: 4px; height: 18px; background: #FFD600; border-radius: 2px;"></div>
            <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #fff; text-transform: uppercase;">О себе</div>
            <div style="flex: 1; height: 1px; background: #2a2a3a;"></div>
          </div>
          <div style="background: #191923; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #ccc; line-height: 1.7; border: 1px solid #2a2a3a;">
            ${profile.bio}
          </div>
        </div>
        ` : ""}

        ${skillChips.length > 0 ? `
        <!-- Skills -->
        <div style="margin-bottom: 28px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="width: 4px; height: 18px; background: #FFD600; border-radius: 2px;"></div>
            <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #fff; text-transform: uppercase;">Навыки и роль</div>
            <div style="flex: 1; height: 1px; background: #2a2a3a;"></div>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${skillChips.map(s => `
              <div style="
                padding: 6px 14px; border-radius: 20px;
                background: ${s.type === "role" ? "rgba(99,102,241,0.2)" : "rgba(255,214,0,0.1)"};
                border: 1px solid ${s.type === "role" ? "rgba(99,102,241,0.5)" : "rgba(255,214,0,0.3)"};
                font-size: 12px; color: ${s.type === "role" ? "#a5b4fc" : "#FFD600"};
                font-weight: ${s.type === "role" ? "700" : "400"};
              ">
                ${s.label}${s.type === "skill" ? ` <span style="opacity:0.6; font-size:11px;">${s.proficiency}/5</span>` : " <span style='font-size:10px;opacity:0.7;'>РОЛЬ</span>"}
              </div>
            `).join("")}
          </div>
        </div>
        ` : ""}

        ${completedTasks.length > 0 ? `
        <!-- Tasks -->
        <div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="width: 4px; height: 18px; background: #FFD600; border-radius: 2px;"></div>
            <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #fff; text-transform: uppercase;">Выполненные задачи</div>
            <div style="flex: 1; height: 1px; background: #2a2a3a;"></div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${completedTasks.map((task, i) => `
              <div style="
                display: flex; align-items: center; justify-content: space-between;
                padding: 10px 14px; border-radius: 8px;
                background: ${i % 2 === 0 ? "#191923" : "transparent"};
                border: 1px solid ${i % 2 === 0 ? "#2a2a3a" : "transparent"};
              ">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="
                    width: 20px; height: 20px; border-radius: 50%;
                    background: #4ade80;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 11px; font-weight: 700; color: #111; flex-shrink: 0;
                  ">✓</div>
                  <div style="font-size: 13px; color: #e5e5e5;">${task.title}</div>
                </div>
                <div style="font-size: 11px; color: #555; flex-shrink: 0;">#${task.taskId}</div>
              </div>
            `).join("")}
          </div>
        </div>
        ` : ""}

      </div>

      <!-- Footer -->
      <div style="
        position: absolute; bottom: 0; left: 0; right: 0;
        background: #191923; border-top: 2px solid #FFD600;
        padding: 12px 40px; display: flex; justify-content: space-between; align-items: center;
      ">
        <div style="font-size: 10px; color: #666;">CodeArena — платформа для разработчиков</div>
        <div style="font-size: 10px; color: #FFD600;">xehrf-github-io.vercel.app</div>
      </div>
    </div>
  `;

  // Render HTML to canvas
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;left:0;top:0;z-index:-9999;opacity:0;pointer-events:none;width:794px;";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 300));
    const h2c = html2canvasModule.default ?? html2canvasModule;
    const canvas = await h2c(container.firstElementChild, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#0f0f14",
      logging: false,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfW = 210;
    const pdfH = (canvas.height * pdfW) / canvas.width;

    if (pdfH <= 297) {
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    } else {
      // Multi-page
      const pageH = 297;
      const ratio = canvas.width / pdfW;
      let srcY = 0;
      while (srcY < canvas.height) {
        const srcH = Math.min(pageH * ratio, canvas.height - srcY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = srcH;
        pageCanvas.getContext("2d").drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 0, 0, pdfW, srcH / ratio);
        srcY += srcH;
        if (srcY < canvas.height) pdf.addPage();
      }
    }

    const filename = `resume_${(profile.nickname || profile.display_name || "user").replace(/\s+/g, "_")}.pdf`;
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

export function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [taskTitles, setTaskTitles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bannerLoadError, setBannerLoadError] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const completedTasks = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of submissions) {
      const ok = s.auto_test_passed === true || s.status === "accepted";
      if (!ok) continue;
      if (seen.has(s.task_id)) continue;
      seen.add(s.task_id);
      out.push({
        taskId: s.task_id,
        title: taskTitles[s.task_id] ?? `Задача #${s.task_id}`,
      });
    }
    return out;
  }, [submissions, taskTitles]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [p, subs, tasks] = await Promise.all([
          apiFetch("/users/me/profile"),
          apiFetch("/submissions/me"),
          apiFetch("/tasks"),
        ]);
        if (!mounted) return;
        setProfile(p);
        setSubmissions(Array.isArray(subs) ? subs : []);
        const map = {};
        for (const t of tasks) map[t.id] = t.title;
        setTaskTitles(map);
      } catch (e) {
        if (mounted) setError(e?.message || "Не удалось загрузить профиль");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
        <Card className="p-6 text-sm text-muted">Загрузка профиля...</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
        <Card className="p-6 text-sm text-accent">{error}</Card>
      </div>
    );
  }

  const u = profile;
  const bannerUrl = resolveAssetUrl(u.banner_url || "");
  const avatarUrl = resolveAssetUrl(u.avatar_url || "");
  const showBanner = bannerUrl && !bannerLoadError;
  const showAvatar = avatarUrl && !avatarLoadError;
  const skills = Array.isArray(u.skills) ? u.skills : [];
  const selectedRole = typeof u.role === "string" ? u.role.trim() : "";
  const roleAlreadyInSkills = selectedRole
    ? skills.some((s) => String(s?.skill_name || "").toLowerCase() === selectedRole.toLowerCase())
    : false;
  const skillChips = [
    ...(selectedRole && !roleAlreadyInSkills
      ? [{ key: `role:${selectedRole}`, label: selectedRole, type: "role" }]
      : []),
    ...skills.map((s) => ({
      key: `skill:${s.id ?? s.skill_name}`,
      label: s.skill_name,
      proficiency: s.proficiency,
      type: "skill",
    })),
  ];

  const bestStreak = Number(u.pvp_best_win_streak ?? 0);
  const currentStreak = Number(u.pvp_win_streak ?? 0);
  const achievements = deriveAchievements({
    pts: Number(u.pts || 0),
    completedCount: completedTasks.length,
    bestStreak,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Page header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
          <span className="capitalize">{u.level.replace("_", " ")}</span>
          <span className="text-border">·</span>
          <span className="font-mono">{Number(u.pts || 0).toLocaleString("ru-RU")} PTS</span>
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          <span className="text-gradient-accent">Профиль</span>
        </h1>
        <p className="mt-2 text-sm text-muted sm:text-base">
          @{u.nickname || u.display_name} · Всё про тебя на арене
        </p>
      </div>

      {/* HERO card with banner + avatar + actions */}
      <Card className="overflow-hidden p-0">
        <div className="relative h-44 bg-canvas sm:h-56">
          {showBanner ? (
            <MediaAsset
              src={bannerUrl}
              alt="Banner"
              className="h-full w-full object-cover"
              onError={() => setBannerLoadError(true)}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(circle at 30% 50%, rgba(255,215,0,0.12), transparent 60%), linear-gradient(135deg, #161B22, #0D1117)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas/95 via-canvas/30 to-transparent" />
          {currentStreak >= 3 ? (
            <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-canvas/80 px-3 py-1 text-xs font-semibold text-accent backdrop-blur">
              {currentStreak >= 7 ? "🔥🔥🔥" : "🔥"} серия {currentStreak}
            </div>
          ) : null}
        </div>

        <div className="relative px-6 pb-6 sm:px-8">
          {/* Avatar overlaps the banner */}
          <div className="-mt-12 flex flex-col items-start gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-canvas bg-elevated shadow-xl sm:h-32 sm:w-32">
                {showAvatar ? (
                  <MediaAsset
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    onError={() => setAvatarLoadError(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-foreground">
                    {u.nickname?.[0]?.toUpperCase() ?? u.display_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
              <div className="mb-2">
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                  {u.nickname || u.display_name}
                </h2>
                <p className="text-sm text-muted">{u.display_name}</p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              <Button
                variant="secondary"
                onClick={async () => {
                  setGeneratingPdf(true);
                  try {
                    await generateResumePDF(u, completedTasks, skillChips);
                  } catch (e) {
                    alert("Не удалось сгенерировать резюме: " + (e?.message || e));
                  } finally {
                    setGeneratingPdf(false);
                  }
                }}
                disabled={generatingPdf}
                className="w-full sm:flex-initial"
              >
                {generatingPdf ? "Генерируем..." : "⬇ Резюме PDF"}
              </Button>
              <LinkButton to="/profile/edit" className="w-full sm:flex-initial">
                Редактировать
              </LinkButton>
            </div>
          </div>

          {/* Bio */}
          <div className="mt-5">
            {u.bio ? (
              <p className="rounded-btn border border-border bg-elevated/40 px-4 py-3 text-sm leading-6 text-foreground">
                {u.bio}
              </p>
            ) : (
              <p className="rounded-btn border border-dashed border-border bg-elevated/30 px-4 py-3 text-sm text-muted">
                Описание профиля пустое. Добавь в настройках, чтобы рекрутеры понимали что у тебя за стек.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Stat tiles row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="PTS" value={Number(u.pts || 0).toLocaleString("ru-RU")} />
        <StatTile
          label="Уровень"
          value={LEVELS.find((l) => l.id === u.level)?.label ?? u.level}
        />
        <StatTile
          label="Решено"
          value={completedTasks.length}
          sub={completedTasks.length === 1 ? "задача" : "задач"}
        />
        <StatTile
          label="Серия"
          value={`${currentStreak}`}
          sub={`лучшая: ${bestStreak}`}
        />
      </div>

      {/* Level progress + Achievements side-by-side on desktop */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1.4fr]">
        <LevelProgressBar pts={u.pts} />
        <AchievementGrid achievements={achievements} />
      </div>

      {/* Skills + Completed tasks */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,1.4fr]">
        <Card className="p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Навыки</h2>
          {skillChips.length === 0 ? (
            <p className="mt-4 rounded-btn border border-dashed border-border bg-elevated/30 px-4 py-6 text-center text-sm text-muted">
              Навыки ещё не добавлены. Перейди в настройки и расскажи про свой стек.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {skillChips.map((s) => (
                <li
                  key={s.key}
                  className="flex flex-col items-start gap-2 rounded-btn border border-border bg-elevated/40 px-3 py-2.5 transition-colors hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{s.label}</span>
                    {s.type === "role" ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-accent">
                        Роль
                      </span>
                    ) : null}
                  </div>
                  {s.type === "skill" && s.proficiency ? (
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((dot) => (
                        <span
                          key={dot}
                          className={`h-1.5 w-3 rounded-sm ${
                            dot <= s.proficiency ? "bg-accent" : "bg-border/40"
                          }`}
                        />
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Выполненные задачи
            </h2>
            <span className="font-mono text-xs text-accent">{completedTasks.length}</span>
          </div>
          {completedTasks.length === 0 ? (
            <div className="mt-4 rounded-btn border border-dashed border-border bg-elevated/30 px-4 py-8 text-center text-sm text-muted">
              Пока нет засчитанных решений.
              <br />
              <Link to="/dashboard" className="mt-2 inline-block text-accent hover:underline">
                Решить первую задачу →
              </Link>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {completedTasks.map((row) => (
                <li key={row.taskId}>
                  <Link
                    to={`/tasks/${row.taskId}/solve`}
                    className="flex flex-col items-start gap-2 rounded-btn border border-border bg-elevated/40 px-4 py-3 text-sm text-foreground transition-all hover:border-accent/40 hover:bg-elevated active:scale-[0.99] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium">{row.title}</span>
                    <span className="font-mono text-xs text-accent">✓</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
