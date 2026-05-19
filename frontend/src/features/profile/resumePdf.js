import { jsPDF } from "jspdf";
import * as html2canvasModule from "html2canvas";
import { resolveAssetUrl } from "../../api/client";

const RESUME_WIDTH_PX = 794;
const RESUME_BACKGROUND = "#0f0f14";
const PDF_PAGE_WIDTH_MM = 210;
const PDF_PAGE_HEIGHT_MM = 297;
const PDF_IMAGE_FORMAT = "JPEG";
const PDF_IMAGE_QUALITY = 0.98;

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getPdfPageHeightPx(canvasWidth) {
  const safeCanvasWidth = Math.max(1, Math.floor(Number(canvasWidth) || 0));
  return Math.max(1, Math.floor((PDF_PAGE_HEIGHT_MM * safeCanvasWidth) / PDF_PAGE_WIDTH_MM));
}

export function getCanvasSliceHeights(canvasHeight, pageHeightPx) {
  const safeCanvasHeight = Math.max(0, Math.floor(Number(canvasHeight) || 0));
  const safePageHeight = Math.max(1, Math.floor(Number(pageHeightPx) || 0));
  const slices = [];

  for (let srcY = 0; srcY < safeCanvasHeight; srcY += safePageHeight) {
    const height = Math.min(safePageHeight, safeCanvasHeight - srcY);
    if (height <= 0) break;
    slices.push({ srcY, height });
  }

  return slices;
}

