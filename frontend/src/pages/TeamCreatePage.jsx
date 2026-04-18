import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { apiFetch } from "../api/client";

export function TeamCreatePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/team", {
        method: "POST",
        body: { name },
      });
      navigate("/team");
    } catch (err) {
      setError(err?.message || "Не удалось создать команду");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold text-foreground">Создать команду</h1>
        <p className="mt-1 text-sm text-muted">Придумайте название и начните собирать состав.</p>
        <form className="mt-5 space-y-4" onSubmit={handleCreate}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl border border-border bg-canvas px-4 py-3 text-sm text-foreground"
            placeholder="Название команды"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Создаем..." : "Создать"}
          </Button>
        </form>
        {error ? <div className="mt-3 text-sm text-accent">{error}</div> : null}
      </Card>
    </div>
  );
}
