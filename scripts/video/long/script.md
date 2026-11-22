# Gemiverse 长片脚本（中文版 + English version）

目标时长 9–10 分钟。同一套画面，两条配音（中文、英文各一版），字幕各出一份 `.srt`，不烧进画面。
观众：第一次听说 Gemiverse 的人。主线是科学方法：观察 → 问题 → 假设 → 方法 → 实验 → 结果 → 失败与修正 → 局限 → 下一步。

画面三种，不出现"幻灯片"：
- **人**：真实感的静帧（红衣女生和她的 Gemi：走在校园、指尖碰到、屏幕内外），慢推慢移。
- **产品**：线上站实拍，讲局部时放大到那一块。
- **概念和图表**：不是一页带标题的图，而是那个东西自己在动。星星一颗颗掉进罐子、字段一个个被盖章或变灰、柱子自己长出来。画面上只有必要的数字和两三个词。

每个数字后面的方括号是出处，成片里不念。

---

## 0. 封面（0:00–0:06）
画面：红衣女生走在校园里，Gemi 飘在肩旁。标题 Gemiverse 两行，停 6 秒，不淡入。
- 中：（无旁白，音乐起）
- EN: (no voice, music in)

## 1. 观察（0:06–0:55）
画面：女生的一天，时间条从早到晚被课、作业、打工一格格占满，只剩两小格空着。旁边校园活动的卡片不停往下掉，越堆越高。
- 中：这是一个大学生的一天。上课、作业、打工，一天排下来，真正能自己安排的只有一两个小时。可校园里同一天有几百件事在发生：讲座、社团、展览、招新。她看不完，也不知道哪条是真的。于是她去问 AI。AI 的回答没有尽头，听上去每一条都很确定，可其中一部分是它自己补出来的。
- EN: This is one day of a college student. Classes, homework, a part-time job. What is left to her is an hour or two. On the same day her campus holds hundreds of things: talks, clubs, exhibitions, sign-ups. She cannot read them all, and she cannot tell which details are true. So she asks an AI. The AI never runs out of answers, and every one sounds sure. Some of them it made up.

## 2. 问题（0:55–1:20）
画面：那堆卡片被扫到一边，只留下一张桌子，桌上三张卡。
- 中：我们想问的是一个反过来的问题：如果她的 AI 和她一样，一天只有一点点可以花的东西，而且每说一句话都要拿得出出处，它会不会反而更有用？
- EN: We asked the opposite question. What if her AI were like her: a small amount to spend each day, and a source for every word it says? Would it be more useful that way?

## 3. 三个假设（1:20–2:00）
画面：三样东西依次亮起：一只装着十颗星的罐子；一张被逐格盖章的卡片；一只封着的信封。
- 中：这就是 Gemiverse 要检验的三个假设。第一，预算有限，它才会去选，带回三件核对过的东西，比列出一千条更有用。第二，每个字段都对着原始页面核对一遍，错的会比一次直接问 AI 少。第三，它在你选择之前先把猜测封起来，事后对答案，它才是真的在学你怎么做选择，而不是在给你贴标签。
- EN: These are the three hypotheses Gemiverse tests. One: only under a limit does it choose, and three checked finds are worth more than a list of a thousand. Two: if every field is checked against the page it came from, fewer of them are wrong than when you simply ask an AI once. Three: if it seals a guess before you choose and scores itself afterwards, it is learning how you choose, not putting a label on you.

## 4. 它是什么（2:00–2:50）
画面：产品实拍。开始页的一点光 → 起名 → 说一件事 → 选学校 → 小屋，Gemi 在屋里走动、坐到书桌前。放大书桌上的三张卡。
- 中：先看它长什么样。你第一次来，这里只有一点光。你给它起个名字，告诉它一件关于你的事，选好学校，它就有了一间小屋。它叫 Gemi，是住在你学校里的一个 AI，不是你本人。校园里的事实放在所有 Gemi 共用的底座里；它对你的了解只存在你自己的浏览器里，两边不混。
- EN: First, what it looks like. On your first visit there is only a point of light. You name it, tell it one thing about you, pick your school, and it gets a room. It is called a Gemi: an AI that lives on your campus. It is not you. Campus facts sit in a base that every Gemi shares. What it learns about you stays in your own browser. The two never mix.

