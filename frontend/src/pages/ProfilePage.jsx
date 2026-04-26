import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";

async function generateResumePDF(profile, completedTasks, skillChips) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210;
  const gold = [255, 214, 0];
  const dark = [15, 15, 20];
  const mid = [40, 40, 50];
  const light = [180, 180, 190];
  const white = [255, 255, 255];
  const green = [74, 222, 128];

  // Background
  doc.setFillColor(...dark);
  doc.rect(0, 0, W, 297, "F");

  // Header stripe
  doc.setFillColor(25, 25, 35);
  doc.rect(0, 0, W, 60, "F");

  // Gold accent line
  doc.setFillColor(...gold);
  doc.rect(0, 58, W, 2, "F");

  // Avatar circle
  const avatarUrl = resolveAssetUrl(profile.avatar_url || "");
  let avatarLoaded = false;
  if (avatarUrl) {
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = avatarUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 120; canvas.height = 120;
      const ctx = canvas.getContext("2d");
      ctx.beginPath();
      ctx.arc(60, 60, 60, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, 120, 120);
      const dataUrl = canvas.toDataURL("image/png");
      // Gold border circle
      doc.setFillColor(...gold);
      doc.circle(30, 30, 17, "F");
      doc.setFillColor(25, 25, 35);
      doc.circle(30, 30, 15.5, "F");
      doc.addImage(dataUrl, "PNG", 15, 15, 30, 30, undefined, "FAST");
      avatarLoaded = true;
    } catch {}
  }
  if (!avatarLoaded) {
    doc.setFillColor(...mid);
    doc.circle(30, 30, 17, "F");
    doc.setFontSize(16);
    doc.setTextColor(...gold);
    const initials = (profile.nickname || profile.display_name || "?")[0].toUpperCase();
    doc.text(initials, 30, 33, { align: "center" });
  }

  // Name & handle
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text(profile.nickname || profile.display_name || "Unknown", 55, 25);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...light);
  doc.text(`@${profile.nickname || profile.display_name}`, 55, 33);

  // Level badge
  const level = (profile.level || "beginner").toUpperCase();
  doc.setFillColor(...gold);
  doc.roundedRect(55, 37, level.length * 3.5 + 10, 8, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(level, 60, 43);

  // CodeArena label top-right
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gold);
  doc.text("CodeArena", W - 15, 12, { align: "right" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...light);
  doc.text("Player Resume", W - 15, 18, { align: "right" });

  // Date
  const now = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFontSize(7);
  doc.setTextColor(...light);
  doc.text(`Сформировано: ${now}`, W - 15, 24, { align: "right" });

  let y = 72;

  // ── Stats row ──
  const stats = [
    { label: "PTS", value: String(profile.pts ?? 0) },
    { label: "Задач решено", value: String(completedTasks.length) },
    { label: "Навыков", value: String(skillChips.filter(s => s.type === "skill").length) },
    { label: "Уровень", value: profile.level || "beginner" },
  ];
  const colW = (W - 30) / stats.length;
  stats.forEach((stat, i) => {
    const x = 15 + i * colW;
    doc.setFillColor(30, 30, 42);
    doc.roundedRect(x, y, colW - 4, 22, 3, 3, "F");
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gold);
    doc.text(stat.value, x + (colW - 4) / 2, y + 11, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...light);
    doc.text(stat.label, x + (colW - 4) / 2, y + 18, { align: "center" });
  });
  y += 30;

  // ── Bio ──
  if (profile.bio) {
    doc.setFillColor(25, 25, 35);
    doc.roundedRect(15, y, W - 30, 2, 1, 1, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gold);
    doc.text("О СЕБЕ", 15, y + 8);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...white);
    const bioLines = doc.splitTextToSize(profile.bio, W - 30);
    doc.text(bioLines, 15, y + 16);
    y += 16 + bioLines.length * 5 + 8;
  }

  // ── Section divider helper ──
  function sectionHeader(label, yPos) {
    doc.setFillColor(...gold);
    doc.rect(15, yPos, 3, 6, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(label, 21, yPos + 5);
    doc.setDrawColor(...mid);
    doc.setLineWidth(0.3);
    doc.line(21 + doc.getTextWidth(label) + 4, yPos + 3, W - 15, yPos + 3);
    return yPos + 12;
  }

  // ── Skills ──
  if (skillChips.length > 0) {
    y = sectionHeader("НАВЫКИ И РОЛЬ", y);
    let sx = 15;
    skillChips.forEach((skill) => {
      const label = skill.type === "skill"
        ? `${skill.label}  ${skill.proficiency}/5`
        : `${skill.label}  РОЛЬ`;
      const tw = doc.getTextWidth(label) + 10;
      if (sx + tw > W - 15) { sx = 15; y += 9; }
      doc.setFillColor(skill.type === "role" ? 40 : 30, skill.type === "role" ? 30 : 35, skill.type === "role" ? 55 : 50);
      doc.roundedRect(sx, y - 5, tw, 7, 2, 2, "F");
      doc.setDrawColor(skill.type === "role" ? 120 : 80, skill.type === "role" ? 80 : 100, skill.type === "role" ? 200 : 150);
      doc.setLineWidth(0.3);
      doc.roundedRect(sx, y - 5, tw, 7, 2, 2, "S");
      doc.setFontSize(7);
      doc.setFont("helvetica", skill.type === "role" ? "bold" : "normal");
      doc.setTextColor(...white);
      doc.text(label, sx + 5, y);
      sx += tw + 4;
    });
    y += 14;
  }

  // ── Completed tasks ──
  if (completedTasks.length > 0) {
    y = sectionHeader("ВЫПОЛНЕННЫЕ ЗАДАЧИ", y);
    completedTasks.slice(0, 15).forEach((task, i) => {
      if (y > 270) return;
      // Row bg alternating
      if (i % 2 === 0) {
        doc.setFillColor(25, 25, 35);
        doc.rect(15, y - 4, W - 30, 8, "F");
      }
      // Green checkmark
      doc.setFillColor(...green);
      doc.circle(21, y, 2.5, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text("✓", 19.5, y + 1);
      // Task title
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...white);
      const title = doc.splitTextToSize(task.title, W - 50)[0];
      doc.text(title, 27, y + 1);
      // Task number
      doc.setFontSize(7);
      doc.setTextColor(...light);
      doc.text(`#${task.taskId}`, W - 15, y + 1, { align: "right" });
      y += 9;
    });
    if (completedTasks.length > 15) {
      doc.setFontSize(8);
      doc.setTextColor(...light);
      doc.text(`+ ещё ${completedTasks.length - 15} задач`, 15, y + 4);
      y += 10;
    }
  }

  // ── Footer ──
  doc.setFillColor(...mid);
  doc.rect(0, 285, W, 12, "F");
  doc.setFillColor(...gold);
  doc.rect(0, 285, W, 1, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...light);
  doc.text("CodeArena — платформа для разработчиков", 15, 292);
  doc.setTextColor(...gold);
  doc.text("xehrf-github-io.vercel.app", W - 15, 292, { align: "right" });

  const filename = `resume_${(profile.nickname || profile.display_name || "user").replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
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
  const bannerBackground =
    u.banner_url ||
    "linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))";
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

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Профиль</h1>
          <p className="mt-1 text-sm text-muted">@{u.nickname || u.display_name}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={generatingPdf}
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
            className="h-12 justify-center rounded-[12px] px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ background: "#FFD600", color: "#111" }}
          >
            {generatingPdf ? "Генерируем..." : "⬇ Скачать резюме"}
          </button>
          <LinkButton
            to="/profile/edit"
            className="h-12 justify-center rounded-[12px] px-5 py-2.5 text-sm"
          >
            Редактировать профиль
          </LinkButton>
        </div>
      </div>

      <Card className="overflow-hidden border-border">
        <div className="relative h-56 bg-slate-950/80 sm:h-72">
          {showBanner ? (
            <img
              src={bannerUrl}
              alt="Banner"
              className="h-full w-full object-cover"
              onError={() => setBannerLoadError(true)}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: bannerBackground }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-end p-4">
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs uppercase tracking-wide text-white">
              {u.level}
            </span>
          </div>
          <div className="absolute left-6 bottom-[-40px] flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-slate-950 bg-slate-800 shadow-xl">
            {showAvatar ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-full w-full object-cover"
                onError={() => setAvatarLoadError(true)}
              />
            ) : (
              <span className="text-4xl font-bold text-white">
                {u.nickname?.[0]?.toUpperCase() ?? u.display_name?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 px-6 pb-6 pt-16 sm:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{u.nickname || u.display_name}</h2>
              <p className="text-sm text-muted">{u.display_name}</p>
            </div>
          </div>
          {u.bio ? (
            <p className="rounded-3xl border border-border bg-canvas px-4 py-4 text-sm leading-6 text-foreground">
              {u.bio}
            </p>
          ) : (
            <p className="rounded-3xl border border-dashed border-border bg-elevated/50 px-4 py-4 text-sm text-muted">
              Описание профиля отсутствует. Добавьте его в настройках.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border bg-canvas p-4">
              <div className="text-xs uppercase tracking-wider text-muted">PTS</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">{u.pts}</div>
            </div>
            <div className="rounded-3xl border border-border bg-canvas p-4">
              <div className="text-xs uppercase tracking-wider text-muted">Уровень</div>
              <div className="mt-2 text-2xl font-semibold capitalize text-foreground">{u.level}</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Навыки</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {skillChips.length === 0 ? (
              <li className="rounded-full border border-dashed border-border bg-elevated/50 px-3 py-1.5 text-sm text-muted">
                Навыки пока не добавлены
              </li>
            ) : (
              skillChips.map((s) => (
                <li
                  key={s.key}
                  className="rounded-full border border-border bg-canvas px-3 py-1.5 text-sm text-foreground transition hover:border-accent/40"
                >
                  <span className="font-medium">{s.label}</span>
                  {s.type === "skill" ? (
                    <>
                      <span className="ml-2 text-muted">·</span>
                      <span className="ml-2 text-accent">{s.proficiency}/5</span>
                    </>
                  ) : (
                    <span className="ml-2 text-xs uppercase tracking-wider text-accent/90">роль</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Выполненные задачи</h2>
          {completedTasks.length === 0 ? (
            <div className="mt-4 rounded-card border border-dashed border-border bg-elevated/50 px-4 py-6 text-sm text-muted">
              Пока нет засчитанных решений. Решай solo-задачи на вкладке «Задачи».
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {completedTasks.map((row) => (
                <li key={row.taskId}>
                  <Link
                    to={`/tasks/${row.taskId}/solve`}
                    className="flex items-center justify-between rounded-[10px] border border-border bg-canvas px-3 py-3 text-sm text-foreground transition-colors active:scale-[0.99] md:hover:border-accent/40"
                  >
                    <span className="font-medium">{row.title}</span>
                    <span className="text-xs text-accent">✓</span>
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
