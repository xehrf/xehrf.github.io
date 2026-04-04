/** Навыки и история для демо-профиля */
export const mockUser = {
  name: "dev_junior",
  elo: 1084,
  pts: 340,
  level: "junior",
  skills: [
    { name: "Python", level: 4 },
    { name: "JavaScript", level: 3 },
    { name: "SQL", level: 2 },
    { name: "Git", level: 3 },
  ],
  history: [
    { id: "h1", task: "HTTP Echo API", result: "1 место", pts: 35, date: "2026-03-28" },
    { id: "h2", task: "Парсер цен", result: "Принято", pts: 80, date: "2026-03-22" },
    { id: "h3", task: "Binary search", result: "2 место", pts: 18, date: "2026-03-15" },
  ],
};
