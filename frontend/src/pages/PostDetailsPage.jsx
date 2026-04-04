import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";

export function PostDetailsPage() {
  const { id } = useParams();
  const { user, refreshMe } = useAuth();
  const [post, setPost] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [message, setMessage] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [resultText, setResultText] = useState("");
  const [contract, setContract] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  async function loadAll() {
    try {
      setError("");
      const p = await apiFetch(`/posts/${id}`);
      setPost(p);
      if (user && p.client_id === user.id) {
        const pr = await apiFetch(`/posts/${id}/proposals`);
        setProposals(pr);
      }
      const myContracts = await apiFetch("/contracts/my");
      const c = myContracts.find((x) => Number(x.post_id) === Number(id));
      setContract(c ?? null);
    } catch (e) {
      setError(e?.message || "Ошибка загрузки");
    }
  }

  useEffect(() => {
    if (user) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  async function apply() {
    try {
      await apiFetch(`/posts/${id}/apply`, { method: "POST", body: { message, portfolio_url: portfolio || null } });
      setMessage("");
      setPortfolio("");
      await loadAll();
    } catch (e) {
      setError(e?.message || "Не удалось откликнуться");
    }
  }

  async function acceptProposal(proposalId) {
    try {
      await apiFetch(`/proposals/${proposalId}/accept`, { method: "POST" });
      await loadAll();
    } catch (e) {
      setError(e?.message || "Не удалось выбрать исполнителя");
    }
  }

  async function submitWork() {
    try {
      await apiFetch(`/contracts/${contract.id}/submit`, { method: "POST", body: { result_text: resultText } });
      setResultText("");
      await loadAll();
    } catch (e) {
      setError(e?.message || "Не удалось отправить результат");
    }
  }

  async function completeContract() {
    try {
      await apiFetch(`/contracts/${contract.id}/complete`, { method: "POST", body: { rating: Number(rating), comment } });
      setComment("");
      await loadAll();
      await refreshMe();
    } catch (e) {
      setError(e?.message || "Не удалось завершить контракт");
    }
  }

  if (!post) return <div className="mx-auto max-w-[430px] px-4 py-8 text-sm text-muted md:max-w-4xl">Загрузка...</div>;

  const isClient = user && post.client_id === user.id;
  const isDeveloper = user && contract && contract.developer_id === user.id;

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-4xl md:px-6 md:py-8">
      <Card>
        <h1 className="text-2xl font-bold text-foreground">{post.title}</h1>
        <p className="mt-3 text-sm text-muted whitespace-pre-wrap">{post.description}</p>
        <div className="mt-3 text-sm text-muted">Стек: <span className="text-foreground">{post.tech_stack}</span></div>
        <div className="mt-1 text-sm text-muted">Бюджет: <span className="text-accent">{post.budget}</span></div>
        <div className="mt-1 text-sm text-muted">Статус: <span className="text-foreground">{post.status}</span></div>
      </Card>

      {error ? <Card className="mt-4 text-sm text-accent">{error}</Card> : null}

      {!isClient && post.status === "open" ? (
        <Card className="mt-4">
          <h2 className="text-lg font-semibold text-foreground">Откликнуться</h2>
          <textarea className="mt-3 min-h-[120px] w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground" placeholder="Сообщение клиенту" value={message} onChange={(e) => setMessage(e.target.value)} />
          <input className="mt-3 w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground" placeholder="Портфолио URL (необязательно)" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} />
          <Button className="mt-3 h-12 w-full rounded-[12px] md:h-auto md:w-auto md:rounded-btn" onClick={apply}>
            Откликнуться
          </Button>
        </Card>
      ) : null}

      {isClient ? (
        <Card className="mt-4">
          <h2 className="text-lg font-semibold text-foreground">Отклики</h2>
          <div className="mt-3 grid gap-3">
            {proposals.map((p) => (
              <div key={p.id} className="rounded-btn border border-border bg-canvas p-3">
                <div className="text-sm text-muted">Developer #{p.developer_id}</div>
                <div className="mt-1 text-sm text-foreground">{p.message}</div>
                {p.portfolio_url ? <div className="mt-1 text-xs text-accent">{p.portfolio_url}</div> : null}
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-muted">Статус: {p.status}</span>
                  {post.status === "open" ? (
                    <Button className="h-11 w-full rounded-[12px] sm:h-auto sm:w-auto sm:rounded-btn" onClick={() => acceptProposal(p.id)}>
                      Выбрать
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {contract ? (
        <Card className="mt-4">
          <h2 className="text-lg font-semibold text-foreground">Контракт #{contract.id}</h2>
          <p className="mt-1 text-sm text-muted">Статус: {contract.status}</p>
          {contract.result_text ? <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{contract.result_text}</p> : null}

          {isDeveloper && contract.status === "active" ? (
            <div className="mt-3">
              <textarea className="min-h-[120px] w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground" placeholder="Опишите результат и приложите детали" value={resultText} onChange={(e) => setResultText(e.target.value)} />
              <Button className="mt-3 h-12 w-full rounded-[12px] md:h-auto md:w-auto md:rounded-btn" onClick={submitWork}>
                Отправить результат
              </Button>
            </div>
          ) : null}

          {isClient && contract.status === "submitted" ? (
            <div className="mt-3 grid gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted">Оценка:</label>
                <select value={rating} onChange={(e) => setRating(e.target.value)} className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground">
                  <option value={5}>5</option>
                  <option value={4}>4</option>
                  <option value={3}>3</option>
                  <option value={2}>2</option>
                  <option value={1}>1</option>
                </select>
              </div>
              <textarea className="min-h-[80px] w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground" placeholder="Комментарий (необязательно)" value={comment} onChange={(e) => setComment(e.target.value)} />
              <Button className="h-12 w-full rounded-[12px] md:h-auto md:w-auto md:rounded-btn" onClick={completeContract}>
                Подтвердить выполнение
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

