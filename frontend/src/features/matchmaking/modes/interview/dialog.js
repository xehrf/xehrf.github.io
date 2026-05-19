/**
 * Branching HR dialog: 6 slots, per-slot pool of 2–3 question variants.
 *
 * The player walks through 6 questions in order. At each slot we randomly
 * pick one variant from the pool, so two consecutive runs feel different
 * even though the structure is fixed. Each answer carries a `moodDelta`
 * in the range [-3, +3] that shifts the interviewer's mood gauge.
 *
 * Final verdict is derived from how many answers landed in mood-positive
 * territory (moodDelta > 0). That maps cleanly to the backend's
 * accuracy-based verdict — no special-casing on the server side.
 */

const SLOT_TITLES = [
  "Знакомство",
  "Технический скрининг",
  "Дебаг-сценарий",
  "Командная работа",
  "Мотивация",
  "Финальные вопросы",
];

const SLOTS = [
  // Slot 0 — opener
  [
    {
      question: "Расскажи о себе и почему ты подал заявку?",
      options: [
        {
          text: "Я junior, ищу место где могу расти и учиться у сильной команды",
          moodDelta: 2,
          reaction: "Хорошо, мы как раз вкладываемся в junior-программу.",
        },
        {
          text: "5+ лет на бэке, хочу глубже в распределённые системы",
          moodDelta: 1,
          reaction: "Звучит по делу. Поговорим о системах позже.",
        },
        {
          text: "Прежде чем отвечать, расскажите про команду и стек",
          moodDelta: 0,
          reaction: "Любопытный ход — обычно такое делают сениоры. Стек — Go + Kafka.",
        },
        {
          text: "Мне срочно нужна работа, готов учить что угодно",
          moodDelta: -2,
          reaction: "Понимаю. Но мы ищем людей, которым интересна именно эта роль.",
        },
      ],
    },
    {
      question: "Что было самым интересным проектом за последний год?",
      options: [
        {
          text: "Переписал критичный сервис, упёрся в требования по latency — пришлось профилировать с zero-allocation",
          moodDelta: 3,
          reaction: "Это уже разговор по делу. Расскажешь подробнее позже?",
        },
        {
          text: "Ничего особенного, обычная работа",
          moodDelta: -3,
          reaction: "Странно — обычно у каждого есть проект, который зацепил.",
        },
        {
          text: "Внедрял новый фреймворк, было интересно учить с нуля",
          moodDelta: 1,
          reaction: "Окей. И как — справляешься, когда новое сваливается на голову?",
        },
        {
          text: "Делал внутренний tool — никто не пользовался, но прокачался",
          moodDelta: 0,
          reaction: "Бывает. Главное — что вынес из этого.",
        },
      ],
    },
  ],
  // Slot 1 — technical depth
  [
    {
      question: "Опиши, как ты бы спроектировал API чата на 1M пользователей онлайн.",
      options: [
        {
          text: "WebSocket, sharding по user_id, Redis pubsub между нодами",
          moodDelta: 2,
          reaction: "Адекватно. А как с persistence истории?",
        },
        {
          text: "Это слишком абстрактно — расскажите про требования к latency и доступности",
          moodDelta: 3,
          reaction: "Отличная реакция. Большинство кидаются в технологии без контекста.",
        },
        {
          text: "Long polling + nginx, как все делают",
          moodDelta: -2,
          reaction: "Хм. На 1М онлайн long polling будет тяжко.",
        },
        {
          text: "Не работал с такими нагрузками — могу попробовать порассуждать",
          moodDelta: 1,
          reaction: "Честно. Давай тогда порассуждаем вместе.",
        },
      ],
    },
    {
      question: "Что делает Database index и когда он вредит?",
      options: [
        {
          text: "Ускоряет SELECT, но замедляет INSERT/UPDATE и занимает место",
          moodDelta: 2,
          reaction: "Хорошо. А что насчёт write-heavy таблиц?",
        },
        {
          text: "Делает таблицу быстрее, минусов нет",
          moodDelta: -3,
          reaction: "Минусы есть всегда — write amplification, место, locks при ребилде.",
        },
        {
          text: "Это B-tree, хранит указатели на строки",
          moodDelta: 1,
          reaction: "Технически верно, но я спрашивал про trade-off.",
        },
        {
          text: "Зависит от типа: B-tree, hash, GIN — у каждого свои сценарии",
          moodDelta: 3,
          reaction: "Видно, что щупал руками. Двигаемся дальше.",
        },
      ],
    },
    {
      question: "Что такое идемпотентность в HTTP и зачем она?",
      options: [
        {
          text: "Повторный вызов даёт тот же результат — критично для retry в распределённых системах",
          moodDelta: 3,
          reaction: "Точно. А PATCH идемпотентен?",
        },
        {
          text: "Это про то, что метод не меняет данные",
          moodDelta: -1,
          reaction: "Не совсем — GET не меняет, но идемпотентность шире.",
        },
        {
          text: "PUT и DELETE идемпотентны, POST — нет",
          moodDelta: 2,
          reaction: "Верно. А почему это вообще важно для API?",
        },
        {
          text: "Никогда не задумывался",
          moodDelta: -2,
          reaction: "Жаль — это базовое для любого, кто пишет HTTP API.",
        },
      ],
    },
  ],
  // Slot 2 — debugging
  [
    {
      question: "Прод упал в 3 ночи. Ты на колле один. Действия?",
      options: [
        {
          text: "Откачу последний релиз и напишу постмортем утром",
          moodDelta: 2,
          reaction: "Грамотно. Стабилизация раньше расследования.",
        },
        {
          text: "Буду чинить, пока не починю",
          moodDelta: -1,
          reaction: "Героизм — это плохой план. Так выгорают.",
        },
        {
          text: "Подниму другого инженера — две головы лучше",
          moodDelta: 1,
          reaction: "Норм. Но сначала всё-таки попробуй rollback.",
        },
        {
          text: "Это не моя зона ответственности в это время",
          moodDelta: -3,
          reaction: "Тогда зачем ты на колле, если не готов работать?",
        },
      ],
    },
    {
      question: "Баг воспроизводится 1 раз из 100. Как подходишь?",
      options: [
        {
          text: "Попробую воспроизвести локально, потом добавлю целевые логи в подозрительные места",
          moodDelta: 3,
          reaction: "Так и должно быть — гипотеза, потом проверка.",
        },
        {
          text: "Добавлю логирование везде и буду ждать",
          moodDelta: 0,
          reaction: "Сработает, но дорого по шуму. А если нагрузка большая?",
        },
        {
          text: "Игнорирую — низкий приоритет",
          moodDelta: -3,
          reaction: "1 из 100 на масштабе — это много инцидентов в день.",
        },
        {
          text: "Перезагружу прод, может само рассосётся",
          moodDelta: -2,
          reaction: "Symptom-driven медицина. Так баги не уходят, а накапливаются.",
        },
      ],
    },
  ],
  // Slot 3 — teamwork
  [
    {
      question: "Тимлид настаивает на решении, которое тебе кажется неоптимальным. Что делаешь?",
      options: [
        {
          text: "Озвучу опасения, соглашусь с финальным решением, оставлю следы в decision-doc",
          moodDelta: 3,
          reaction: "Зрелая позиция. Disagree-and-commit в чистом виде.",
        },
        {
          text: "Подниму вопрос на ретро, чтобы команда обсудила",
          moodDelta: 2,
          reaction: "Хорошо — выводит частное мнение в системное решение.",
        },
        {
          text: "Делаю как сказали — он тимлид",
          moodDelta: -1,
          reaction: "Тимлид не всегда прав. Молчаливое согласие — плохой паттерн.",
        },
        {
          text: "Делаю как считаю правильным, потом доказываю результатом",
          moodDelta: -2,
          reaction: "Это создаёт распри в команде. Соавторство важнее правоты.",
        },
      ],
    },
    {
      question: "Junior просит помочь со своей задачей пятый раз за день. Реакция?",
      options: [
        {
          text: "Помогу, но попрошу сначала сформулировать что он уже пробовал",
          moodDelta: 3,
          reaction: "Отличный подход — учит самостоятельности.",
        },
        {
          text: "Помогу — на то я и тут",
          moodDelta: 0,
          reaction: "Норм, но он так не научится. Помощь != ответы.",
        },
        {
          text: "Объясняю, но злюсь",
          moodDelta: -2,
          reaction: "Раздражение junior считывает мгновенно. Лучше выдохнуть.",
        },
        {
          text: "Игнорирую — пусть учится сам",
          moodDelta: -3,
          reaction: "Это саботаж онбординга. Так в команде никто не вырастет.",
        },
      ],
    },
  ],
  // Slot 4 — motivation
  [
    {
      question: "Почему ты ушёл с прошлого места?",
      options: [
        {
          text: "Не было роста и интересных задач",
          moodDelta: 2,
          reaction: "Окей. И что для тебя 'интересные задачи' сейчас?",
        },
        {
          text: "Захотел сменить стек / направление",
          moodDelta: 1,
          reaction: "Норм. А готов ли откатить грейд ради нового направления?",
        },
        {
          text: "Платили мало",
          moodDelta: -1,
          reaction: "Честно. Но мы спрашиваем мотивацию, не оффер.",
        },
        {
          text: "Конфликт с командой",
          moodDelta: -2,
          reaction: "Расскажешь подробнее — это важный сигнал.",
        },
      ],
    },
    {
      question: "Что для тебя успешный проект?",
      options: [
        {
          text: "Когда пользователи довольны и команда не выгорела",
          moodDelta: 3,
          reaction: "Это редкий ответ. Большинство называют одну метрику.",
        },
        {
          text: "Когда вышел в срок и без серьёзных багов",
          moodDelta: 1,
          reaction: "Здраво. А что если 'без багов' противоречит 'в срок'?",
        },
        {
          text: "Когда есть крутая история для резюме",
          moodDelta: -2,
          reaction: "Карьеризм. Мы предпочитаем людей, кому важен сам продукт.",
        },
        {
          text: "Когда заработали много денег",
          moodDelta: -1,
          reaction: "Это результат, а не процесс. Я спрашивал про второе.",
        },
      ],
    },
  ],
  // Slot 5 — closing
  [
    {
      question: "Есть ли у тебя вопросы ко мне?",
      options: [
        {
          text: "Какая самая сложная задача, с которой команда справилась за последний квартал?",
          moodDelta: 3,
          reaction: "Хороший вопрос — показывает интерес к контексту команды.",
        },
        {
          text: "Расскажите про процесс ревью и онбординг",
          moodDelta: 2,
          reaction: "Грамотно — это реально влияет на повседневную работу.",
        },
        {
          text: "Сколько платите?",
          moodDelta: -1,
          reaction: "Об этом поговорим в следующем раунде — рано пока.",
        },
        {
          text: "Нет, всё понятно",
          moodDelta: -3,
          reaction: "Жаль. Отсутствие вопросов — часто признак отсутствия интереса.",
        },
      ],
    },
    {
      question: "Куда ты хочешь расти через 3 года?",
      options: [
        {
          text: "Углубиться в архитектуру / стать staff-инженером",
          moodDelta: 2,
          reaction: "Понятный трек. У нас как раз есть такие позиции.",
        },
        {
          text: "Стать тимлидом",
          moodDelta: 1,
          reaction: "Норм, если это про реальный интерес к людям, а не только к зарплате.",
        },
        {
          text: "Запустить свой стартап",
          moodDelta: -1,
          reaction: "Тогда мы временная остановка для тебя — это меняет наши планы найма.",
        },
        {
          text: "Не знаю, как пойдёт",
          moodDelta: -2,
          reaction: "Жаль — мы хотели бы вкладываться в человека, у которого есть направление.",
        },
      ],
    },
  ],
];

export const TOTAL_DIALOG_SLOTS = SLOTS.length;
export const MAX_MOOD = 18; // 6 slots × max +3 per answer
export const MIN_MOOD = -18;

export function buildDialogRun(random = Math.random) {
  return SLOTS.map((variants, index) => {
    const variant = variants[Math.floor(random() * variants.length)];
    return {
      slot: index,
      slotTitle: SLOT_TITLES[index],
      question: variant.question,
      options: variant.options,
    };
  });
}