## 5. 预算：星星就是真的 token（2:50–4:35）
这一段是全片重点，昨天的一分钟版几乎没讲。

5a. 一颗星是多少（2:50–3:20）
画面：一颗星放大，里面是滚动的 token 计数，停在 1,500。然后十颗星分成两堆落进两只罐子：6 和 4。
- 中：Gemi 每天有十颗星。星星不是积分，是真的算力：一颗星大约等于一千五百个 token，也就是模型读写一千来个字的量。十颗里，六颗是替你花的，四颗是它自己的。
- EN: A Gemi gets ten Gem Stars a day. A star is not a point. It is real compute: one star is about fifteen hundred tokens, roughly a thousand words read or written by the model. Six of the ten are spent for you. Four are its own.
[1 star ≈ 1,500 tokens: lib/server/gemini.ts；6 + 4: app/api/day/route.ts]

5b. 价目表（3:20–3:55）
画面：没有表格。每个动作是屋里的一件事，做的时候星星从罐子飞过去：出门（门，3 颗）、写日记（书桌，1 颗）、计划今天（它停下来想，2 颗）、布置房间（1 颗）、写一首歌（6 颗，罐子不够，星星先攒在一边）。
- 中：每件事都有价钱。出门去一个地方找东西，三颗。计划今天怎么花，两颗。写日记，一颗。动一动自己的房间，一颗。想写一首歌要六颗，一天的钱不够，它得连着几天不花，攒出来。而你开口让它做的事不收星星；查共用的底座也不收。星星只管它自己拿主意做的事。
- EN: Everything has a price. Going out to look for something: three stars. Planning the day: two. Writing its diary: one. Changing something in its room: one. A song costs six, more than one day's allowance, so it has to go without for a few days and save. What you ask it to do costs no stars. Reading the shared base costs none. Stars only pay for what it decides to do on its own.
[lib/kernel/tools.ts：go_out 3, plan_day 2, write_diary 1, decorate_room 1, write_song 6]

5c. 它怎么决定（3:55–4:20）
画面：一天的时间线上，Gemi 在不同情形下做不同的事：桌上有东西没看，它站在桌边等；夜里，它躺下；你很久没来而它对你还没把握，它走向门口；星星花完，它坐在地毯上。每个情形旁边浮出它自己说的那句理由。
- 中：没人吩咐的时候，它按一张规则表过日子，从上往下，第一条对上的就照做。桌上还有你没看的东西，它不再花钱，等你。夜里它睡觉。你有一阵没来，而它对你怎么选还没把握，它就用自己的星星出门。星星花完了，它休息到明天。每一步它都说得出为什么。
- EN: When nobody tells it what to do, it lives by one table of rules, read from the top, first match wins. If finds are waiting on the desk, it stops spending and waits for you. At night it sleeps. If you have been away a while and it is still unsure how you choose, it goes out on its own stars. When the stars are gone, it rests until tomorrow. For every step it can say why.
[lib/kernel/autonomy.ts，12 条规则]

5d. 为什么要这样（4:20–4:35）
画面：左边女生的一天时间条，右边 Gemi 的十颗星，两条并排，一样短。
- 中：为什么要给它这么少？因为有限的预算就是真实一天的投影：人的时间和精力本来就有限。有了上限，才会出现那个真正的问题，今天什么值得做。我们不比谁做得多，只看一颗星换回了什么。
- EN: Why so little? Because a limited budget is the shape of a real day. A person's time and attention are limited too. Only under a limit does the real question appear: what is worth doing today. We never count how much it did. We count what one star bought.
[DESIGN.md "Why the Gemi has a small budget"]

