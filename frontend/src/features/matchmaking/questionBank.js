export const ROUND_SECONDS = 15;
export const TOTAL_ROUNDS = 5;
export const COUNTDOWN_SECONDS = 3;
export const TIMEOUT_ANSWER = "__timeout__";

export const ROUND_QUESTIONS = [
  {
    type: "output",
    code: `console.log(typeof null);`,
    options: ['"object"', '"null"', '"undefined"', '"boolean"'],
    answer: '"object"',
    explanation: 'typeof null — историческая ошибка JS, возвращает "object"',
  },
  {
    type: "output",
    code: `console.log(0.1 + 0.2 === 0.3);`,
    options: ["true", "false", "undefined", "NaN"],
    answer: "false",
    explanation: "Плавающая точка: 0.1+0.2 = 0.30000000000000004",
  },
  {
    type: "output",
    code: `console.log([] + []);`,
    options: ['""', '"[]"', "null", "undefined"],
    answer: '""',
    explanation: "Два массива складываются как пустые строки",
  },
  {
    type: "output",
    code: `console.log(+'3' + +'2');`,
    options: ["5", '"32"', "NaN", "undefined"],
    answer: "5",
    explanation: "Унарный + конвертирует строки в числа",
  },
  {
    type: "output",
    code: `const a = [1,2,3];\nconsole.log(a.length = 1, a);`,
    options: ["1, [1]", "3, [1,2,3]", "1, []", "Error"],
    answer: "1, [1]",
    explanation: "Установка length усекает массив",
  },
  {
    type: "output",
    code: `console.log(1 < 2 < 3);`,
    options: ["true", "false", "NaN", "Error"],
    answer: "true",
    explanation: "1<2 = true, true<3 = 1<3 = true",
  },
  {
    type: "output",
    code: `console.log(3 > 2 > 1);`,
    options: ["true", "false", "NaN", "Error"],
    answer: "false",
    explanation: "3>2 = true, true>1 = 1>1 = false",
  },
  {
    type: "output",
    code: `console.log(!!null + !!undefined);`,
    options: ["0", "NaN", "false", "2"],
    answer: "0",
    explanation: "!!null = false, !!undefined = false, false+false = 0",
  },
  {
    type: "bug",
    description: "Функция должна вернуть сумму массива",
    code: `function sum(arr) {\n  let total = 0;\n  for (let i = 0; i <= arr.length; i++) {\n    total += arr[i];\n  }\n  return total;\n}`,
    options: ["let total = 0", "i <= arr.length", "total += arr[i]", "return total"],
    answer: "i <= arr.length",
    explanation: "Должно быть i < arr.length, иначе arr[length] = undefined",
  },
  {
    type: "bug",
    description: "Функция должна проверить, является ли число чётным",
    code: `function isEven(n) {\n  return n % 2 === 1;\n}`,
    options: ["return", "n % 2", "=== 1", "function isEven(n)"],
    answer: "=== 1",
    explanation: "Чётное число: n % 2 === 0, а не 1",
  },
  {
    type: "bug",
    description: "Функция должна перевернуть строку",
    code: `function reverse(str) {\n  return str.split('').reverse;\n}`,
    options: ["str.split('')", ".reverse", "return", "function reverse(str)"],
    answer: ".reverse",
    explanation: "Нужно вызвать .reverse() как метод, а не ссылку",
  },
  {
    type: "bug",
    description: "Функция должна найти максимум в массиве",
    code: `function findMax(arr) {\n  let max = 0;\n  for (const n of arr) {\n    if (n > max) max = n;\n  }\n  return max;\n}`,
    options: ["let max = 0", "for (const n of arr)", "if (n > max)", "return max"],
    answer: "let max = 0",
    explanation: "Начальное значение 0 не работает для массивов с отрицательными числами",
  },
  {
    type: "quiz",
    question: "Что такое замыкание (closure)?",
    options: [
      "Функция с доступом к переменным внешней области",
      "Метод закрытия соединения с БД",
      "Способ объявить приватный класс",
      "Паттерн проектирования",
    ],
    answer: "Функция с доступом к переменным внешней области",
    explanation: "Closure — функция, сохраняющая ссылку на лексическое окружение",
  },
  {
    type: "quiz",
    question: "Какой HTTP метод идемпотентен?",
    options: ["POST", "PATCH", "PUT", "DELETE и PUT"],
    answer: "DELETE и PUT",
    explanation: "DELETE и PUT — идемпотентны. POST создаёт новый ресурс каждый раз",
  },
  {
    type: "quiz",
    question: "Что возвращает Promise.all() если один промис rejected?",
    options: [
      "Все успешные результаты",
      "Немедленно rejects с первой ошибкой",
      "undefined",
      "Массив с ошибками",
    ],
    answer: "Немедленно rejects с первой ошибкой",
    explanation: "Promise.all — fail-fast, первый rejected = весь промис rejected",
  },
  {
    type: "quiz",
    question: "Что такое Big O нотация O(1)?",
    options: [
      "Линейная сложность",
      "Квадратичная сложность",
      "Константное время выполнения",
      "Логарифмическая сложность",
    ],
    answer: "Константное время выполнения",
    explanation: "O(1) — время не зависит от размера входных данных",
  },
  {
    type: "quiz",
    question: "Что делает оператор '??=' ?",
    options: [
      "Присваивает если значение null или undefined",
      "Сравнивает строго",
      "Побитовое NOT",
      "Проверяет тип",
    ],
    answer: "Присваивает если значение null или undefined",
    explanation: "Nullish coalescing assignment: x ??= y означает x = x ?? y",
  },
];

export function shuffleArray(items, random = Math.random) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function buildQuestionDeck({
  questionBank = ROUND_QUESTIONS,
  totalRounds = TOTAL_ROUNDS,
  random = Math.random,
} = {}) {
  return shuffleArray(questionBank, random).slice(0, totalRounds);
}
