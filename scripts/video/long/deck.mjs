// The Chinese deck as a PDF (22 Nov): Gemiverse told as an engine. Pictures come from what the film already has: the drawn
// scenes of public/film/long.html (one frame each), the story pictures, and frames of the 3D product and of the public AI ME page.
// node scripts/video/long/deck.mjs   ->  /Users/aisandbox/Documents/gem4/Gemiverse-引擎-中文版.pdf
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const puppeteer = createRequire("/Users/aisandbox/Documents/vsbp/package.json")("puppeteer");
const B = new URL(".", import.meta.url).pathname, FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", W = `${B}deck/`; fs.mkdirSync(W, { recursive: true });
const A = (scene, p = 0.99) => ({ anim: scene, p }), I = (name) => ({ img: `${B}../../../public/film/art/${name}.jpg` }), C = (clip, at = 3) => ({ clip, at }), R = (path) => ({ img: path });
const S = [
  { kind: "cover", vis: [A("cover", 0.5)] },
  { k: "一句话", t: "Gemiverse 不是一个产品，是一个引擎", lines: ["把一个 AI 投射进一个它能改变的空间、一个它能感受的世界。", "第一个样子：大学校园里的 Gemi（本文的例子）。", "已有的应用：平方校园的 AI ME。", "空间、生长、预算、底座四个部件，可以换场景，也可以换模型。"], vis: [A("engine")] },
  { k: "起点", t: "人的一天有限，AI 的回答没有尽头", lines: ["一个学生真正能自己安排的，一天只有一两个小时。", "同一天，校园里有几百件事在发生，她看不完。", "AI 每一句都听上去很确定，其中一部分是它自己补出来的。"], vis: [I("o2"), I("o3"), I("o4")] },
  { k: "问题", t: "反过来试一次：三个要用数字检验的假设", lines: ["如果 AI 和人一样，一天只有一点点可以花，而且每句话都拿得出出处？", "一、有限才会选：三件核对过的，比一千条更有用。", "二、逐字段对着原页核对，错的会比直接问一次少。", "三、先封存猜测再对答案，才是在学你怎么选，而不是贴标签。"], vis: [A("s3")] },
  { k: "引擎 · 总览", t: "四个部件", lines: ["空间：AI 能理解、能改变的地方。", "生长：AI 不是一次造好的，随证据一点点长出来。", "预算：思维是被有限的资源和规划启发出来的。", "底座：可信来自平方智能的数据与知识基础设施，而不是无限地上网探索。"], vis: [A("engine")] },
  { k: "引擎 · 空间", t: "论迹：要有行为，先要有它能改变的空间", lines: ["小屋、书桌、罐子、门。", "它做的每件事，都留下看得见、数得清、撤得回的痕迹：带回来的一张卡，花掉的一颗星，挪过的一把椅子。", "它知道屋里每样东西是什么、在哪、谁动过；你挪了椅子，它会走过去看。"], vis: [I("o19"), C("clips3d/d-shelf.mp4")] },
  { k: "引擎 · 空间", t: "论心：要有心智，还要有它能感受的世界", lines: ["你用任何语言说的话；你给它看的一张海报；校园里核对过的页面；你留下什么、跳过什么。", "它据此形成带宽度的判断，并且去猜。", "我们按行为评判它，也让你读得到它的心。两样缺一个，另一个也立不住。"], vis: [I("o20"), A("halo1", 0.66)] },
  { k: "引擎 · 空间", t: "小屋不是装饰，是一块读数盘", lines: ["状态里的一件事实，在屋里只显示成一样东西。", "还没看的 → 桌上摊开的卡；你留下的 → 钉在板上；今天剩下的星 → 罐子里。", "攒了几天的星 → 装得超过一天的罐子；对你的不确定 → 它站在哪、问什么；外出 → 房间空着，门半开。"], vis: [A("readout"), C("clips3d/d-deskview.mp4")] },
  { k: "引擎 · 空间", t: "为什么引擎里是三维的", lines: ["三维空间里，位置、朝向、距离都是明确的参数，AI 更容易理解空间。", "三维的身体，让它更好地规划动作和交互：走到哪，坐在哪，伸手去拿什么。", "这是引擎的做法。落到具体应用，可以按场景的需要和实际的成本来选，用更轻的画面也行。"], vis: [C("clips3d/d-trio.mp4"), C("clips3d/d-spaces.mp4", 6), C("clips3d/d-snow.mp4")] },
  { k: "引擎 · 生长", t: "它是从底下一层层长出来的", lines: ["公开的网页 → 共用的底座 → 核对的门 → 带宽度的心智 → 按规则的行动 → 投影 → 你看到的房间。", "每一层都是下面一层的投影；房间只是最上面那一层。", "AI 也分阶段长大：能用的方法随证据解锁，不是一次给全。"], vis: [A("layers")] },
  { k: "引擎 · 预算", t: "十颗星：星星就是真的 token", lines: ["每天十颗 Gem Star；一颗约 1,500 个 token，也就是模型读写一千来个字。", "六颗替你花，四颗是它自己的。", "它可以选择今天不花，攒几天去做一件更大的事。"], vis: [A("s5a"), I("o7")] },
  { k: "引擎 · 预算", t: "每件事都有价钱；你开口的不收", lines: ["出门找东西 3 颗；计划今天 2 颗；写日记 1 颗；动动房间 1 颗；写一首歌 6 颗（要攒）。", "你开口让它做的事：0。查共用的底座：0。", "星星只管它自己拿主意做的事。"], vis: [A("s5b", 0.62), A("s5b", 0.99)] },
  { k: "引擎 · 预算", t: "没人吩咐时：一张规则表，第一条对上的就照做", lines: ["十二条规则写在代码里，从上往下读。", "桌上有你没看的，它不再花，等你；夜里睡觉；你一阵没来而它还没把握，它用自己的星星出门；花完了，休息到明天。", "每一步，它都说得出为什么。"], vis: [A("s5c", 0.7)] },
  { k: "引擎 · 预算", t: "思维，是被有限的资源和规划启发出来的", lines: ["有限的预算，是真实一天的投影：人的时间和注意力本来就有限。", "有了上限，它才必须规划：今天，什么值得做。", "我们不比谁做得多，只看一颗星换回了什么：去找宝贝，不要堆垃圾。"], vis: [A("s5d")] },
  { k: "引擎 · 心智", t: "它对你的看法，是一个带宽度的数", lines: ["一个位置，加一圈光晕；光晕是它还有多没把握。", "只有一条更新规则：k = u² / (u² + noise)，m ← m + k (x − m)，u ← √((1 − k) u²)。", "七条轴说的是你在某种情形下怎么选，两头没有好坏，不是人格类型。每个位置都能点开、能撤回。"], vis: [A("halo1", 0.66), A("halo2", 0.5)] },
  { k: "引擎 · 心智", t: "说过、选过、做过，分量不同；意外让它更不确定", lines: ["噪声：说过 2.5 · 选过 1.0 · 长期 0.45 · 做过 0.22。越小越重。", "只靠说，光晕永远降不到 0.55 以下。", "选择落在光晕之外，光晕反而变宽。屏幕外面真的去做了的事，分量最重。"], vis: [A("halo3"), A("halo2", 0.95)] },
  { k: "引擎 · 心智", t: "下一步往哪看；猜测先封存", lines: ["gap = 在乎 × 没把握。在 gap 最大的那条轴上，从相反的两头各带回一样东西：不管你留下哪个，它都能学到点什么。", "封存：h = SHA-256(nonce ‖ guess) 在你选择之前发出；之后公开原文，你的浏览器重新计算。", "它早期的猜测经常是错的，它在日记里也这么写。"], vis: [A("gap"), A("seal")] },
  { k: "引擎 · 底座", t: "它为什么可信：不是无限上网，而是落在核对过的底座上", lines: ["底座由平方智能的数据与知识基础设施支撑。", "每条校园事实带着出处，逐字段核对，所有 Gemi 共用。", "共享的是事实，绝不是谁问过它；它对你的了解，只留在你自己的浏览器里。"], vis: [A("trust")] },
  { k: "引擎 · 底座", t: "那道门：每个字段回到原页面问一句", lines: ["先把网页读成一张卡；再对每个字段单独问：页面上真的这么写了吗？", "只回答是或否，外加把握度。答案 ≥ 0.8 且把握 ≥ 0.5 才展示，否则宁可空着。", "页面没印年份，就不给日期。还可以让托管 Agent 当场把原页面重新取回来再核对。"], vis: [A("s6", 0.9)] },
  { k: "检验", t: "十张没见过的页面：直接问，四个字段里有一个没依据", lines: ["对照组：同一个网页，直接问一次 AI。测试页不是我们挑的。", "直接问：103 个字段，29 个在页面上找不到依据。", "过了门：76 个字段，0 个找不到依据；少说了 27 个，它宁可不说。"], vis: [A("s7b")] },
  { k: "检验", t: "我们输过一轮，然后找到了原因", lines: ["六所大学、122 张原始网页、610 个事实：第一轮直接问 8.7%，我们 9.6%，比不做还差。", "原因：网页里藏着屏幕上看不见的字，模型把它们也读进去了。", "改成只读人眼看得到的字：直接问 8.4%；同样读法 4.3%；我们 3.2%，覆盖 96%。更贵：每页 2,334 对 955 个 token。"], vis: [A("s7c", 0.55), A("s7d2", 0.7)] },
  { k: "观察箱", t: "换一个脑子：同样的日子，三个模型怎么活", lines: ["小屋、预算、规则不变，只换模型；同一个模拟学生，各过五天。", "三个都把出门次数用满，都选择攒星星写歌；五天用掉 4.5 万到 6.1 万个 token。", "封存的猜测 30 次里对 13 到 16 次，和抛硬币差不多：在这次模拟里，第三个假设还没有站住。"], vis: [A("s9", 0.8)] },
  { k: "规模", t: "核对一次，大家共用：token 花一次，一直有回报", lines: ["核对一页的成本是直接问一次的 2.4 倍；可一个 Gemi 核对过，所有 Gemi 免费读。", "从第三个读同一页的学生开始，核对过的事实就比没核对的便宜。", "另一头成本封顶：每个学生每天十颗星，一万五千个 token，事先知道。"], vis: [A("payback"), A("ceil")] },
  { k: "规模", t: "今天：90 所学校可以给 Gemi 选一个家", lines: ["73 所已有核对过的校园信息；82 所有自己的地图，地图上每个地标都对过公开资料。", "共用底座里有 1,109 条核对过的校园实体。", "Gemi 之间交换名片，每句话出门前过一道隐私的门；做决定的，始终是人。"], vis: [C("clips-zh/pick.mp4", 1.5), C("clips-zh/map.mp4", 5.5), I("o15")] },
  { k: "为什么是我们", t: "思路走在前面；最不可替代的，是引擎里的油", lines: ["大公司的方向是无限算力：更大的模型、更多的 token、无限地上网探索。", "这个引擎走的是另一条路：有限的资源、一个空间、一份规划，让思维被启发出来。这不是大公司会优先思考的方向。", "但引擎的思路可以被学走。学不走的是油：平方智能的数据与知识基础设施，每条事实带着出处、逐字段核对、所有 AI 共用。"], vis: [A("moat")] },
  { k: "应用", t: "引擎之上：校园里的 Gemi，和平方校园的 AI ME", lines: ["同一套方法：一个 AI，一间小屋，一座真实的校园。", "校园 Gemi 用三维空间和三维身体；AI ME 按自己的场景和成本，选了更轻的画面。", "Gemiverse 是引擎；AI ME 是它的一个应用。"], vis: [C("clips3d/d-desk.mp4"), R(`${W}aime.jpg`)] },
  { k: "计划", t: "谁来付钱：三条路（待定）", lines: ["学生：想让 Gemi 每天多几颗星。", "社团和学校：想被 Gemi 找到，或者有自己的 AI。", "模型公司：把自己的模型放进这间小屋，看它怎么生活。"], vis: [A("pay")] },
  { k: "边界", t: "我们不声称什么", lines: ["不声称它理解人的心智；七条轴还没有在真实学生身上验证过。", "学习那一半和换脑实验，用的是模拟学生。", "更新规则、gap 规则和封存的预测是我们自己的设计。数字出处见仓库的 README 与 DEVLOG。"], vis: [I("o14")] },
  { kind: "end", t: "你过你的一天，它过它的一天，你们不断遇见。", vis: [R(`${B}../../../public/art/film/both-red2.jpg`)] },
];
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", defaultViewport: { width: 1920, height: 1080 } });
const page = await browser.newPage(); await page.goto("http://localhost:3000/film/long.html?s=hook&t=0&lang=zh", { waitUntil: "networkidle2" });
execFileSync(FF, ["-loglevel", "error", "-y", "-ss", "10", "-i", `${B}clips3d/aime.mp4`, "-frames:v", "1", `${W}aime.jpg`]);
const data = (f) => `data:image/jpeg;base64,${fs.readFileSync(f).toString("base64")}`; let n = 0;
for (const s of S) for (const v of s.vis) { const f = `${W}v${n++}.jpg`;
  if (v.anim) { await page.evaluate((id, p) => window.seek(id, p * 20, 20, "zh"), v.anim, v.p); await new Promise((r) => setTimeout(r, 350)); await page.screenshot({ path: f, type: "jpeg", quality: 88 }); }
  else if (v.clip) execFileSync(FF, ["-loglevel", "error", "-y", "-ss", String(v.at), "-i", `${B}${v.clip}`, "-frames:v", "1", "-vf", v.clip.includes("d-desk.") || v.clip.includes("d-shelf") || v.clip.includes("d-snow") ? "crop=iw*0.58:ih*0.58:iw*0.21:ih*0.17,scale=1280:-2" : "scale=1280:-2", "-q:v", "3", f]);
  else execFileSync(FF, ["-loglevel", "error", "-y", "-i", v.img, "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", f]);
  v.src = data(f); v.tall = !!v.img && v.img.endsWith("aime.jpg"); }
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const slide = (s, i) => { if (s.kind === "cover") return `<section class="full"><img src="${s.vis[0].src}"></section>`;
  if (s.kind === "end") return `<section class="full"><img src="${s.vis[0].src}"><div class="veil"></div><div class="endt"><div class="logo"><span style="color:#ffd98a">Gemi</span><span style="color:#d9c4ff">verse</span></div><p>${esc(s.t)}</p><p class="small">AI + 空间的投射引擎 · 校园是它的第一个样子</p></div></section>`;
  const many = s.vis.length; return `<section><div class="txt"><div class="k">${esc(s.k)}</div><h1>${esc(s.t)}</h1><ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div><div class="vis n${many}">${s.vis.map((v) => `<img class="${v.tall ? "tall" : ""}" src="${v.src}">`).join("")}</div><div class="pg"><span style="color:#d9891c">Gemi</span><span style="color:#7c4dce">verse</span> 引擎　${i + 1} / ${S.length}</div></section>`; };
