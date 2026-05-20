/**
 * Task topic inference.
 *
 * Tasks don't have an explicit topic column on the backend yet, so the
 * Dashboard derives a topic from each task's title using priority-ordered
 * keyword matching. First topic whose keyword appears in the (lowercased)
 * title wins — order matters: more specific topics first so that, e.g.,
 * "Группировка анаграмм" lands in `hash` (group-by) and a plain
 * "Анаграммы" lands in `strings`.
 *
 * Once tasks gain a real topic field this file can shrink to a label map.
 */

export const TASK_TOPICS = [
  {
    id: "all",
    label: "Все темы",
    description: "Полная подборка — задачи из всех разделов сразу.",
  },
  {
    id: "arrays",
    label: "Массивы",
    description:
      "Список вещей по порядку — как вагоны поезда или очередь в магазине. Учимся быстро искать, считать и переставлять элементы.",
  },
  {
    id: "strings",
    label: "Строки",
    description:
      "Это текст: буквы, слова, предложения. Переворачиваем, ищем подстроки, проверяем — читается ли одинаково с двух сторон (палиндром).",
  },
  {
    id: "hash",
    label: "Хеш",
    description:
      "Волшебный словарь: даёшь ключ — мгновенно получаешь ответ. Как телефонная книга, только в миллион раз быстрее.",
  },
  {
    id: "stack",
    label: "Стек/Очередь",
    description:
      "Стопка тарелок (берём сверху) или очередь в кассу (первый пришёл — первый ушёл). Нужны, когда важен порядок обработки.",
  },
  {
    id: "graphs",
    label: "Графы",
    description:
      "Точки и линии между ними. Карта метро, друзья в соцсети, дороги между городами — всё это графы. Учимся ходить по ним и искать пути.",
  },
  {
    id: "trees",
    label: "Деревья",
    description:
      "Иерархия как семейное древо: один сверху, у него «дети», у них свои «дети». Папки на компьютере — тоже дерево.",
  },
  {
    id: "dp",
    label: "Динамика",
    description:
      "Разбиваем большую задачу на маленькие и не решаем одно и то же дважды. Записываем готовые ответы и берём их потом — как шпаргалку.",
  },
  {
    id: "sort",
    label: "Сортировка",
    description:
      "Расставляем по порядку: от меньшего к большему, по алфавиту, по дате. Как сортируешь карты в руке.",
  },
  {
    id: "binsearch",
    label: "Бин. поиск",
    description:
      "Игра «больше или меньше»: каждый раз делим оставшийся интервал пополам. За 20 шагов находим число среди миллиона.",
  },
  {
    id: "math",
    label: "Математика",
    description:
      "Простые числа, делители, степени, остатки от деления. Базовые числовые трюки и школьные формулы.",
  },
  {
    id: "other",
    label: "Другое",
    description: "Задачи, которые пока не вписались в основные темы.",
  },
];

export function getTopicById(id) {
  return TASK_TOPICS.find((t) => t.id === id) ?? TASK_TOPICS[0];
}

// Order = priority. First match wins, so put more specific topics first.
const TOPIC_RULES = [
  { id: "graphs",    keywords: ["bfs", "dfs", "граф", "дейкстра", "топологическ"] },
  { id: "trees",     keywords: ["дерев", "обход дерев", " bst ", "куч"] },
  { id: "binsearch", keywords: ["бинарн поиск", "бинарный поиск", "binary search"] },
  { id: "dp",        keywords: ["наибольш", "возраста", "субпоследовательн", "динамик"] },
  { id: "hash",      keywords: ["частот", "уникальн", "группировк", "топ-k", "топ-к", "топ k"] },
  { id: "stack",     keywords: ["скобк", "lru", "счётчик операц", "стек", "очеред"] },
  { id: "sort",      keywords: ["сортировк", "слить", "слияни"] },
  { id: "strings",   keywords: [
    "строк", "палиндром", "анаграмм", "гласн", "цезар", "kmp",
    "run-length", "минимальное окно", "разворот", "заглавн", "символ", "подстрок",
  ] },
  { id: "math",      keywords: [
    "fizzbuzz", "факториал", "нод", "чётн", "прост",
    "сумма цифр", "сумма двух",
  ] },
  { id: "arrays",    keywords: [
    "массив", "two sum", "две суммы", "матриц", "пропавшее", "сдвиг",
    "удвой", "максимум", "максимальн", "сгладить",
  ] },
];

export function inferTaskTopic(task) {
  if (!task) return "other";
  const title = (task.title || "").toLowerCase();
  if (!title) return "other";
  for (const rule of TOPIC_RULES) {
    for (const kw of rule.keywords) {
      if (title.includes(kw)) return rule.id;
    }
  }
  return "other";
}

/**
 * { topicId: count } across the given task list. Includes "all" with the
 * total. Topics with zero tasks are still present (count 0) so the sidebar
 * UI can render the full list and grey-out empty ones if it wants to.
 */
export function countTasksByTopic(tasks) {
  const counts = Object.fromEntries(TASK_TOPICS.map((t) => [t.id, 0]));
  for (const task of tasks) {
    const topic = inferTaskTopic(task);
    counts[topic] = (counts[topic] ?? 0) + 1;
    counts.all += 1;
  }
  return counts;
}
