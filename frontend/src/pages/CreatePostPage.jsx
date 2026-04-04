import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";

export function CreatePostPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const formattedDeadline = new Date(deadline).toISOString();
      const post = await apiFetch("/posts", {
        method: "POST",
        body: {
          title,
          description,
          tech_stack: techStack,
          budget: Number(budget),
          deadline: formattedDeadline,
        },
      });
      navigate(`/freelance/posts/${post.id}`);
    } catch (e) {
      setError(e?.message || "Не удалось создать публикацию");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-3xl md:px-6 md:py-8">
      <h1 className="mb-4 text-2xl font-bold text-foreground">Новая публикация</h1>
      <Card>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input className="h-12 rounded-[12px] border border-border bg-canvas px-3 text-sm text-foreground md:h-auto md:rounded-btn md:py-2" placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="min-h-[140px] rounded-[12px] border border-border bg-canvas px-3 py-3 text-sm text-foreground md:rounded-btn" placeholder="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="h-12 rounded-[12px] border border-border bg-canvas px-3 text-sm text-foreground md:h-auto md:rounded-btn md:py-2" placeholder="Tech stack (Python, FastAPI, Telegram Bot)" value={techStack} onChange={(e) => setTechStack(e.target.value)} />
          <input className="h-12 rounded-[12px] border border-border bg-canvas px-3 text-sm text-foreground md:h-auto md:rounded-btn md:py-2" placeholder="Бюджет" type="number" min="1" value={budget} onChange={(e) => setBudget(e.target.value)} />
          <input className="h-12 rounded-[12px] border border-border bg-canvas px-3 text-sm text-foreground md:h-auto md:rounded-btn md:py-2" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          {error ? <div className="text-sm text-accent">{error}</div> : null}
          <Button type="submit" disabled={submitting} className="h-12 w-full rounded-[12px] text-base md:h-auto md:rounded-btn md:text-sm">
            {submitting ? "Создаём..." : "Опубликовать"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

