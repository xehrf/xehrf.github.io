import { useEffect, useState } from "react";
import { LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

export function MyJobsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch("/contracts/my");
        if (mounted) setContracts(data);
      } catch (e) {
        if (mounted) setError(e?.message || "Не удалось загрузить контракты");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-4xl md:px-6 md:py-8">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Мои контракты</h1>
      {loading ? <Card className="text-sm text-muted">Загрузка...</Card> : null}
      {error ? <Card className="text-sm text-accent">{error}</Card> : null}
      <div className="grid gap-3">
        {contracts.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="text-sm text-muted">Контракт #{c.id}</div>
            <div className="mt-1 text-sm text-foreground">Post #{c.post_id}</div>
            <div className="mt-1 text-sm text-muted">Статус: {c.status}</div>
            <LinkButton
              to={`/freelance/posts/${c.post_id}`}
              variant="secondary"
              className="mt-3 h-11 w-full justify-center rounded-[12px] md:h-auto md:w-auto md:rounded-btn"
            >
              Открыть задачу
            </LinkButton>
          </Card>
        ))}
      </div>
    </div>
  );
}

