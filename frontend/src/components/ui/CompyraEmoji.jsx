import React from "react";

// CompyraEmoji.jsx — кастомные эмодзи в стиле «Матрицы»
// Зелёный на чёрном, wireframe + цифровой код. Тот же API: <CompyraEmoji name size />.

const M_FG = "#FFD700"; // compyra gold (matrix style)
const M_MID = "#E8B400"; // mid
const M_INK = "#0D1117"; // near-black backdrop
const M_GHOST = "rgba(255,215,0,0.18)"; // faint cells

// All glyphs draw to 100x100 viewBox.

function GlowDefs({ id }) {
  return (
    <defs>
      <filter id={`mg-${id}`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.4" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function Rain({ seed = 1 }) {
  const cols = [12, 22, 34, 46, 58, 70, 82, 90];
  return (
    <g opacity="0.45">
      {cols.map((x, i) => {
        const len = 3 + ((i + seed) % 4);
        const yOff = (i * 13 + seed * 7) % 24;
        return (
          <g key={i}>
            {Array.from({ length: len }).map((_, k) => (
              <text
                key={k}
                x={x}
                y={(yOff + k * 8) % 100}
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontSize="6"
                fill={M_MID}
                opacity={1 - k * 0.18}
                textAnchor="middle"
              >
                {(i + k + seed) % 2 ? "1" : "0"}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function Trophy() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <Rain seed={3} />
      <g
        filter={`url(#mg-${id})`}
        stroke={M_FG}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M 18 30 Q 6 30 6 44 Q 6 56 22 58" />
        <path d="M 82 30 Q 94 30 94 44 Q 94 56 78 58" />
        <path d="M 22 16 H 78 V 44 Q 78 64 50 70 Q 22 64 22 44 Z" />
        <line x1="44" y1="70" x2="44" y2="80" />
        <line x1="56" y1="70" x2="56" y2="80" />
        <rect x="28" y="80" width="44" height="8" rx="1.5" />
      </g>
      <text
        x="50"
        y="38"
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="11"
        fontWeight="700"
        fill={M_FG}
        opacity="0.9"
      >
        №1
      </text>
    </>
  );
}

function Medal({ rank }) {
  const id = React.useId().replace(/:/g, "");
  const cy = 64;
  return (
    <>
      <GlowDefs id={id} />
      <g
        stroke={M_FG}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeWidth={rank === 1 ? "3" : rank === 2 ? "2.5" : "2"}
      >
        <path d="M 28 6 L 42 44" />
        <path d="M 72 6 L 58 44" />
        <path d="M 28 6 L 36 6" />
        <path d="M 72 6 L 64 6" />
      </g>

      <g filter={`url(#mg-${id})`}>
        <circle cx="50" cy={cy} r="24" fill="none" stroke={M_FG} strokeWidth="2.5" />

        {rank === 1 && (
          <>
            <g stroke={M_FG} strokeWidth="1.6" fill="none">
              <path d="M 22 64 Q 14 50 22 36" />
              <path d="M 22 38 L 17 36" />
              <path d="M 24 44 L 18 44" />
              <path d="M 22 52 L 16 52" />
              <path d="M 22 60 L 16 60" />
              <path d="M 24 50 L 19 47" />
              <path d="M 24 56 L 19 60" />
            </g>
            <g stroke={M_FG} strokeWidth="1.6" fill="none">
              <path d="M 78 64 Q 86 50 78 36" />
              <path d="M 78 38 L 83 36" />
              <path d="M 76 44 L 82 44" />
              <path d="M 78 52 L 84 52" />
              <path d="M 78 60 L 84 60" />
              <path d="M 76 50 L 81 47" />
              <path d="M 76 56 L 81 60" />
            </g>
            <g stroke={M_FG} strokeWidth="1.4" opacity="0.7">
              <line x1="50" y1="32" x2="50" y2="40" />
              <line x1="50" y1="88" x2="50" y2="96" />
              <line x1="32" y1="64" x2="40" y2="64" />
              <line x1="60" y1="64" x2="68" y2="64" />
            </g>
          </>
        )}

        {rank === 2 && (
          <>
            <g stroke={M_FG} strokeWidth="1.6" fill="none">
              <path d="M 22 58 L 18 54" />
              <path d="M 22 64 L 16 64" />
              <path d="M 22 70 L 18 74" />
              <path d="M 78 58 L 82 54" />
              <path d="M 78 64 L 84 64" />
              <path d="M 78 70 L 82 74" />
            </g>
            <circle cx="50" cy={cy} r="17" fill="none" stroke={M_FG} strokeWidth="1.2" opacity="0.7" />
          </>
        )}

        {rank === 3 && (
          <circle
            cx="50"
            cy={cy}
            r="17"
            fill="none"
            stroke={M_FG}
            strokeWidth="1.4"
            strokeDasharray="2 3"
            opacity="0.7"
          />
        )}

        <text
          x="50"
          y={cy + 8}
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          fontSize="22"
          fontWeight="800"
          fill={M_FG}
        >
          {rank}
        </text>
      </g>
    </>
  );
}

function Fire() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill={M_FG} fontFamily="'JetBrains Mono', monospace" fontWeight="700" textAnchor="middle">
        <text x="50" y="22" fontSize="10" opacity="0.5">0</text>
        <text x="46" y="32" fontSize="11" opacity="0.7">1</text>
        <text x="54" y="32" fontSize="11" opacity="0.7">0</text>
        <text x="40" y="44" fontSize="13" opacity="0.85">1</text>
        <text x="50" y="44" fontSize="13" opacity="0.95">0</text>
        <text x="60" y="44" fontSize="13" opacity="0.85">1</text>
        <text x="34" y="58" fontSize="14">0</text>
        <text x="46" y="58" fontSize="16">1</text>
        <text x="58" y="58" fontSize="14">0</text>
        <text x="68" y="58" fontSize="13">1</text>
        <text x="30" y="74" fontSize="13" opacity="0.9">1</text>
        <text x="42" y="76" fontSize="15">0</text>
        <text x="54" y="76" fontSize="15">1</text>
        <text x="66" y="74" fontSize="13" opacity="0.9">0</text>
        <text x="48" y="88" fontSize="11" opacity="0.6">7</text>
        <text x="56" y="88" fontSize="11" opacity="0.6">F</text>
      </g>
    </>
  );
}

function Bolt() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`}>
        <path d="M 56 6 L 22 54 L 44 54 L 36 94 L 78 40 L 56 40 Z" fill="none" stroke={M_FG} strokeWidth="3" strokeLinejoin="round" />
        <path d="M 56 6 L 22 54 L 44 54 L 36 94 L 78 40 L 56 40 Z" fill={M_GHOST} stroke="none" />
      </g>
      <g fontFamily="'JetBrains Mono', monospace" fontSize="6" fill={M_FG} opacity="0.7" textAnchor="middle">
        <text x="48" y="32">1</text>
        <text x="42" y="50">0</text>
        <text x="52" y="60">1</text>
        <text x="48" y="74">0</text>
      </g>
    </>
  );
}

function Target() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.2">
        <circle cx="50" cy="50" r="42" />
        <circle cx="50" cy="50" r="30" opacity="0.85" />
        <circle cx="50" cy="50" r="18" opacity="0.7" />
        <circle cx="50" cy="50" r="6" fill={M_FG} />
        <line x1="50" y1="2" x2="50" y2="18" />
        <line x1="50" y1="82" x2="50" y2="98" />
        <line x1="2" y1="50" x2="18" y2="50" />
        <line x1="82" y1="50" x2="98" y2="50" />
      </g>
    </>
  );
}

function Skull() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M 22 44 Q 22 12 50 12 Q 78 12 78 44 V 64 Q 78 70 72 70 H 66 V 80 Q 66 88 58 88 H 42 Q 34 88 34 80 V 70 H 28 Q 22 70 22 64 Z" />
        <ellipse cx="38" cy="46" rx="8" ry="10" fill={M_FG} />
        <ellipse cx="62" cy="46" rx="8" ry="10" fill={M_FG} />
        <path d="M 50 56 L 46 68 L 54 68 Z" fill={M_FG} />
        <line x1="34" y1="74" x2="66" y2="74" strokeWidth="2" />
        <line x1="42" y1="74" x2="42" y2="86" strokeWidth="1.6" />
        <line x1="50" y1="74" x2="50" y2="86" strokeWidth="1.6" />
        <line x1="58" y1="74" x2="58" y2="86" strokeWidth="1.6" />
        <line x1="28" y1="58" x2="32" y2="62" strokeWidth="1.5" opacity="0.7" />
        <line x1="72" y1="58" x2="68" y2="62" strokeWidth="1.5" opacity="0.7" />
      </g>
      <text x="50" y="32" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="6" fill={M_FG} opacity="0.45">
        x_x
      </text>
    </>
  );
}

function Handshake() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M 4 60 L 28 44 L 50 50 L 42 66 L 18 78 Z" />
        <path d="M 96 60 L 72 44 L 50 50 L 58 66 L 82 78 Z" />
        <rect x="40" y="46" width="20" height="22" rx="2" />
      </g>
      <text x="50" y="40" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="9" fontWeight="700" fill={M_FG} opacity="0.7">
        ::
      </text>
    </>
  );
}

function Crown() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M 14 68 L 22 24 L 38 50 L 50 16 L 62 50 L 78 24 L 86 68 Z" />
        <rect x="12" y="70" width="76" height="14" rx="1.5" />
      </g>
      <g fontFamily="'JetBrains Mono', monospace" fontWeight="700" fill={M_FG} textAnchor="middle">
        <text x="22" y="28" fontSize="7" opacity="0.85">+</text>
        <text x="50" y="20" fontSize="8">★</text>
        <text x="78" y="28" fontSize="7" opacity="0.85">+</text>
      </g>
      <g fill={M_FG}>
        <circle cx="26" cy="78" r="1.5" />
        <circle cx="50" cy="78" r="1.5" />
        <circle cx="74" cy="78" r="1.5" />
      </g>
    </>
  );
}

function Diamond() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M 18 36 L 32 16 L 68 16 L 82 36 L 50 90 Z" />
        <line x1="32" y1="16" x2="50" y2="36" />
        <line x1="68" y1="16" x2="50" y2="36" />
        <line x1="18" y1="36" x2="50" y2="36" />
        <line x1="82" y1="36" x2="50" y2="36" />
        <line x1="50" y1="36" x2="50" y2="90" />
      </g>
      <text x="50" y="46" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="8" fontWeight="700" fill={M_FG}>
        1K
      </text>
    </>
  );
}

function Muscle() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <rect x="18" y="22" width="26" height="18" rx="3" />
        <rect x="18" y="40" width="26" height="14" />
        <path d="M 44 32 Q 86 22 86 50 Q 86 72 56 72 L 44 72 Z" />
        <path d="M 44 54 L 56 72" />
      </g>
      <text x="66" y="56" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontSize="9" fontWeight="700" fill={M_FG} opacity="0.85">
        10x
      </text>
    </>
  );
}

function Shield() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M 50 6 L 88 18 L 88 50 Q 88 78 50 94 Q 12 78 12 50 L 12 18 Z" />
        <path d="M 50 14 L 80 24 L 80 50 Q 80 72 50 86 Q 20 72 20 50 L 20 24 Z" opacity="0.55" />
        <path d="M 40 36 L 56 50 L 40 64" strokeWidth="5" strokeLinecap="round" />
      </g>
    </>
  );
}

function Swords() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} stroke={M_FG} strokeWidth="3" strokeLinecap="round" fill="none">
        <line x1="14" y1="14" x2="74" y2="74" />
        <line x1="86" y1="14" x2="26" y2="74" />
      </g>
      <g stroke={M_FG} strokeWidth="2" fill="none">
        <rect x="62" y="64" width="20" height="6" rx="1" transform="rotate(45 72 67)" />
        <rect x="18" y="64" width="20" height="6" rx="1" transform="rotate(-45 28 67)" />
        <rect x="74" y="74" width="14" height="14" rx="1" transform="rotate(45 81 81)" fill={M_INK} />
        <rect x="12" y="74" width="14" height="14" rx="1" transform="rotate(-45 19 81)" fill={M_INK} />
      </g>
      <g stroke={M_FG} strokeWidth="1.5" fill="none">
        <line x1="50" y1="44" x2="50" y2="56" />
        <line x1="44" y1="50" x2="56" y2="50" />
        <line x1="46" y1="46" x2="54" y2="54" />
        <line x1="54" y1="46" x2="46" y2="54" />
      </g>
    </>
  );
}

function Star() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M 50 8 L 61 36 L 92 38 L 68 58 L 76 90 L 50 72 L 24 90 L 32 58 L 8 38 L 39 36 Z" />
        <circle cx="50" cy="50" r="3" fill={M_FG} />
      </g>
    </>
  );
}

function Rocket() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M 38 78 Q 38 30 50 8 Q 62 30 62 78 Z" />
        <circle cx="50" cy="42" r="6" />
        <path d="M 30 60 L 22 78 L 38 72 Z" />
        <path d="M 70 60 L 78 78 L 62 72 Z" />
        <line x1="38" y1="78" x2="62" y2="78" />
        <path d="M 42 80 L 50 96 L 58 80" />
      </g>
    </>
  );
}

function Brain() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M 50 12 Q 18 12 18 44 Q 14 60 28 70 Q 28 86 44 86 L 56 86 Q 72 86 72 70 Q 86 60 82 44 Q 82 12 50 12 Z" />
        <path d="M 50 14 L 50 86" />
        <path d="M 30 30 Q 38 38 30 46" />
        <path d="M 28 56 Q 36 60 30 68" />
        <path d="M 70 30 Q 62 38 70 46" />
        <path d="M 72 56 Q 64 60 70 68" />
      </g>
      <g fontFamily="'JetBrains Mono', monospace" fontSize="7" fill={M_FG} opacity="0.7" textAnchor="middle">
        <text x="40" y="44">01</text>
        <text x="60" y="60">10</text>
      </g>
    </>
  );
}

function Gamepad() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M 10 50 Q 10 30 28 30 L 72 30 Q 90 30 90 50 L 90 64 Q 90 80 76 80 Q 68 80 62 72 L 38 72 Q 32 80 24 80 Q 10 80 10 64 Z" />
        <rect x="20" y="48" width="18" height="6" rx="1" />
        <rect x="26" y="42" width="6" height="18" rx="1" />
        <circle cx="68" cy="46" r="3" />
        <circle cx="80" cy="56" r="3" />
        <circle cx="68" cy="66" r="3" />
        <circle cx="56" cy="56" r="3" />
      </g>
    </>
  );
}

function Speech() {
  const id = React.useId().replace(/:/g, "");
  return (
    <>
      <GlowDefs id={id} />
      <g filter={`url(#mg-${id})`} fill="none" stroke={M_FG} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M 12 24 Q 12 12 24 12 H 76 Q 88 12 88 24 V 56 Q 88 68 76 68 H 40 L 24 84 V 68 H 24 Q 12 68 12 56 Z" />
      </g>
      <g fontFamily="'JetBrains Mono', monospace" fontWeight="700" fill={M_FG} textAnchor="middle">
        <text x="34" y="46" fontSize="14">&gt;</text>
        <text x="50" y="46" fontSize="14">_</text>
      </g>
    </>
  );
}

const EMOJIS = {
  trophy: <Trophy />,
  medal1: <Medal rank={1} />,
  medal2: <Medal rank={2} />,
  medal3: <Medal rank={3} />,
  fire: <Fire />,
  bolt: <Bolt />,
  target: <Target />,
  skull: <Skull />,
  handshake: <Handshake />,
  crown: <Crown />,
  diamond: <Diamond />,
  muscle: <Muscle />,
  shield: <Shield />,
  swords: <Swords />,
  star: <Star />,
  rocket: <Rocket />,
  brain: <Brain />,
  gamepad: <Gamepad />,
  speech: <Speech />,
};

export function CompyraEmoji({ name, size = 24, className = "", style }) {
  const glyph = EMOJIS[name];
  if (!glyph) {
    return <span style={{ display: "inline-block", width: size, height: size }} />;
  }
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: "inline-block", verticalAlign: "-0.18em", ...(style || {}) }}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}

const EMOJI_MAP = {
  "🏆": "trophy",
  "🥇": "medal1",
  "🥈": "medal2",
  "🥉": "medal3",
  "🔥": "fire",
  "⚡": "bolt",
  "🎯": "target",
  "💀": "skull",
  "🤝": "handshake",
  "👑": "crown",
  "💎": "diamond",
  "💪": "muscle",
  "🛡": "shield",
  "🛡️": "shield",
  "⚔️": "swords",
  "⚔": "swords",
  "⭐": "star",
  "🚀": "rocket",
  "🧠": "brain",
  "🎮": "gamepad",
  "💬": "speech",
};

export function CompyraText({ children, size = 18 }) {
  if (typeof children !== "string") return children;
  const parts = [];
  let buf = "";
  for (const ch of children) {
    if (ch === "\uFE0F") continue;
    if (EMOJI_MAP[ch]) {
      if (buf) {
        parts.push(buf);
        buf = "";
      }
      parts.push(<CompyraEmoji key={parts.length} name={EMOJI_MAP[ch]} size={size} />);
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);
  return <>{parts}</>;
}

export const COMPYRA_EMOJI_NAMES = Object.keys(EMOJIS);

if (typeof window !== "undefined") {
  window.CompyraEmoji = CompyraEmoji;
  window.CompyraText = CompyraText;
}
