"use client";

import { useEffect, useState } from "react";
import DeckEn from "./DeckEn";
import DeckZh from "./DeckZh";

// Two decks with the same slides: English for judges, Chinese for our own review. ?lang=zh opens the Chinese one.
export default function Page() {
  const [zh, setZh] = useState(false);
  useEffect(() => { setZh(new URLSearchParams(location.search).get("lang") === "zh"); }, []);
  return zh ? <DeckZh onLang={() => setZh(false)} /> : <DeckEn onLang={() => setZh(true)} />;
}
