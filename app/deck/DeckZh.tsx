"use client";

import { useEffect, useState, type ReactNode } from "react";
import { INK } from "@/components/game";
import { LineChart, Bars } from "@/components/charts";
import proof from "@/lib/proof.json";
import Banner from "./Banner";
import { step, type Tier } from "@/lib/mind";
import { POLICY } from "@/lib/kernel/autonomy";
import { TOOLS } from "@/lib/kernel/tools";

// The deck is a page of the product itself, so its pictures are the live 3D room and character, not screenshots.
const Live = ({ src, className = "" }: { src: string; className?: string }) => <iframe src={src} title="live" className={`h-full w-full border-0 bg-transparent ${className}`} loading="lazy" />;
const Frame = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`overflow-hidden rounded-[28px] border-[3px] bg-[#fffaf0] ${className}`} style={{ borderColor: INK, boxShadow: `0 8px 0 ${INK}22` }}>{children}</div>);
const Tag = ({ children, c = "#c8b4f0" }: { children: ReactNode; c?: string }) => <span className="mr-2 inline-block rounded-full border-2 px-3 py-0.5 text-sm font-bold" style={{ borderColor: INK, background: c }}>{children}</span>;
const Eyebrow = ({ children }: { children: ReactNode }) => <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#8a8296]">{children}</p>;
const H = ({ children }: { children: ReactNode }) => <h1 className="mt-3 text-[2.9rem] font-bold leading-[1.08] tracking-tight">{children}</h1>;
const P = ({ children }: { children: ReactNode }) => <p className="mt-4 text-xl leading-relaxed text-[#4a4356]">{children}</p>;
const Li = ({ children }: { children: ReactNode }) => <li className="flex gap-3 py-1.5 text-lg leading-snug"><span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "#7c4dce" }} /><span>{children}</span></li>;
const Cell = ({ children, head, w }: { children: ReactNode; head?: boolean; w?: string }) => <td className={`border-t-2 px-4 py-3.5 align-top ${head ? "text-xs font-bold uppercase tracking-wider text-[#8a8296]" : "text-[19px] leading-snug"}`} style={{ borderColor: "#e6dfd0", width: w }}>{children}</td>;


const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const PUR = "#7c4dce", GREY = "#b9b2c4", GOLD = "#e0a526", TEAL = "#2f9e8f", RED = "#d9534f";
const L = proof.listings.overall as any, PG = proof.pages.overall as any, P1 = proof.pagesRun1.overall as any;
const TPP = { base: proof.pages.tokens.baseline / proof.pages.n, sys: proof.pages.tokens.system_v2 / proof.pages.n };   // tokens per page, measured
const TIERS: [Tier, string, string][] = [["self_reported", "说过", GREY], ["checked", "选过（已核对）", GOLD], ["seen_over_time", "长期观察到", TEAL], ["actually_done", "真的做了", PUR]];
const haloCurve = (t: Tier) => { let b = { m: 0, u: 1 }; const pts: [number, number][] = [[0, 1]]; for (let k = 1; k <= 10; k++) { b = step(b, b.m, t); pts.push([k, b.u]); } return pts; };
const Box = ({ children, c = "#fffaf0", className = "" }: { children: ReactNode; c?: string; className?: string }) => <div className={`rounded-2xl border-2 px-4 py-3 ${className}`} style={{ borderColor: INK, background: c }}>{children}</div>;
const Stat = ({ v, l, c = "#fff" }: { v: string; l: string; c?: string }) => <div className="rounded-2xl border-2 px-3 py-3 text-center" style={{ borderColor: INK, background: c }}><div className="text-3xl font-bold tabular-nums">{v}</div><div className="mt-1 text-xs leading-tight text-[#6d6579]">{l}</div></div>;
const F = ({ children }: { children: ReactNode }) => <div className="my-2 rounded-xl bg-[#2b2536] px-4 py-2.5 font-mono text-[15px] leading-relaxed text-[#fdf6e3]">{children}</div>;
const LAYERS: [string, string, string, string][] = [
  ["7 · 你看到的房间", "一个 3D 房间，一个角色，书桌上三张卡片。", "3D 由 Neon 编写", "#ffd6e0"],
  ["6 · 投影", "16 条规则：状态里的一件事实，在房间里只显示成一样东西。房间里没有哪样东西是随手放的装饰。", "16 条已做 12 条", "#ffe08a"],
  ["5 · 自主与治理", "在实测状态上按顺序匹配的策略，第一条命中的生效；14 个登记过的方法，两个钱袋，成长阶段，确认，总开关。", "12 条策略，写在代码里", "#c8e6a0"],
  ["4 · 心智", "七条轴，每条有一个位置和一个不确定度。只有一条更新规则；证据按得来的方式加权。日志只追加，撤销靠重放。", "Carbon 把 9 条轴减到 7 条", "#a8e0c0"],
  ["3 · 核对关卡", "每个字段拿去对照来源问 Decisions 一个问题。低于 0.8 就不展示，并且标明没有展示。", `没见过的页面上错误率 ${pct(PG.system_v2.error_rate)}`, "#a8d4ff"],
  ["2 · 共享底座", "实体、关联、证据，带来源等级和原文引用。由 Carbon 和另一位设计者并行设计，再合并。", "166 个实体，420 个核对过的字段", "#c8b4f0"],
  ["1 · 公开网页", "六所大学的静态页面和公开 JSON 数据源。隐藏文字、缺年份、反爬墙。", "今天读了 202 个页面", "#e6dfd0"],
];
const MAP: [string, string, string, string][] = [
  ["还没看的带回来的东西", "卡片在书桌上摊成扇形", "别人帮你找来、你还没读的东西", "Gemi 放 · 你清"],
  ["你留下的东西", "卡片钉在软木板上", "你的候选清单", "你"],
  ["今天剩下的 Gem Star", "两个罐子里的金色和淡紫色星星", "一天里剩下的时间和注意力", "Gemi 花"],
  ["攒了几天的星星", "淡紫色罐子装得超过一天的量", "为更大的事攒着", "Gemi"],
  ["对你的不确定", "它的表情；它站在哪；它问什么", "还不太了解一个人", "你的选择"],
  ["家具摆在哪", "地面网格", "你的空间，你的摆法", "你搬 · Gemi 留意"],
  ["成长阶段", "架子上的奖杯", "真正做成的事，不是花掉的时间", "结果"],
  ["外出去校园", "房间空着，门半开", "人在别处", "Gemi"],
];
const FAILS: [string, string, string, string][] = [
  ["在原始网页上，基线和我们的系统都把线下活动说成线上。这些页面的每个报名表里都有一行「请注意这是线上活动」，被页面用 display:none 藏了起来。人看不到这行字，我们的文本读取器却读到了；核对关卡也确认了它，因为这些字确实在页面里。",
    "是否线上：122 条里错 47 条（基线错 37 条）。核对关卡没有带来任何改变。",
    "按人看到的样子读页面：取文本之前，先去掉页面自己隐藏的元素。",
    "是否线上：122 条里错 12 条（原来 47 条）。六所大学 610 条事实的总错误率从 9.6% 降到 3.2%；拿到同样可见文本的单次调用基线是 4.3%。大部分提升来自读取器，两边都受益；流程自身的优势在地点上（错 6 条，对比 12 条）。"],
  ["活动列表只印「November 23」，不印年份。我们的规则「绝不猜年份」让几乎所有日期都不展示。",
    "70 条列表里日期对了 2 条；覆盖率 54.6%；错 1 条",
    "年份由代码里的一条规则确定，不交给模型：取读页面当天或之后第一个这样的日期。",
    "70 条里日期对了 68 条；覆盖率 88.7%；错 1 条"],
  ["16 个正确的开始时间没有展示。我们问 Decisions API「是不是 15:00 开始」，而页面上印的是「3:00pm」。",
    "覆盖率 88.7%",
    "按页面印的写法去问核对关卡，同时附上 24 小时制的值。",
    "覆盖率 96.9%；错误率 0.5%，基线是 1.0%"],
  ["核对关卡拿「页面有没有写明这一点」去问我们自己定的标签（活动类型、线下还是线上、谁可以参加）。页面很少用文字写明这些，所以正确的标签被拦下了。",
    "设计集上 148 个字段通过 102 个",
    "字段分两种。明写的事实必须出现在页面上。分类则按「这是不是最贴切的标签」来核对，存储时标为推断。",
    "145 个字段通过 118 个；展示出来的无依据字段仍是 0"],
  ["我们自己复查时发现，「封存的」预测是和卡片一起发到浏览器的，它的哈希也没法重新计算。",
    "无法验证",
    "先承诺后揭示：卡片发出时不带数字，只带一个哈希和加密后的数字；最后一次选择之后，浏览器拿到数字和 nonce，重新计算哈希。",
    "在浏览器里验证通过（显示对勾）"],
  ["大学的大型日历对脚本只回一个验证页面或一个空壳。",
    "25 个种子页面里 16 个拿到可用文本",
    "从网站自己的公开 JSON 数据源里取同一个活动；来源等级标得比静态页面低一级。",
    "25 个全部可用（17 个静态页面，8 条数据源记录）"],
];

