"use client";
import { useEffect, useState } from "react";

// A presenter's guide for the three-minute live demo. It appears only after /?guide=1 (or the G key) and stays across pages.
// Each step says where to go, what to click (in Chinese, for the presenter) and what to say (in English, short sentences).
const SAY = "帮我去图书馆看看有没有写论文的 workshop";
const STEPS: { t: string; sec: number; go?: string; reset?: boolean; copy?: string; doZh: string[]; say: string[]; zh: string }[] = [
  { t: "Open", sec: 20, go: "/", reset: true, doZh: ["点「Go」回到首页（会清空上次的演示数据）", "指一下 banner，然后点黄色按钮 Meet your Gemi"],
    say: ["This is Gemiverse.", "Every college student gets a Gemi: an AI of their own, living on campus.", "The hard part is simple to say: tell a student what is on, and never say something false."],
    zh: "这是 Gemiverse。每个大学生有一个自己的 Gemi，住在校园里。难点一句话：告诉学生有什么活动，而且绝不说错。" },
  { t: "Meet it", sec: 25, go: "/start", doZh: ["点 Say hello", "名字随便打（比如 Mochi）→ That is its name", "点「复制」把下面这句贴进去 → It heard you", "选 NYU → Move in at NYU"], copy: "I just started a PhD in education. I want to find people who build things for learners. Big mixers tire me.",
    say: ["It starts as a point of light. It exists because I came.", "I name it, I tell it one thing about me, and we choose where we live: NYU."],
    zh: "它一开始是一个光点，因为我来了才存在。我给它起名，告诉它一件事，然后选我们住在哪：NYU。" },
  { t: "Ask it", sec: 40, go: "/room", copy: SAY, doZh: ["点底部 Talk", "点「复制」，把中文这句贴进输入框，回车", "等十几秒，书桌面板会自己打开，出现 3 张卡", "指给评委看卡片上的绿色 checked fields"],
    say: ["I ask in Chinese: please go to the library and look for a writing workshop.", "The Decisions API decides what I asked for, with a confidence score. Not free text.", "It goes out and brings back three things.", "Every field was checked against the source page. If it cannot be checked, it is not shown."],
    zh: "我用中文说：帮我去图书馆看看写论文的工作坊。由 Decisions API 判断我要它做什么，带置信度，不是自由文本。它出门带回三样。每个字段都对照来源核对过，核对不了的不显示。" },
  { t: "Look again, live", sec: 35, doZh: ["在第一张卡上点 Look again, live", "等约 25 秒（这段时间讲右边的话）", "结果出来后指：Managed Agent · 秒数 · 命令数，和每行 still on the page"],
    say: ["Pages change. So I can ask it to look again, right now.", "A Managed Agent fetches the page itself, in a Google sandbox.", "Then the Decisions API checks each stored field against what the agent saw.", "The agent reads. Another model judges. I decide."],
    zh: "页面会变，所以我可以让它现在再去看一眼。Managed Agent 在 Google 的沙箱里自己抓页面，然后 Decisions API 把每个已存字段和 agent 看到的对一遍。agent 负责读，另一个模型负责判，我来决定。" },
  { t: "Choose", sec: 30, doZh: ["第一张点 Keep，另外两张点 Skip", "面板里会出现 Its guess, revealed 和 ✓", "点底部 Diary，指给评委看它学到了什么、可以撤回"],
    say: ["Before I chose, it sealed a guess of what I would keep. Now it opens it.", "My browser checks the hash, so it could not change its guess.", "Sometimes it is wrong, and it says so.", "The diary shows what it learned about how I choose. I can undo any line."],
    zh: "我选之前，它封存了一个预测。现在揭开，浏览器校验哈希，所以它改不了。有时它猜错，它会直说。日记里是它学到的我怎么选，每一条都能撤回。" },
  { t: "Your input", sec: 30, go: "/room", doZh: ["对评委说右边的话", "点 Talk → 输入框左边的回形针 → 选评委给的海报照片；或者直接打评委说的一句话", "指出：它读出的字段，哪些通过、哪些没显示"],
    say: ["Now something I did not prepare. Please give me a poster, or one sentence about yourself.", "It reads the poster, checks each field against the picture, and tells me if this event is already in the shared base."],
    zh: "现在来一个我没准备的。请给我一张海报，或者说一句关于你自己的话。它读海报，把每个字段对照图片核对，并告诉我这个活动是不是已经在共享底座里。" },
  { t: "Proof", sec: 30, go: "/admin", doZh: ["指 Dashboard 上面一排数字和柱状图", "点左边 Data flywheel，再点 AI performance（时间不够就只讲 Dashboard）"],
    say: ["On 122 pages from six universities that we did not pick: 3.2 percent wrong, against 8.4 for one model call.", "Our first run lost. We kept that bar on the chart.", "Reading only what a person can see fixed half of it. The gate fixes the rest.", "One check serves every student, so the tokens keep paying. Thank you."],
    zh: "在我们没挑的 6 所大学 122 个页面上：3.2% 错，单次调用是 8.4%。我们第一次跑输了，那根柱子还留在图上。只读人看得见的文字解决了一半，核对关卡解决剩下的。一次核对服务所有学生，所以 token 一直有回报。谢谢。" },
];

