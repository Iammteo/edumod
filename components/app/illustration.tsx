// Lightweight, animated school-themed SVG illustrations (no image assets needed). Respects
// prefers-reduced-motion via the global guard in globals.css. Used in empty states and headers
// to make the app feel friendly and alive.

// A bobbing graduation cap with twinkling stars and floating books — the hero "scene".
export function SchoolScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 200" className={className} role="img" aria-label="School illustration">
      {/* soft halo */}
      <circle cx="120" cy="104" r="78" fill="#e7eefc" />
      <circle cx="120" cy="104" r="78" fill="none" stroke="#c9dbfb" strokeDasharray="4 7" className="motion-safe:[animation:spin-slow_30s_linear_infinite]" style={{ transformOrigin: "120px 104px" }} />

      {/* floating books */}
      <g className="motion-safe:[animation:float_5s_ease-in-out_infinite]">
        <rect x="40" y="120" width="44" height="13" rx="2" fill="#178a4c" />
        <rect x="44" y="110" width="44" height="13" rx="2" fill="#2159e8" />
        <rect x="48" y="100" width="44" height="13" rx="2" fill="#b9540f" />
      </g>

      {/* pencil */}
      <g className="motion-safe:[animation:bob_4s_ease-in-out_infinite]" style={{ transformOrigin: "180px 130px" }}>
        <rect x="168" y="92" width="11" height="50" rx="3" fill="#f4b740" transform="rotate(28 173 117)" />
        <path d="M183 138 l6 11 -12 1 z" fill="#5b6b86" transform="rotate(28 183 144)" />
      </g>

      {/* graduation cap */}
      <g className="motion-safe:[animation:bob_4.5s_ease-in-out_infinite]" style={{ transformOrigin: "120px 78px" }}>
        <path d="M120 50 L172 72 L120 94 L68 72 Z" fill="#10213f" />
        <path d="M92 83 v18 c0 9 56 9 56 0 v-18 l-28 12 z" fill="#1c3a6e" />
        <path d="M172 72 v22" stroke="#f4b740" strokeWidth="3" strokeLinecap="round" />
        <circle cx="172" cy="98" r="5" fill="#f4b740" className="motion-safe:[animation:wiggle_2.5s_ease-in-out_infinite]" style={{ transformOrigin: "172px 94px" }} />
      </g>

      {/* twinkles */}
      {[[58, 70], [186, 56], [150, 150], [80, 168]].map(([x, y], i) => (
        <g key={i} className="motion-safe:[animation:twinkle_2.4s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.5}s`, transformOrigin: `${x}px ${y}px` }}>
          <path d={`M${x} ${y - 6} l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6 z`} fill="#f4b740" />
        </g>
      ))}
    </svg>
  );
}

// Compact friendly mark for empty states.
export function EmptyArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-hidden>
      <circle cx="60" cy="54" r="40" fill="#eef2f9" />
      <g className="motion-safe:[animation:bob_4s_ease-in-out_infinite]" style={{ transformOrigin: "60px 50px" }}>
        <path d="M60 30 L92 44 L60 58 L28 44 Z" fill="#2159e8" />
        <path d="M42 51 v11 c0 6 36 6 36 0 v-11 l-18 8 z" fill="#1746b0" />
        <path d="M92 44 v15" stroke="#f4b740" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="92" cy="61" r="3.5" fill="#f4b740" className="motion-safe:[animation:wiggle_2.5s_ease-in-out_infinite]" style={{ transformOrigin: "92px 58px" }} />
      </g>
      {[[26, 30], [96, 26], [86, 78]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill="#9bb3ed" className="motion-safe:[animation:twinkle_2.2s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.4}s`, transformOrigin: `${x}px ${y}px` }} />)}
    </svg>
  );
}
