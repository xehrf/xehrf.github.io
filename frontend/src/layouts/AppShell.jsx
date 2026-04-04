import { Outlet } from "react-router-dom";
import { Navbar } from "../components/layout/Navbar.jsx";
import { MobileHeader } from "../components/layout/MobileHeader.jsx";
import { BottomNav } from "../components/layout/BottomNav.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";

export function AppShell() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-foreground">
      <div className="hidden md:block">
        <Navbar user={user} />
      </div>
      <MobileHeader user={user} />
      <main className="min-h-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>
      {user ? <BottomNav /> : null}
    </div>
  );
}