export function DemoGuide() {
  const [on, setOn] = useState(false), [i, setI] = useState(0), [small, setSmall] = useState(false), [t0, setT0] = useState<number | null>(null), [now, setNow] = useState(0), [copied, setCopied] = useState(false);
  useEffect(() => { try { if (new URLSearchParams(location.search).get("guide") === "1") localStorage.setItem("demo.guide", "1"); if (new URLSearchParams(location.search).get("guide") === "0") localStorage.removeItem("demo.guide");
      setOn(localStorage.getItem("demo.guide") === "1"); setI(+(localStorage.getItem("demo.step") ?? 0)); const s = localStorage.getItem("demo.t0"); setT0(s ? +s : null); } catch {}
    const key = (e: KeyboardEvent) => { if (e.key === "g" && e.altKey) { const v = localStorage.getItem("demo.guide") === "1"; v ? localStorage.removeItem("demo.guide") : localStorage.setItem("demo.guide", "1"); setOn(!v); } };
    addEventListener("keydown", key); const id = setInterval(() => setNow(Date.now()), 500); return () => { removeEventListener("keydown", key); clearInterval(id); }; }, []);
  if (!on) return null;
  const s = STEPS[i], step = (k: number) => { const n = Math.max(0, Math.min(STEPS.length - 1, k)); setI(n); try { localStorage.setItem("demo.step", String(n)); } catch {} setCopied(false); };
  const go = () => { try { if (s.reset) { for (const k of Object.keys(localStorage)) if (k.startsWith("gemi.")) localStorage.removeItem(k); const t = Date.now(); localStorage.setItem("demo.t0", String(t)); setT0(t); } } catch {} if (s.go) location.href = s.go; };
  const el = t0 ? Math.max(0, Math.floor((now - t0) / 1000)) : 0, mm = `${Math.floor(el / 60)}:${String(el % 60).padStart(2, "0")}`;
  if (small) return <button onClick={() => setSmall(false)} className="fixed bottom-3 left-3 z-[90] rounded-full bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white opacity-70">{i + 1}/{STEPS.length} · {mm}</button>;
  return (
    <div className="fixed bottom-3 left-3 z-[90] w-[23rem] rounded-xl border border-[#d1d5db] bg-white/95 p-3.5 text-[#111827] shadow-xl" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="flex items-center justify-between text-[12px]"><b>{i + 1} / {STEPS.length} · {s.t} <span className="font-normal text-[#6b7280]">约 {s.sec} 秒</span></b>
        <span className="flex items-center gap-2"><span className="tabular-nums" style={{ color: el > 180 ? "#dc2626" : el > 150 ? "#d97706" : "#6b7280" }}>{mm} / 3:00</span><button onClick={() => setSmall(true)} className="text-[#6b7280]" aria-label="收起">—</button></span></div>
      <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[12.5px] leading-snug text-[#374151]">{s.doZh.map((d) => <li key={d}>{d}</li>)}</ol>
      {s.copy && <button onClick={() => { navigator.clipboard?.writeText(s.copy!).then(() => setCopied(true)).catch(() => {}); }} className="mt-1.5 w-full truncate rounded-md border border-[#d1d5db] bg-[#f9fafb] px-2 py-1 text-left text-[12px]">{copied ? "已复制 ✓ " : "复制："}{s.copy}</button>}
      <div className="mt-2 rounded-lg bg-[#eef2ff] px-3 py-2">{s.say.map((x) => <p key={x} className="text-[14.5px] font-semibold leading-snug">{x}</p>)}</div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-[#6b7280]">{s.zh}</p>
      <div className="mt-2.5 flex items-center gap-2"><button onClick={() => step(i - 1)} disabled={i === 0} className="rounded-md border border-[#d1d5db] px-2.5 py-1 text-[12.5px] disabled:opacity-40">上一步</button>
        {(s.go || s.reset) && <button onClick={go} className="rounded-md bg-[#4f46e5] px-3 py-1 text-[12.5px] font-semibold text-white">Go → {s.go}</button>}
        <button onClick={() => step(i + 1)} disabled={i === STEPS.length - 1} className="ml-auto rounded-md bg-[#111827] px-3 py-1 text-[12.5px] font-semibold text-white disabled:opacity-40">下一步</button></div>
    </div>);
}
