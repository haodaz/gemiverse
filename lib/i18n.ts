// Interface languages. Facts in the base stay in the language of their source; only the interface and the Gemi's own words change.
export type Lang = "en" | "zh" | "es";
export const LANGS: Record<Lang, string> = { en: "English", zh: "中文", es: "Español" };

const T: Record<string, Record<Lang, string>> = {
  step1: { en: "Step 1 of 3", zh: "第 1 步，共 3 步", es: "Paso 1 de 3" },
  where: { en: "Where does your Gemi live?", zh: "你的 Gemi 住在哪所学校？", es: "¿Dónde vive tu Gemi?" },
  what_is: { en: "A Gemi is an AI version of you that lives on campus. It goes out on a small daily budget, brings back only what it has checked, and learns how you choose.",
    zh: "Gemi 是住在校园里的 AI 版的你。它每天只有一点预算，出门去看，只带回核对过的东西，并且慢慢学会你是怎么做选择的。",
    es: "Un Gemi es una versión de ti hecha con IA que vive en el campus. Sale con un pequeño presupuesto diario, trae solo lo que ha comprobado y aprende cómo eliges." },
  more_soon: { en: "More campuses opening soon.", zh: "更多学校陆续开放。", es: "Pronto abrirán más campus." },
  choose: { en: "Choose a campus", zh: "选一所学校", es: "Elige un campus" },
  move_in: { en: "Move in at", zh: "入住", es: "Mudarse a" },
  how_base: { en: "How the base was designed →", zh: "底座是怎么设计出来的 →", es: "Cómo se diseñó la base →" },
  footer: { en: "Campus facts are shared by every Gemi. What yours learns about you stays in this browser. Illustrations and 3D models were made by Gemini 4 Neon; no university logos are used.",
    zh: "校园的事实所有 Gemi 共用。你的 Gemi 对你的了解只留在这个浏览器里。插画和 3D 模型由 Gemini 4 Neon 制作，没有使用任何校徽。",
    es: "Los datos del campus son compartidos por todos los Gemi. Lo que el tuyo aprende sobre ti se queda en este navegador. Ilustraciones y modelos 3D hechos por Gemini 4 Neon; sin logotipos universitarios." },
  stage: { en: "Stage 1 of 5 · Unpacked", zh: "第 1 阶段，共 5 阶段 · 刚安顿下来", es: "Etapa 1 de 5 · Recién llegado" },
  stars_you: { en: "Gem Stars for you", zh: "为你花的 Gem Star", es: "Gem Stars para ti" },
  stars_self: { en: "Gem Stars for itself", zh: "它自己的 Gem Star", es: "Gem Stars para sí" },
  stars_you_note: { en: "Spent when it goes out or asks other AIs on its own.", zh: "它自己决定出门、去问别的 AI 时花。", es: "Se gastan cuando sale o pregunta por iniciativa propia." },
  stars_self_note: { en: "Thinking, its diary, its room.", zh: "思考、写日记、收拾屋子。", es: "Pensar, su diario, su cuarto." },
  tab_talk: { en: "Today", zh: "今天", es: "Hoy" }, tab_desk: { en: "Desk", zh: "书桌", es: "Escritorio" },
  tab_tools: { en: "What it can do", zh: "它能做什么", es: "Qué puede hacer" }, tab_diary: { en: "Diary", zh: "日记", es: "Diario" },
  tab_outbox: { en: "What left this room", zh: "从这里出去了什么", es: "Qué salió de aquí" },
  right_now: { en: "Right now", zh: "此刻", es: "Ahora mismo" }, gemi_is: { en: "is", zh: "正在", es: "está" },
  arrange: { en: "Arrange room", zh: "摆放家具", es: "Ordenar cuarto" }, colours: { en: "Change colours", zh: "换配色", es: "Cambiar colores" },
  say_something: { en: "Tell it something, or show it a poster…", zh: "跟它说点什么，或者给它看一张海报…", es: "Dile algo o enséñale un cartel…" },
  hold_to_talk: { en: "Talk", zh: "语音输入", es: "Hablar" }, listening: { en: "Listening… tap to send", zh: "在听…再点一下发送", es: "Escuchando… toca para enviar" },
  attach: { en: "Show a photo or file", zh: "给它看图片或文件", es: "Mostrar foto o archivo" }, send: { en: "Send", zh: "发送", es: "Enviar" },
  mic_consent: { en: "The mic is on only while recording. Nothing is kept.", zh: "只在录音时开麦，不保存。", es: "El micro solo está activo al grabar. No se guarda nada." },
  heard: { en: "What it heard", zh: "它听到的", es: "Lo que oyó" }, saw: { en: "What it saw", zh: "它看到的", es: "Lo que vio" },
  checked: { en: "checked", zh: "已核对", es: "comprobado" }, withheld: { en: "not confirmed", zh: "未确认", es: "sin confirmar" },
  empty_today: { en: "Say hello in any language, or show it something.", zh: "用任何语言打个招呼，或者给它看点什么。", es: "Saluda en cualquier idioma o enséñale algo." },
  desk_intro: { en: "The shared campus base for this school. Each field was checked against its source before it got in.", zh: "这所学校的共享底座。每个字段入库前都对照来源核对过。", es: "La base compartida de este campus. Cada dato se comprobó con su fuente antes de entrar." },
  fields_checked: { en: "fields checked", zh: "个字段已核对", es: "datos comprobados" }, of: { en: "of", zh: "/", es: "de" },
  date_unconfirmed: { en: "date not confirmed", zh: "日期未确认", es: "fecha sin confirmar" }, open_source: { en: "Open the source page", zh: "打开来源页面", es: "Abrir la página original" },
  tools_intro: { en: "Gem Stars are its own daily allowance. What you ask for is free; what it decides to do, it pays for.", zh: "Gem Star 是它自己每天的零花钱。你让它做的不花；它自己决定做的，它自己付。", es: "Las Gem Stars son su asignación diaria. Lo que tú pides es gratis; lo que decide hacer, lo paga." },
  diary_empty: { en: "Nothing yet.", zh: "还没有内容。", es: "Nada todavía." },
  outbox_empty: { en: "Nothing has left this room.", zh: "还没有任何东西从这里出去。", es: "Nada ha salido de este cuarto." },
  btn_talk: { en: "Talk", zh: "聊聊", es: "Hablar" }, btn_desk: { en: "Desk", zh: "书桌", es: "Escritorio" }, btn_diary: { en: "Diary", zh: "日记", es: "Diario" },
  btn_wardrobe: { en: "Wardrobe", zh: "衣柜", es: "Armario" }, tab_wardrobe: { en: "Wardrobe", zh: "衣柜", es: "Armario" },
  btn_campus: { en: "Campus", zh: "去校园", es: "Campus" }, btn_arrange: { en: "Arrange", zh: "布置", es: "Ordenar" }, btn_more: { en: "Abilities", zh: "能力", es: "Habilidades" },
  btn_outbox: { en: "Social", zh: "社交", es: "Social" }, close: { en: "Close", zh: "关闭", es: "Cerrar" },
  tap_talk: { en: "Talk to me", zh: "跟我说话", es: "Háblame" }, tap_doing: { en: "What are you doing?", zh: "你在干嘛？", es: "¿Qué haces?" },
  tap_out: { en: "Go to campus", zh: "去校园逛逛", es: "Ir al campus" }, tap_look: { en: "Change my look", zh: "换个样子", es: "Cambiar mi aspecto" },
  for_you: { en: "for you", zh: "为你", es: "para ti" }, for_itself: { en: "for itself", zh: "为自己", es: "para sí" },
  campus_title: { en: "Where should it go?", zh: "让它去哪儿？", es: "¿Adónde debería ir?" },
  campus_note: { en: "Pick a place and it goes now.", zh: "选一个地方，它现在就去。", es: "Elige un lugar y va ahora." },
  b_library: { en: "Library", zh: "图书馆", es: "Biblioteca" }, b_clubs: { en: "Clubs", zh: "社团", es: "Clubes" }, b_commons: { en: "Commons", zh: "交友广场", es: "Plaza" }, b_career: { en: "Opportunities", zh: "发展资源", es: "Oportunidades" },
  b_library_n: { en: "build a skill · explore a field", zh: "练本事 · 探方向", es: "aprender · explorar" }, b_clubs_n: { en: "find my people · make and express", zh: "找同类 · 做东西", es: "mi gente · crear" },
  b_commons_n: { en: "meet people · rest", zh: "认识人 · 歇一歇", es: "conocer gente · descansar" }, b_career_n: { en: "get experience · decide a direction", zh: "攒经历 · 定方向", es: "experiencia · rumbo" },
  thinking: { en: "thinking…", zh: "在想…", es: "pensando…" },
  brought_back: { en: "Brought back", zh: "它带回来的", es: "Lo que trajo" }, keep: { en: "Keep", zh: "留下", es: "Guardar" }, skip: { en: "Skip", zh: "不要", es: "Pasar" },
  kept: { en: "kept", zh: "留下了", es: "guardado" }, skipped: { en: "skipped", zh: "没要", es: "pasado" },
  sealed: { en: "Its guess is sealed", zh: "它的猜测已封存", es: "Su predicción está sellada" },
  reveal: { en: "Its guess, revealed", zh: "揭开它的猜测", es: "Su predicción, revelada" }, guessed: { en: "guessed you would keep it", zh: "猜你会留下", es: "predijo que lo guardarías" },
  right: { en: "right", zh: "猜对", es: "acertó" }, wrong: { en: "wrong", zh: "猜错", es: "falló" },
  whole_base: { en: "Everything in the shared base", zh: "共享底座里的全部", es: "Todo en la base compartida" },
  no_finds: { en: "Nothing here yet.", zh: "还没有东西。", es: "Nada todavía." },
  understanding: { en: "How it thinks you choose", zh: "它认为你是怎么选的", es: "Cómo cree que eliges" },
  understanding_note: { en: "A wide band means it is not sure yet.", zh: "色带越宽，说明它越没把握。", es: "Una banda ancha significa que aún no está seguro." },
  learned: { en: "What it learned, and from which choice", zh: "它学到了什么，来自哪次选择", es: "Qué aprendió y de qué elección" },
  undo: { en: "Undo", zh: "撤回", es: "Deshacer" }, redo: { en: "Put back", zh: "恢复", es: "Restaurar" },
  you_said: { en: "You said", zh: "你说过", es: "Dijiste" }, at_place: { en: "is out at", zh: "去了", es: "está en" },
  out_note: { en: "Looking around…", zh: "正在逛…", es: "Mirando…" },
  send_here: { en: "Send it here", zh: "让它去这里", es: "Enviar aquí" }, sources: { en: "checked fields", zh: "核对过的字段", es: "datos comprobados" },
  its_idea: { en: "its own idea, 3 Gem Stars", zh: "它自己要去的，花了 3 颗 Gem Star", es: "idea suya, 3 Gem Stars" }, your_idea: { en: "you asked", zh: "你让它去的", es: "tú lo pediste" },
  back_room: { en: "Back to the room", zh: "回小屋", es: "Volver al cuarto" },
  added_base: { en: "Added to the shared base: every Gemi can now find it.", zh: "已加入共享底座：所有 Gemi 都能读到它了。", es: "Añadido a la base compartida: todos los Gemi pueden encontrarlo." },
  same_base: { en: "Already in the base, now seen from two sources:", zh: "底座里已经有了，现在有两个来源印证：", es: "Ya está en la base, ahora con dos fuentes:" },
  cost: { en: "cost", zh: "花费", es: "coste" }, you: { en: "You", zh: "你", es: "Tú" },
};
export const t = (key: string, lang: Lang) => T[key]?.[lang] ?? T[key]?.en ?? key;
export const loadLang = (): Lang => { try { const v = localStorage.getItem("gemi.lang"); return v === "zh" || v === "es" ? v : "en"; } catch { return "en"; } };
export const saveLang = (l: Lang) => { try { localStorage.setItem("gemi.lang", l); } catch {} };

