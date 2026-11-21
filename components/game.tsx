"use client";
import type { ReactNode } from "react";

// The game look: cream cards with a thick plum outline and a hard drop shadow, chunky round icon buttons. Icons were drawn by Gemini 4 Neon.
export const INK = "#3d3648";
export const Icon = ({ name, size = 28 }: { name: string; size?: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={`/icons/${name}.svg`} alt="" width={size} height={size} draggable={false} style={{ width: size, height: size }} />
);

export function IconButton({ icon, label, onClick, active, accent, size = 56, badge }: { icon: string; label: string; onClick: () => void; active?: boolean; accent?: string; size?: number; badge?: number }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="group relative flex flex-col items-center gap-1">
      <span className="grid place-items-center rounded-full border-[3px] transition-transform duration-150 group-hover:-translate-y-1 group-active:translate-y-0.5"
        style={{ width: size, height: size, borderColor: INK, background: active ? accent ?? "#ffe08a" : "#fffaf0", boxShadow: `0 4px 0 ${INK}` }}>
        <Icon name={icon} size={size * 0.62} />
      </span>
      {badge ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 px-1 text-[10px] font-bold text-white" style={{ background: "#ff6b8a", borderColor: INK }}>{badge}</span> : null}
      <span className="rounded-full px-2 text-[11px] font-semibold" style={{ color: INK, background: "#fffaf0cc" }}>{label}</span>
    </button>
  );
}

export function GamePanel({ title, icon, accent, onClose, closeLabel, children, footer }: { title: string; icon: string; accent: string; onClose: () => void; closeLabel: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <aside className="absolute bottom-32 right-5 top-20 z-10 flex w-[440px] flex-col overflow-hidden rounded-[28px] border-[3px]" style={{ borderColor: INK, background: "#fffaf0", boxShadow: `0 8px 0 ${INK}33, 0 18px 40px #0003` }}>
      <header className="flex items-center gap-3 border-b-[3px] px-4 py-2.5" style={{ borderColor: INK, background: accent }}>
        <span className="grid h-10 w-10 place-items-center rounded-full border-[3px] bg-[#fffaf0]" style={{ borderColor: INK }}><Icon name={icon} size={24} /></span>
        <h2 className="flex-1 text-base font-bold text-white" style={{ textShadow: `0 2px 0 ${INK}55` }}>{title}</h2>
        <button onClick={onClose} aria-label={closeLabel} className="grid h-9 w-9 place-items-center rounded-full border-[3px] bg-[#fffaf0] transition hover:rotate-90" style={{ borderColor: INK }}><Icon name="close" size={20} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer}
    </aside>
  );
}

export function Chunky({ children, onClick, color = "#ffe08a", disabled, small }: { children: ReactNode; onClick?: () => void; color?: string; disabled?: boolean; small?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-full border-[3px] font-bold transition active:translate-y-0.5 disabled:opacity-40 ${small ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"}`}
      style={{ borderColor: INK, background: color, color: INK, boxShadow: `0 3px 0 ${INK}` }}>{children}</button>
  );
}

// A radial menu: icons fan out in an arc above a point (the Gemi's head).
export function RadialMenu({ x, y, items }: { x: number; y: number; items: { icon: string; label: string; onClick: () => void }[] }) {
  const n = items.length, radius = 96, spread = Math.PI * 0.9;
  return (
    <div className="absolute z-20" style={{ left: x, top: Math.max(y, 170) }}>
      {items.map((it, i) => {
        const a = -Math.PI / 2 - spread / 2 + (spread * i) / (n - 1), dx = Math.cos(a) * radius, dy = Math.sin(a) * radius;
        return (
          <div key={it.label} className="gemi-pop absolute" style={{ left: dx, top: dy, transform: "translate(-50%, -50%)", animationDelay: `${i * 45}ms` }}>
            <IconButton icon={it.icon} label={it.label} onClick={it.onClick} size={58} />
          </div>
        );
      })}
    </div>
  );
}
