import { useEffect, useState } from "react";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

export function FreelancePage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [tech, setTech] = useState("");
  const [status, setStatus] = useState("");

  async function loadPosts() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (minBudget) params.set("min_budget", minBudget);
      if (maxBudget) params.set("max_budget", maxBudget);
      if (tech) params.set("tech", tech);
      if (status) params.set("status", status);
      const query = params.toString();
      const data = await apiFetch(`/posts${query ? `?${query}` : ""}`);
      setPosts(data);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить публикации");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Публикации</h1>
          <p className="mt-1 text-sm text-muted">Заказы и отклики для junior-разработчиков</p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <LinkButton to="/freelance/create" className="h-12 justify-center rounded-[12px] py-3 md:h-auto md:rounded-btn md:py-2.5">
            Создать публикацию
          </LinkButton>
          <LinkButton
            to="/freelance/my-jobs"
            variant="secondary"
            className="h-12 justify-center rounded-[12px] py-3 md:h-auto md:rounded-btn md:py-2.5"
          >
            Мои задачи
          </LinkButton>
        </div>
      </div>

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input value={minBudget} onChange={(e) => setMinBudget(e.target.value)} placeholder="Мин. бюджет" className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground" />
          <input value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} placeholder="Макс. бюджет" className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground" />
          <input value={tech} onChange={(e) => setTech(e.target.value)} placeholder="Технология (Python)" className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground">
            <option value="">Все статусы</option>
            <option value="open">open</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
          </select>
          <Button onClick={loadPosts} className="h-12 w-full rounded-[12px] md:h-auto md:w-auto md:rounded-btn">
            Фильтровать
          </Button>
        </div>
      </Card>

      {loading ? <Card className="text-sm text-muted">Загрузка...</Card> : null}
      {error ? <Card className="text-sm text-accent">{error}</Card> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {posts.map((post) => (
          <Card key={post.id} className="p-5">
            <h2 className="text-lg font-semibold text-foreground">{post.title}</h2>
            <p className="mt-2 text-sm text-muted line-clamp-3">{post.description}</p>
            <div className="mt-3 text-sm text-muted">Стек: <span className="text-foreground">{post.tech_stack}</span></div>
            <div className="mt-1 text-sm text-muted">Бюджет: <span className="text-accent">{post.budget}</span></div>
            <div className="mt-1 text-sm text-muted">Статус: <span className="text-foreground">{post.status}</span></div>
            <div className="mt-4">
              <LinkButton
                to={`/freelance/posts/${post.id}`}
                className="h-12 w-full justify-center rounded-[12px] py-3 text-base md:h-auto md:w-auto md:rounded-btn md:text-sm"
              >
                Откликнуться
              </LinkButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