// Sentences that are produced as English by the 3D view (what the Gemi is doing) and by the autonomy table (why). They are shown
// through say(), so the interface stays in one language. Anything not listed falls back to English.
const SAY: Record<string, { zh: string; es: string }> = {
  "settling in": { zh: "安顿下来", es: "instalándose" }, "about to head out": { zh: "准备出门", es: "a punto de salir" }, "just being here": { zh: "就这么待着", es: "simplemente aquí" },
  "looking out the window": { zh: "看着窗外", es: "mirando por la ventana" }, "picking a book from the shelf": { zh: "从书架上挑书", es: "eligiendo un libro" }, "stretching": { zh: "伸懒腰", es: "estirándose" },
  "wondering what you'd like": { zh: "琢磨你会喜欢什么", es: "pensando qué te gustaría" }, "writing in the diary": { zh: "写日记", es: "escribiendo en su diario" },
  "writing in its diary, on its own star": { zh: "用自己的一颗星写日记", es: "escribiendo en su diario, con su propia estrella" }, "changed its room, on its own star": { zh: "用自己的一颗星改了改房间", es: "cambió su cuarto, con su propia estrella" },
  "You paused me. I do nothing until you say so.": { zh: "你让我暂停了。你不发话我什么都不做。", es: "Me pausaste. No hago nada hasta que lo digas." }, "I am out looking.": { zh: "我在外面找。", es: "Estoy fuera buscando." },
  "I brought things back. I will not spend more until you have looked.": { zh: "我带了东西回来。你看过之前我不再花星星。", es: "Traje cosas. No gastaré más hasta que las mires." }, "It is night.": { zh: "夜里了。", es: "Es de noche." },
  "You changed my room. I am taking a look.": { zh: "你动了我的房间，我去看看。", es: "Cambiaste mi cuarto. Voy a mirar." },
  "I still do not know enough about how you choose. I am going out, on my own stars.": { zh: "我对你怎么选还不够了解。我用自己的星星出门看看。", es: "Aún no sé bastante sobre cómo eliges. Salgo, con mis propias estrellas." },
  "Today taught me something. I am writing it down.": { zh: "今天学到了点东西，我记下来。", es: "Hoy aprendí algo. Lo estoy anotando." }, "I saved enough. I am making it now.": { zh: "攒够了，我现在就做。", es: "Ahorré suficiente. Lo hago ahora." },
  "I am not spending today. I am saving for something bigger.": { zh: "今天不花，我在攒一件更大的事。", es: "Hoy no gasto. Ahorro para algo más grande." }, "I have a star of my own. I am changing something in my room.": { zh: "我有一颗自己的星，改改房间。", es: "Tengo una estrella mía. Cambio algo en mi cuarto." },
  "I have spent today's stars. I will rest until tomorrow.": { zh: "今天的星星花完了，我休息到明天。", es: "Gasté las estrellas de hoy. Descanso hasta mañana." }, "Nothing needs me right now.": { zh: "眼下没什么要我做的。", es: "Nada me necesita ahora." },
};
const PLACE: Record<string, { zh: string; es: string }> = { library: { zh: "图书馆", es: "la biblioteca" }, clubs: { zh: "社团", es: "los clubes" }, commons: { zh: "交流广场", es: "el comedor" }, opportunities: { zh: "发展资源", es: "oportunidades" } };
export function say(text: string | null | undefined, lang: Lang): string {
  if (!text || lang === "en") return text ?? "";
  if (SAY[text]) return SAY[text][lang];
  let m = text.match(/^waiting for you with (\d+) things?$/); if (m) return lang === "zh" ? `等你来看带回来的 ${m[1]} 样东西` : `esperándote con ${m[1]} cosa${m[1] === "1" ? "" : "s"}`;
  m = text.match(/^out at the (\w+), on its own$/); if (m) return lang === "zh" ? `自己去了${PLACE[m[1]]?.zh ?? m[1]}` : `en ${PLACE[m[1]]?.es ?? m[1]}, por su cuenta`;
  m = text.match(/^noticed you moved the (.+)$/); if (m) return lang === "zh" ? `发现你动了 ${m[1]}` : `notó que moviste: ${m[1]}`;
  return text;
}
