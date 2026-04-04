/** @type {Array<{ id: string, title: string, difficulty: number, rewardPts: number, type: 'solo' | 'match' }>} */
export const mockTasks = [
  {
    id: "1",
    title: "HTTP Echo API",
    difficulty: 2,
    rewardPts: 40,
    type: "match",
  },
  {
    id: "2",
    title: "Telegram-бот /ping → pong",
    difficulty: 2,
    rewardPts: 55,
    type: "solo",
  },
  {
    id: "3",
    title: "Парсер цен с маркетплейса",
    difficulty: 3,
    rewardPts: 80,
    type: "solo",
  },
  {
    id: "4",
    title: "Binary search с кастомным компаратором",
    difficulty: 1,
    rewardPts: 25,
    type: "match",
  },
  {
    id: "5",
    title: "SSR-лендинг на React",
    difficulty: 4,
    rewardPts: 120,
    type: "solo",
  },
  {
    id: "6",
    title: "Мини-компилятор арифметики",
    difficulty: 5,
    rewardPts: 200,
    type: "match",
  },
];
