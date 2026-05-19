import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { AsciiVideoBackground } from "../components/AsciiVideoBackground.jsx";
import { VideoBackground } from "../components/VideoBackground.jsx";
import {
  BG_MODE_ASCII,
  BG_MODE_PLAIN,
  BG_MODE_STORAGE_KEY,
  PAGE_BACKGROUND_PRESET,
  PLAIN_VIDEO_PAGE_PRESET,
  getStoredBgMode,
} from "../components/asciiBackgroundPresets.js";
import { Navbar } from "../components/layout/Navbar.jsx";
import { MobileHeader } from "../components/layout/MobileHeader.jsx";
import { BottomNav } from "../components/layout/BottomNav.jsx";
import { SocialSidebar } from "../components/layout/SocialSidebar.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { resolveAssetUrl } from "../api/client";

const SIDEBAR_COLLAPSED_KEY = "social_sidebar_collapsed";

export function AppShell() {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });
  const [bgMode, setBgMode] = useState(() => getStoredBgMode());

  // Listen for bg-mode changes from other tabs / EditProfilePage selector.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function syncMode(e) {
      if (e && e.key !== BG_MODE_STORAGE_KEY) return;
      setBgMode(getStoredBgMode());
    }
    window.addEventListener("storage", syncMode);
    window.addEventListener("bg-mode-change", syncMode);
    return () => {
      window.removeEventListener("storage", syncMode);
      window.removeEventListener("bg-mode-change", syncMode);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  // Global background driven by the user's uploaded video. Mounted at the
  // layout level so it persists across route changes (no remount, no flash).
  // Tuning is centralised in asciiBackgroundPresets so the settings preview
  // matches what users actually see live.
  const bgVideoUrl = user?.bg_video_url ? resolveAssetUrl(user.bg_video_url) : null;

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-canvas text-foreground">
      {bgVideoUrl && bgMode === BG_MODE_ASCII ? (
        <AsciiVideoBackground
          videoUrl={bgVideoUrl}
          {...PAGE_BACKGROUND_PRESET}
        />
      ) : null}
      {bgVideoUrl && bgMode === BG_MODE_PLAIN ? (
        <VideoBackground
          videoUrl={bgVideoUrl}
          {...PLAIN_VIDEO_PAGE_PRESET}
        />
      ) : null}
      <div className="sticky top-0 z-50 hidden md:block">
        <Navbar user={user} />
      </div>
      <div className="relative z-10">
        <MobileHeader user={user} />
      </div>
      {user ? (
        <SocialSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
      ) : null}
      <main
        className={[
          "relative z-10 min-h-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0",
          user && !sidebarCollapsed ? "md:pl-16" : "",
          user && sidebarCollapsed ? "md:pl-6" : "",
        ].join(" ")}
      >
        <Outlet />
      </main>
      {user ? (
        <div className="relative z-10">
          <BottomNav />
        </div>
      ) : null}
    </div>
  );
}
