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
