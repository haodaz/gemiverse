"use client";
// The cover's one picture: a Gemi, entering a space, whose mind gains dimensions, on tokens that stretch across time.
// Stages 1 and 2 are the live 3D; stages 3 and 4 are drawn from the same shapes the product computes.
const INK = "#3d3648", PUR = "#7c4dce", GOLD = "#e0a526", MUTED = "#8a8296";
export type BannerText = { s1: [string, string]; s2: [string, string]; s3: [string, string]; s4: [string, string]; day1: string; later: string; spent: string; stays: string; days: string };
export const BANNER_EN: BannerText = { s1: ["A Gemi", "an AI projection of one student"], s2: ["enters a space", "a room and a campus it can read and change"], s3: ["its mind gains dimensions", "seven axes of how you choose, each with a width"], s4: ["and tokens stretch into time", "spent once a day; what they bought stays"],
  day1: "day 1", later: "day 5", spent: "Gem Stars spent that day", stays: "what stays: checked facts, what it knows", days: "days" };

const spoke = (k: number, r: number): [number, number] => { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 7; return [110 + r * Math.cos(a), 105 + r * Math.sin(a)]; };
const poly = (rs: number[]) => rs.map((r, k) => spoke(k, r).join(",")).join(" ");
const M = [52, 30, 70, 58, 38, 62, 44];                                   // where it ends up on each axis (illustrative positions)
function Mind({ t }: { t: BannerText }) {
  return (
    <svg viewBox="0 0 220 210" className="h-full w-full">
      {[30, 60, 90].map((r) => <polygon key={r} points={poly(Array(7).fill(r))} fill="none" stroke="#e6dfd0" />)}
      {Array.from({ length: 7 }, (_, k) => <line key={k} x1="110" y1="105" x2={spoke(k, 90)[0]} y2={spoke(k, 90)[1]} stroke="#d9d0e6" />)}
      <polygon points={poly(Array(7).fill(88))} fill={PUR} opacity="0.10" /><polygon points={poly(Array(7).fill(14))} fill="#f6f2ee" />
      <polygon points={poly(M.map((r) => r + 9))} fill={PUR} opacity="0.28" /><polygon points={poly(M.map((r) => r - 9))} fill="#f6f2ee" opacity="0.9" />
      <polygon points={poly(M)} fill="none" stroke={PUR} strokeWidth="2.5" strokeLinejoin="round" />
      {M.map((r, k) => <circle key={k} cx={spoke(k, r)[0]} cy={spoke(k, r)[1]} r="3.5" fill={PUR} />)}
      <text x="8" y="16" fontSize="11" fill={MUTED}>{t.day1}: ○</text><text x="8" y="31" fontSize="11" fill={PUR} fontWeight="700">{t.later}: ◆</text>
    </svg>);
}
function Time({ t }: { t: BannerText }) {
  const X = (d: number) => 26 + d * 26, base = 168, cum = [0, 10, 24, 36, 52, 64, 82, 96];
  return (
    <svg viewBox="0 0 220 210" className="h-full w-full">
      <polygon points={`${X(0)},${base} ${cum.map((v, d) => `${X(d)},${base - v * 1.35}`).join(" ")} ${X(7)},${base}`} fill={PUR} opacity="0.22" />
      <polyline points={cum.map((v, d) => `${X(d)},${base - v * 1.35}`).join(" ")} fill="none" stroke={PUR} strokeWidth="2.5" />
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (<g key={d}><rect x={X(d) - 7} y={base - (d === 3 || d === 4 ? 0 : 18)} width="14" height={d === 3 || d === 4 ? 0 : 18} fill={GOLD} rx="2" />
        {(d === 3 || d === 4) && <text x={X(d)} y={base - 4} textAnchor="middle" fontSize="12" fill={GOLD}>★</text>}
        <text x={X(d)} y={base + 14} textAnchor="middle" fontSize="10" fill={MUTED}>{d}</text></g>))}
      <rect x={X(5) - 7} y={base - 54} width="14" height="36" fill={GOLD} opacity="0.55" rx="2" />
      <line x1={X(0)} x2={X(7) + 10} y1={base} y2={base} stroke={INK} strokeWidth="1.5" /><text x={X(4)} y={base + 30} fontSize="10.5" fill={MUTED} textAnchor="middle">{t.days}</text>
      <rect x="8" y="6" width="10" height="10" fill={GOLD} rx="2" /><text x="23" y="15" fontSize="10.5" fill={INK}>{t.spent}</text>
      <rect x="8" y="22" width="10" height="10" fill={PUR} opacity="0.5" rx="2" /><text x="23" y="31" fontSize="10.5" fill={INK}>{t.stays}</text>
    </svg>);
}
export default function Banner({ t = BANNER_EN }: { t?: BannerText }) {
  const live = (src: string) => <iframe src={src} title="live" className="h-full w-full border-0 bg-transparent" />;
  const stages: [[string, string], React.ReactNode][] = [[t.s1, live("/gen3d/doll.html?embed=1&cam=front&looks=mochi")], [t.s2, live("/gen3d/viewer.html?embed=1&bare=1&school=nyu")], [t.s3, <Mind key="m" t={t} />], [t.s4, <Time key="t" t={t} />]];
  return (
    <div className="grid h-full grid-cols-[0.8fr_auto_1.5fr_auto_1fr_auto_1fr] items-stretch gap-2">
      {stages.flatMap(([label, pic], k) => [
        ...(k ? [<div key={`a${k}`} className="flex items-center text-4xl font-bold" style={{ color: PUR }}>→</div>] : []),
        <div key={k} className="flex min-h-0 flex-col"><div className="min-h-0 flex-1">{pic}</div>
          <p className="mt-2 text-center text-xl font-bold leading-tight">{label[0]}</p><p className="text-center text-[13.5px] leading-snug text-[#6d6579]">{label[1]}</p></div>])}
    </div>);
}
