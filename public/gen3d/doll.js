// Puts the four Neon-written doll modules together: body (skeleton and skin), face (painted), hair (strands), clothes (garments on the joints).
// The motion module is optional: if it is present the doll uses it, otherwise it only breathes.
export const LOOKS = {
  mochi: { skin: "#f3d3bd", bodyWidth: 1, bodyHeight: 1, eye: "#4a2f24", eyeShape: "almond", brow: "soft", browColor: "#2a2022", lip: "#d98a8a", blush: true, freckles: false, lashes: true,
    hairStyle: "bob", hairColor: "#2a2226", highlight: "#6a5a60", fringe: "full", top: "cardigan", topColor: "#b8a2e3", bottom: "pleatedSkirt", bottomColor: "#3d3648", shoes: "maryJanes", shoeColor: "#2b2230", socks: "knee", sockColor: "#ffffff", accent: "#f2a7b8" },
  pip: { skin: "#a86f4c", bodyWidth: 1.05, bodyHeight: 1.04, eye: "#2f1d14", eyeShape: "round", brow: "straight", browColor: "#1d1512", lip: "#9a5a4a", blush: true, freckles: true, lashes: false,
    hairStyle: "curlyMedium", hairColor: "#2a1d18", highlight: "#5a4034", fringe: "none", top: "hoodie", topColor: "#8fc1e8", bottom: "jeans", bottomColor: "#4a5f8a", shoes: "sneakers", shoeColor: "#f6c453", socks: "ankle", sockColor: "#ffffff", accent: "#f6c453" },
  kai: { skin: "#eac7a8", bodyWidth: 1.08, bodyHeight: 1.05, eye: "#3b2a22", eyeShape: "almond", brow: "straight", browColor: "#1f1a1c", lip: "#c98a80", blush: false, freckles: false, lashes: false,
    hairStyle: "shortLayered", hairColor: "#1f1a1c", highlight: "#4a4046", fringe: "sideSwept", top: "hoodie", topColor: "#5b7bb5", bottom: "trousers", bottomColor: "#3d3f4a", shoes: "sneakers", shoeColor: "#ffffff", socks: "ankle", sockColor: "#ffffff", accent: "#f6c453" },
  leo: { skin: "#8d5a3c", bodyWidth: 1.15, bodyHeight: 1.08, eye: "#2f1d14", eyeShape: "round", brow: "arched", browColor: "#1d1512", lip: "#8a5548", blush: false, freckles: false, lashes: false,
    hairStyle: "buzz", hairColor: "#1d1512", highlight: "#3a2a22", fringe: "none", top: "blazer", topColor: "#4a5568", bottom: "jeans", bottomColor: "#34425e", shoes: "boots", shoeColor: "#5a3d2a", socks: "none", sockColor: "#ffffff", accent: "#7fb48a" },
  wide: { skin: "#e8b796", bodyWidth: 1.28, bodyHeight: 0.94, eye: "#3a6b4a", eyeShape: "droopy", brow: "arched", browColor: "#6b4a2f", lip: "#c97a7a", blush: true, freckles: true, lashes: true,
    hairStyle: "bob", hairColor: "#8a5a34", highlight: "#c08a55", fringe: "sideSwept", top: "sweater", topColor: "#7fb48a", bottom: "trousers", bottomColor: "#d9c08a", shoes: "boots", shoeColor: "#6b4a2f", socks: "none", sockColor: "#ffffff", accent: "#e98b6d" },
};

import { applyFace } from "./face-paint.js";

