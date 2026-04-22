import { useEffect, useMemo, useState } from "react";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { formatDate, formatMoney, getPostStatusMeta } from "../utils/freelanceStatus.js";

const INITIAL_FILTERS = {
  q: "",
  minBudget: "",
  maxBudget: "",
  tech: "",
  status: "",
};

export function FreelancePage() {
  const [posts, setPosts] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...INITIAL_FILTERS }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const openCount = useMemo(() => posts.filter((post) => post.status === "open").length, [posts]);
  const inProgressCount = useMemo(() => posts.filter((post) => post.status === "in_progress").length, [posts]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function loadPosts(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
      if (nextFilters.minBudget) params.set("min_budget", nextFilters.minBudget);
      if (nextFilters.maxBudget) params.set("max_budget", nextFilters.maxBudget);
      if (nextFilters.tech.trim()) params.set("tech", nextFilters.tech.trim());
      if (nextFilters.status) params.set("status", nextFilters.status);

      const query = params.toString();
      const data = await apiFetch(`/posts${query ? `?${query}` : ""}`);
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Failed to load freelance posts");
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    const cleared = { ...INITIAL_FILTERS };
    setFilters(cleared);
    loadPosts(cleared);
  }

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-6xl md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Freelance Jobs</h1>
          <p className="mt-1 text-sm text-muted">Find orders, send proposals, and track delivery in one place.</p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          <LinkButton
            to="/freelance/create"
            className="h-12 justify-center rounded-[12px] py-3 md:h-auto md:rounded-btn md:py-2.5"
          >
            Create post
          </LinkButton>
          <LinkButton
            to="/freelance/my-jobs"
            variant="secondary"
            className="h-12 justify-center rounded-[12px] py-3 md:h-auto md:rounded-btn md:py-2.5"
          >
            My jobs
          </LinkButton>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Total posts</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{posts.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Open</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{openCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">In progress</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{inProgressCount}</p>
        </Card>
      </div>

      <Card className="mb-6 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input
            value={filters.q}
            onChange={(e) => updateFilter("q", e.target.value)}
            placeholder="Search title or description"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          />
          <input
            value={filters.minBudget}
            onChange={(e) => updateFilter("minBudget", e.target.value)}
            placeholder="Min budget"
            type="number"
            min="0"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          />
          <input
            value={filters.maxBudget}
            onChange={(e) => updateFilter("maxBudget", e.target.value)}
            placeholder="Max budget"
            type="number"
            min="0"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          />
          <input
            value={filters.tech}
            onChange={(e) => updateFilter("tech", e.target.value)}
            placeholder="Technology (React, FastAPI)"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          />
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <Button onClick={loadPosts} className="h-12 rounded-[12px] md:h-auto md:rounded-btn">
              Filter
            </Button>
            <Button
              onClick={resetFilters}
              variant="secondary"
              className="h-12 rounded-[12px] md:h-auto md:rounded-btn"
            >
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {loading ? <Card className="text-sm text-muted">Loading posts...</Card> : null}
      {error ? <Card className="text-sm text-accent">{error}</Card> : null}

      {!loading && !error && posts.length === 0 ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground">No posts found</h2>
          <p className="mt-2 text-sm text-muted">
            Try relaxing filters or create the first post in this category.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {posts.map((post) => {
          const statusMeta = getPostStatusMeta(post.status);
          return (
            <Card key={post.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">{post.title}</h2>
                <span
                  className={[
                    "inline-flex rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wide",
                    statusMeta.badgeClass,
                  ].join(" ")}
                >
                  {statusMeta.label}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-muted">{post.description}</p>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-muted">
                  Stack: <span className="text-foreground">{post.tech_stack}</span>
                </p>
                <p className="text-muted">
                  Budget: <span className="text-accent">{formatMoney(post.budget)}</span>
                </p>
                <p className="text-muted">
                  Deadline: <span className="text-foreground">{formatDate(post.deadline)}</span>
                </p>
                <p className="text-muted">
                  Proposals: <span className="text-foreground">{post.proposals_count ?? 0}</span>
                </p>
              </div>
              <div className="mt-4">
                <LinkButton
                  to={`/freelance/posts/${post.id}`}
                  className="h-12 w-full justify-center rounded-[12px] py-3 text-base md:h-auto md:w-auto md:rounded-btn md:text-sm"
                >
                  View details
                </LinkButton>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
