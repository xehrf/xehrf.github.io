from sqlalchemy.orm import Session

from app.db.models import Task, TaskType


def seed_if_empty(db: Session) -> None:
    existing_titles = {row[0] for row in db.query(Task.title).all()}

    seeded: list[Task] = [
        Task(
            title="Sum Two Numbers",
            description="Implement function sum_two(a, b) that returns a + b.",
            task_type=TaskType.solo,
            difficulty=1,
            time_limit_minutes=30,
            tests_json={
                "type": "python_function",
                "function_name": "sum_two",
                "tests": [
                    {"input": [1, 2], "expected": 3},
                    {"input": [-5, 8], "expected": 3},
                    {"input": [0, 0], "expected": 0},
                ],
            },
            starter_code="def sum_two(a, b):\n    return a + b\n",
            is_published=True,
        ),
        Task(
            title="Is Even",
            description="Implement is_even(n) that returns True for even numbers.",
            task_type=TaskType.solo,
            difficulty=1,
            time_limit_minutes=30,
            tests_json={
                "type": "python_function",
                "function_name": "is_even",
                "tests": [
                    {"input": [2], "expected": True},
                    {"input": [7], "expected": False},
                    {"input": [0], "expected": True},
                ],
            },
            starter_code="def is_even(n):\n    return n % 2 == 0\n",
            is_published=True,
        ),
        Task(
            title="Reverse String",
            description="Implement reverse_string(s) that returns the reversed string.",
            task_type=TaskType.solo,
            difficulty=1,
            time_limit_minutes=30,
            tests_json={
                "type": "python_function",
                "function_name": "reverse_string",
                "tests": [
                    {"input": ["abc"], "expected": "cba"},
                    {"input": ["CodeArena"], "expected": "anerAedoC"},
                    {"input": [""], "expected": ""},
                ],
            },
            starter_code="def reverse_string(s):\n    return s[::-1]\n",
            is_published=True,
        ),
        Task(
            title="Factorial",
            description="Implement factorial(n) for n >= 0.",
            task_type=TaskType.solo,
            difficulty=1,
            time_limit_minutes=40,
            tests_json={
                "type": "python_function",
                "function_name": "factorial",
                "tests": [
                    {"input": [0], "expected": 1},
                    {"input": [5], "expected": 120},
                    {"input": [7], "expected": 5040},
                ],
            },
            starter_code="def factorial(n):\n    res = 1\n    for i in range(2, n + 1):\n        res *= i\n    return res\n",
            is_published=True,
        ),
        Task(
            title="Count Vowels",
            description="Implement count_vowels(s) that counts aeiou vowels.",
            task_type=TaskType.solo,
            difficulty=1,
            time_limit_minutes=30,
            tests_json={
                "type": "python_function",
                "function_name": "count_vowels",
                "tests": [
                    {"input": ["hello"], "expected": 2},
                    {"input": ["xyz"], "expected": 0},
                    {"input": ["AEIOU"], "expected": 5},
                ],
            },
            starter_code="def count_vowels(s):\n    vowels = set('aeiou')\n    return sum(1 for ch in s.lower() if ch in vowels)\n",
            is_published=True,
        ),
        Task(
            title="FizzBuzz N",
            description="Implement fizz_buzz(n) returning list from 1..n with fizz/buzz rules.",
            task_type=TaskType.solo,
            difficulty=1,
            time_limit_minutes=40,
            tests_json={
                "type": "python_function",
                "function_name": "fizz_buzz",
                "tests": [
                    {"input": [5], "expected": ["1", "2", "fizz", "4", "buzz"]},
                    {"input": [3], "expected": ["1", "2", "fizz"]},
                ],
            },
            starter_code=(
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
            is_published=True,
        ),
        Task(
            title="Two Sum Indices",
            description="Implement two_sum(nums, target) returning indices of two numbers.",
            task_type=TaskType.solo,
            difficulty=3,
            time_limit_minutes=90,
            tests_json={
                "type": "python_function",
                "function_name": "two_sum",
                "tests": [
                    {"input": [[2, 7, 11, 15], 9], "expected": [0, 1]},
                    {"input": [[3, 2, 4], 6], "expected": [1, 2]},
                ],
            },
            starter_code=(
                "def two_sum(nums, target):\n"
                "    seen = {}\n"
                "    for i, n in enumerate(nums):\n"
                "        need = target - n\n"
                "        if need in seen:\n"
                "            return [seen[need], i]\n"
                "        seen[n] = i\n"
                "    return []\n"
            ),
            is_published=True,
        ),
        Task(
            title="Valid Parentheses",
            description="Implement valid_parentheses(s) for (), {}, [].",
            task_type=TaskType.match,
            difficulty=3,
            time_limit_minutes=90,
            tests_json={
                "type": "python_function",
                "function_name": "valid_parentheses",
                "tests": [
                    {"input": ["()[]{}"], "expected": True},
                    {"input": ["(]"], "expected": False},
                    {"input": ["([{}])"], "expected": True},
                ],
            },
            starter_code=(
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
            is_published=True,
        ),
        Task(
            title="Binary Search",
            description="Implement binary_search(nums, target) returning index or -1.",
            task_type=TaskType.solo,
            difficulty=3,
            time_limit_minutes=90,
            tests_json={
                "type": "python_function",
                "function_name": "binary_search",
                "tests": [
                    {"input": [[1, 3, 5, 7, 9], 7], "expected": 3},
                    {"input": [[1, 3, 5, 7, 9], 2], "expected": -1},
                ],
            },
            starter_code=(
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
            is_published=True,
        ),
        Task(
            title="Top K Frequent",
            description="Implement top_k_frequent(nums, k).",
            task_type=TaskType.match,
            difficulty=3,
            time_limit_minutes=120,
            tests_json={
                "type": "python_function",
                "function_name": "top_k_frequent",
                "tests": [
                    {"input": [[1, 1, 1, 2, 2, 3], 2], "expected": [1, 2]},
                    {"input": [[4, 4, 4, 6, 6, 1], 1], "expected": [4]},
                ],
            },
            starter_code=(
                "def top_k_frequent(nums, k):\n"
                "    freq = {}\n"
                "    for n in nums:\n"
                "        freq[n] = freq.get(n, 0) + 1\n"
                "    pairs = sorted(freq.items(), key=lambda x: (-x[1], x[0]))\n"
                "    return [n for n, _ in pairs[:k]]\n"
            ),
            is_published=True,
        ),
        Task(
            title="Group Anagrams",
            description="Implement group_anagrams(words) sorted by group key.",
            task_type=TaskType.solo,
            difficulty=3,
            time_limit_minutes=120,
            tests_json={
                "type": "python_function",
                "function_name": "group_anagrams",
                "tests": [
                    {"input": [["eat", "tea", "tan", "ate", "nat", "bat"]], "expected": [["ate", "eat", "tea"], ["bat"], ["nat", "tan"]]},
                ],
            },
            starter_code=(
                "def group_anagrams(words):\n"
                "    groups = {}\n"
                "    for w in words:\n"
                "        key = ''.join(sorted(w))\n"
                "        groups.setdefault(key, []).append(w)\n"
                "    out = [sorted(v) for v in groups.values()]\n"
                "    return sorted(out, key=lambda g: g[0])\n"
            ),
            is_published=True,
        ),
        Task(
            title="Rotate Matrix 90",
            description="Implement rotate_matrix(mat) clockwise.",
            task_type=TaskType.match,
            difficulty=3,
            time_limit_minutes=120,
            tests_json={
                "type": "python_function",
                "function_name": "rotate_matrix",
                "tests": [
                    {"input": [[[1, 2], [3, 4]]], "expected": [[3, 1], [4, 2]]},
                    {"input": [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], "expected": [[7, 4, 1], [8, 5, 2], [9, 6, 3]]},
                ],
            },
            starter_code="def rotate_matrix(mat):\n    return [list(row) for row in zip(*mat[::-1])]\n",
            is_published=True,
        ),
        Task(
            title="Dijkstra Shortest Path",
            description="Implement dijkstra(n, edges, start) returning distances list.",
            task_type=TaskType.solo,
            difficulty=5,
            time_limit_minutes=180,
            tests_json={
                "type": "python_function",
                "function_name": "dijkstra",
                "tests": [
                    {"input": [5, [[0, 1, 2], [1, 2, 3], [0, 3, 1], [3, 4, 4], [4, 2, 1]], 0], "expected": [0, 2, 5, 1, 5]},
                ],
            },
            starter_code=(
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
            is_published=True,
        ),
        Task(
            title="LRU Cache Simulation",
            description="Implement lru_sim(capacity, ops) returning outputs for GET ops.",
            task_type=TaskType.match,
            difficulty=5,
            time_limit_minutes=180,
            tests_json={
                "type": "python_function",
                "function_name": "lru_sim",
                "tests": [
                    {"input": [2, [["PUT", 1, 1], ["PUT", 2, 2], ["GET", 1], ["PUT", 3, 3], ["GET", 2], ["GET", 3]]], "expected": [1, -1, 3]},
                ],
            },
            starter_code=(
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
            is_published=True,
        ),
        Task(
            title="Merge K Sorted Lists",
            description="Implement merge_k_lists(lists) returning one sorted list.",
            task_type=TaskType.solo,
            difficulty=5,
            time_limit_minutes=180,
            tests_json={
                "type": "python_function",
                "function_name": "merge_k_lists",
                "tests": [
                    {"input": [[[1, 4, 5], [1, 3, 4], [2, 6]]], "expected": [1, 1, 2, 3, 4, 4, 5, 6]},
                ],
            },
            starter_code=(
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
            is_published=True,
        ),
        Task(
            title="Longest Increasing Subsequence Length",
            description="Implement lis_len(nums).",
            task_type=TaskType.match,
            difficulty=5,
            time_limit_minutes=180,
            tests_json={
                "type": "python_function",
                "function_name": "lis_len",
                "tests": [
                    {"input": [[10, 9, 2, 5, 3, 7, 101, 18]], "expected": 4},
                    {"input": [[0, 1, 0, 3, 2, 3]], "expected": 4},
                ],
            },
            starter_code=(
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
            is_published=True,
        ),
        Task(
            title="Min Window Substring Length",
            description="Implement min_window_len(s, t), return minimal window length or 0.",
            task_type=TaskType.solo,
            difficulty=5,
            time_limit_minutes=180,
            tests_json={
                "type": "python_function",
                "function_name": "min_window_len",
                "tests": [
                    {"input": ["ADOBECODEBANC", "ABC"], "expected": 4},
                    {"input": ["a", "aa"], "expected": 0},
                ],
            },
            starter_code=(
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
            is_published=True,
        ),
        Task(
            title="Thread-safe Counter Design",
            description="Implement lock_counter(ops) where ops is list of increments/decrements.",
            task_type=TaskType.match,
            difficulty=5,
            time_limit_minutes=180,
            tests_json={
                "type": "python_function",
                "function_name": "lock_counter",
                "tests": [
                    {"input": [[["inc", 3], ["dec", 1], ["inc", 7]]], "expected": 9},
                    {"input": [[["dec", 2], ["inc", 5]]], "expected": 3},
                ],
            },
            starter_code=(
                "def lock_counter(ops):\n"
                "    value = 0\n"
                "    for op, n in ops:\n"
                "        if op == 'inc':\n"
                "            value += n\n"
                "        elif op == 'dec':\n"
                "            value -= n\n"
                "    return value\n"
            ),
            is_published=True,
        ),
    ]

    to_insert = [task for task in seeded if task.title not in existing_titles]
    if to_insert:
        db.add_all(to_insert)
        db.commit()
