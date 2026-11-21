// SPACE: how what happens shows up in the room. Each row is one fact from the private log or the Gemi's state and the one thing
// in the room that shows it. If a thing in the room is not on this list, it is furniture the student or the Gemi placed.
export const SPACE: { fact: string; shows_as: string; where: string; built: boolean }[] = [
  { fact: "finds brought back and not yet looked at", shows_as: "paper cards fanned on the desk, one per find", where: "desk", built: true },
  { fact: "finds the student kept", shows_as: "cards pinned to the corkboard", where: "corkboard", built: true },
  { fact: "Gem Stars left for the student today", shows_as: "glowing gold stars in a jar, one per star", where: "desk, right corner", built: true },
  { fact: "Gem Stars left for itself today", shows_as: "glowing lilac stars in a second jar", where: "desk, right corner", built: true },
  { fact: "growth stage", shows_as: "one small trophy per stage reached", where: "top of the bookshelf", built: true },
  { fact: "it is out on campus", shows_as: "the Gemi is not in the room", where: "whole room", built: true },
  { fact: "it is waiting for the student", shows_as: "it stands by the desk and waves", where: "by the desk", built: true },
  { fact: "it spent a star on its room", shows_as: "wall, floor and fabric colours change, or a piece of furniture changes style", where: "whole room", built: true },
  { fact: "the student rearranged the room", shows_as: "furniture stands where it was put; the Gemi walks over, looks, and notes it in its diary", where: "floor grid", built: true },
  { fact: "stars saved over several days", shows_as: "the lilac jar keeps filling past one day's worth", where: "desk, right corner", built: true },
  { fact: "something it saved for and made", shows_as: "a song plays in the room", where: "whole room", built: true },
  { fact: "its current expression", shows_as: "the face: happy with finds, unsure when its guesses were wrong, thinking while planning", where: "the Gemi", built: true },
  { fact: "an event the student actually attended", shows_as: "a keepsake on the shelf", where: "bookshelf", built: false },
  { fact: "a name card exchanged with a club or another Gemi", shows_as: "a card in a holder", where: "desk", built: false },
  { fact: "something the Gemi made for itself", shows_as: "a new object, after the student approves", where: "a free slot", built: false },
  { fact: "a space unlocked at a higher stage", shows_as: "a tab to a second room (loft, reading room, lab)", where: "above the room", built: false },
];

// SPACES: each extra space is for one kind of growth, has its own resources from the shared base, and its own things the Gemi does there.
// A space opens only with Gem Stars the Gemi saved itself. `built` says what works today; the rest is design.
export const SPACES: { id: string; name: string; zh: string; cost: number; for_: string; for_zh: string; need: string; does: [string, string][]; built: boolean }[] = [
  { id: "readingRoom", name: "Reading room", zh: "阅览室", cost: 8, for_: "Going deep on one thing", for_zh: "把一件事读深", need: "explore_a_field",
    does: [["A reading list from library pages it has checked", "从核对过的图书馆页面整理书单"], ["It reads on its own stars and leaves a reading note", "它用自己的星星读，留下一页读书笔记"], ["Writes with you: an outline, then you write", "陪你写：先出提纲，你来写"]], built: false },
  { id: "loft", name: "Skylight loft", zh: "天窗阁楼", cost: 12, for_: "Knowing itself", for_zh: "认识它自己", need: "know_itself",
    does: [["Every diary page, by week", "按周翻看每一页日记"], ["Where its guesses about you were wrong, and what changed", "它猜错你的地方，以及后来改了什么"]], built: false },
  { id: "rooftop", name: "Rooftop", zh: "屋顶", cost: 12, for_: "Meeting others", for_zh: "认识别人", need: "find_my_people",
    does: [["Other Gemis visit; each side keeps its own name card", "别的 Gemi 来做客，名片各存各的"], ["Every message passes the privacy gate first", "每句话先过隐私关卡"]], built: false },
  { id: "lab", name: "Lab", zh: "实验室", cost: 14, for_: "Testing a guess", for_zh: "检验一个猜想", need: "decide_a_direction",
    does: [["Sets up one small real-world try to settle what it is least sure of", "为它最没把握的一条轴，安排一次现实里的小尝试"], ["Shows the result against its sealed guess", "把结果和封存的预测放在一起看"]], built: false },
  { id: "greenhouse", name: "Greenhouse", zh: "温室", cost: 10, for_: "Things that take weeks", for_zh: "要好几周的事", need: "keep_going",
    does: [["If-then plans you made, each as one plant", "你定下的「如果…就…」计划，每个一盆"], ["A plant grows only when the thing was really done", "事情真的做了，那一盆才长"]], built: false },
  { id: "makerLab", name: "Maker lab", zh: "创客间", cost: 14, for_: "Making", for_zh: "动手做", need: "make_and_express",
    does: [["Songs, objects and zines it makes on its own stars", "它用自己的星星做的歌、物件和小册子"], ["You approve before anything enters the room", "进屋之前要你点头"]], built: false },
  { id: "backyard", name: "Backyard", zh: "后院", cost: 10, for_: "Rest and company", for_zh: "休息和陪伴", need: "rest_and_recover",
    does: [["Companions live here; each one stands for a time it guessed you right", "小伙伴住在这里，每一只代表它猜对你的一次"]], built: false },
];
