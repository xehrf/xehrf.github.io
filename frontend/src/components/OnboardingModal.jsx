import { useMemo, useState } from "react";
import { apiFetch } from "../api/client";
import { Button } from "./ui/Button.jsx";

const ROLES = [
  "Back-end",
  "Front-end",
  "Full-stack",
  "Project Manager",
  "UI/UX",
  "AI/ML",
  "DevOps",
  "QA",
];

const TECHNOLOGIES = [
  "Python",
  "JavaScript",
  "C++",
  "Java",
  "Unity",
  "React",
  "Django",
  "FastAPI",
  "Node.js",
];

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function toggleValue(values, candidate) {
  return values.includes(candidate) ? values.filter((item) => item !== candidate) : [...values, candidate];
}

export function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedTechnologies, setSelectedTechnologies] = useState([]);
  const [otherTechnology, setOtherTechnology] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canGoNext = step === 1 ? Boolean(selectedRole) : selectedTechnologies.length > 0;

  const finalTechnologies = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const tech of selectedTechnologies) {
      const clean = normalizeText(tech);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
    }
    return out;
  }, [selectedTechnologies]);

  const addOtherTechnology = () => {
    const clean = normalizeText(otherTechnology);
    if (!clean) return;
    setSelectedTechnologies((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === clean.toLowerCase());
      return exists ? prev : [...prev, clean];
    });
    setOtherTechnology("");
  };

  const submitOnboarding = async () => {
    if (!selectedRole || finalTechnologies.length === 0 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/users/me/onboarding", {
        method: "POST",
        body: {
          role: selectedRole,
          technologies: finalTechnologies,
        },
      });
      await onComplete();
    } catch (e) {
      setError(e?.message || "Failed to save onboarding. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 py-8">
      <div
        className="w-full max-w-xl rounded-2xl p-6 sm:p-7"
        style={{ background: "#111", border: "1px solid rgba(255,214,0,0.15)" }}
      >
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#FFD600]/80">Welcome to CodeArena</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Finish your onboarding</h2>
          <p className="mt-2 text-sm text-white/70">Step {step} of 2</p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLES.map((role) => {
              const active = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className="rounded-xl px-4 py-3 text-left text-sm transition-colors"
                  style={{
                    border: `1px solid ${active ? "#FFD600" : "rgba(255,214,0,0.15)"}`,
                    background: active ? "rgba(255,214,0,0.14)" : "transparent",
                    color: active ? "#FFD600" : "white",
                  }}
                >
                  {role}
                </button>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TECHNOLOGIES.map((tech) => {
                const active = selectedTechnologies.includes(tech);
                return (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => setSelectedTechnologies((prev) => toggleValue(prev, tech))}
                    className="rounded-xl px-3 py-2 text-sm transition-colors"
                    style={{
                      border: `1px solid ${active ? "#FFD600" : "rgba(255,214,0,0.15)"}`,
                      background: active ? "rgba(255,214,0,0.14)" : "transparent",
                      color: active ? "#FFD600" : "white",
                    }}
                  >
                    {tech}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={otherTechnology}
                onChange={(e) => setOtherTechnology(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOtherTechnology();
                  }
                }}
                placeholder="Other technology"
                className="h-11 flex-1 rounded-xl bg-black px-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
                style={{ border: "1px solid rgba(255,214,0,0.15)" }}
              />
              <Button
                type="button"
                onClick={addOtherTechnology}
                disabled={!normalizeText(otherTechnology)}
                className="h-11 rounded-xl px-4"
                style={{ background: "#FFD600", color: "#111" }}
              >
                Add
              </Button>
            </div>

            {finalTechnologies.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {finalTechnologies.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full px-3 py-1 text-xs"
                    style={{ background: "rgba(255,214,0,0.18)", color: "#FFD600" }}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            onClick={() => setStep((prev) => (prev === 1 ? 1 : prev - 1))}
            disabled={step === 1 || submitting}
            className="h-11 rounded-xl px-5"
            style={{ border: "1px solid rgba(255,214,0,0.15)", background: "transparent", color: "white" }}
          >
            Back
          </Button>

          {step === 1 ? (
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canGoNext || submitting}
              className="h-11 rounded-xl px-5"
              style={{ background: "#FFD600", color: "#111" }}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              onClick={submitOnboarding}
              disabled={!canGoNext || submitting}
              className="h-11 rounded-xl px-5"
              style={{ background: "#FFD600", color: "#111" }}
            >
              {submitting ? "Saving..." : "Finish"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
