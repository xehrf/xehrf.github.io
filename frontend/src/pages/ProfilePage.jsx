import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch, resolveAssetUrl } from "../api/client";
import { jsPDF } from "jspdf";
import * as html2canvasModule from "html2canvas";

async function generateResumePDF(profile, completedTasks, skillChips) {

  const avatarUrl = resolveAssetUrl(profile.avatar_url || "");
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
            ${avatarUrl
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
      {/* ASCII video background lives in <AppShell /> so it persists across
          every page — no per-page wiring needed here. */}
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
            {generatingPdf ? "Генерируем PDF..." : "⬇ Скачать резюме"}
          </button>
          <LinkButton to="/profile/edit" className="h-12 justify-center rounded-[12px] px-5 py-2.5 text-sm">
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
