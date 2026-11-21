"use client";
// Plain SVG charts with axes, for the deck and the proof page. No library.
const INK = "#3d3648", GRID = "#e6dfd0", MUTED = "#8a8296";

export function LineChart({ series, xMax, yMax, xLabel, yLabel, xTicks, yTicks, w = 520, h = 300, logX = false, fmtX = (v: number) => String(v), fmtY = (v: number) => String(v) }: {
  series: { name: string; color: string; points: [number, number][]; dash?: boolean }[]; xMax: number; yMax: number; xLabel: string; yLabel: string; xTicks: number[]; yTicks: number[]; w?: number; h?: number; logX?: boolean; fmtX?: (v: number) => string; fmtY?: (v: number) => string }) {
  const L = 56, R = 16, T = 14, B = 44, X = (v: number) => L + ((logX ? Math.log10(Math.max(1, v)) / Math.log10(xMax) : v / xMax)) * (w - L - R), Y = (v: number) => h - B - (Math.min(yMax, v) / yMax) * (h - T - B);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {yTicks.map((v) => (<g key={v}><line x1={L} x2={w - R} y1={Y(v)} y2={Y(v)} stroke={GRID} /><text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{fmtY(v)}</text></g>))}
      {xTicks.map((v) => (<g key={v}><line x1={X(v)} x2={X(v)} y1={h - B} y2={h - B + 5} stroke={INK} /><text x={X(v)} y={h - B + 18} textAnchor="middle" fontSize="11" fill={MUTED}>{fmtX(v)}</text></g>))}
      <line x1={L} x2={w - R} y1={h - B} y2={h - B} stroke={INK} strokeWidth="1.5" /><line x1={L} x2={L} y1={T} y2={h - B} stroke={INK} strokeWidth="1.5" />
      <text x={(L + w - R) / 2} y={h - 6} textAnchor="middle" fontSize="12" fill={INK}>{xLabel}</text>
      <text x={14} y={(T + h - B) / 2} textAnchor="middle" fontSize="12" fill={INK} transform={`rotate(-90 14 ${(T + h - B) / 2})`}>{yLabel}</text>
      {series.map((s) => <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash ? "6 5" : undefined} strokeLinejoin="round" points={s.points.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")} />)}
      {series.map((s, i) => (<g key={s.name}><line x1={w - R - 150} x2={w - R - 128} y1={T + 10 + i * 17} y2={T + 10 + i * 17} stroke={s.color} strokeWidth="3" strokeDasharray={s.dash ? "6 5" : undefined} /><text x={w - R - 122} y={T + 14 + i * 17} fontSize="11.5" fill={INK}>{s.name}</text></g>))}
    </svg>
  );
}

export function Bars({ groups, yMax, yLabel, fmt = (v: number) => String(v), w = 520, h = 300 }: { groups: { label: string; bars: { name: string; value: number; color: string }[] }[]; yMax: number; yLabel: string; fmt?: (v: number) => string; w?: number; h?: number }) {
  const L = 56, R = 12, T = 22, B = 46, gw = (w - L - R) / groups.length, Y = (v: number) => h - B - (Math.min(yMax, v) / yMax) * (h - T - B);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (<g key={f}><line x1={L} x2={w - R} y1={Y(f * yMax)} y2={Y(f * yMax)} stroke={GRID} /><text x={L - 8} y={Y(f * yMax) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{fmt(f * yMax)}</text></g>))}
      <line x1={L} x2={w - R} y1={h - B} y2={h - B} stroke={INK} strokeWidth="1.5" />
      <text x={14} y={(T + h - B) / 2} textAnchor="middle" fontSize="12" fill={INK} transform={`rotate(-90 14 ${(T + h - B) / 2})`}>{yLabel}</text>
      {groups.map((g, gi) => { const bw = Math.min(46, (gw - 18) / g.bars.length); return (<g key={g.label}>
        {g.bars.map((b, bi) => { const x = L + gi * gw + (gw - bw * g.bars.length) / 2 + bi * bw; return (<g key={b.name}><rect x={x + 2} y={Y(b.value)} width={bw - 4} height={Math.max(1, h - B - Y(b.value))} fill={b.color} rx="3" /><text x={x + bw / 2} y={Y(b.value) - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>{fmt(b.value)}</text><text x={x + bw / 2} y={h - B + 14} textAnchor="middle" fontSize="10" fill={MUTED}>{b.name}</text></g>); })}
        <text x={L + gi * gw + gw / 2} y={h - 8} textAnchor="middle" fontSize="12" fill={INK}>{g.label}</text></g>); })}
    </svg>
  );
}
