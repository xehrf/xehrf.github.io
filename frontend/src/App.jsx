import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { FreelancePage } from "./pages/FreelancePage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { MatchmakingPage } from "./pages/MatchmakingPage.jsx";
import { CreatePostPage } from "./pages/CreatePostPage.jsx";
import { MyJobsPage } from "./pages/MyJobsPage.jsx";
import { OAuthCallbackPage } from "./pages/OAuthCallbackPage.jsx";
import { PostDetailsPage } from "./pages/PostDetailsPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { EditProfilePage } from "./pages/EditProfilePage.jsx";
import { TeamPage } from "./pages/TeamPage.jsx";
import { TeamPublicPage } from "./pages/TeamPublicPage.jsx";
import { TaskSolvePage } from "./pages/TaskSolvePage.jsx";
import { TeamCreatePage } from "./pages/TeamCreatePage.jsx";
import { TeamsPage } from "./pages/TeamsPage.jsx";
import { TaskDetailPage } from "./pages/TaskDetailPage.jsx";
import { RequireAuth } from "./auth/RequireAuth.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/freelance"
          element={
            <RequireAuth>
              <FreelancePage />
            </RequireAuth>
          }
        />
        <Route
          path="/freelance/create"
          element={
            <RequireAuth>
              <CreatePostPage />
            </RequireAuth>
          }
        />
        <Route
          path="/freelance/posts/:id"
          element={
            <RequireAuth>
              <PostDetailsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/freelance/my-jobs"
          element={
            <RequireAuth>
              <MyJobsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tasks/:taskId/solve"
          element={
            <RequireAuth>
              <TaskSolvePage />
            </RequireAuth>
          }
        />
        <Route
          path="/tasks/:taskId"
          element={
            <RequireAuth>
              <TaskDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/matchmaking"
          element={
            <RequireAuth>
              <MatchmakingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <RequireAuth>
              <Navigate to="/matchmaking?tab=leaderboard" replace />
            </RequireAuth>
          }
        />
        <Route
          path="/team"
          element={
            <RequireAuth>
              <TeamsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/team/current"
          element={
            <RequireAuth>
              <TeamPage />
            </RequireAuth>
          }
        />
        <Route
          path="/team/:teamId"
          element={
            <RequireAuth>
              <TeamPublicPage />
            </RequireAuth>
          }
        />
        <Route
          path="/teams"
          element={
            <RequireAuth>
              <Navigate to="/team" replace />
            </RequireAuth>
          }
        />
        <Route
          path="/team/create"
          element={
            <RequireAuth>
              <TeamCreatePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <RequireAuth>
              <EditProfilePage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