function buildResumeHtml(profile, completedTasks, skillChips) {
  const avatarUrl = resolveAssetUrl(profile.avatar_url || "");
  const now = new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  const displayName = escapeHtml(profile.nickname || profile.display_name || "Unknown");
  const username = escapeHtml(profile.nickname || profile.display_name || "unknown");
  const level = escapeHtml(profile.level || "beginner");
  const avatarInitial = escapeHtml((profile.nickname || profile.display_name || "?")[0]?.toUpperCase() || "?");
  const safeBio = escapeHtml(profile.bio || "");
  const safeAvatarUrl = escapeHtml(avatarUrl);

  return `
    <div style="
      width: ${RESUME_WIDTH_PX}px;
      min-height: 1123px;
      background: ${RESUME_BACKGROUND};
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #fff;
      position: relative;
      box-sizing: border-box;
    ">
      <div style="background: #191923; padding: 32px 40px 28px; position: relative; border-bottom: 3px solid #FFD600;">
        <div style="position: absolute; top: 20px; right: 40px; text-align: right;">
          <div style="color: #FFD600; font-size: 14px; font-weight: 700; letter-spacing: 1px;">CodeArena</div>
          <div style="color: #888; font-size: 11px; margin-top: 2px;">Player Resume</div>
          <div style="color: #666; font-size: 10px; margin-top: 4px;">Сформировано: ${escapeHtml(now)}</div>
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
            ${safeAvatarUrl
              ? `<img src="${safeAvatarUrl}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" referrerpolicy="no-referrer" />`
              : avatarInitial
            }
          </div>
          <div>
            <div style="font-size: 30px; font-weight: 700; color: #fff; line-height: 1.1;">
              ${displayName}
            </div>
            <div style="font-size: 13px; color: #aaa; margin-top: 4px;">
              @${username}
            </div>
            <div style="
              display: inline-block;
              background: #FFD600; color: #111;
              font-size: 10px; font-weight: 700;
              letter-spacing: 1px; text-transform: uppercase;
              padding: 4px 14px; border-radius: 20px; margin-top: 10px;
            ">${level}</div>
          </div>
        </div>
      </div>

      <div style="padding: 28px 40px;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px;">
          ${[
            { label: "PTS", value: profile.pts ?? 0 },
            { label: "Задач решено", value: completedTasks.length },
            { label: "Навыков", value: skillChips.filter((item) => item.type === "skill").length },
            { label: "Уровень", value: profile.level || "beginner" },
          ].map((stat) => `
            <div style="background: #1e1e2a; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #2a2a3a;">
              <div style="font-size: 24px; font-weight: 700; color: #FFD600;">${escapeHtml(stat.value)}</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">${escapeHtml(stat.label)}</div>
            </div>
          `).join("")}
        </div>

        ${safeBio ? `
        <div style="margin-bottom: 28px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="width: 4px; height: 18px; background: #FFD600; border-radius: 2px;"></div>
            <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #fff; text-transform: uppercase;">О себе</div>
            <div style="flex: 1; height: 1px; background: #2a2a3a;"></div>
          </div>
          <div style="background: #191923; border-radius: 10px; padding: 14px 18px; font-size: 13px; color: #ccc; line-height: 1.7; border: 1px solid #2a2a3a; white-space: pre-wrap;">
            ${safeBio}
          </div>
        </div>
        ` : ""}

        ${skillChips.length > 0 ? `
        <div style="margin-bottom: 28px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="width: 4px; height: 18px; background: #FFD600; border-radius: 2px;"></div>
            <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #fff; text-transform: uppercase;">Навыки и роль</div>
            <div style="flex: 1; height: 1px; background: #2a2a3a;"></div>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${skillChips.map((item) => `
              <div style="
                padding: 6px 14px; border-radius: 20px;
                background: ${item.type === "role" ? "rgba(99,102,241,0.2)" : "rgba(255,214,0,0.1)"};
                border: 1px solid ${item.type === "role" ? "rgba(99,102,241,0.5)" : "rgba(255,214,0,0.3)"};
                font-size: 12px; color: ${item.type === "role" ? "#a5b4fc" : "#FFD600"};
                font-weight: ${item.type === "role" ? "700" : "400"};
              ">
                ${escapeHtml(item.label)}${item.type === "skill" ? ` <span style="opacity:0.6; font-size:11px;">${escapeHtml(item.proficiency)}/5</span>` : " <span style='font-size:10px;opacity:0.7;'>РОЛЬ</span>"}
              </div>
            `).join("")}
          </div>
        </div>
        ` : ""}

        ${completedTasks.length > 0 ? `
        <div>
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="width: 4px; height: 18px; background: #FFD600; border-radius: 2px;"></div>
            <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; color: #fff; text-transform: uppercase;">Выполненные задачи</div>
            <div style="flex: 1; height: 1px; background: #2a2a3a;"></div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${completedTasks.map((task, index) => `
              <div style="
                display: flex; align-items: center; justify-content: space-between;
                padding: 10px 14px; border-radius: 8px;
                background: ${index % 2 === 0 ? "#191923" : "transparent"};
                border: 1px solid ${index % 2 === 0 ? "#2a2a3a" : "transparent"};
              ">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="
                    width: 20px; height: 20px; border-radius: 50%;
                    background: #4ade80;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 11px; font-weight: 700; color: #111; flex-shrink: 0;
                  ">✓</div>
                  <div style="font-size: 13px; color: #e5e5e5;">${escapeHtml(task.title)}</div>
                </div>
                <div style="font-size: 11px; color: #555; flex-shrink: 0;">#${escapeHtml(task.taskId)}</div>
              </div>
            `).join("")}
          </div>
        </div>
        ` : ""}
      </div>

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
}

async function waitForImages(rootNode) {
  const images = Array.from(rootNode.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }

          let timeoutId = 0;
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            window.clearTimeout(timeoutId);
            resolve();
          };

          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          timeoutId = window.setTimeout(done, 4000);
        }),
    ),
  );
}

function createPdfPageCanvas(sourceCanvas, slice) {
  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = sourceCanvas.width;
  pageCanvas.height = slice.height;

  const context = pageCanvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare PDF page canvas.");
  }

  context.fillStyle = RESUME_BACKGROUND;
  context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  context.drawImage(
    sourceCanvas,
    0,
    slice.srcY,
    sourceCanvas.width,
    slice.height,
    0,
    0,
    pageCanvas.width,
    pageCanvas.height,
  );

  return pageCanvas;
}

export async function generateResumePDF(profile, completedTasks, skillChips) {
  const html = buildResumeHtml(profile, completedTasks, skillChips);
  const container = document.createElement("div");
  container.style.cssText = `position:absolute;left:0;top:0;z-index:-9999;opacity:0;pointer-events:none;width:${RESUME_WIDTH_PX}px;`;
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const resumeNode = container.firstElementChild;
    if (!resumeNode) {
      throw new Error("Could not render resume content.");
    }

    await waitForImages(resumeNode);
    await new Promise((resolve) => window.setTimeout(resolve, 200));

    const h2c = html2canvasModule.default ?? html2canvasModule;
    const canvas = await h2c(resumeNode, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: RESUME_BACKGROUND,
      logging: false,
      windowWidth: RESUME_WIDTH_PX,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageHeightPx = getPdfPageHeightPx(canvas.width);
    const slices = getCanvasSliceHeights(canvas.height, pageHeightPx);
    if (slices.length === 0) {
      throw new Error("Resume canvas is empty.");
    }

    slices.forEach((slice, index) => {
      if (index > 0) {
        pdf.addPage();
      }

      const pageCanvas =
        slices.length === 1 ? canvas : createPdfPageCanvas(canvas, slice);
      const pageHeightMm = (slice.height * PDF_PAGE_WIDTH_MM) / pageCanvas.width;
      pdf.addImage(pageCanvas, PDF_IMAGE_FORMAT, 0, 0, PDF_PAGE_WIDTH_MM, pageHeightMm, undefined, "FAST");
    });

    const filename = `resume_${(profile.nickname || profile.display_name || "user").replace(/\s+/g, "_")}.pdf`;
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
