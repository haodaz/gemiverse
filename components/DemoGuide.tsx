"use client";
import { useEffect, useState } from "react";

// A presenter's guide for the three-minute live demo. It appears only after /?guide=1 (or the G key) and stays across pages.
// Each step says where to go, what to click (in Chinese, for the presenter) and what to say (in English, short sentences).
const SAY = "帮我去图书馆看看有没有写论文的 workshop";
// The story, told on the product alone (no slides): a problem a student has, meeting the Gemi, asking it, watching it check,
// seeing it be honest about itself, an input nobody prepared, and the numbers in the back office. About 2:50 in all.
const STEPS: { t: string; sec: number; go?: string; reset?: boolean; copy?: string; doZh: string[]; say: string[]; zh: string }[] = [
  { t: "The problem", sec: 15, go: "/", reset: true, doZh: ["点「Go」回首页（会清空上次的演示数据，计时从这里开始）", "停在 banner，说完右边三句，再点黄色按钮 Meet your Gemi"],
    say: ["A student has a thousand campus events and no time.", "An AI that reads them is easy. An AI that never tells her something false is not.", "This is Gemiverse. Every student gets a Gemi."],
    zh: "一个学生面前有上千个校园活动，却没有时间。让 AI 去读不难；让 AI 绝不对她说错才难。这是 Gemiverse，每个学生有一个 Gemi。" },
  { t: "Meet it", sec: 20, go: "/start", doZh: ["点 Say hello", "名字打 Mochi → That is its name", "点「复制」，贴进文本框 → It heard you", "选 NYU → Move in at NYU"], copy: "I just started a PhD in education. I want to find people who build things for learners. Big mixers tire me.",
    say: ["It starts as a point of light. It exists because I came.", "I name it, tell it one thing about me, and choose where we live."],
    zh: "它一开始是一个光点，因为我来了才存在。我给它起名，告诉它一件事，选我们住在哪。" },
  { t: "Ask it", sec: 35, go: "/room", copy: SAY, doZh: ["（刚进屋它会先听你上一步写的那句话，等它回完）", "点底部 Talk，点「复制」，贴进输入框，回车", "等十几秒，书桌面板自己打开，出现 3 张卡", "指卡片上绿色的 checked fields"],
    say: ["I ask in Chinese: go to the library, find me a writing workshop.", "The Decisions API decides what I asked for, with a confidence score.", "It has a small budget of real tokens, so it brings back three things, not three hundred.", "Every field was checked against its source. What it could not check, it does not show."],
    zh: "我用中文说：去图书馆帮我找写论文的工作坊。Decisions API 判断我要它做什么，带置信度。它的预算是很少的真实 token，所以带回三样，不是三百样。每个字段都对照来源核对过，核对不了的不显示。" },
  { t: "Look again, live", sec: 20, doZh: ["在第一张卡上点 Look again, live（要等 25 到 50 秒）", "不要干等：说完右边的话，直接点「下一步」去做留/跳", "结果回来后再回头指一下"],
    say: ["Pages change. So I ask it to look again, right now.", "A Managed Agent is fetching that page itself, in a Google sandbox.", "When it comes back, the Decisions API judges each stored field. While it works:"],
    zh: "页面会变，所以我让它现在再去看一眼。Managed Agent 正在 Google 的沙箱里自己抓那个页面。回来以后 Decisions API 逐个字段判断。趁它在跑：" },
  { t: "Choose", sec: 35, doZh: ["第二、三张卡点 Skip，第一张点 Keep", "面板出现 Its guess, revealed 和 ✓，指一下猜对/猜错", "往上滚回第一张卡，指 Managed Agent 的结果：still on the page", "点底部 Diary，指它学到了什么"],
    say: ["Before I chose, it sealed a guess of what I would keep. My browser checks the hash.", "Sometimes it is wrong. It says so, and it learns how I choose.", "And the agent is back: these fields are still on the live page.", "The diary shows what it learned about me. I can undo any line."],
    zh: "我选之前它封存了一个预测，浏览器校验哈希。有时它猜错，它会直说，并从中学我怎么选。agent 也回来了：这些字段仍然在线上页面里。日记是它学到的关于我的事，每条都能撤回。" },
  { t: "Your input", sec: 25, go: "/room", doZh: ["对评委说右边第一句，等他们给东西", "点 Talk → 输入框左边回形针 → 选海报照片；或直接打他们说的话", "指出哪些字段通过、哪些没显示"],
    say: ["Now something I did not prepare. Give me a poster, or one sentence about you.", "It reads it, checks each field against the picture, and tells me if the event is already in the shared base."],
    zh: "现在来一个我没准备的。给我一张海报，或者说一句关于你的话。它读出来，把每个字段对照图片核对，并告诉我这个活动是否已经在共享底座里。" },
  { t: "Proof", sec: 25, go: "/admin", doZh: ["指 Dashboard 第一排数字，再指柱状图里红色那根", "有时间再点左边 Data flywheel"],
    say: ["Does it work? 122 pages from six universities we did not pick.", "3.2 percent wrong, against 8.4 for one model call.", "The red bar is our first run. We lost. We kept it on the chart.", "467 checked facts, shared by every Gemi. One check, every student. Thank you."],
    zh: "它真的有效吗？6 所大学 122 个我们没挑的页面：3.2% 错，单次调用 8.4%。红色那根是我们第一次跑，输了，我们把它留在图上。467 个核对过的事实，所有 Gemi 共用。一次核对，服务每个学生。谢谢。" },
  { t: "Q&A", sec: 120, doZh: ["下面是可能的问题和短答案，挑着用", "需要细节时打开 /deck（方法、测试集、失败记录）"],
    say: ["Baseline? One Gemini 4 Argon call, same page, no check.", "Test set? Every upcoming event the calendars returned. Truth is their own structured fields, not ours.", "Still fails? 18 facts. 12 are hybrid events: yes-or-no was the wrong question.", "Why tokens as a budget? A day is limited too. It must choose what matters.", "Privacy? Campus facts are shared. What it learns about you stays in your browser.", "Built today? Yes, all code. The idea began with Cocoverse, our product for pets."],
    zh: "基线：一次 Argon 调用，同一个页面，不核对。测试集：日历返回的所有近期活动，答案是日历自己的结构化字段，不是我们写的。还错在哪：18 个事实，其中 12 个是线上线下混合的活动，是非题问错了。为什么用 token 做预算：一天也是有限的，它必须选重要的。隐私：校园事实共享，它对你的了解只在你的浏览器里。今天做的吗：是，所有代码；想法最初来自 Cocoverse。" },
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
