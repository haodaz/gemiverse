"use client";
// The cover's one picture: a Gemi, entering a space, whose mind gains dimensions, on tokens that stretch across time.
// Stages 1 and 2 are the live 3D; stages 3 and 4 are drawn from the same shapes the product computes.
const INK = "#3d3648", PUR = "#7c4dce", GOLD = "#e0a526", MUTED = "#8a8296";
export type BannerText = { s1: [string, string]; s2: [string, string]; s3: [string, string]; s4: [string, string]; minds: [string, string][]; spent: string; stays: string; days: string };
export const BANNER_EN: BannerText = { s1: ["A Gemi", "an AI projection of one student"], s2: ["enters a space", "a room and a campus it can read and change"], s3: ["its mind gains dimensions", "six capacities, each standing on the one below"], s4: ["and tokens stretch into time", "spent once a day; what they bought stays"],
  minds: [["Perceive", "hears you, reads a poster"], ["Check", "a fact counts only if its source shows it"], ["Believe", "seven axes of how you choose, with a width"], ["Predict", "seals a guess before you choose"], ["Plan", "spends where it knows least"], ["Reflect and make", "diary of its errors; saves up; makes"]], spent: "Gem Stars spent that day", stays: "what stays: checked facts, what it knows", days: "days" };

// The mind as capacities that stack: each one needs the one below it. These are the six the product has today.
const STEP_C = ["#e6dfd0", "#c8b4f0", "#a8d4ff", "#a8e0c0", "#ffe08a", "#ffd6e0"];
function Mind({ t }: { t: BannerText }) {
  return (
    <div className="flex h-full flex-col-reverse justify-center gap-1.5 px-1">
      {t.minds.map(([name, what], k) => (
        <div key={name} className="flex items-center gap-2 rounded-lg border-2 px-2.5 py-1" style={{ borderColor: INK, background: STEP_C[k], marginLeft: `${k * 5}%`, width: `${100 - k * 5}%` }}>
          <b className="shrink-0 text-[13px]">{k + 1} · {name}</b><span className="text-[11.5px] leading-tight text-[#4a4356]">{what}</span></div>))}
    </div>);
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
    <div className="grid h-full grid-cols-[0.7fr_auto_1.25fr_auto_1.35fr_auto_0.95fr] items-stretch gap-2">
      {stages.flatMap(([label, pic], k) => [
        ...(k ? [<div key={`a${k}`} className="flex items-center text-4xl font-bold" style={{ color: PUR }}>→</div>] : []),
        <div key={k} className="flex min-h-0 flex-col"><div className="min-h-0 flex-1">{pic}</div>
          <p className="mt-2 text-center text-xl font-bold leading-tight">{label[0]}</p><p className="text-center text-[13.5px] leading-snug text-[#6d6579]">{label[1]}</p></div>])}
    </div>);
}