## 6. 方法：每个字段过一道门（4:35–5:35）
画面：一张活动网页滑进来。一张空卡片上，标题、日期、时间、地点、主办方一个个被填上（Hydrogen）。然后每个字段被拉回网页上对应的那句话：对得上的盖章，对不上的变灰消失。最后卡片上只剩盖了章的字段。接着实拍：点"Look again, live"，托管 Agent 自己去把原页面再取一遍。
- 中：再看它怎么保证说的是真的。出门带回一个活动，先由一个模型把网页读成一张卡：标题、日期、时间、地点、主办方。然后每个字段单独回到原页面上问一句：页面上真的这么写了吗？这一步用的是 Decisions API，它不写文章，只给是或否，外加一个把握度。答案和把握度都够高，这个字段才给你看；不够，就宁可空着。页面上没印年份的活动，它不给日期。你还可以让它当场再去看一眼：一个托管 Agent 在 Google 的沙盒里把原页面重新取回来，再核对一次。
- EN: Next, how it keeps what it says true. When it brings back an event, one model first reads the page into a card: title, date, time, place, organiser. Then each field goes back to the page with one question: does the page really say this? That step is the Decisions API. It writes no prose. It answers yes or no, with a confidence. Only if both are high enough do you see the field. Otherwise it is left blank. If a page prints no year, you get no date. You can also send it back on the spot: a Managed Agent fetches the page again inside Google's sandbox, and the fields are checked once more.
[门槛：答案 ≥ 0.8 且把握度 ≥ 0.5，app/api/see、scripts/foundry；Agent 重看一次约 30 秒、19,266 token：base/runs/11-agent-trip.json]

## 7. 实验和结果（5:35–7:15）

7a. 怎么比（5:35–5:55）
画面：两条跑道。上面一条是"问一次 AI"（一个模型一步到位），下面一条是 Gemi（读 → 逐字段核对）。同一批网页从左边送进两条跑道。
- 中：假设要拿数字来验。对照组很简单：同一个网页，直接问一次 Gemini，让它把这几个字段答出来。测试用的网页不是我们挑的，标准答案来自各校日历自己的结构化数据。
- EN: A hypothesis needs numbers. The baseline is simple: the same page, one call to Gemini, asked for the same fields. We did not pick the test pages, and the answer key comes from the calendars' own structured data.

7b. 第一组结果（5:55–6:20）
画面：十张没见过的网页。对照组吐出 103 个字段，其中 29 个变红（页面上找不到依据）；Gemi 吐出 76 个，一个红的也没有，但少了 27 个。
- 中：十张它没见过的活动页。直接问，给出一百零三个字段，其中二十九个在页面上找不到依据，差不多四个里有一个。Gemi 给出七十六个，没有一个找不到依据。代价也摆在这里：它少说了二十七个。它宁可不说。
- EN: Ten event pages it had never seen. One call gave a hundred and three fields. Twenty-nine of them had no support on the page: about one in four. The Gemi gave seventy-six, none without support. The price is on the screen too: it said twenty-seven fewer. It would rather say nothing.
[DESIGN.md §3：76 / 103，0 / 29。说明："0" 是按构造得到的，因为门就是同一种核对；真正的发现是对照组约四分之一无依据]

7c. 输掉的那一次（6:20–6:50）
画面：六所大学的 122 张原始网页，610 个事实。两根柱子长出来：对照 8.7%，我们 9.6%。我们的柱子更高，停住。然后镜头钻进一张网页的源码，高亮一段屏幕上看不见的隐藏文字。
- 中：然后我们输了一次。换成六所大学的一百二十二张原始网页、六百一十个事实，第一轮的错误率，直接问是百分之八点七，我们是百分之九点六，比不做还差。去看错在哪，发现网页里藏着屏幕上看不见的文字，模型把它们也读进去了。
- EN: Then we lost. On a hundred and twenty-two raw pages from six universities, six hundred and ten facts, the first run gave eight point seven percent wrong for one call, and nine point six for us. Worse than doing nothing. We looked at what went wrong: the pages carry text that never shows on screen, and the model was reading that too.
[base/runs/08-eval-pages.run1.json：baseline 8.7%，system 9.6%]

