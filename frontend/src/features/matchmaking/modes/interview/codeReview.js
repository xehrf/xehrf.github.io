/**
 * Code Review interview scenarios.
 *
 * Each round asks the player to reason like in a real interview:
 * find the main issue, pick a better implementation, and choose the
 * review comment that sounds like a senior engineer.
 */

export const REVIEW_CATEGORIES = ["problem", "improvement", "comment"];

export const CODE_REVIEW_SCENARIOS = [
  {
    id: "python-user-names",
    title: "Python: собираем имена пользователей",
    role: "Backend review",
    code: `users = []
for u in db:
    users.append(u.name)`,
    choices: {
      problem: [
        {
          id: "append-style",
          text: "Главная проблема в том, что append выглядит слишком многословно.",
          rationale: "Это косметика, а не самый важный риск.",
        },
        {
          id: "projection",
          text: "Код может тянуть из БД целые объекты, хотя нужны только имена.",
          rationale: "Да: если db - это query/курсор, лучше спроецировать только нужное поле.",
        },
        {
          id: "empty-array",
          text: "Пустой список нельзя объявлять до цикла, потому что он потеряет данные.",
          rationale: "Список как раз нужен до цикла, иначе append некуда делать.",
        },
      ],
      improvement: [
        {
          id: "list-comprehension",
          text: "user_names = [u.name for u in db]",
          rationale: "Лучше по читаемости, но всё ещё может материализовать лишние поля.",
        },
        {
          id: "select-name",
          text: "user_names = session.scalars(select(User.name)).all()",
          rationale: "Да: выбираем только User.name на уровне запроса и называем результат точнее.",
        },
        {
          id: "map-lambda",
          text: "users = list(map(lambda u: u.name, db))",
          rationale: "Не даёт выигрыша и хуже читается для Python-кода.",
        },
      ],
      comment: [
        {
          id: "junior-nit",
          text: "Можно просто сделать list comprehension, так красивее.",
          rationale: "Так отвечает junior: верно замечает стиль, но пропускает стоимость запроса.",
        },
        {
          id: "senior-query",
          text: "Я бы выбирал только User.name в SQL-запросе и переименовал users в user_names; если строк много, нужна пагинация или стриминг.",
          rationale: "Да: комментарий связывает читаемость, нагрузку и поведение на больших данных.",
        },
        {
          id: "rewrite-all",
          text: "Этот код надо полностью переписать на другой ORM.",
          rationale: "Слишком широкий вывод без доказанной причины.",
        },
      ],
    },
    answers: {
      problem: "projection",
      improvement: "select-name",
      comment: "senior-query",
    },
    improvedCode: `from sqlalchemy import select

user_names = session.scalars(select(User.name)).all()`,
    juniorAnswer: "Я бы заменил цикл на list comprehension: `[u.name for u in db]`. Так короче.",
    seniorAnswer:
      "Я бы сначала уточнил, что такое `db`. Если это query/курсор, проблема не в цикле, а в том, что мы можем загрузить целые User-объекты ради одного поля. Лучше выбрать `User.name` на уровне SQL, назвать переменную `user_names` и подумать о пагинации/стриминге для больших выборок.",
  },
  {
    id: "js-async-map",
    title: "JavaScript: имена по id",
    role: "Async review",
    code: `async function getUserNames(ids) {
  const users = ids.map(async (id) => {
    const user = await api.getUser(id);
    return user.name;
  });

  return users;
}`,
    choices: {
      problem: [
        {
          id: "promises",
          text: "Функция возвращает массив Promise, а не массив имён.",
          rationale: "Да: async callback внутри map не делает внешний массив готовыми значениями.",
        },
        {
          id: "missing-var",
          text: "Нужно заменить const на let, иначе users нельзя вернуть.",
          rationale: "const не мешает вернуть значение.",
        },
        {
          id: "callback-style",
          text: "Нельзя использовать async/await внутри map.",
          rationale: "Можно, но результатом будет массив промисов.",
        },
      ],
      improvement: [
        {
          id: "promise-all",
          text: "return Promise.all(ids.map(async (id) => (await api.getUser(id)).name));",
          rationale: "Да: ждём все запросы и возвращаем имена.",
        },
        {
          id: "forEach",
          text: "const users = []; ids.forEach(async id => users.push((await api.getUser(id)).name)); return users;",
          rationale: "forEach не ждёт async callback; вернётся пустой или неполный массив.",
        },
        {
          id: "json-stringify",
          text: "return JSON.stringify(users);",
          rationale: "Сериализация не решает проблему промисов.",
        },
      ],
      comment: [
        {
          id: "senior-concurrency",
          text: "Нужно обернуть map в Promise.all; если ids может быть большим, стоит добавить лимит concurrency, чтобы не положить API пачкой запросов.",
          rationale: "Да: исправляет баг и сразу отмечает эксплуатационный риск.",
        },
        {
          id: "junior-await",
          text: "Поставь await перед ids.map.",
          rationale: "await массива не дождётся его внутренних промисов.",
        },
        {
          id: "style-only",
          text: "Лучше переименовать users в names.",
          rationale: "Имя можно улучшить, но это не главный баг.",
        },
      ],
    },
    answers: {
      problem: "promises",
      improvement: "promise-all",
      comment: "senior-concurrency",
    },
    improvedCode: `async function getUserNames(ids) {
  return Promise.all(
    ids.map(async (id) => {
      const user = await api.getUser(id);
      return user.name;
    }),
  );
}`,
    juniorAnswer: "Тут надо где-то добавить await, потому что внутри map async.",
    seniorAnswer:
      "Сейчас `users` - это массив Promise, поэтому вызывающий код получит не имена. Минимальный фикс - `Promise.all(ids.map(...))`. Если список id потенциально большой, я бы не запускал все запросы одновременно, а добавил ограничение параллелизма или batch endpoint.",
  },
  {
    id: "react-search-state",
    title: "React: поле поиска",
    role: "Frontend review",
    code: `function SearchBox({ query }) {
  const [value, setValue] = useState(query);

  useEffect(() => {
    setValue(query);
  });

  return (
    <input
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}`,
    choices: {
      problem: [
        {
          id: "no-deps",
          text: "useEffect без dependency array запускается после каждого рендера и может затирать ввод пользователя.",
          rationale: "Да: локальный value постоянно синхронизируется обратно из props.",
        },
        {
          id: "input-event",
          text: "onChange нельзя использовать на input в React.",
          rationale: "onChange - стандартный обработчик для контролируемого input.",
        },
        {
          id: "state-name",
          text: "value - зарезервированное имя, его нельзя использовать в state.",
          rationale: "Это обычное имя переменной.",
        },
      ],
      improvement: [
        {
          id: "controlled",
          text: "Сделать компонент полностью контролируемым: value={query}, onChange={onQueryChange}.",
          rationale: "Да: один источник правды проще, если query уже живёт у родителя.",
        },
        {
          id: "empty-deps",
          text: "Поставить [] и больше никогда не обновлять value из query.",
          rationale: "Тогда внешнее изменение query не попадёт в поле.",
        },
        {
          id: "memo",
          text: "Обернуть setValue в useMemo.",
          rationale: "useMemo не исправляет цикл синхронизации state из props.",
        },
      ],
      comment: [
        {
          id: "senior-source",
          text: "Тут смешаны controlled и локальный state. Давай выберем один источник правды; если нужен reset от query, синхронизируем только по [query].",
          rationale: "Да: комментарий описывает модель состояния и оставляет вариант для UX-требования.",
        },
        {
          id: "junior-deps",
          text: "Добавь dependency array, React ругается.",
          rationale: "Это близко, но не объясняет, какая модель состояния нужна.",
        },
        {
          id: "delete-effect",
          text: "useEffect всегда плохой, его нужно удалить из проекта.",
          rationale: "Слишком категорично и не помогает принять дизайн-решение.",
        },
      ],
    },
    answers: {
      problem: "no-deps",
      improvement: "controlled",
      comment: "senior-source",
    },
    improvedCode: `function SearchBox({ query, onQueryChange }) {
  return (
    <input
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
    />
  );
}`,
    juniorAnswer: "Нужно добавить dependency array в useEffect, потому что линтер ругается.",
    seniorAnswer:
      "Проблема глубже линтера: компонент одновременно пытается быть controlled и держать локальную копию props. Я бы выбрал один источник правды. Если поле должно отражать `query` родителя, пусть родитель управляет value/onChange. Если нужен локальный draft, синхронизацию надо делать осознанно и только по `[query]`.",
  },
];

export function pickCodeReviewScenario(random = Math.random) {
  const idx = Math.floor(random() * CODE_REVIEW_SCENARIOS.length);
  return CODE_REVIEW_SCENARIOS[idx];
}

export function scoreCodeReviewAnswer(scenario, selections) {
  const details = REVIEW_CATEGORIES.map((category) => {
    const selectedId = selections?.[category] ?? null;
    return {
      category,
      selectedId,
      expectedId: scenario.answers[category],
      correct: selectedId === scenario.answers[category],
    };
  });

  return {
    correct: details.filter((item) => item.correct).length,
    total: details.length,
    details,
  };
}
