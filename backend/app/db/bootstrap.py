from sqlalchemy.orm import Session

from app.db.models import Task, TaskType


def seed_if_empty(db: Session) -> None:
    # Важно: не плодим дубликаты, если раньше уже сидили английские названия.
    # Обновляем известные сиды на русский и solo, а недостающие добавляем.
    existing_by_title: dict[str, Task] = {t.title: t for t in db.query(Task).all()}

    seeds: list[dict] = [
        # ===== ЛЁГКИЕ (1) =====
        {
            "legacy_titles": ["Sum Two Numbers"],
            "title": "Сумма двух чисел",
            "description": "Реализуйте функцию sum_two(a, b), которая возвращает a + b.",
            "difficulty": 1,
            "time_limit_minutes": 30,
            "tests_json": {
                "type": "python_function",
                "function_name": "sum_two",
                "tests": [
                    {"input": [1, 2], "expected": 3},
                    {"input": [-5, 8], "expected": 3},
                    {"input": [0, 0], "expected": 0},
                ],
            },
            "starter_code": "def sum_two(a, b):\n    return a + b\n",
        },
        {
            "legacy_titles": ["Is Even"],
            "title": "Чётное число",
            "description": "Реализуйте is_even(n): верните True, если n чётное, иначе False.",
            "difficulty": 1,
            "time_limit_minutes": 30,
            "tests_json": {
                "type": "python_function",
                "function_name": "is_even",
                "tests": [
                    {"input": [2], "expected": True},
                    {"input": [7], "expected": False},
                    {"input": [0], "expected": True},
                ],
            },
            "starter_code": "def is_even(n):\n    return n % 2 == 0\n",
        },
        {
            "legacy_titles": ["Reverse String"],
            "title": "Разворот строки",
            "description": "Реализуйте reverse_string(s) и верните строку в обратном порядке.",
            "difficulty": 1,
            "time_limit_minutes": 30,
            "tests_json": {
                "type": "python_function",
                "function_name": "reverse_string",
                "tests": [
                    {"input": ["abc"], "expected": "cba"},
                    {"input": ["CodeArena"], "expected": "anerAedoC"},
                    {"input": [""], "expected": ""},
                ],
            },
            "starter_code": "def reverse_string(s):\n    return s[::-1]\n",
        },
        {
            "legacy_titles": ["Factorial"],
            "title": "Факториал",
            "description": "Реализуйте factorial(n) для n ≥ 0.",
            "difficulty": 1,
            "time_limit_minutes": 40,
            "tests_json": {
                "type": "python_function",
                "function_name": "factorial",
                "tests": [
                    {"input": [0], "expected": 1},
                    {"input": [5], "expected": 120},
                    {"input": [7], "expected": 5040},
                ],
            },
            "starter_code": "def factorial(n):\n    res = 1\n    for i in range(2, n + 1):\n        res *= i\n    return res\n",
        },
        {
            "legacy_titles": ["Count Vowels"],
            "title": "Подсчёт гласных",
            "description": "Реализуйте count_vowels(s): посчитайте количество гласных (a, e, i, o, u) в строке.",
            "difficulty": 1,
            "time_limit_minutes": 30,
            "tests_json": {
                "type": "python_function",
                "function_name": "count_vowels",
                "tests": [
                    {"input": ["hello"], "expected": 2},
                    {"input": ["xyz"], "expected": 0},
                    {"input": ["AEIOU"], "expected": 5},
                ],
            },
            "starter_code": "def count_vowels(s):\n    vowels = set('aeiou')\n    return sum(1 for ch in s.lower() if ch in vowels)\n",
        },
        {
            "legacy_titles": ["FizzBuzz N"],
            "title": "FizzBuzz до N",
            "description": "Реализуйте fizz_buzz(n): верните список строк от 1 до n по правилам fizz/buzz/fizzbuzz.",
            "difficulty": 1,
            "time_limit_minutes": 40,
            "tests_json": {
                "type": "python_function",
                "function_name": "fizz_buzz",
                "tests": [
                    {"input": [5], "expected": ["1", "2", "fizz", "4", "buzz"]},
                    {"input": [3], "expected": ["1", "2", "fizz"]},
                ],
            },
            "starter_code": (
                "def fizz_buzz(n):\n"
                "    out = []\n"
                "    for i in range(1, n + 1):\n"
                "        if i % 15 == 0:\n"
                "            out.append('fizzbuzz')\n"
                "        elif i % 3 == 0:\n"
                "            out.append('fizz')\n"
                "        elif i % 5 == 0:\n"
                "            out.append('buzz')\n"
                "        else:\n"
                "            out.append(str(i))\n"
                "    return out\n"
            ),
        },
        {
            "legacy_titles": [],
            "title": "Сумма цифр",
            "description": "Реализуйте sum_digits(n): верните сумму цифр целого числа n (n может быть отрицательным).",
            "difficulty": 1,
            "time_limit_minutes": 30,
            "tests_json": {
                "type": "python_function",
                "function_name": "sum_digits",
                "tests": [
                    {"input": [123], "expected": 6},
                    {"input": [-90], "expected": 9},
                    {"input": [0], "expected": 0},
                ],
            },
            "starter_code": "def sum_digits(n):\n    n = abs(n)\n    return sum(int(ch) for ch in str(n))\n",
        },
        # ===== СРЕДНИЕ (2) =====
        {
            "legacy_titles": [],
            "title": "Палиндром",
            "description": "Реализуйте is_palindrome(s): верните True, если строка читается одинаково слева направо и справа налево.",
            "difficulty": 2,
            "time_limit_minutes": 45,
            "tests_json": {
                "type": "python_function",
                "function_name": "is_palindrome",
                "tests": [
                    {"input": ["level"], "expected": True},
                    {"input": ["абба"], "expected": True},
                    {"input": ["hello"], "expected": False},
                ],
            },
            "starter_code": "def is_palindrome(s):\n    return s == s[::-1]\n",
        },
        {
            "legacy_titles": [],
            "title": "Частоты слов",
            "description": "Реализуйте word_freq(text): верните словарь {слово: частота}. Разделители — пробелы.",
            "difficulty": 2,
            "time_limit_minutes": 60,
            "tests_json": {
                "type": "python_function",
                "function_name": "word_freq",
                "tests": [
                    {"input": ["a b a"], "expected": {"a": 2, "b": 1}},
                    {"input": ["one"], "expected": {"one": 1}},
                ],
            },
            "starter_code": (
                "def word_freq(text):\n"
                "    freq = {}\n"
                "    for w in text.split():\n"
                "        freq[w] = freq.get(w, 0) + 1\n"
                "    return freq\n"
            ),
        },
        {
            "legacy_titles": [],
            "title": "Проверка простого числа",
            "description": "Реализуйте is_prime(n): верните True, если n — простое число (n ≥ 0).",
            "difficulty": 2,
            "time_limit_minutes": 60,
            "tests_json": {
                "type": "python_function",
                "function_name": "is_prime",
                "tests": [
                    {"input": [1], "expected": False},
                    {"input": [2], "expected": True},
                    {"input": [49], "expected": False},
                    {"input": [97], "expected": True},
                ],
            },
            "starter_code": (
                "def is_prime(n):\n"
                "    if n < 2:\n"
                "        return False\n"
                "    if n % 2 == 0:\n"
                "        return n == 2\n"
                "    d = 3\n"
                "    while d * d <= n:\n"
                "        if n % d == 0:\n"
                "            return False\n"
                "        d += 2\n"
                "    return True\n"
            ),
        },
        # ===== СЛОЖНЫЕ (3) =====
        {
            "legacy_titles": ["Two Sum Indices"],
            "title": "Две суммы (индексы)",
            "description": "Реализуйте two_sum(nums, target): верните индексы двух чисел, сумма которых равна target.",
            "difficulty": 3,
            "time_limit_minutes": 90,
            "tests_json": {
                "type": "python_function",
                "function_name": "two_sum",
                "tests": [
                    {"input": [[2, 7, 11, 15], 9], "expected": [0, 1]},
                    {"input": [[3, 2, 4], 6], "expected": [1, 2]},
                ],
            },
            "starter_code": (
                "def two_sum(nums, target):\n"
                "    seen = {}\n"
                "    for i, n in enumerate(nums):\n"
                "        need = target - n\n"
                "        if need in seen:\n"
                "            return [seen[need], i]\n"
                "        seen[n] = i\n"
                "    return []\n"
            ),
        },
        {
            "legacy_titles": ["Binary Search"],
            "title": "Бинарный поиск",
            "description": "Реализуйте binary_search(nums, target): верните индекс target или -1.",
            "difficulty": 3,
            "time_limit_minutes": 90,
            "tests_json": {
                "type": "python_function",
                "function_name": "binary_search",
                "tests": [
                    {"input": [[1, 3, 5, 7, 9], 7], "expected": 3},
                    {"input": [[1, 3, 5, 7, 9], 2], "expected": -1},
                ],
            },
            "starter_code": (
                "def binary_search(nums, target):\n"
                "    l, r = 0, len(nums) - 1\n"
                "    while l <= r:\n"
                "        m = (l + r) // 2\n"
                "        if nums[m] == target:\n"
                "            return m\n"
                "        if nums[m] < target:\n"
                "            l = m + 1\n"
                "        else:\n"
                "            r = m - 1\n"
                "    return -1\n"
            ),
        },
        {
            "legacy_titles": ["Group Anagrams"],
            "title": "Группировка анаграмм",
            "description": "Реализуйте group_anagrams(words): сгруппируйте слова-ананаграммы, внутри группы отсортируйте.",
            "difficulty": 3,
            "time_limit_minutes": 120,
            "tests_json": {
                "type": "python_function",
                "function_name": "group_anagrams",
                "tests": [
                    {
                        "input": [["eat", "tea", "tan", "ate", "nat", "bat"]],
                        "expected": [["ate", "eat", "tea"], ["bat"], ["nat", "tan"]],
                    },
                ],
            },
            "starter_code": (
                "def group_anagrams(words):\n"
                "    groups = {}\n"
                "    for w in words:\n"
                "        key = ''.join(sorted(w))\n"
                "        groups.setdefault(key, []).append(w)\n"
                "    out = [sorted(v) for v in groups.values()]\n"
                "    return sorted(out, key=lambda g: g[0])\n"
            ),
        },
        {
            "legacy_titles": ["Valid Parentheses"],
            "title": "Валидные скобки",
            "description": "Реализуйте valid_parentheses(s): проверьте корректность скобок (), {}, [].",
            "difficulty": 3,
            "time_limit_minutes": 90,
            "tests_json": {
                "type": "python_function",
                "function_name": "valid_parentheses",
                "tests": [
                    {"input": ["()[]{}"], "expected": True},
                    {"input": ["(]"], "expected": False},
                    {"input": ["([{}])"], "expected": True},
                ],
            },
            "starter_code": (
                "def valid_parentheses(s):\n"
                "    st = []\n"
                "    pairs = {')': '(', ']': '[', '}': '{'}\n"
                "    for ch in s:\n"
                "        if ch in '([{':\n"
                "            st.append(ch)\n"
                "        elif ch in pairs:\n"
                "            if not st or st[-1] != pairs[ch]:\n"
                "                return False\n"
                "            st.pop()\n"
                "    return not st\n"
            ),
        },
        # ===== ЭКСПЕРТ (4) =====
        {
            "legacy_titles": [],
            "title": "BFS по неориентированному графу",
            "description": "Реализуйте bfs_levels(n, edges, start): верните список расстояний (в рёбрах) от start до всех вершин, -1 если недостижимо.",
            "difficulty": 4,
            "time_limit_minutes": 150,
            "tests_json": {
                "type": "python_function",
                "function_name": "bfs_levels",
                "tests": [
                    {"input": [5, [[0, 1], [1, 2], [0, 3]], 0], "expected": [0, 1, 2, 1, -1]},
                ],
            },
            "starter_code": (
                "from collections import deque\n"
                "def bfs_levels(n, edges, start):\n"
                "    g = [[] for _ in range(n)]\n"
                "    for u, v in edges:\n"
                "        g[u].append(v)\n"
                "        g[v].append(u)\n"
                "    dist = [-1] * n\n"
                "    dist[start] = 0\n"
                "    q = deque([start])\n"
                "    while q:\n"
                "        u = q.popleft()\n"
                "        for v in g[u]:\n"
                "            if dist[v] == -1:\n"
                "                dist[v] = dist[u] + 1\n"
                "                q.append(v)\n"
                "    return dist\n"
            ),
        },
        {
            "legacy_titles": ["Rotate Matrix 90"],
            "title": "Поворот матрицы на 90°",
            "description": "Реализуйте rotate_matrix(mat): поверните квадратную матрицу по часовой стрелке.",
            "difficulty": 4,
            "time_limit_minutes": 150,
            "tests_json": {
                "type": "python_function",
                "function_name": "rotate_matrix",
                "tests": [
                    {"input": [[[1, 2], [3, 4]]], "expected": [[3, 1], [4, 2]]},
                    {
                        "input": [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]],
                        "expected": [[7, 4, 1], [8, 5, 2], [9, 6, 3]],
                    },
                ],
            },
            "starter_code": "def rotate_matrix(mat):\n    return [list(row) for row in zip(*mat[::-1])]\n",
        },
        {
            "legacy_titles": ["Top K Frequent"],
            "title": "Топ-K самых частых",
            "description": "Реализуйте top_k_frequent(nums, k): верните k самых частых чисел.",
            "difficulty": 4,
            "time_limit_minutes": 150,
            "tests_json": {
                "type": "python_function",
                "function_name": "top_k_frequent",
                "tests": [
                    {"input": [[1, 1, 1, 2, 2, 3], 2], "expected": [1, 2]},
                    {"input": [[4, 4, 4, 6, 6, 1], 1], "expected": [4]},
                ],
            },
            "starter_code": (
                "def top_k_frequent(nums, k):\n"
                "    freq = {}\n"
                "    for n in nums:\n"
                "        freq[n] = freq.get(n, 0) + 1\n"
                "    pairs = sorted(freq.items(), key=lambda x: (-x[1], x[0]))\n"
                "    return [n for n, _ in pairs[:k]]\n"
            ),
        },
        # ===== ЛЕГЕНДАРНЫЕ (5) =====
        {
            "legacy_titles": ["Dijkstra Shortest Path"],
            "title": "Дейкстра: кратчайшие пути",
            "description": "Реализуйте dijkstra(n, edges, start): верните массив расстояний от start до всех вершин (или -1 если пути нет).",
            "difficulty": 5,
            "time_limit_minutes": 180,
            "tests_json": {
                "type": "python_function",
                "function_name": "dijkstra",
                "tests": [
                    {
                        "input": [5, [[0, 1, 2], [1, 2, 3], [0, 3, 1], [3, 4, 4], [4, 2, 1]], 0],
                        "expected": [0, 2, 5, 1, 5],
                    },
                ],
            },
            "starter_code": (
                "import heapq\n"
                "def dijkstra(n, edges, start):\n"
                "    g = [[] for _ in range(n)]\n"
                "    for u, v, w in edges:\n"
                "        g[u].append((v, w))\n"
                "    INF = 10**18\n"
                "    dist = [INF] * n\n"
                "    dist[start] = 0\n"
                "    pq = [(0, start)]\n"
                "    while pq:\n"
                "        d, u = heapq.heappop(pq)\n"
                "        if d != dist[u]:\n"
                "            continue\n"
                "        for v, w in g[u]:\n"
                "            nd = d + w\n"
                "            if nd < dist[v]:\n"
                "                dist[v] = nd\n"
                "                heapq.heappush(pq, (nd, v))\n"
                "    return [x if x < INF else -1 for x in dist]\n"
            ),
        },
        {
            "legacy_titles": ["LRU Cache Simulation"],
            "title": "Симуляция LRU-кэша",
            "description": "Реализуйте lru_sim(capacity, ops): для операций GET верните список значений (или -1).",
            "difficulty": 5,
            "time_limit_minutes": 180,
            "tests_json": {
                "type": "python_function",
                "function_name": "lru_sim",
                "tests": [
                    {
                        "input": [
                            2,
                            [["PUT", 1, 1], ["PUT", 2, 2], ["GET", 1], ["PUT", 3, 3], ["GET", 2], ["GET", 3]],
                        ],
                        "expected": [1, -1, 3],
                    },
                ],
            },
            "starter_code": (
                "from collections import OrderedDict\n"
                "def lru_sim(capacity, ops):\n"
                "    cache = OrderedDict()\n"
                "    out = []\n"
                "    for op in ops:\n"
                "        if op[0] == 'GET':\n"
                "            key = op[1]\n"
                "            if key in cache:\n"
                "                cache.move_to_end(key)\n"
                "                out.append(cache[key])\n"
                "            else:\n"
                "                out.append(-1)\n"
                "        else:\n"
                "            _, key, value = op\n"
                "            if key in cache:\n"
                "                cache.move_to_end(key)\n"
                "            cache[key] = value\n"
                "            if len(cache) > capacity:\n"
                "                cache.popitem(last=False)\n"
                "    return out\n"
            ),
        },
        {
            "legacy_titles": ["Merge K Sorted Lists"],
            "title": "Слить K отсортированных списков",
            "description": "Реализуйте merge_k_lists(lists): слейте k отсортированных списков в один отсортированный.",
            "difficulty": 5,
            "time_limit_minutes": 180,
            "tests_json": {
                "type": "python_function",
                "function_name": "merge_k_lists",
                "tests": [
                    {"input": [[[1, 4, 5], [1, 3, 4], [2, 6]]], "expected": [1, 1, 2, 3, 4, 4, 5, 6]},
                ],
            },
            "starter_code": (
                "import heapq\n"
                "def merge_k_lists(lists):\n"
                "    heap = []\n"
                "    for i, lst in enumerate(lists):\n"
                "        if lst:\n"
                "            heapq.heappush(heap, (lst[0], i, 0))\n"
                "    out = []\n"
                "    while heap:\n"
                "        val, li, idx = heapq.heappop(heap)\n"
                "        out.append(val)\n"
                "        ni = idx + 1\n"
                "        if ni < len(lists[li]):\n"
                "            heapq.heappush(heap, (lists[li][ni], li, ni))\n"
                "    return out\n"
            ),
        },
        {
            "legacy_titles": ["Min Window Substring Length"],
            "title": "Минимальное окно (длина)",
            "description": "Реализуйте min_window_len(s, t): верните длину минимального подотрезка s, содержащего все символы t (или 0).",
            "difficulty": 5,
            "time_limit_minutes": 180,
            "tests_json": {
                "type": "python_function",
                "function_name": "min_window_len",
                "tests": [
                    {"input": ["ADOBECODEBANC", "ABC"], "expected": 4},
                    {"input": ["a", "aa"], "expected": 0},
                ],
            },
            "starter_code": (
                "def min_window_len(s, t):\n"
                "    if not t or not s:\n"
                "        return 0\n"
                "    need = {}\n"
                "    for ch in t:\n"
                "        need[ch] = need.get(ch, 0) + 1\n"
                "    have = {}\n"
                "    formed = 0\n"
                "    required = len(need)\n"
                "    l = 0\n"
                "    best = 10**9\n"
                "    for r, ch in enumerate(s):\n"
                "        have[ch] = have.get(ch, 0) + 1\n"
                "        if ch in need and have[ch] == need[ch]:\n"
                "            formed += 1\n"
                "        while formed == required:\n"
                "            best = min(best, r - l + 1)\n"
                "            left = s[l]\n"
                "            have[left] -= 1\n"
                "            if left in need and have[left] < need[left]:\n"
                "                formed -= 1\n"
                "            l += 1\n"
                "    return 0 if best == 10**9 else best\n"
            ),
        },
        {
            "legacy_titles": ["Longest Increasing Subsequence Length"],
            "title": "Длина наибольшей возрастающей подпоследовательности",
            "description": "Реализуйте lis_len(nums): верните длину LIS.",
            "difficulty": 5,
            "time_limit_minutes": 180,
            "tests_json": {
                "type": "python_function",
                "function_name": "lis_len",
                "tests": [
                    {"input": [[10, 9, 2, 5, 3, 7, 101, 18]], "expected": 4},
                    {"input": [[0, 1, 0, 3, 2, 3]], "expected": 4},
                ],
            },
            "starter_code": (
                "def lis_len(nums):\n"
                "    tails = []\n"
                "    for x in nums:\n"
                "        l, r = 0, len(tails)\n"
                "        while l < r:\n"
                "            m = (l + r) // 2\n"
                "            if tails[m] < x:\n"
                "                l = m + 1\n"
                "            else:\n"
                "                r = m\n"
                "        if l == len(tails):\n"
                "            tails.append(x)\n"
                "        else:\n"
                "            tails[l] = x\n"
                "    return len(tails)\n"
            ),
        },
        {
            "legacy_titles": ["Thread-safe Counter Design"],
            "title": "Дизайн счётчика операций",
            "description": "Реализуйте lock_counter(ops): примените последовательность операций inc/dec и верните итог.",
            "difficulty": 5,
            "time_limit_minutes": 180,
            "tests_json": {
                "type": "python_function",
                "function_name": "lock_counter",
                "tests": [
                    {"input": [[["inc", 3], ["dec", 1], ["inc", 7]]], "expected": 9},
                    {"input": [[["dec", 2], ["inc", 5]]], "expected": 3},
                ],
            },
            "starter_code": (
                "def lock_counter(ops):\n"
                "    value = 0\n"
                "    for op, n in ops:\n"
                "        if op == 'inc':\n"
                "            value += n\n"
                "        elif op == 'dec':\n"
                "            value -= n\n"
                "    return value\n"
            ),
        },
        # ===== ДОПОЛНИТЕЛЬНЫЕ SOLO-ЗАДАЧИ (разные уровни) =====
        # Лёгкие (1)
        {
            "legacy_titles": ["Sum Array"],
            "title": "Сумма элементов массива",
            "description": "Реализуйте sum_array(nums): верните сумму всех чисел в списке.",
            "difficulty": 1,
            "time_limit_minutes": 30,
            "tests_json": {
                "type": "python_function",
                "function_name": "sum_array",
                "tests": [
                    {"input": [[1, 2, 3]], "expected": 6},
                    {"input": [[-1, 5, -4]], "expected": 0},
                    {"input": [[]], "expected": 0},
                ],
            },
            "starter_code": "def sum_array(nums):\n    return sum(nums)\n",
        },
        {
            "legacy_titles": ["Max In Array"],
            "title": "Максимум в массиве",
            "description": "Реализуйте max_in_array(nums): верните максимум. Если список пуст — верните None.",
            "difficulty": 1,
            "time_limit_minutes": 35,
            "tests_json": {
                "type": "python_function",
                "function_name": "max_in_array",
                "tests": [
                    {"input": [[1, 9, 3]], "expected": 9},
                    {"input": [[-10, -3, -7]], "expected": -3},
                    {"input": [[]], "expected": None},
                ],
            },
            "starter_code": "def max_in_array(nums):\n    return max(nums) if nums else None\n",
        },
        {
            "legacy_titles": ["GCD Two Numbers"],
            "title": "НОД двух чисел",
            "description": "Реализуйте gcd(a, b): верните наибольший общий делитель (алгоритм Евклида).",
            "difficulty": 1,
            "time_limit_minutes": 40,
            "tests_json": {
                "type": "python_function",
                "function_name": "gcd",
                "tests": [
                    {"input": [48, 18], "expected": 6},
                    {"input": [7, 13], "expected": 1},
                    {"input": [0, 5], "expected": 5},
                ],
            },
            "starter_code": (
                "def gcd(a, b):\n"
                "    a, b = abs(a), abs(b)\n"
                "    while b:\n"
                "        a, b = b, a % b\n"
                "    return a\n"
            ),
        },
        # Нормальные (2)
        {
            "legacy_titles": ["Is Prime"],
            "title": "Проверка простоты",
            "description": "Реализуйте is_prime(n): верните True, если n — простое число (n ≥ 0).",
            "difficulty": 2,
            "time_limit_minutes": 60,
            "tests_json": {
                "type": "python_function",
                "function_name": "is_prime",
                "tests": [
                    {"input": [2], "expected": True},
                    {"input": [1], "expected": False},
                    {"input": [49], "expected": False},
                    {"input": [97], "expected": True},
                ],
            },
            "starter_code": (
                "def is_prime(n):\n"
                "    n = int(n)\n"
                "    if n < 2:\n"
                "        return False\n"
                "    if n % 2 == 0:\n"
                "        return n == 2\n"
                "    d = 3\n"
                "    while d * d <= n:\n"
                "        if n % d == 0:\n"
                "            return False\n"
                "        d += 2\n"
                "    return True\n"
            ),
        },
        {
            "legacy_titles": ["Anagram Check"],
            "title": "Анаграммы",
            "description": "Реализуйте is_anagram(a, b): верните True, если строки — анаграммы (регистр игнорируйте).",
            "difficulty": 2,
            "time_limit_minutes": 60,
            "tests_json": {
                "type": "python_function",
                "function_name": "is_anagram",
                "tests": [
                    {"input": ["listen", "silent"], "expected": True},
                    {"input": ["А роза", "за ора"], "expected": True},
                    {"input": ["abc", "ab"], "expected": False},
                ],
            },
            "starter_code": (
                "def is_anagram(a, b):\n"
                "    import re\n"
                "    a = re.sub(r'\\s+', '', str(a).lower())\n"
                "    b = re.sub(r'\\s+', '', str(b).lower())\n"
                "    return sorted(a) == sorted(b)\n"
            ),
        },
        {
            "legacy_titles": ["Valid Parentheses"],
            "title": "Правильные скобки",
            "description": "Реализуйте is_valid_brackets(s): проверьте корректность скобочной последовательности из ()[]{}.",
            "difficulty": 2,
            "time_limit_minutes": 70,
            "tests_json": {
                "type": "python_function",
                "function_name": "is_valid_brackets",
                "tests": [
                    {"input": ["()[]{}"], "expected": True},
                    {"input": ["([{}])"], "expected": True},
                    {"input": ["(]"], "expected": False},
                    {"input": ["((("], "expected": False},
                ],
            },
            "starter_code": (
                "def is_valid_brackets(s):\n"
                "    pairs = {')': '(', ']': '[', '}': '{'}\n"
                "    st = []\n"
                "    for ch in s:\n"
                "        if ch in '([{':\n"
                "            st.append(ch)\n"
                "        elif ch in pairs:\n"
                "            if not st or st[-1] != pairs[ch]:\n"
                "                return False\n"
                "            st.pop()\n"
                "    return not st\n"
            ),
        },
        # Сложные (3)
        {
            "legacy_titles": ["Binary Search"],
            "title": "Бинарный поиск",
            "description": "Реализуйте binary_search(nums, target): верните индекс target в отсортированном nums или -1.",
            "difficulty": 3,
            "time_limit_minutes": 90,
            "tests_json": {
                "type": "python_function",
                "function_name": "binary_search",
                "tests": [
                    {"input": [[1, 3, 5, 7, 9], 7], "expected": 3},
                    {"input": [[1, 3, 5, 7, 9], 2], "expected": -1},
                    {"input": [[], 1], "expected": -1},
                ],
            },
            "starter_code": (
                "def binary_search(nums, target):\n"
                "    l, r = 0, len(nums) - 1\n"
                "    while l <= r:\n"
                "        m = (l + r) // 2\n"
                "        if nums[m] == target:\n"
                "            return m\n"
                "        if nums[m] < target:\n"
                "            l = m + 1\n"
                "        else:\n"
                "            r = m - 1\n"
                "    return -1\n"
            ),
        },
        {
            "legacy_titles": ["BFS Shortest Path Unweighted"],
            "title": "BFS: кратчайший путь (без весов)",
            "description": "Реализуйте bfs_shortest(n, edges, start, goal): верните длину кратчайшего пути или -1.",
            "difficulty": 3,
            "time_limit_minutes": 110,
            "tests_json": {
                "type": "python_function",
                "function_name": "bfs_shortest",
                "tests": [
                    {"input": [5, [[0, 1], [1, 2], [2, 3], [0, 4]], 0, 3], "expected": 3},
                    {"input": [4, [[0, 1], [2, 3]], 0, 3], "expected": -1},
                ],
            },
            "starter_code": (
                "from collections import deque\n"
                "def bfs_shortest(n, edges, start, goal):\n"
                "    g = [[] for _ in range(n)]\n"
                "    for u, v in edges:\n"
                "        g[u].append(v)\n"
                "        g[v].append(u)\n"
                "    dist = [-1] * n\n"
                "    q = deque([start])\n"
                "    dist[start] = 0\n"
                "    while q:\n"
                "        u = q.popleft()\n"
                "        if u == goal:\n"
                "            return dist[u]\n"
                "        for v in g[u]:\n"
                "            if dist[v] == -1:\n"
                "                dist[v] = dist[u] + 1\n"
                "                q.append(v)\n"
                "    return -1\n"
            ),
        },
        # Очень сложные (4)
        {
            "legacy_titles": ["Topological Sort"],
            "title": "Топологическая сортировка",
            "description": "Реализуйте topo_sort(n, edges): верните порядок вершин DAG или пустой список, если есть цикл.",
            "difficulty": 4,
            "time_limit_minutes": 150,
            "tests_json": {
                "type": "python_function",
                "function_name": "topo_sort",
                "tests": [
                    {"input": [4, [[0, 1], [0, 2], [1, 3], [2, 3]]], "expected": [0, 1, 2, 3]},
                    {"input": [2, [[0, 1], [1, 0]]], "expected": []},
                ],
            },
            "starter_code": (
                "from collections import deque\n"
                "def topo_sort(n, edges):\n"
                "    g = [[] for _ in range(n)]\n"
                "    indeg = [0] * n\n"
                "    for u, v in edges:\n"
                "        g[u].append(v)\n"
                "        indeg[v] += 1\n"
                "    q = deque([i for i in range(n) if indeg[i] == 0])\n"
                "    out = []\n"
                "    while q:\n"
                "        u = q.popleft()\n"
                "        out.append(u)\n"
                "        for v in g[u]:\n"
                "            indeg[v] -= 1\n"
                "            if indeg[v] == 0:\n"
                "                q.append(v)\n"
                "    return out if len(out) == n else []\n"
            ),
        },
        # Легендарные (5)
        {
            "legacy_titles": ["KMP Substring Search"],
            "title": "KMP: поиск подстроки",
            "description": "Реализуйте kmp_find(s, p): верните первый индекс вхождения p в s или -1.",
            "difficulty": 5,
            "time_limit_minutes": 180,
            "tests_json": {
                "type": "python_function",
                "function_name": "kmp_find",
                "tests": [
                    {"input": ["ababcabcabababd", "ababd"], "expected": 10},
                    {"input": ["aaaaa", "bba"], "expected": -1},
                    {"input": ["abc", ""], "expected": 0},
                ],
            },
            "starter_code": (
                "def kmp_find(s, p):\n"
                "    s = str(s)\n"
                "    p = str(p)\n"
                "    if p == '':\n"
                "        return 0\n"
                "    # prefix-function (lps)\n"
                "    lps = [0] * len(p)\n"
                "    j = 0\n"
                "    for i in range(1, len(p)):\n"
                "        while j > 0 and p[i] != p[j]:\n"
                "            j = lps[j - 1]\n"
                "        if p[i] == p[j]:\n"
                "            j += 1\n"
                "            lps[i] = j\n"
                "    j = 0\n"
                "    for i, ch in enumerate(s):\n"
                "        while j > 0 and ch != p[j]:\n"
                "            j = lps[j - 1]\n"
                "        if ch == p[j]:\n"
                "            j += 1\n"
                "            if j == len(p):\n"
                "                return i - len(p) + 1\n"
                "    return -1\n"
            ),
        },
    ]

    changed = False
    to_insert: list[Task] = []

    for seed in seeds:
        # Ищем существующую задачу по текущему title или по legacy_titles (если была сидирована раньше на EN).
        candidates = [seed["title"], *seed.get("legacy_titles", [])]
        existing = None
        for t in candidates:
            existing = existing_by_title.get(t)
            if existing is not None:
                break

        if existing is None:
            to_insert.append(
                Task(
                    title=seed["title"],
                    description=seed["description"],
                    task_type=TaskType.solo,
                    difficulty=seed["difficulty"],
                    time_limit_minutes=seed["time_limit_minutes"],
                    tests_json=seed["tests_json"],
                    starter_code=seed.get("starter_code"),
                    is_published=True,
                )
            )
            continue

        # Обновляем существующие сиды под новые требования: русские тексты + только solo.
        if existing.title != seed["title"]:
            existing.title = seed["title"]
            changed = True
        if existing.description != seed["description"]:
            existing.description = seed["description"]
            changed = True
        if existing.task_type != TaskType.solo:
            existing.task_type = TaskType.solo
            changed = True
        if existing.difficulty != seed["difficulty"]:
            existing.difficulty = seed["difficulty"]
            changed = True
        if existing.time_limit_minutes != seed["time_limit_minutes"]:
            existing.time_limit_minutes = seed["time_limit_minutes"]
            changed = True
        if existing.tests_json != seed["tests_json"]:
            existing.tests_json = seed["tests_json"]
            changed = True
        if seed.get("starter_code") is not None and existing.starter_code != seed.get("starter_code"):
            existing.starter_code = seed.get("starter_code")
            changed = True
        if existing.is_published is not True:
            existing.is_published = True
            changed = True

    if to_insert:
        db.add_all(to_insert)
        changed = True

    if changed:
        db.commit()