7d. 修正之后（6:50–7:15）
画面：隐藏文字被擦掉，只剩人眼能看到的字。柱子重新长：对照 8.4%，对照 + 我们的读法 4.3%，我们 3.2%。旁边一个小天平：每页 955 token 对 2,334 token。
- 中：改法是只读人眼看得到的字。再测一次：直接问是百分之八点四；我们是百分之三点二，覆盖率百分之九十六。公平起见，把同样的读法也给对照组，它是百分之四点三。所以差距的大头来自读法（从八点四降到四点三），那道门再减掉一截（从四点三到三点二）。它也更贵：每页两千三百多个 token，对照组不到一千。还剩十八个错，其中十二个是"线上还是线下"判断错了，原因还没找到。
- EN: The fix was to read only what a person can see. Measured again: one call, eight point four percent wrong. Ours, three point two, covering ninety-six percent. To be fair we gave the baseline the same reader: four point three. So most of the gap comes from the reading, eight point four down to four point three, and the gate takes it the rest of the way, to three point two. It also costs more: over twenty-three hundred tokens a page, against under a thousand. Eighteen facts are still wrong. Twelve of them are "online or in person", and we have not found the cause.
[lib/proof.json：baseline 8.42%，baseline_visible 4.27%，system_v2 3.24% / 96.4%；token 每页 2,334 对 955；18 个仍错]

## 8. 它怎么学你：论迹，也论心（7:15–8:05）
画面：实拍。三张卡摆上桌之前，一只信封封上（它的猜测）。女生留下一张、跳过两张。信封打开对答案。一根轴上的小点动了一下，周围的光晕缩小一圈。点开那个点，看到是哪几次选择把它挪到这里的，点"撤回"，它回到原位。
- 中：第三个假设是关于学习的。它把东西摆上桌之前，会先把"我猜你会留下哪几件"封起来。你留下、跳过，它再打开对答案，猜错了也写进日记。每一次选择会让一根轴上的位置动一点，周围那圈光晕代表它还有多没把握，证据越多，光晕越小。这些轴说的是你在某种情形下怎么选，两头都没有好坏，不是人格类型。每个位置都能点开，看到是哪几次选择造成的，不同意就撤回。中国人说论迹不论心：它只看你做了什么，不替你下定义。
- EN: The third hypothesis is about learning. Before it puts things on the desk, it seals a guess: which of these will you keep. You keep some and skip some. Then it opens the guess, and if it was wrong, that goes in its diary. Every choice moves a point on an axis a little. The halo around the point is how unsure it still is, and it shrinks as evidence arrives. The axes describe how you choose in a situation. Neither end is better, and none of them is a personality type. Every position opens to the choices behind it, and you can undo any of them. It judges by what you did, not by what it supposes you are.
- 必须说的局限（同一段结尾）：这一半目前只用模拟学生量过，还没有真实学生的数据。 / This half has so far been measured only with simulated students. There is no data from real students yet.