const SECTIONS: [string, number][] = [["产品", 6], ["特色与价值", 7], ["过程", 6], ["展望", 3]];
const sectionOf = (i: number) => { let k = 0; for (const [name, n] of SECTIONS) { if (i < k + n) return name; k += n; } return ""; };

export default function Deck({ onLang }: { onLang?: () => void }) {
  const [i, setI] = useState(0);

  const slides: { id: string; body: ReactNode }[] = [
    { id: "Gemiverse", body: (
      <div className="flex h-full flex-col">
        <div className="flex items-end justify-between gap-10"><div><Eyebrow>Gemini 4 纽约黑客松 · 赛道一，5 Sigma · 今天做的</Eyebrow><h1 className="mt-2 text-[4.6rem] font-bold leading-none tracking-tight">Gemiverse</h1></div>
          <p className="max-w-[46%] pb-2 text-xl leading-relaxed text-[#4a4356]">每个大学生都有一个 <b>Gemi</b>。它进入一个空间，在里面一天天更懂你；每天花的 token 很少，换来的东西却留得住。</p></div>
        <div className="mt-4 min-h-0 flex-1"><Banner t={{ s1: ["一个 Gemi", "一个学生的 AI 投射"], s2: ["进入一个空间", "它能读懂、也能改变的小屋和校园"], s3: ["心智升维", "六种能力，每一种都站在下面那一种之上"], s4: ["token 拉长成时间", "每天只花一点；换来的东西一直留着"], minds: [["感知", "听你说话，看懂海报"], ["核对", "来源上找得到才算事实"], ["认识你", "七条「你怎么选」的轴，带宽度"], ["预测", "你选之前先封存一个猜测"], ["规划", "把预算花在最不了解的地方"], ["反思和创造", "日记里记下自己的错；攒星星；做东西"]], spent: "当天花掉的 Gem Star", stays: "留下来的：核对过的事实、它对你的了解", days: "天" }} /></div>
        <p className="mt-3 text-center text-2xl font-bold" style={{ color: "#7c4dce" }}>宁可漏掉，也不说错。</p>
      </div>) },

    { id: "它是什么", body: (
      <div className="grid h-full grid-cols-[1fr_1.25fr] items-center gap-10">
        <div><Eyebrow>Gemiverse 是什么</Eyebrow><H>一个分身，有房间，有预算，对事实有良心。</H>
          <ul className="mt-5"><Li>你用任何语言跟它说话，或者给它看一张海报。它听的是你说了什么，不是你听起来怎么样。</Li>
            <Li>它去校园里的四个地方，带回三样东西，每个字段都对照来源核对过。</Li>
            <Li>你留下或跳过。它由此学到你是怎么选的，并把学到的给你看。其中任何一条你都可以撤销。</Li>
            <Li>没人管它的时候，它花自己的 Gem Star：想事情，外出，写日记，改自己的房间。</Li></ul></div>
        <div className="h-[78vh]"><Live src="/gen3d/viewer.html?embed=1&bare=1&school=nyu" /></div>
      </div>) },

    { id: "任务", body: (
      <div className="grid h-full grid-cols-[1.15fr_1fr] items-center gap-12">
        <div><Eyebrow>赛道一 · 5 Sigma · 任务</Eyebrow><H>告诉学生有什么活动。绝不告诉他们假的。</H>
          <P>听起来只是查一下。今天的智能体在这件事上有三种失败，我们都测到了：</P>
          <ul className="mt-3"><Li><b>它们读到了人看不到的东西。</b>这些页面的每个报名表里都藏着一行「这是线上活动」。单次模型调用在原始页面上把 {proof.pages.facts} 条事实里的 {P1.baseline.wrong} 条说错了。</Li>
            <Li><b>它们会自己补空。</b>在十个没见过的页面上，单次调用展示的 103 个字段里有 29 个在页面上找不到依据：编出来的结束时间，写错的年份。</Li>
            <Li><b>它们进不去。</b>大型日历对脚本只回一堵墙；我们最初的 25 个页面里有 9 个没拿到任何可用内容。</Li></ul>
          <p className="mt-6 text-2xl font-bold" style={{ color: PUR }}>房间错了或日子错了，学生就白搭一个晚上。所以：宁可漏掉，也不说错。</p></div>
        <div><div className="grid grid-cols-2 gap-3"><Stat v={pct(P1.baseline.error_rate)} l="单次调用，原始页面，六所大学" c="#ffe1df" /><Stat v={pct(PG.system_v2.error_rate)} l="我们的系统，同样的页面" c="#dff3e6" />
          <Stat v="29 / 103" l="展示了无依据的字段，单次调用" c="#ffe1df" /><Stat v="0 / 76" l="展示了无依据的字段，我们的系统" c="#dff3e6" /></div>
          <p className="mt-4 text-[15px] text-[#8a8296]">我们还没有做到五个西格玛。我们做出来的，是让错误率可以测量、并且能把它压下去的东西。</p></div>
      </div>) },

    { id: "Gemi + Verse", body: (
      <div className="h-full"><Eyebrow>为什么是 Gemi，为什么是 Verse</Eyebrow><H>心智要有身体才能被读懂。事实要有地方才能被共享。</H>
        <div className="mt-8 grid grid-cols-2 gap-8">
          <Frame className="p-7"><Tag>Gemi · 人</Tag>
            <ul className="mt-4"><Li>它心里的你是不确定的。一个角色能把这一点<b>表现出来</b>：它站在哪，手里拿着什么，猜错时的表情。</Li>
              <Li>它只属于你。它对你的了解都留在你的浏览器里。没有平台画像。</Li>
              <Li>养它就是养自己：每一次留下或跳过，都让你看到自己是怎么选的。</Li></ul></Frame>
          <Frame className="p-7"><Tag c="#a8d4ff">Verse · 地方</Tag>
            <ul className="mt-4"><Li>校园里的事实是一个共享底座。一个 Gemi 核对过的，每个 Gemi 都能免费读。</Li>
              <Li>房间是一块读数盘：书桌上的卡片是等你看的东西，钉起来的是你留下的，罐子里装着它的 Gem Star。</Li>
              <Li>中间没有信息流，没有排名，没有推荐系统。Gemi 和社团的智能体组成网络；做决定的是人。</Li></ul></Frame>
        </div>
        <p className="mt-8 text-center text-2xl font-bold">事实共享。理解私有。</p>
      </div>) },

    { id: "给谁用", body: (
      <div className="grid h-full grid-cols-[1.15fr_1fr] items-center gap-10">
        <div><Eyebrow>给谁用，为什么是他们</Eyebrow><H>大学生。先做 NYU 和 Columbia。</H>
          <ul className="mt-5"><Li><b>是太多，不是太少。</b>NYU 的一个日历数据源，三周里就列了大约一千个活动。学生不缺信息；他们缺的是一个替他们读、又不乱编的东西。</Li>
            <Li><b>页面是公开的，可以核对。</b>校园是一个有边界的小世界，有官方来源。正因为这样，对事实提五个西格玛的标准才有可能做到。</Li>
            <Li><b>这里的选择会塑造一个人。</b>大一时你走进哪个房间是有分量的。研究也说得很清楚：只有存在真实的机会，归属感才会跟着来。</Li>
            <Li><b>垂直领域让成本负担得起。</b>成千上万的学生面对同一批活动，所以核对一次，所有人都能用。</Li></ul></div>
        <div className="h-[70vh]"><img src="/art/campus3-nyu.svg" alt="一张手绘风格的校园地图" className="h-full w-full object-cover [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_78%)]" /></div>
      </div>) },

    { id: "价值", body: (
      <div className="h-full"><Eyebrow>痛点，它怎么应对，以及证据</Eyebrow><H>四个问题，四个回答。</H>
        <table className="mt-6 w-full"><tbody>
          <tr><Cell head w="24%">痛点</Cell><Cell head w="38%">Gemi 怎么做</Cell><Cell head>今天的证据</Cell></tr>
          <tr><Cell><b>AI 的回答听起来对，其实不对。</b></Cell><Cell>它带回来的每样东西，每个字段都由 Decisions API 对照来源核对。低于 0.8 就不展示，并且标明没有展示。</Cell><Cell>在 10 个没见过的页面上，单次模型调用展示的 103 个字段里有 29 个在页面上找不到依据；我们的一个也没有。在六所大学的 122 个原始页面上：错 3.2%，对比 8.4%。</Cell></tr>
          <tr><Cell><b>一千个活动，没有时间。</b></Cell><Cell>每天一小笔预算逼它做选择：每次外出带回三样东西，挑在你最在意、而它了解最少的地方。</Cell><Cell>Carbon 挑两样东西，让它们在它最没把握的那条轴上形成对比，所以不管你留下哪一个，它都能学到点什么。</Cell></tr>
          <tr><Cell><b>黑箱式的个性化。</b></Cell><Cell>七条随情境而定的轴，每条都带一圈光晕。每一次移动都对应到某一次选择，并且可以撤销。在你选择之前，它先封存一个预测。</Cell><Cell>封存是真的先承诺后揭示；浏览器会重新计算哈希。它早期的预测经常是错的，它在日记里也这么写。</Cell></tr>
          <tr><Cell><b>让你一直聊下去的陪伴产品。</b></Cell><Cell>短时间到访。不搞连续打卡，不搞排行榜。成功看的是你在现实世界里做了什么。</Cell><Cell>依据研究，从设计之初就这样定下；成长按核对过的事实和留下的东西来算，绝不按花掉的时间算。</Cell></tr>
        </tbody></table>
      </div>) },

    { id: "外表简单", body: (
      <div className="grid h-full grid-cols-[1fr_1.35fr] items-center gap-8">
        <div className="flex h-full flex-col"><Eyebrow>看起来简单，其实不简单。</Eyebrow><H>它是从底下往上长出来的。</H>
          <p className="mt-3 text-lg text-[#4a4356]">按这个顺序搭建，先做最底层。每一层都是下面一层的投影；房间只是最上面那一层。</p>
          <div className="min-h-0 flex-1"><Live src="/gen3d/viewer.html?embed=1&bare=1&school=nyu" /></div></div>
        <div className="space-y-1.5">{LAYERS.map(([name, what, num, c]) => (
          <div key={name} className="grid grid-cols-[190px_1fr_170px] items-center gap-3 rounded-xl border-2 px-3 py-2" style={{ borderColor: INK, background: c }}>
            <b className="text-[15px]">{name}</b><span className="text-[14px] leading-snug">{what}</span><span className="text-right text-[12.5px] font-bold">{num}</span></div>))}
          <p className="pt-2 text-[14px] text-[#8a8296]">在任何界面出现之前，Gemini 先设计了第 2 层和第 4 层。另一位设计者同时并行工作；两份草稿和合并结果都在仓库里，没有任何一份被覆盖。</p></div>
      </div>) },

    { id: "token 持续回本", body: (
      <div className="h-full"><Eyebrow>为什么这个成本值得</Eyebrow><H>token 花一次，一直有回报。</H>
        <div className="mt-4 grid grid-cols-[1.2fr_1fr] gap-10">
          <LineChart logX xMax={1000} yMax={2600} h={340} xLabel="Gemi 读同一个页面的学生人数" yLabel="每个学生、每个页面的 token 数" xTicks={[1, 3, 10, 100, 1000]} yTicks={[0, 500, 1000, 1500, 2000, 2500]} series={[
            { name: "每人调用一次，不核对", color: GREY, dash: true, points: [[1, TPP.base], [1000, TPP.base]] },
            { name: "核对，每人各做各的", color: RED, dash: true, points: [[1, TPP.sys], [1000, TPP.sys]] },
            { name: "核对一次，大家共享", color: PUR, points: [1, 2, 3, 5, 10, 30, 100, 300, 1000].map((n) => [n, TPP.sys / n] as [number, number]) }]} />
          <div className="text-[17px] leading-relaxed">
            <F>cost(n) = c_check / n + c_recheck<br />c_check = {Math.round(TPP.sys)} 个 token（实测）<br />c_recheck = 0，如果页面指纹没有变</F>
            <p className="mt-3">核对的成本是一次不核对调用的 {(TPP.sys / TPP.base).toFixed(1)} 倍。从<b>第三个学生</b>开始，核对过的事实就比没核对的便宜，而且它一直留在底座里。</p>
            <p className="mt-3">一个学生给它看的海报，核对之后进入底座，所有人都能用。共享的是事实，绝不是谁问过它。</p>
            <p className="mt-3"><b>为什么做垂直领域：</b>在一个校园之内，来源是官方的，实体反复出现，一套设计就够用。在开放的网络上，n 一直接近 1。</p></div>
        </div>
      </div>) },

    { id: "稀缺", body: (
      <div className="grid h-full grid-cols-[1.1fr_1fr] items-center gap-10">
        <div><Eyebrow>为什么要给 Gemi 有限的预算，并让它自己演绎</Eyebrow><H>去找宝贝，不要堆垃圾。</H>
          <P>人的一天里，时间、精力和注意力都有限。Gemi 的一天里，Gem Star 的数量有限，而且它们是真实的 token。两者形状相同，所以它的选择能对应到真实的一天。</P>
          <ul className="mt-3"><Li><b>稀缺逼出真正要紧的问题：</b>今天什么值得做？没有上限的话，智能体会带回一千个活动，还说这是帮忙。</Li>
            <Li><b>不是每个学生都有无限的算力。</b>我们算的是一个 token 换来了什么，不是烧掉了多少。</Li>
            <Li><b>它可以选择不花。</b>它可以攒几天去做一件更大的事：一首歌要 6 颗，一个新空间要 12 颗。</Li>
            <Li><b>你开口要的都免费。</b>星星只用在它自己决定去做的事上。</Li><Li><b>然后放手让它自己跑。</b>每天它自己排计划、花、攒，并写下理由，没有人指挥。有了上限，这件事才值得看，也才敢放手。</Li></ul></div>
        <table className="w-full"><tbody>
          <tr><Cell head w="46%">在真实的一天里</Cell><Cell head>在 Gemiverse 里</Cell></tr>
          <tr><Cell>时间、精力、注意力</Cell><Cell>Gem Star，分装两个钱袋：一个为你，一个为它自己</Cell></tr>
          <tr><Cell>决定什么最要紧</Cell><Cell>缺口规则：花在你在意、而它了解最少的地方</Cell></tr>
          <tr><Cell>值得你花一个晚上的三件事</Cell><Cell>每次外出带回三样东西，每个字段都核对过</Cell></tr>
          <tr><Cell>攒着</Cell><Cell>一个跨天装满的罐子</Cell></tr>
          <tr><Cell>今天什么都不做</Cell><Cell>一条策略：休息、攒着，或者随便忙点小事，花 0 颗星</Cell></tr>
        </tbody></table>
      </div>) },

    { id: "心智", body: (
      <div className="h-full"><Eyebrow>心智空间 · 三小块数学</Eyebrow><H>它对你的看法，是一个带宽度的数。</H>
        <div className="mt-3 grid grid-cols-[1.1fr_1fr] gap-10">
          <div><LineChart xMax={10} yMax={1} h={320} xLabel="同一条轴上的证据条数" yLabel="不确定度（光晕）" xTicks={[0, 2, 4, 6, 8, 10]} yTicks={[0, 0.25, 0.5, 0.75, 1]} series={TIERS.map(([t, name, color]) => ({ name, color, points: haloCurve(t) }))} />
            <p className="text-[14px] text-[#8a8296]">曲线由房间里实际运行的代码算出（<code>lib/mind.ts</code>）。只靠说的话，光晕永远降不到 0.55 以下。</p></div>
          <div className="text-[16px] leading-snug">
            <b>1 · 更新。</b>七条轴，描述你怎么做选择。证据按得来的方式加权。
            <F>k = u² / (u² + noise[tier])<br />m ← m + k (x − m) &nbsp; u ← √((1 − k) u²)<br />noise：说过 2.5 · 选过 1.0 · 长期 0.45 · 做过 0.22</F>
            落在光晕之外的选择会让光晕变宽：意外让它更不确定，而不是更确定。
            <p className="mt-3"><b>2 · 下一步往哪看。</b></p>
            <F>gap(axis) = care(axis) × u(axis)<br />在 gap 最大（argmax）的那条轴上，从相反的两端各带回一样东西</F>
            不管你留下哪一个，它都能学到点什么。
            <p className="mt-3"><b>3 · 一个事后改不了的预测。</b></p>
            <F>h = SHA-256(nonce ‖ guess)，在你选择之前发出<br />之后：公开 nonce 和 guess；你的浏览器重新计算 h</F>
          </div>
        </div>
      </div>) },

    { id: "投影", body: (
      <div className="grid h-full grid-cols-[1.5fr_1fr] items-center gap-8">
        <div><Eyebrow>空间投影</Eyebrow><H>一个状态，一样东西，一个现实里的含义。</H>
          <table className="mt-3 w-full"><tbody>
            <tr><Cell head w="22%">状态（一个数）</Cell><Cell head w="26%">在房间里</Cell><Cell head w="30%">对应生活里的什么</Cell><Cell head>谁来改变它</Cell></tr>
            {MAP.map((r) => <tr key={r[0]}>{r.map((t, k) => <td key={k} className="border-t-2 px-3 py-1.5 align-top text-[14.5px] leading-snug" style={{ borderColor: "#e6dfd0", fontWeight: k === 0 ? 700 : 400 }}>{t}</td>)}</tr>)}
          </tbody></table>
          <p className="mt-3 text-[15px] leading-snug text-[#4a4356]"><b>为什么这种对应很重要：</b>Gemi 和学生在同一个空间里行动，彼此都看得到对方做了什么。每样东西都代表一件测量过的事，并且在现实里有对应物，所以房间的一处改动就是状态的一处改动，策略可以据此推理。房间里没有哪样东西是悬空的，所以决策保持稳定。</p></div>
        <div className="h-[80vh]"><Live src="/gen3d/viewer.html?embed=1&bare=1&school=columbia" /></div>
      </div>) },

    { id: "自主", body: (
      <div className="h-full"><Eyebrow>有规则的自主</Eyebrow><H>没人告诉它做什么的时候，它做什么。</H>
        <div className="mt-3 grid grid-cols-[1.5fr_1fr] gap-8">
          <table className="w-full"><tbody>
            <tr><Cell head w="5%">#</Cell><Cell head w="50%">什么时候（第一条命中的生效）</Cell><Cell head w="25%">它做什么</Cell><Cell head>它要花</Cell></tr>
            {POLICY.map((r, k) => <tr key={r.id}>{[String(k + 1), r.when, r.then.method ?? r.then.state, r.then.stars ? `${r.then.stars} 颗 Gem Star` : "0"].map((t, j) => <td key={j} className="border-t px-3 py-[5px] align-top text-[13.5px] leading-snug" style={{ borderColor: "#e6dfd0", fontFamily: j === 2 ? "ui-monospace, monospace" : undefined }}>{t}</td>)}</tr>)}
          </tbody></table>
          <div className="space-y-2.5 text-[15px] leading-snug">
            <Box c="#fff"><b>依据实测状态的策略，不是凭心情。</b>左边这张表就是实际运行的代码（<code>lib/kernel/autonomy.ts</code>）。</Box>
            <Box c="#fff"><b>治理内核。</b>只能用登记过的方法。调用之前先扣费。每天有上限。必须先到达某个成长阶段。有些需要你确认。还有一个暂停，优先于每一条策略。</Box>
            <Box c="#fff"><b>三种模式。</b>想（计划、预测、写日记）。做（外出、核对、询问）。造（装饰、作曲、搭建）；它写成代码的任何东西，运行前都要先扫描。</Box>
            <Box c="#fff"><b>它看得到你做了什么。</b>搬动它的家具，第 5 条就会触发：它走过去，看一看，记下来。</Box></div>
        </div>
      </div>) },

    { id: "范围", body: (
      <div className="h-full"><Eyebrow>范围 · Gemi 能做的全部事情</Eyebrow><H>{TOOLS.length} 个方法。这张清单之外的都调用不了。</H>
        <div className="mt-3 grid grid-cols-[1.25fr_1fr] gap-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{TOOLS.map((t) => (
            <div key={t.name} className="rounded-xl border-2 px-3 py-1.5" style={{ borderColor: INK, background: t.mode === "think" ? "#efe7ff" : t.mode === "act" ? "#e3f1ff" : "#fff0c9" }}>
              <div className="flex items-baseline justify-between"><b className="font-mono text-[13.5px]">{t.name}</b><span className="text-[11.5px] font-bold">{t.mode} · {t.stars ? `${t.stars}★` : "免费"}</span></div>
              <div className="text-[12.5px] leading-snug text-[#4a4356]">{t.does}</div></div>))}</div>
          <div><div className="grid grid-cols-2 gap-3">{[["room-game-ui-1212", "点它一下，展开一圈可选的动作"], ["desk-zoom-1318", "带回来的东西在书桌上，星星在罐子里"], ["room-3d-arrange-1123", "在网格上的布置模式"], ["campus-v3-1252", "它能去的四个地方"]].map(([f, c]) => (
            <figure key={f}><img src={`/deck/${f}.jpg`} alt={c} className="h-[17vh] w-full rounded-xl object-cover" /><figcaption className="mt-1 text-[12.5px] text-[#6d6579]">{c}</figcaption></figure>))}</div>
            <p className="mt-3 text-[14px] leading-snug text-[#4a4356]">紫色：想（think）。蓝色：做（act）。黄色：造（make）。你开口要的，每个方法都免费；它自己主动去做的，按标出的价格从它自己的钱袋里付。</p></div>
        </div>
      </div>) },

    { id: "基线", body: (
      <div className="h-full"><Eyebrow>问题一 · 基线是什么，好了多少</Eyebrow><H>对手是在同样页面上的一次模型调用。</H>
        <div className="mt-4 grid grid-cols-[1.25fr_1fr] gap-10">
          <div><Bars yMax={0.1} yLabel="错误率" fmt={(v) => `${(v * 100).toFixed(1)}%`} h={330} groups={[
            { label: `活动列表 · ${proof.listings.facts} 条事实`, bars: [{ name: "基线", value: L.baseline.error_rate, color: GREY }, { name: "我们", value: L.v3.error_rate, color: PUR }] },
            { label: `原始页面，第一次跑 · ${proof.pages.facts} 条事实`, bars: [{ name: "基线", value: P1.baseline.error_rate, color: GREY }, { name: "我们", value: P1.system.error_rate ?? P1.system_v1?.error_rate, color: RED }] },
            { label: "原始页面，修复之后", bars: [{ name: "基线", value: PG.baseline.error_rate, color: GREY }, { name: "基线+读取器", value: PG.baseline_visible.error_rate, color: "#8f879c" }, { name: "我们", value: PG.system_v2.error_rate, color: PUR }] }]} /></div>
          <div className="text-[17px] leading-relaxed">
            <p><b>基线：</b>Gemini 4 Argon，一次调用，输入页面文本，输出五项事实。没有结构，没有核对。</p>
            <p className="mt-3"><b>我们：</b>Hydrogen 往 Carbon 设计的结构里填内容；Decisions API 对照来源，每个字段回答一个问题；年份由代码里的一条规则确定。</p>
            <p className="mt-3"><b>第一次跑输了。</b>{pct(P1.system?.error_rate ?? P1.system_v1?.error_rate)} 对 {pct(P1.baseline.error_rate)}。核对关卡确认了隐藏文字，因为那些字确实在页面里。这根柱子我们照样放出来。</p>
            <p className="mt-3"><b>修复之后：</b>{pct(PG.system_v2.error_rate)} 对 {pct(PG.baseline.error_rate)}，覆盖率 {pct(PG.system_v2.coverage)}。把我们的读取器给基线用，它能到 {pct(PG.baseline_visible.error_rate)}：大部分提升来自读取器；核对关卡自身的优势在地点上，错 6 条，对比 12 条。</p>
            <p className="mt-3 text-[15px] text-[#8a8296]">成本：每个页面 {Math.round(TPP.sys)} 个 token，对比 {Math.round(TPP.base)} 个。下一页讲这笔钱谁来付。</p></div>
        </div>
      </div>) },

    { id: "测试集", body: (
      <div className="h-full"><Eyebrow>问题二 · 测试集</Eyebrow><H>页面不是我们挑的，标准答案不是我们写的。</H>
        <div className="mt-5 grid grid-cols-[1fr_1.1fr] gap-10">
          <div><div className="grid grid-cols-3 gap-3"><Stat v={String(proof.pages.n)} l="原始活动页面" /><Stat v="6" l="所大学；其中 5 所设计时从没见过" /><Stat v={String(proof.pages.edge_pages)} l="带特殊情况的页面" /></div>
            <Bars yMax={32} yLabel="页面数" h={230} groups={Object.entries(proof.pages.schools).map(([k, v]) => ({ label: k, bars: [{ name: "", value: v as number, color: k === "NYU" ? PUR : TEAL }] }))} />
            <p className="text-[14px] text-[#8a8296]">另有 {proof.listings.n} 条 NYU 活动列表（{proof.listings.facts} 条事实），以及设计阶段特意留着没用的十页考题集。</p></div>
          <table className="w-full self-start"><tbody>
            <tr><Cell head w="34%">规则</Cell><Cell head>怎么守住</Cell></tr>
            <tr><Cell><b>输入不是我们的</b></Cell><Cell>六所大学的图书馆日历返回的每一个即将举办的活动，按数据源的顺序。不手挑。</Cell></tr>
            <tr><Cell><b>标准答案是独立的</b></Cell><Cell>答案来自日历自己的结构化字段（日期、开始、结束、地点、是否线上）。各系统只看得到渲染出来的页面。</Cell></tr>
            <tr><Cell><b>故意选乱的</b></Cell><Cell>重复举办的活动、没有地点、只在线上、跨多天、已取消、缺年份、被页面隐藏的文字。</Cell></tr>
            <tr><Cell><b>评分规则先定死</b></Cell><Cell>每一组都用同一个评分器。不展示的算在覆盖率的损失里，绝不算对。</Cell></tr>
            <tr><Cell><b>也有现场输入</b></Cell><Cell>这个会场里的语音和海报，在台上走同一道核对关卡。</Cell></tr>
          </tbody></table>
        </div>
      </div>) },

    { id: "失败", body: (
      <div className="h-full"><Eyebrow>问题三 · 哪里失败了，我们改了什么</Eyebrow><H>之前，怎么改，之后。</H>
        <table className="mt-4 w-full"><tbody>
          <tr><Cell head w="27%">我们看到了什么</Cell><Cell head w="17%">之前</Cell><Cell head w="31%">我们改了什么</Cell><Cell head>之后</Cell></tr>
          {FAILS.map((row, n) => (
            <tr key={n}>{row.map((t: string, k: number) => <td key={k} className="border-t-2 px-3 py-2 align-top text-[14.5px] leading-snug" style={{ borderColor: "#e6dfd0", fontWeight: k === 3 ? 700 : 400 }}>{t.length > 100 ? t.slice(0, 98) + "…" : t}</td>)}</tr>))}
        </tbody></table>
        <p className="mt-3 text-[15px] text-[#8a8296]">共记录了 {proof.improvements.length} 次修正，证据文件都列在 <code>base/runs/improvements.json</code> 里。其中三次是我们的测量出了错，不是系统出了错。</p>
      </div>) },

    { id: "仍然失败", body: (
      <div className="grid h-full grid-cols-[1.2fr_1fr] items-center gap-10">
        <div><Eyebrow>问题三 · 哪里仍然失败</Eyebrow><H>还有 {PG.system_v2.wrong} 条事实是错的。都在这里。</H>
          <table className="mt-4 w-full"><tbody>
            <tr><Cell head w="16%">哪所学校</Cell><Cell head w="14%">事实</Cell><Cell head w="36%">我们展示的</Cell><Cell head>日历上写的</Cell></tr>
            {[0, 1, 9, 13].map((k) => { const w = (proof.pages.still_wrong as any[])[k]; return w ? (<tr key={k}><Cell>{w.school}</Cell><Cell>{w.field}</Cell><Cell>{String(w.shown)}</Cell><Cell>{String(w.truth)}</Cell></tr>) : null; })}
          </tbody></table>
          <ul className="mt-4"><Li><b>18 条里的 12 条</b>是 Penn 和 Duke 重复举办的活动被说成线上。原因我们还没找到。</Li>
            <Li><b>18 条里的 4 条</b>是 Duke 的房间：我们从描述里读出了房间，而日历字段写的是「Other」。我们仍然把它们算作错。</Li>
            <Li>第一次跑活动列表时覆盖率是 54.6%：核对关卡太严也是一种失败。</Li></ul></div>
        <div><p className="text-sm font-bold uppercase tracking-wider text-[#8a8296]">数字之外</p>
          <ul className="mt-2"><Li>Columbia 的记录没有进入活动列表测试。</Li><Li>外出读的是核对过的底座；Managed Agent 的实时浏览还没有接上。</Li><Li>学习这一侧只在一个模拟学生上测过。第一天：6 个封存的预测对了 2 个。</Li><Li>生成的三张脸都被否掉了；现在的脸是手绘的。</Li></ul></div>
      </div>) },

    { id: "今天和以后", body: (
      <div className="grid h-full grid-cols-[1.3fr_1fr] items-center gap-10">
        <div><Eyebrow>一天之内我们走到了哪，照实说</Eyebrow><H>哪些能用，哪些测过，哪里还粗糙。</H>
          <table className="mt-5 w-full"><tbody>
            <tr><Cell head w="50%">今天能用</Cell><Cell head>还没有</Cell></tr>
            <tr><Cell>共享底座由 Gemini 设计，已填充、已核对，并在没见过的页面上对照基线测量过</Cell><Cell>机构结构和机会这两部分几乎是空的</Cell></tr>
            <tr><Cell>听多种语言，看海报，外出，带回三样东西，留下或跳过，封存的预测，可以撤销的日记</Cell><Cell>Managed Agent 的实时浏览；外出读的是核对过的底座</Cell></tr>
            <tr><Cell>用它自己的 Gem Star 主动做事；十四个受治理的方法；一个能整天整天运行的管理模式</Cell><Cell>Gemi 对 Gemi 只和 Carbon 编出来的模拟学生跑过；社团的智能体还没有做</Cell></tr>
            <tr><Cell>一个把自身状态显示出来的 3D 房间；一个带关节的角色，有 29 个动作和 12 种表情</Cell><Cell><b>角色还很粗糙。</b>生成的三张脸都失败了；脸暂时是手绘的</Cell></tr>
          </tbody></table>
          <p className="mt-4 text-lg"><b>接下来：</b>衣柜和从一段语音里诞生，伙伴和纪念品，靠现实世界里的结果换来的空间，有自己智能体的社团，第三个校园。</p></div>
        <div className="h-[70vh]"><Live src="/gen3d/doll.html?embed=1&cam=front&looks=pip,mochi&show=walk,sitDown,wave,think,reachShelf,stretch" /></div>
      </div>) },

    { id: "Gemini", body: (
      <div className="h-full"><Eyebrow>每个 Gemini 模型做了什么</Eyebrow><H>七个模型，各做一件事。</H>
        <table className="mt-5 w-full"><tbody>
          <tr><Cell head w="20%">模型</Cell><Cell head w="46%">它的工作</Cell><Cell head>我们看到的</Cell></tr>
          <tr><Cell><b>Gemini 4 Carbon</b></Cell><Cell>用高强度思考设计底座、学习图和 Gemi 的成长。规划每天的 Gem Star，按缺口规则挑选要带回来的东西。</Cell><Cell>把我们的九条轴减到七条，每条都配了一个可以观察到的对比。还自己指出了哪些地方不贴合。</Cell></tr>
          <tr><Cell><b>Gemini 4 Hydrogen</b></Cell><Cell>听任何语言的语音，读海报，填实体，标注需求，写日记，扮演模拟学生。</Cell><Cell>一段夹着英文词的中文语音，逐字还原了出来，每个需求都对应到原话。</Cell></tr>
          <tr><Cell><b>Decisions API</b></Cell><Cell>核对关卡。每个字段对照来源回答一个是或否；判断两条记录是不是同一个；学生给它看的东西也走同样的核对。</Cell><Cell>以 0.86 认出一张海报是底座里已有的活动。拦下了一个猜出来的年份。</Cell></tr>
          <tr><Cell><b>Gemini 4 Argon</b></Cell><Cell>单次调用的基线，我们拿它来对比。</Cell><Cell>编了一个结束时间；把 2026 年的活动写成 2025 年。</Cell></tr>
          <tr><Cell><b>Gemini 4 Neon</b></Cell><Cell>编写 3D：房间、家具、身体、衣服、头发、29 段动作的动作库、36 个小生物、地图和图标。我们把它自己的渲染图给它看，让它改。</Cell><Cell>结构和动作做得好。脸需要人的眼睛来把关。</Cell></tr>
          <tr><Cell><b>Lyria</b></Cell><Cell>背景音乐，每首 30 秒。</Cell><Cell>六首，每首大约 15 秒生成。</Cell></tr>
          <tr><Cell><b>Managed Agent</b></Cell><Cell>计划用来实时外出访问公开网页。</Cell><Cell>今天没有接上。</Cell></tr>
        </tbody></table>
      </div>) },

    { id: "对 Gemini 的意义", body: (
      <div className="grid h-full grid-cols-[1.2fr_1fr] items-center gap-10">
        <div><Eyebrow>这件事为 Gemini 探索了什么</Eyebrow><H>模型之间互相设计、核对、纠正，而且有预算。</H>
          <ul className="mt-5"><Li><b>模型设计自己的地基。</b>Carbon 写了本体；另一位设计者并行写了一份；合并时记下了每一处分歧。</Li>
            <Li><b>一个模型的说法，是另一个模型的问题。</b>Hydrogen 写的任何东西，没有 Decisions 高于 0.8 的回答，就到不了学生面前。</Li>
            <Li><b>一个看得到自己作品的模型。</b>Neon 看不出自己做的脸不对，直到把渲染图给它看。</Li>
            <Li><b>把预算当作设计材料。</b>token 稀缺，智能体就得做选择，而它换来的东西成为公共财产。</Li>
            <Li><b>规则写在代码里的自主。</b>想、做、造：方法要登记，先扣费，分阶段，有总开关。</Li></ul></div>
        <Frame className="h-[62vh] p-6"><p className="text-sm font-bold uppercase tracking-wider text-[#8a8296]">五个西格玛，在这个产品里</p>
          <p className="mt-4 text-3xl font-bold leading-tight">一条事实只有能在它的来源上指出来，才会到学生面前。</p>
          <p className="mt-5 text-lg leading-relaxed text-[#4a4356]">我们还没有做到五个西格玛。我们做出来的，是让错误率可以测量、并且把它压下去的东西：每个字段一道核对关卡，一条基线，一套考题集，一份失败记录。</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-center"><div className="rounded-2xl border-2 bg-white py-3" style={{ borderColor: INK }}><div className="text-3xl font-bold">0 / 76</div><div className="text-xs text-[#8a8296]">展示了无依据的字段，没见过的页面</div></div>
            <div className="rounded-2xl border-2 bg-white py-3" style={{ borderColor: INK }}><div className="text-3xl font-bold">29 / 103</div><div className="text-xs text-[#8a8296]">同样的页面，单次模型调用</div></div></div></Frame>
      </div>) },

    { id: "理论", body: (
      <div className="h-full"><Eyebrow>它立在什么之上</Eyebrow><H>每个设计选择都有出处，也有我们说明的局限。</H>
        <table className="mt-5 w-full"><tbody>
          <tr><Cell head w="26%">选择</Cell><Cell head w="40%">为什么</Cell><Cell head>出处</Cell></tr>
          <tr><Cell><b>是一个循环，不是一份档案</b></Cell><Cell>会存储、反思和计划的智能体，行为让人觉得可信；推理和行动交替进行，留下的轨迹读得懂。</Cell><Cell>Park et al. 2023 · Yao et al. 2023</Cell></tr>
          <tr><Cell><b>每个看法都是你可以纠正的猜测</b></Cell><Cell>模型的社会推理，情况稍微一变就会出错。</Cell><Cell>Ullman 2023 · Shapira et al. 2024 · Strachan et al. 2024</Cell></tr>
          <tr><Cell><b>每个字段都显示把握有多大</b></Cell><Cell>目标是校准过的信任；逐条给出把握程度，能帮人校准。</Cell><Cell>Lee & See 2004 · Zhang, Liao & Bellamy 2020</Cell></tr>
          <tr><Cell><b>什么都能撤销</b></Cell><Cell>纠正和忽略都应该很容易。</Cell><Cell>Amershi et al. 2019</Cell></tr>
          <tr><Cell><b>短时间到访，不搞连续打卡</b></Cell><Cell>在一项四周的试验里，聊天机器人用得越多，孤独感和依赖越强。这是一篇预印本；修订版里效应较弱。</Cell><Cell>Fang et al. 2025</Cell></tr>
          <tr><Cell><b>只做登记过的动作</b></Cell><Cell>只在场景允许的动作里选，能减少做不到的动作。</Cell><Cell>Ahn et al. 2022 · Gibson 1979</Cell></tr>
          <tr><Cell><b>先有真实的机会</b></Cell><Cell>关于归属感的话，只在存在真实机会的地方才起作用。</Cell><Cell>Walton et al. 2023</Cell></tr>
        </tbody></table>
        <p className="mt-4 text-[15px] text-[#8a8296]">我们不声称：它理解人的心智；七条轴在真实学生身上验证过；缺口规则和封存的预测来自文献。这些是我们自己的设计，今天在 202 个页面和一个模拟学生上测过。</p>
      </div>) },

    { id: "试一试", body: (
      <div className="grid h-full grid-cols-[1fr_1.2fr] items-center gap-10">
        <div><Eyebrow>试一试</Eyebrow><H>带上你自己的输入。</H>
          <ul className="mt-5"><Li>用任何语言，说二十秒关于你自己的话。</Li><Li>给它看这个会场里的一张海报。</Li><Li>让它出门。打开任意一张卡片，看核对记录。</Li><Li>留下一个，跳过一个。打开日记。</Li></ul>
          <div className="mt-8 flex flex-wrap gap-3 text-lg font-bold">{[["/room", "房间"], ["/foundry", "Foundry：底座"], ["/admin", "Admin：按天运行"], ["/gen3d/doll.html?cam=front", "角色"]].map(([h, l]) => (
            <a key={h} href={h} className="rounded-full border-[3px] bg-[#ffe08a] px-5 py-2" style={{ borderColor: INK, boxShadow: `0 4px 0 ${INK}` }}>{l}</a>))}</div>
          <p className="mt-8 text-sm text-[#8a8296]">所有代码都是 2026-11-21 当天在 AI 编程助手的帮助下写的。概念来自我们之前做的校园分身和带不确定度的画像。github.com/haodaz/gemiverse</p></div>
        <div className="h-[78vh]"><Live src="/gen3d/viewer.html?embed=1&bare=1&school=columbia" /></div>
      </div>) },
  ];

  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (["ArrowRight", "PageDown", " "].includes(e.key)) setI((x) => Math.min(slides.length - 1, x + 1)); if (["ArrowLeft", "PageUp"].includes(e.key)) setI((x) => Math.max(0, x - 1)); };
    addEventListener("keydown", on); return () => removeEventListener("keydown", on);
  }, [slides.length]);

  return (
    <main className="relative h-screen overflow-hidden bg-[#f6f2ee] text-[#2b2536]">
      <div className="h-full px-16 pb-20 pt-12">{slides[i].body}</div>
      <nav className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-2">
        <button onClick={() => setI(Math.max(0, i - 1))} aria-label="上一页" className="mr-3 h-10 w-10 rounded-full border-[3px] bg-[#fffaf0] text-lg font-bold" style={{ borderColor: INK, boxShadow: `0 3px 0 ${INK}` }}>‹</button>
        {slides.map((s, k) => <button key={s.id} onClick={() => setI(k)} title={s.id} aria-label={`第 ${k + 1} 页：${s.id}`} className="h-3 rounded-full border-2 transition-all" style={{ borderColor: INK, width: k === i ? 34 : 12, background: k === i ? "#7c4dce" : "#fffaf0" }} />)}
        <button onClick={() => setI(Math.min(slides.length - 1, i + 1))} aria-label="下一页" className="ml-3 h-10 w-10 rounded-full border-[3px] bg-[#fffaf0] text-lg font-bold" style={{ borderColor: INK, boxShadow: `0 3px 0 ${INK}` }}>›</button>
        <span className="ml-4 text-xs tabular-nums text-[#8a8296]">{sectionOf(i)} · {i + 1} / {slides.length} · {slides[i].id}</span>
        {onLang && <button onClick={onLang} className="ml-4 rounded-full border-[3px] bg-[#fffaf0] px-3 py-1 text-sm font-bold" style={{ borderColor: INK, boxShadow: `0 3px 0 ${INK}` }}>English</button>}
      </nav>
    </main>
  );
}