export async function buildDoll(THREE, look, kit, report = console.warn) {
  globalThis.THREE ??= THREE;   // some generated helpers read THREE from the page although the brief said not to
  const load = async (n) => { try { return await import(`./doll-${n}.js`); } catch (e) { report(`doll-${n}: ${e.message}`); return null; } };
  // newer versions of a module win when they exist (face2 over face, hair2 over hair)
  const first = async (...names) => { for (const n of names) { try { return await import(`./doll-${n}.js`); } catch {} } report(`doll-${names.at(-1)}: not available`); return null; };
  const [body, face, hair, tops, bottoms, shoes, motion] = await Promise.all([load("body"), first("face2", "face"), first("hair4", "hair3", "hair2", "hair"), first("tops"), first("bottoms"), first("shoes"), first("motion")]);
  let headMod = null; for (const n of ["doll-head4", "doll-head"]) { try { headMod = await import(`./${n}.js`); break; } catch {} }   // third version: head and face as one module, made after Neon was shown a render
  if (!body) return null;
  let root; try { root = body.buildBody(THREE, look, kit); } catch (e) { report("body: " + e.message); return null; }
  const head = root.getObjectByName("head");
  if (head) head.position.y -= 0.012;   // a shorter neck (Elodie): the head sits lower on the shoulders
  // Hand corrections after Elodie's review: hands were sculpted too small, and the head carried a dark painted gradient.
  for (const n of ["handL", "handR"]) root.getObjectByName(n)?.scale.multiplyScalar(1.7);
  head?.traverse((o) => { if (o.isMesh && o.material && o.userData.slot === "skin") { o.material = o.material.clone(); o.material.map = null; o.material.color = new THREE.Color(look.skin); o.material.needsUpdate = true; } });
  let faceGroup = null, hairGroup = null, painted = null;
  if (headMod && head) try { for (const c of [...head.children]) c.visible = false; faceGroup = headMod.buildHead(THREE, look, kit); head.add(faceGroup); painted = applyFace(THREE, kit, faceGroup, look); } catch (e) { report("head: " + e.message); headMod = null; for (const c of head.children) c.visible = true; }
  if (!headMod && face && head) try { faceGroup = face.buildFace(THREE, look, kit); head.add(faceGroup); } catch (e) { report("face: " + e.message); }
  if (hair && head) try { hairGroup = hair.buildHair(THREE, look, kit); head.add(hairGroup); } catch (e) { report("hair: " + e.message); }
  for (const [mod, fn] of [[tops, "wearTop"], [bottoms, "wearBottom"], [shoes, "wearShoes"]]) if (mod?.[fn]) try { mod[fn](THREE, root, look, kit); } catch (e) { report(`${fn}: ${e.message}`); }
  // A ball joint under a sleeve, trouser leg, sock or boot is cloth-coloured and slightly larger, so no skin ball shows through.
  const long = !["shorts", "pleatedSkirt"].includes(look.bottom), sleeves = look.top !== "tee";
  const cover = [[["legL", "legR"], long || look.bottom === "pleatedSkirt" ? look.bottomColor : null], [["shinL", "shinR"], long ? look.bottomColor : look.socks === "knee" ? null : null],
    [["armL", "armR", "forearmL", "forearmR"], sleeves ? look.topColor : null], [["footL", "footR"], look.shoes === "boots" ? look.shoeColor : look.socks !== "none" ? look.sockColor : null]];
  for (const [names, colour] of cover) if (colour) for (const n of names) for (const child of root.getObjectByName(n)?.children ?? [])
    if (child.isMesh && child.userData.dollBody !== false && /Sphere/.test(child.geometry?.type ?? "") && child.position.length() < 0.02) {
      child.material = new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.9, sheen: 0.4 }); child.scale.multiplyScalar(1.22); }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // The "dark lower face" in every earlier version was the hair's shadow falling on the face. A face must not be shadowed by its own fringe.
  faceGroup?.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  if (new URLSearchParams(globalThis.location?.search ?? "").has("nohairshadow")) hairGroup?.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  if (new URLSearchParams(globalThis.location?.search ?? "").has("nohair")) { if (hairGroup) hairGroup.visible = false; }
  let animator = null; if (motion?.createAnimator) try { animator = motion.createAnimator(root); animator.play("idle"); } catch (e) { report("motion: " + e.message); }
  return {
    root, look,
    play: (clip, opts) => { try { animator?.play(clip, opts); } catch (e) { report(`clip ${clip}: ${e.message}`); } },
    express: (name) => { try { painted ? painted.express(name) : (headMod ?? face)?.setExpression?.(faceGroup, name); } catch {} },
    walkSpeed: (clip) => motion?.walkSpeed?.(clip) ?? 0.5,
    update(t, dt) {
      if (animator) animator.update(dt); else if (body.pose) body.pose(root, "stand", t);
      if (painted) painted.blink(t); else if (faceGroup) (headMod ?? face)?.blink?.(faceGroup, t);
      if (hairGroup && hair?.sway) hair.sway(hairGroup, t, 1);
    },
  };
}