## 9. 换一个脑子（8:05–8:55）
画面：三间一模一样的小屋并排，三只一模一样的罐子。同一个模拟学生。五天快进。每间屋里的 Gemi 过法不一样：出门几次、攒了多少、猜对多少。数字直接长在各自的屋子上。
- 中：小屋、预算、规则都不变的时候，可以只换一样东西：它的脑子。我们让三个不同的 Gemini 模型各当五天 Gemi，面对同一个模拟学生，每天同样十颗星。三个都把出门的次数用满了，五天各十趟。三个都决定攒星星写一首歌：其中两个连着两天不写日记，第四天把歌写了出来；另一个日记照写，到第五天才攒够。花掉的算力不一样：五天下来，最省的用了四万五千个 token，最多的用了六万一千。还有一个不好看的数字：封起来的猜测，三十次里它们分别猜对十三次、十四次和十六次，和抛硬币差不多。也就是说，第三个假设在这次模拟里还没有被证实。每个模型只跑了一次，这不是结论，只是第一眼。但它说明这间小屋可以当一个观察箱：把不同的模型放进同样的日子里，看它们怎么活。下一步，是把别家的模型也放进来。
- EN: With the room, the budget and the rules fixed, one thing can be swapped: the mind. We let three different Gemini models each be the Gemi for five days, facing the same simulated student, with the same ten stars a day. All three used every trip they were allowed: ten in five days. All three decided to save for a song. Two of them skipped their diary for two days and wrote the song on day four. The third kept its diary and only had enough on day five. The compute they used differs: over five days the leanest used forty-five thousand tokens, the heaviest sixty-one thousand. And one number is not pretty. Of thirty sealed guesses, they got thirteen, fourteen and sixteen right. That is a coin toss. So in this simulation the third hypothesis is not confirmed yet. Each mind ran once. This is not a result, only a first look. But it shows the room can be an observation box: put different models into the same days, and watch how each one lives. The next step is to let other makers' models in.
[base/runs/16-minds.json：Hydrogen 14/30、60,627 token；Argon 16/30、45,141；Carbon 13/30、50,312；各 10 趟；歌在第 4、4、5 天]

## 10. 它打开了什么，以及还没做的（8:55–9:40）
画面：一组几秒一个的实拍：学校选择页（中国 / 美国）、北大和 MIT 的手绘地图（点一个地标弹出原文引句）、Gemi 和另一个 Gemi 交换名片（一句话被门拦下）、别的空间。然后一张"还没做"的清单，一行行划出来。
- 中：比赛之后，它从两所学校变成九十所，七十三所有核对过的数据；八十二所有了自己的地图，地图上的每个地标都对过公开资料，图是画的，不是测绘。Gemi 之间可以交换名片，每句话出门前也要过一道门，目前对面还是模拟的。没做完的也摆在这里：十五所学校没有数据；学习那一半还没有真人数据；新角色还不能换衣服。
- EN: Since the hackathon it has grown from two schools to ninety. Seventy-three have checked data. Eighty-two have a map of their own, where every landmark was checked against public text; the picture is drawn, not surveyed. Gemis can exchange name cards, and every sentence passes a gate before it leaves; for now the other side is simulated. What is not done is here too: fifteen schools have no data, the learning half has no data from real people, and the new body cannot change clothes yet.

## 11. 结尾（9:40–9:55）
画面：回到真实感的静帧。女生的手指碰到屏幕里的 Gemi；屏幕内外两个人对看。标题。
- 中：你过你的一天，它过它的一天，你们不断遇见。比赛不是终点。Gemiverse，一起搭一个宇宙。
- EN: You live your day. It lives its own. You keep meeting. The hackathon was not the finish line. Gemiverse: build a universe together.
片尾小字：一个人，一天写成（2026-11-21，Gemini 4 NYC Hackathon）；之后的部分另注日期。数字出处见仓库 README 与 DEVLOG。

---

## 做之前要你定的三件事
1. **你说的"昨天新出的短片"是哪一部？** 给我名字或链接，我看它是怎么从实拍过渡到动画的，再定第 1 段和第 11 段的转场。
2. **配音要花一点你自己的钱，先问你。** 中文用阿里云 qwen-tts（你全局设定的首选），英文用 OpenAI gpt-4o-mini-tts（昨天一分钟版用的就是它）。十分钟两版，估计总共不到 1 美元。两把 key 分别在 zhiji-yida 和 companydata 的 `.env.local` 里，都是你自己的付费 key。
3. **人物用哪一组？** 我默认用昨天生成的红衣女生那组，不用你本人照片做的那几张。