const html = `<!doctype html><meta charset="utf-8"><style>@page{size:1920px 1080px;margin:0}*{box-sizing:border-box}body{margin:0;font-family:"PingFang SC","Helvetica Neue",sans-serif;color:#2b2536}
section{width:1920px;height:1080px;position:relative;overflow:hidden;background:#faf8f5;display:flex;page-break-after:always}.full img{width:100%;height:100%;object-fit:cover}
.txt{width:780px;padding:110px 30px 90px 100px;display:flex;flex-direction:column;justify-content:center}.k{font-size:28px;font-weight:700;letter-spacing:4px;color:#7c4dce;margin-bottom:22px}
h1{font-size:60px;line-height:1.22;margin:0 0 40px;font-weight:800;letter-spacing:-1px}ul{margin:0;padding:0;list-style:none}li{font-size:31px;line-height:1.55;margin-bottom:22px;padding-left:30px;position:relative;color:#3d3649}li:before{content:"";position:absolute;left:0;top:19px;width:12px;height:12px;border-radius:6px;background:#ffc233}
.vis{flex:1;padding:70px 80px 80px 20px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:22px}.vis img{max-width:100%;border-radius:22px;border:3px solid #2b2536;box-shadow:0 6px 0 #2b253622;background:#fff}
.n1 img{max-height:900px}.n2 img{max-height:440px}.n3 img{max-height:290px}.vis img.tall{max-height:440px}
.pg{position:absolute;left:100px;bottom:44px;font-size:22px;color:#8a8296;font-weight:600}
.veil{position:absolute;inset:0;background:#1b1524;opacity:.45}.endt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center}.logo{font-size:150px;font-weight:700;letter-spacing:-3px}.endt p{font-size:44px;margin:26px 0 0}.endt .small{font-size:32px;color:#ffd98a}</style>${S.map(slide).join("")}`;
fs.writeFileSync(`${W}deck.html`, html); const p2 = await browser.newPage(); await p2.goto("file://" + W + "deck.html", { waitUntil: "load" }); await new Promise((r) => setTimeout(r, 1500));
const out = "/Users/aisandbox/Documents/gem4/Gemiverse-引擎-中文版.pdf"; await p2.pdf({ path: out, width: "1920px", height: "1080px", printBackground: true });
await p2.setViewport({ width: 1920, height: 1080 }); for (const k of [1, 6, 14, 24]) { await p2.evaluate((k) => document.querySelectorAll("section")[k].scrollIntoView(), k); await p2.screenshot({ path: `${W}check-${k}.jpg`, type: "jpeg", quality: 80 }); }
await browser.close(); console.log("slides", S.length, "->", out, (fs.statSync(out).size / 1e6).toFixed(1) + " MB");
