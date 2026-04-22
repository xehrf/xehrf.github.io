import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { formatMoney } from "../utils/freelanceStatus.js";

function formatForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function nowPlusHours(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return formatForInput(date);
}

export function CreatePostPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState(() => nowPlusHours(24));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = useMemo(() => {
    if (title.trim().length < 3) return false;
    if (description.trim().length < 10) return false;
    if (techStack.trim().length < 2) return false;
    if (!Number.isFinite(Number(budget)) || Number(budget) <= 0) return false;
    const date = new Date(deadline);
    if (Number.isNaN(date.getTime())) return false;
    if (date.getTime() <= Date.now()) return false;
    return true;
  }, [title, description, techStack, budget, deadline]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    if (!isValid) {
      setSubmitting(false);
      setError("Please fill every field correctly. Deadline must be in the future.");
      return;
    }

    try {
      const post = await apiFetch("/posts", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          tech_stack: techStack.trim(),
          budget: Number(budget),
          deadline: new Date(deadline).toISOString(),
        },
      });
      navigate(`/freelance/posts/${post.id}`);
    } catch (e) {
      setError(e?.message || "Could not create post");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 py-6 md:max-w-3xl md:px-6 md:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Freelance Post</h1>
          <p className="mt-1 text-sm text-muted">Describe the task clearly to receive stronger proposals.</p>
        </div>
        <LinkButton to="/freelance" variant="secondary" className="hidden md:inline-flex">
          Back to list
        </LinkButton>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Title</label>
            <input
              className="h-12 rounded-[12px] border border-border bg-canvas px-3 text-sm text-foreground md:h-auto md:rounded-btn md:py-2"
              placeholder="Build Telegram bot with payment flow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              className="min-h-[160px] rounded-[12px] border border-border bg-canvas px-3 py-3 text-sm text-foreground md:rounded-btn"
              placeholder="Expected functionality, priorities, and delivery format..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-muted">Minimum 10 characters</p>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-foreground">Tech stack</label>
            <input
              className="h-12 rounded-[12px] border border-border bg-canvas px-3 text-sm text-foreground md:h-auto md:rounded-btn md:py-2"
              placeholder="Python, FastAPI, PostgreSQL"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Budget</label>
              <input
                className="h-12 rounded-[12px] border border-border bg-canvas px-3 text-sm text-foreground md:h-auto md:rounded-btn md:py-2"
                placeholder="1000"
                type="number"
                min="1"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
              <p className="text-xs text-muted">
                Preview: <span className="text-foreground">{formatMoney(budget || 0)}</span>
              </p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Deadline</label>
              <input
                className="h-12 rounded-[12px] border border-border bg-canvas px-3 text-sm text-foreground md:h-auto md:rounded-btn md:py-2"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          {error ? <div className="text-sm text-accent">{error}</div> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <LinkButton
              to="/freelance"
              variant="secondary"
              className="h-12 w-full justify-center rounded-[12px] sm:h-auto sm:w-auto sm:rounded-btn"
            >
              Cancel
            </LinkButton>
            <Button
              type="submit"
              disabled={submitting || !isValid}
              className="h-12 w-full rounded-[12px] text-base sm:h-auto sm:w-auto sm:rounded-btn sm:text-sm"
            >
              {submitting ? "Publishing..." : "Publish post"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
