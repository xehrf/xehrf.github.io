import { useEffect, useMemo, useState } from "react";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  getContractStatusMeta,
  getPostStatusMeta,
} from "../utils/freelanceStatus.js";

const ROLE_OPTIONS = [
  { value: "", label: "Все роли" },
  { value: "client", label: "Как клиент" },
  { value: "developer", label: "Как разработчик" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "active", label: "В работе" },
  { value: "submitted", label: "Отправлен" },
  { value: "completed", label: "Завершён" },
];

function ProgressBar({ percent }) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className="h-2 rounded-full bg-canvas">
      <div
        className="h-full rounded-full bg-accent transition-all duration-300"
        style={{ width: `${safePercent}%` }}
      />
    </div>
  );
}

export function MyJobsPage() {
  const [contracts, setContracts] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      const roleQuery = params.toString();
      const [contractsData, postsData] = await Promise.all([
        apiFetch(`/contracts/my${roleQuery ? `?${roleQuery}` : ""}`),
        apiFetch("/posts/my"),
      ]);
      setContracts(Array.isArray(contractsData) ? contractsData : []);
      setMyPosts(Array.isArray(postsData) ? postsData : []);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const filteredContracts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (statusFilter && contract.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const target = [
        contract.post_title,
        contract.client_display_name,
        contract.developer_display_name,
        String(contract.post_id ?? ""),
        String(contract.id ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return target.includes(normalizedSearch);
    });
  }, [contracts, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: filteredContracts.length,
      active: filteredContracts.filter((item) => item.status === "active").length,
      submitted: filteredContracts.filter((item) => item.status === "submitted").length,
      completed: filteredContracts.filter((item) => item.status === "completed").length,
    };
  }, [filteredContracts]);

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 py-6 md:max-w-5xl md:px-6 md:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Мои заказы</h1>
          <p className="mt-1 text-sm text-muted">Отслеживайте все свои контракты и созданные заказы.</p>
        </div>
        <LinkButton to="/freelance" variant="secondary" className="h-11 rounded-[12px] px-4 py-2 md:rounded-btn">
          Каталог фриланса
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Всего</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">В работе</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Отправлено</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.submitted}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Завершено</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.completed}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по заказу, участнику, id"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground transition hover:border-accent/50 hover:text-accent"
            onClick={loadData}
          >
            Обновить
          </button>
        </div>
      </Card>

      {loading ? <Card className="text-sm text-muted">Загрузка...</Card> : null}
      {error ? <Card className="text-sm text-accent">{error}</Card> : null}

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-foreground">Мои заказы</h2>
        {myPosts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Вы пока не создали ни одного заказа.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {myPosts.map((post) => {
              const statusMeta = getPostStatusMeta(post.status);
              return (
                <div key={post.id} className="rounded-btn border border-border bg-canvas p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-foreground">{post.title}</h3>
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wide",
                        statusMeta.badgeClass,
                      ].join(" ")}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-muted sm:grid-cols-2">
                    <p>
                      Бюджет: <span className="text-foreground">{formatMoney(post.budget)}</span>
                    </p>
                    <p>
                      Дедлайн: <span className="text-foreground">{formatDate(post.deadline)}</span>
                    </p>
                    <p>
                      Отклики: <span className="text-foreground">{post.proposals_count ?? 0}</span>
                    </p>
                    <p>
                      Создан: <span className="text-foreground">{formatDateTime(post.created_at)}</span>
                    </p>
                  </div>
                  <LinkButton
                    to={`/freelance/posts/${post.id}`}
                    variant="secondary"
                    className="mt-3 h-11 w-full justify-center rounded-[12px] sm:h-auto sm:w-auto sm:rounded-btn"
                  >
                    Открыть заказ
                  </LinkButton>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-foreground">Мои контракты</h2>
        {filteredContracts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Нет контрактов по текущим фильтрам.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {filteredContracts.map((contract) => {
              const statusMeta = getContractStatusMeta(contract.status);
              return (
                <div key={contract.id} className="rounded-btn border border-border bg-canvas p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-foreground">
                        {contract.post_title || `Заказ #${contract.post_id}`}
                      </h3>
                      <p className="mt-1 text-xs text-muted">Контракт #{contract.id}</p>
                    </div>
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wide",
                        statusMeta.badgeClass,
                      ].join(" ")}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1 text-sm text-muted sm:grid-cols-2">
                    <p>
                      Клиент: <span className="text-foreground">{contract.client_display_name || contract.client_id}</span>
                    </p>
                    <p>
                      Разработчик:{" "}
                      <span className="text-foreground">
                        {contract.developer_display_name || contract.developer_id}
                      </span>
                    </p>
                    <p>
                      Бюджет: <span className="text-foreground">{formatMoney(contract.post_budget || 0)}</span>
                    </p>
                    <p>
                      Создан: <span className="text-foreground">{formatDateTime(contract.created_at)}</span>
                    </p>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-muted">
                      <span>Прогресс</span>
                      <span>{statusMeta.progress}%</span>
                    </div>
                    <ProgressBar percent={statusMeta.progress} />
                  </div>

                  <LinkButton
                    to={`/freelance/posts/${contract.post_id}`}
                    variant="secondary"
                    className="mt-3 h-11 w-full justify-center rounded-[12px] sm:h-auto sm:w-auto sm:rounded-btn"
                  >
                    Открыть контракт
                  </LinkButton>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
