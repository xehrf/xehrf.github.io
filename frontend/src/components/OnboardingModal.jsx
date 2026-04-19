import { useState } from "react";
import { Button } from "../components/ui/Button.jsx";
import { apiFetch } from "../api/client";

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

export function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedTechnologies, setSelectedTechnologies] = useState([]);
  const [customTech, setCustomTech] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
  };

  const handleTechToggle = (tech) => {
    setSelectedTechnologies((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  const handleAddCustomTech = () => {
    if (customTech.trim() && !selectedTechnologies.includes(customTech.trim())) {
      setSelectedTechnologies((prev) => [...prev, customTech.trim()]);
      setCustomTech("");
    }
  };

  const handleNext = () => {
    if (step === 1 && selectedRole) {
      setStep(2);
    }
  };

  const handleComplete = async () => {
    if (!selectedRole || selectedTechnologies.length === 0) return;

    setLoading(true);
    setError("");
    try {
      console.log("Saving onboarding:", { role: selectedRole, technologies: selectedTechnologies });
      await apiFetch("/users/me/onboarding", {
        method: "POST",
        body: {
          role: selectedRole,
          technologies: selectedTechnologies,
        },
      });
      console.log("Onboarding saved successfully");
      setLoading(false);
      onComplete();
    } catch (error) {
      console.error("Onboarding failed:", error);
      setError(error.message || "Ошибка при сохранении. Попробуйте ещё раз.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-md rounded-2xl border border-yellow-500/20 bg-gray-900 p-6 text-white">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-yellow-400">
            {step === 1 ? "Выберите вашу роль" : "Выберите технологии"}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {step === 1
              ? "Расскажите, чем вы занимаетесь"
              : "Какие технологии вы используете?"}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => handleRoleSelect(role)}
                className={`w-full rounded-lg border p-3 text-left transition-all duration-200 ${
                  selectedRole === role
                    ? "border-yellow-500 bg-yellow-500/10 text-gray-300"
                    : "border-white/10 bg-gray-700 text-white hover:border-yellow-500/50 hover:text-yellow-400"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {TECHNOLOGIES.map((tech) => (
                <button
                  key={tech}
                  onClick={() => handleTechToggle(tech)}
                  className={`rounded-lg border p-2 text-sm transition-all duration-200 ${
                    selectedTechnologies.includes(tech)
                      ? "border-yellow-500 bg-yellow-500/10 text-gray-300"
                      : "border-white/10 bg-gray-700 text-white hover:border-yellow-500/50 hover:text-yellow-400"
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customTech}
                onChange={(e) => setCustomTech(e.target.value)}
                placeholder="Другое..."
                className="flex-1 rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-yellow-500 focus:outline-none"
                onKeyPress={(e) => e.key === "Enter" && handleAddCustomTech()}
              />
              <Button
                onClick={handleAddCustomTech}
                className="rounded-lg bg-yellow-500 px-3 py-2 text-sm font-medium text-black hover:bg-yellow-400"
                disabled={!customTech.trim()}
              >
                +
              </Button>
            </div>

            {selectedTechnologies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedTechnologies.map((tech) => (
                  <span
                    key={tech}
                    className="rounded bg-yellow-500/20 px-2 py-1 text-xs text-yellow-400"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          {step === 2 && (
            <Button
              onClick={() => setStep(1)}
              variant="secondary"
              className="rounded-lg border border-white/10 bg-gray-700 px-4 py-2 text-white hover:bg-gray-600"
            >
              Назад
            </Button>
          )}
          <div className="ml-auto">
            {step === 1 ? (
              <Button
                onClick={handleNext}
                className="rounded-lg bg-yellow-500 px-4 py-2 font-medium text-black hover:bg-yellow-400"
                disabled={!selectedRole}
              >
                Далее
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                className="rounded-lg bg-yellow-500 px-4 py-2 font-medium text-black hover:bg-yellow-400"
                disabled={selectedTechnologies.length === 0 || loading}
              >
                {loading ? "Сохранение..." : "Завершить"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}