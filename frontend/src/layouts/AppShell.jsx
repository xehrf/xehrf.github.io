import { Outlet } from "react-router-dom";
import { AsciiVideoBackground } from "../components/AsciiVideoBackground.jsx";
import { Navbar } from "../components/layout/Navbar.jsx";
import { MobileHeader } from "../components/layout/MobileHeader.jsx";
import { BottomNav } from "../components/layout/BottomNav.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { resolveAssetUrl } from "../api/client";

export function AppShell() {
  const { user } = useAuth();

  // Global ASCII/Matrix-style background driven by the user's uploaded video.
  // Mounted at the layout level so it persists across route changes (no
  // remount, no flash). Opacity dialed back so foreground text stays readable
  // across every page — not only the profile.
  const bgVideoUrl = user?.bg_video_url ? resolveAssetUrl(user.bg_video_url) : null;

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-canvas text-foreground">
      {bgVideoUrl ? (
        <AsciiVideoBackground
          videoUrl={bgVideoUrl}
          opacity={0.24}
          cellPx={18}
          symbolScale={0.6}
          densityScale={1}
          fps={12}
          variableSizing={false}
          renderDpr={1}
          maxCols={104}
          maxRows={58}
        />
      ) : null}
      <div className="relative z-10 hidden md:block">
        <Navbar user={user} />
      </div>
      <div className="relative z-10">
        <MobileHeader user={user} />
      </div>
      <main className="relative z-10 min-h-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
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
