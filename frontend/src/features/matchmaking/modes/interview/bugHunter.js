/**
 * Bug Hunter scenarios: real-ish JS files with hand-placed bugs.
 *
 * Each scenario carries:
 *   - title:      shown above the code as the "PR title" being reviewed
 *   - code:       multiline source. Players see this with line numbers.
 *   - bugs:       array of {line, explanation}. Lines are 1-indexed.
 *
 * Design notes:
 *   - Bug density target: 3–5 bugs per ~50–80 line file. Too sparse and
 *     the timer feels punishing; too dense and the player just clicks
 *     every line.
 *   - Bugs should look plausible at a glance — a confidently-written `==`
 *     instead of `===`, an off-by-one, missing `await`, mutated input.
 *     Each bug should be findable in <15 seconds by a competent reader.
 *   - We deliberately avoid syntax errors — the file should look like it
 *     "compiles" and only fail at runtime / on edge cases.
 */

export const BUG_HUNTER_SCENARIOS = [
  {
    id: "cart-total",
    title: "Pull request: fix cart total calculation",
    code: `// utils/cart.js
// Computes the total a user owes at checkout.

function calculateCartTotal(items, discountCode, taxRate) {
  let subtotal = 0;

  for (let i = 0; i <= items.length; i++) {
    subtotal += items[i].price * items[i].quantity;
  }

  let discount = 0;
  if (discountCode = "SAVE10") {
    discount = subtotal * 0.1;
  }

  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * taxRate;

  return afterDiscount + tax;
}

async function fetchCartItems(userId) {
  const response = fetch(\`/api/cart/\${userId}\`);
  return response.json();
}

function applyBulkDiscount(items, percent) {
  items.forEach(item => {
    item.price = item.price * (1 - percent);
  });
  return items;
}

function formatPrice(value) {
  return "$" + value.toFixed(2);
}

export { calculateCartTotal, fetchCartItems, applyBulkDiscount, formatPrice };`,
    bugs: [
      { line: 7, explanation: "Off-by-one: `i <= items.length` читает items[length] = undefined. Должно быть `<`." },
      { line: 13, explanation: "Присваивание вместо сравнения: `discountCode = \"SAVE10\"`. Нужно `===`." },
      { line: 24, explanation: "Нет `await` перед fetch — response это Promise, у которого нет .json()." },
      { line: 30, explanation: "Мутация входного массива: applyBulkDiscount изменяет переданные items вместо копии." },
    ],
  },
  {
    id: "user-auth",
    title: "Pull request: refactor login handler",
    code: `// api/auth.js
// Express handler for POST /login.

const users = require("../db/users");
const bcrypt = require("bcryptjs");

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const user = users.findByEmail(email);

  if (user == null) {
    res.status(404).json({ error: "User not found" });
  }

  const ok = bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createToken({ id: user.id, email: user.email });

  res.cookie("token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "none",
  });

  return res.json({ ok: true, token: token, user: user });
}

function createToken(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

module.exports = { login };`,
    bugs: [
      { line: 13, explanation: "findByEmail не await-ится — user будет Promise, а не объект." },
      { line: 17, explanation: "Нет return после 404 — выполнение продолжается, и user.passwordHash на следующей строке упадёт на null." },
      { line: 19, explanation: "bcrypt.compare возвращает Promise — нужен await, иначе ok всегда truthy." },
      { line: 30, explanation: "secure: false + sameSite: \"none\" — браузер отвергнет cookie. sameSite=none требует secure=true." },
      { line: 32, explanation: "Возврат всего user в JSON — утечка passwordHash и других приватных полей." },
    ],
  },
  {
    id: "list-utils",
    title: "Pull request: list helper utilities",
    code: `// utils/list.js
// Small collection of array helpers used across the codebase.

function unique(arr) {
  return arr.filter((item, index) => {
    return arr.indexOf(item) !== index;
  });
}

function last(arr) {
  return arr[arr.length];
}

function average(arr) {
  if (arr.length === 0) return 0;
  const sum = arr.reduce((acc, n) => acc + n, 0);
  return sum / arr.length - 1;
}

function pickRandom(arr) {
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, size));
  }
  return out;
}

function shallowCopy(arr) {
  return arr;
}

function deepCopy(obj) {
  return JSON.parse(obj);
}

module.exports = { unique, last, average, pickRandom, chunk, shallowCopy, deepCopy };`,
    bugs: [
      { line: 6, explanation: "Условие перевёрнуто: `!== index` оставляет дубликаты вместо первых вхождений. Нужно `=== index`." },
      { line: 11, explanation: "Индексы с 0 — last() возвращает undefined. Нужно `arr[arr.length - 1]`." },
      { line: 17, explanation: "Приоритет операторов: `sum / arr.length - 1` это (sum/length) - 1. Нужно скобки." },
      { line: 28, explanation: "slice(i, size) вместо slice(i, i + size) — каждый чанк начинается с i, но кончается на size." },
      { line: 34, explanation: "shallowCopy возвращает тот же массив — не копия. Нужно `[...arr]` или `arr.slice()`." },
      { line: 38, explanation: "JSON.parse принимает строку, а получает объект. Нужно `JSON.parse(JSON.stringify(obj))`." },
    ],
  },
];

export function pickBugHunterScenario(random = Math.random) {
  const idx = Math.floor(random() * BUG_HUNTER_SCENARIOS.length);
  return BUG_HUNTER_SCENARIOS[idx];
}
