import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button, LinkButton } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { apiFetch } from "../api/client";
import { useAuth } from "../auth/AuthProvider.jsx";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  getContractStatusMeta,
  getPostStatusMeta,
  resolveTimelineEventLabel,
} from "../utils/freelanceStatus.js";

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

export function PostDetailsPage() {
  const { id } = useParams();
  const { user, refreshMe } = useAuth();
  const [post, setPost] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [contract, setContract] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [messages, setMessages] = useState([]);
  const [applyMessage, setApplyMessage] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [resultText, setResultText] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [chatText, setChatText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");

  const isClient = Boolean(user && post && post.client_id === user.id);
  const isDeveloper = Boolean(user && contract && contract.developer_id === user.id);
  const isContractMember = Boolean(
    user && contract && (contract.client_id === user.id || contract.developer_id === user.id),
  );

  const postStatusMeta = useMemo(() => getPostStatusMeta(post?.status), [post?.status]);
  const contractStatusMeta = useMemo(() => getContractStatusMeta(contract?.status), [contract?.status]);
  const progressPercent = timeline?.progress_percent ?? contractStatusMeta.progress;

  async function loadAll() {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const loadedPost = await apiFetch(`/posts/${id}`);
      setPost(loadedPost);

      if (loadedPost.client_id === user.id) {
        const loadedProposals = await apiFetch(`/posts/${id}/proposals`);
        setProposals(Array.isArray(loadedProposals) ? loadedProposals : []);
      } else {
        setProposals([]);
      }

      let loadedContract = null;
      try {
        loadedContract = await apiFetch(`/posts/${id}/contract`);
      } catch (e) {
        if (e?.status !== 403) throw e;
      }

      setContract(loadedContract || null);

      if (loadedContract?.id) {
        const [loadedTimeline, loadedMessages] = await Promise.all([
          apiFetch(`/contracts/${loadedContract.id}/timeline`),
          apiFetch(`/contracts/${loadedContract.id}/messages`),
        ]);
        setTimeline(loadedTimeline || null);
        setMessages(Array.isArray(loadedMessages) ? loadedMessages : []);
      } else {
        setTimeline(null);
        setMessages([]);
      }
    } catch (e) {
      setError(e?.message || "Failed to load post details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  async function apply() {
    if (!applyMessage.trim()) {
      setError("Add a short message for the client before applying.");
      return;
    }
    setBusyAction("apply");
    setError("");
    try {
      await apiFetch(`/posts/${id}/apply`, {
        method: "POST",
        body: {
          message: applyMessage.trim(),
          portfolio_url: portfolio.trim() || null,
        },
      });
      setApplyMessage("");
      setPortfolio("");
      await loadAll();
    } catch (e) {
      setError(e?.message || "Could not apply");
    } finally {
      setBusyAction("");
    }
  }

  async function acceptProposal(proposalId) {
    setBusyAction(`accept:${proposalId}`);
    setError("");
    try {
      await apiFetch(`/proposals/${proposalId}/accept`, { method: "POST" });
      await loadAll();
    } catch (e) {
      setError(e?.message || "Could not accept proposal");
    } finally {
      setBusyAction("");
    }
  }

  async function submitResult() {
    if (!contract?.id) return;
    if (!resultText.trim()) {
      setError("Describe the delivered result before submitting.");
      return;
    }
    setBusyAction("submit");
    setError("");
    try {
      await apiFetch(`/contracts/${contract.id}/submit`, {
        method: "POST",
        body: { result_text: resultText.trim() },
      });
      setResultText("");
      await loadAll();
    } catch (e) {
      setError(e?.message || "Could not submit result");
    } finally {
      setBusyAction("");
    }
  }

  async function requestRevision() {
    if (!contract?.id) return;
    setBusyAction("revision");
    setError("");
    try {
      await apiFetch(`/contracts/${contract.id}/request-revision`, {
        method: "POST",
        body: { note: revisionNote.trim() || null },
      });
      setRevisionNote("");
      await loadAll();
    } catch (e) {
      setError(e?.message || "Could not request revision");
    } finally {
      setBusyAction("");
    }
  }

  async function completeContract() {
    if (!contract?.id) return;
    setBusyAction("complete");
    setError("");
    try {
      await apiFetch(`/contracts/${contract.id}/complete`, {
        method: "POST",
        body: {
          rating: Number(rating),
          comment: reviewComment.trim() || null,
        },
      });
      setReviewComment("");
      await loadAll();
      await refreshMe();
    } catch (e) {
      setError(e?.message || "Could not complete contract");
    } finally {
      setBusyAction("");
    }
  }

  async function sendMessage() {
    if (!contract?.id) return;
    if (!chatText.trim()) return;
    setBusyAction("chat");
    setError("");
    try {
      await apiFetch(`/contracts/${contract.id}/messages`, {
        method: "POST",
        body: { message: chatText.trim() },
      });
      setChatText("");
      await loadAll();
    } catch (e) {
      setError(e?.message || "Could not send message");
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-[430px] px-4 py-8 text-sm text-muted md:max-w-4xl">Loading...</div>;
  }

  if (!post) {
    return <div className="mx-auto max-w-[430px] px-4 py-8 text-sm text-muted md:max-w-4xl">Post not found.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 py-6 md:max-w-5xl md:px-6 md:py-8">
      <div className="flex items-center justify-between gap-2">
        <LinkButton to="/freelance" variant="secondary" className="h-11 rounded-[12px] px-3 py-2 md:rounded-btn">
          Back
        </LinkButton>
        <Button
          onClick={loadAll}
          variant="secondary"
          className="h-11 rounded-[12px] px-3 py-2 md:rounded-btn"
          disabled={Boolean(busyAction)}
        >
          Refresh
        </Button>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{post.title}</h1>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{post.description}</p>
          </div>
          <span
            className={[
              "inline-flex rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wide",
              postStatusMeta.badgeClass,
            ].join(" ")}
          >
            {postStatusMeta.label}
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
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
      </Card>

      {error ? <Card className="text-sm text-accent">{error}</Card> : null}

      {!isClient && post.status === "open" ? (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-foreground">Send proposal</h2>
          <textarea
            className="mt-3 min-h-[120px] w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
            placeholder="Tell client how you will solve this task"
            value={applyMessage}
            onChange={(e) => setApplyMessage(e.target.value)}
          />
          <input
            className="mt-3 w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
            placeholder="Portfolio URL (optional)"
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
          />
          <Button
            className="mt-3 h-12 w-full rounded-[12px] md:h-auto md:w-auto md:rounded-btn"
            onClick={apply}
            disabled={busyAction === "apply"}
          >
            {busyAction === "apply" ? "Sending..." : "Apply"}
          </Button>
        </Card>
      ) : null}

      {isClient ? (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-foreground">Proposals</h2>
          {proposals.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No proposals yet.</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {proposals.map((proposal) => (
                <div key={proposal.id} className="rounded-btn border border-border bg-canvas p-3">
                  <div className="text-sm text-muted">
                    {proposal.developer_display_name || `Developer #${proposal.developer_id}`}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{proposal.message}</p>
                  {proposal.portfolio_url ? (
                    <a
                      href={proposal.portfolio_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex text-xs text-accent hover:underline"
                    >
                      Portfolio
                    </a>
                  ) : null}
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-muted uppercase tracking-wide">{proposal.status}</span>
                    {post.status === "open" && proposal.status === "pending" ? (
                      <Button
                        className="h-11 w-full rounded-[12px] sm:h-auto sm:w-auto sm:rounded-btn"
                        onClick={() => acceptProposal(proposal.id)}
                        disabled={busyAction === `accept:${proposal.id}`}
                      >
                        {busyAction === `accept:${proposal.id}` ? "Selecting..." : "Select developer"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {contract ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Contract #{contract.id}</h2>
              <p className="mt-1 text-sm text-muted">
                Client: <span className="text-foreground">{contract.client_display_name || contract.client_id}</span>
              </p>
              <p className="text-sm text-muted">
                Developer:{" "}
                <span className="text-foreground">{contract.developer_display_name || contract.developer_id}</span>
              </p>
            </div>
            <span
              className={[
                "inline-flex rounded-full border px-2 py-1 text-[11px] font-medium uppercase tracking-wide",
                contractStatusMeta.badgeClass,
              ].join(" ")}
            >
              {timeline?.status_title || contractStatusMeta.label}
            </span>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-muted">
              <span>Status progress</span>
              <span>{progressPercent}%</span>
            </div>
            <ProgressBar percent={progressPercent} />
            {timeline?.next_action ? <p className="mt-2 text-sm text-muted">{timeline.next_action}</p> : null}
          </div>

          {contract.result_text ? (
            <div className="mt-4 rounded-btn border border-border bg-canvas p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Submitted result</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{contract.result_text}</p>
            </div>
          ) : null}

          {isDeveloper && contract.status === "active" ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-foreground">Submit result</h3>
              <textarea
                className="mt-2 min-h-[120px] w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
                placeholder="Describe what was done and include links if needed"
                value={resultText}
                onChange={(e) => setResultText(e.target.value)}
              />
              <Button
                className="mt-3 h-12 w-full rounded-[12px] md:h-auto md:w-auto md:rounded-btn"
                onClick={submitResult}
                disabled={busyAction === "submit"}
              >
                {busyAction === "submit" ? "Submitting..." : "Submit result"}
              </Button>
            </div>
          ) : null}

          {isClient && contract.status === "submitted" ? (
            <div className="mt-4 grid gap-3 rounded-btn border border-border bg-canvas p-3">
              <h3 className="text-sm font-semibold text-foreground">Review delivery</h3>
              <textarea
                className="min-h-[80px] w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
                placeholder="Revision note (optional)"
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  className="h-12 w-full rounded-[12px] sm:h-auto sm:w-auto sm:rounded-btn"
                  onClick={requestRevision}
                  disabled={busyAction === "revision"}
                >
                  {busyAction === "revision" ? "Sending..." : "Request revision"}
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
                <label className="text-sm text-muted">Rating</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
                >
                  <option value={5}>5</option>
                  <option value={4}>4</option>
                  <option value={3}>3</option>
                  <option value={2}>2</option>
                  <option value={1}>1</option>
                </select>
              </div>
              <textarea
                className="min-h-[80px] w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
                placeholder="Final review comment (optional)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
              <Button
                className="h-12 w-full rounded-[12px] sm:h-auto sm:w-auto sm:rounded-btn"
                onClick={completeContract}
                disabled={busyAction === "complete"}
              >
                {busyAction === "complete" ? "Completing..." : "Approve and complete"}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {contract && timeline?.events?.length ? (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-foreground">Status timeline</h2>
          <div className="mt-3 grid gap-2">
            {timeline.events.map((event) => (
              <div key={`${event.id}-${event.created_at}`} className="rounded-btn border border-border bg-canvas p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{resolveTimelineEventLabel(event.event_type)}</p>
                  <p className="text-xs text-muted">{formatDateTime(event.created_at)}</p>
                </div>
                {event.actor_display_name ? (
                  <p className="mt-1 text-xs text-muted">By: {event.actor_display_name}</p>
                ) : null}
                {event.note ? <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{event.note}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {contract && isContractMember ? (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-foreground">Messages</h2>
          <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto rounded-btn border border-border bg-canvas p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted">No messages yet.</p>
            ) : (
              messages.map((msg) => {
                const mine = user?.id === msg.sender_id;
                return (
                  <div
                    key={msg.id}
                    className={[
                      "rounded-btn border px-3 py-2",
                      mine
                        ? "ml-auto border-accent/40 bg-accent/10 text-foreground"
                        : "mr-auto border-border bg-elevated text-foreground",
                      "max-w-[90%]",
                    ].join(" ")}
                  >
                    <p className="text-xs text-muted">{mine ? "You" : msg.sender_display_name || msg.sender_id}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{msg.message}</p>
                    <p className="mt-1 text-[11px] text-muted">{formatDateTime(msg.created_at)}</p>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <textarea
              className="min-h-[44px] w-full rounded-btn border border-border bg-canvas px-3 py-2 text-sm text-foreground"
              placeholder="Type message"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
            />
            <Button
              onClick={sendMessage}
              className="h-12 rounded-[12px] px-6 sm:h-auto sm:rounded-btn"
              disabled={busyAction === "chat" || !chatText.trim()}
            >
              {busyAction === "chat" ? "Sending..." : "Send"}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
