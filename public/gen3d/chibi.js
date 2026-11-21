// The low-poly chibi: one Neon-written module on the shared skeleton names, animated by the same motion library as the doll.
export const LOOKS = {
  mochi: { skin: "#f3d3bd", bodyWidth: 1, bodyHeight: 1, hairStyle: "long", hairColor: "#2a2226", eye: "#6b4a3a", top: "cardigan", topColor: "#b8a2e3", bottom: "skirt", bottomColor: "#3d3648", shoes: "maryJanes", shoeColor: "#2b2230", socks: "knee", sockColor: "#ffffff", glasses: "round", bag: "none", accent: "#f2a7b8", blush: true },
  kai: { skin: "#eac7a8", bodyWidth: 1.08, bodyHeight: 1.04, hairStyle: "short", hairColor: "#2a2226", eye: "#4a3a2f", top: "hoodie", topColor: "#5b7bb5", bottom: "trousers", bottomColor: "#3d3f4a", shoes: "sneakers", shoeColor: "#ffffff", socks: "ankle", sockColor: "#ffffff", glasses: "none", bag: "backpack", accent: "#f6c453", blush: false },
  pip: { skin: "#a86f4c", bodyWidth: 1.05, bodyHeight: 1.02, hairStyle: "curly", hairColor: "#2a1d18", eye: "#3a2418", top: "blazer", topColor: "#5a5560", bottom: "jeans", bottomColor: "#4a5f8a", shoes: "boots", shoeColor: "#6b4a2f", socks: "none", sockColor: "#ffffff", glasses: "none", bag: "tote", accent: "#8fc1e8", blush: true },
  bob: { skin: "#f1cfb4", bodyWidth: 1, bodyHeight: 1, hairStyle: "bob", hairColor: "#c98b4a", eye: "#7a4a2a", top: "blazer", topColor: "#5a5560", bottom: "trousers", bottomColor: "#4a4650", shoes: "loafers", shoeColor: "#3a3038", socks: "none", sockColor: "#ffffff", glasses: "none", bag: "none", accent: "#8fd0e0", blush: true },
};
export async function buildChibi(THREE, look, kit, report = console.warn) {
  globalThis.THREE ??= THREE;
  let mod, motion = null;
  try { mod = await import("./chibi-lowpoly.js"); } catch (e) { report("chibi-lowpoly: " + e.message); return null; }
  try { motion = await import("./doll-motion.js"); } catch {}
  let root; try { root = mod.buildChibi(THREE, look, kit); } catch (e) { report("chibi: " + e.message); return null; }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const phase = Math.random() * 4;
  let animator = null; if (motion?.createAnimator) try { animator = motion.createAnimator(root); animator.play("idle"); } catch (e) { report("motion: " + e.message); }
  return { root, look,
    play: (clip, opts) => { try { animator?.play(clip, opts); } catch (e) { report(`clip ${clip}: ${e.message}`); } },
    express: (name) => { try { mod.setExpression?.(root, name); } catch {} },
    walkSpeed: (clip) => motion?.walkSpeed?.(clip) ?? 0.5,
    // this module's blink takes how closed the eyes are, 0 to 1
    update(t, dt) { animator?.update(dt); try { mod.blink?.(root, (t + phase) % 4.2 < 0.13 ? 1 : 0); mod.sway?.(root, t); } catch {} } };
}
