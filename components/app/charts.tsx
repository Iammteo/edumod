// Lightweight, dependency-free, responsive SVG charts with axes. Scale to container via viewBox.

export function AreaLineChart({ points, labels, yMax = 100, ySuffix = "%", stroke = "#2159e8", height = 210 }: { points: number[]; labels: string[]; yMax?: number; ySuffix?: string; stroke?: string; height?: number }) {
  const w = 380, h = height, mL = 34, mR = 8, mT = 10, mB = 22;
  const pw = w - mL - mR, ph = h - mT - mB;
  const stepX = pw / Math.max(points.length - 1, 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const xy = points.map((p, i) => [mL + i * stepX, mT + ph - (p / yMax) * ph] as const);
  const line = xy.map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(" ");
  const area = `${line} L ${xy[xy.length - 1][0].toFixed(1)} ${mT + ph} L ${xy[0][0].toFixed(1)} ${mT + ph} Z`;
  const gid = `ar-${stroke.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={stroke} stopOpacity="0.22" /><stop offset="100%" stopColor={stroke} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => { const y = mT + ph - t * ph; return <g key={t}><line x1={mL} x2={w - mR} y1={y} y2={y} stroke="#eef2f9" strokeWidth="1" /><text x={mL - 6} y={y + 3} textAnchor="end" className="fill-[#9aa7bd] text-[8px]">{Math.round(t * yMax)}{ySuffix}</text></g>; })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {xy.map((c, i) => <g key={i}><circle cx={c[0]} cy={c[1]} r="3.5" fill="#fff" stroke={stroke} strokeWidth="2" /><circle cx={c[0]} cy={c[1]} r="10" fill="transparent"><title>{`${labels[i]}: ${points[i]}${ySuffix}`}</title></circle><text x={c[0]} y={h - 6} textAnchor="middle" className="fill-[#9aa7bd] text-[8px]">{labels[i]}</text></g>)}
    </svg>
  );
}

export function BarChart({ data, yMax, yLabel = (n) => n.toLocaleString(), color = "#178a4c", height = 210 }: { data: { label: string; value: number }[]; yMax?: number; yLabel?: (n: number) => string; color?: string; height?: number }) {
  const w = 380, h = height, mL = 34, mR = 8, mT = 10, mB = 22;
  const pw = w - mL - mR, ph = h - mT - mB;
  const max = yMax ?? Math.max(...data.map((d) => d.value), 1);
  const slot = pw / data.length, bw = Math.min(slot * 0.5, 34);
  const ticks = [0, 0.5, 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
      {ticks.map((t) => { const y = mT + ph - t * ph; return <g key={t}><line x1={mL} x2={w - mR} y1={y} y2={y} stroke="#eef2f9" strokeWidth="1" /><text x={mL - 6} y={y + 3} textAnchor="end" className="fill-[#9aa7bd] text-[8px]">{yLabel(t * max)}</text></g>; })}
      {data.map((d, i) => { const bh = (d.value / max) * ph; const x = mL + i * slot + (slot - bw) / 2; return <g key={d.label} className="group"><rect x={x} y={mT + ph - bh} width={bw} height={bh} rx="4" fill={color} className="opacity-85 transition-opacity group-hover:opacity-100"><title>{`${d.label}: ${d.value.toLocaleString()}`}</title></rect><text x={x + bw / 2} y={h - 6} textAnchor="middle" className="fill-[#9aa7bd] text-[8px]">{d.label}</text></g>; })}
    </svg>
  );
}

export function DonutChart({ segments, total, totalLabel = "Total" }: { segments: { label: string; value: number; color: string }[]; total?: number; totalLabel?: string }) {
  const sum = segments.reduce((s, x) => s + x.value, 0) || 1;
  const shown = total ?? sum;
  const r = 54, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg viewBox="0 0 140 140" className="size-[150px] -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#eef2f9" strokeWidth="15" />
          {segments.map((s) => { const len = (s.value / sum) * c; const el = <circle key={s.label} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="15" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}><title>{`${s.label}: ${s.value}`}</title></circle>; offset += len; return el; })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center"><div><div className="font-display text-[20px] font-bold leading-none">{shown.toLocaleString()}</div><div className="text-[10px] text-ink-soft">{totalLabel}</div></div></div>
      </div>
      <div className="grid gap-2">
        {segments.map((s) => <div key={s.label} className="flex items-center gap-2 text-[12px]"><span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} /><span className="font-bold text-ink">{s.label}</span><span className="ml-auto text-ink-soft">{Math.round((s.value / sum) * 100)}% ({s.value})</span></div>)}
      </div>
    </div>
  );
}
