// Puts the four Neon-written doll modules together: body (skeleton and skin), face (painted), hair (strands), clothes (garments on the joints).
// The motion module is optional: if it is present the doll uses it, otherwise it only breathes.
export const LOOKS = {
  mochi: { skin: "#f3d3bd", bodyWidth: 1, bodyHeight: 1, eye: "#4a2f24", eyeShape: "almond", brow: "soft", browColor: "#2a2022", lip: "#d98a8a", blush: true, freckles: false, lashes: true,
    hairStyle: "longStraight", hairColor: "#1f1a1c", highlight: "#4a3a3f", fringe: "full", top: "cardigan", topColor: "#b8a2e3", bottom: "pleatedSkirt", bottomColor: "#3d3648", shoes: "maryJanes", shoeColor: "#2b2230", socks: "knee", sockColor: "#ffffff", accent: "#f2a7b8" },
  pip: { skin: "#a86f4c", bodyWidth: 1.05, bodyHeight: 1.04, eye: "#2f1d14", eyeShape: "round", brow: "straight", browColor: "#1d1512", lip: "#9a5a4a", blush: true, freckles: true, lashes: false,
    hairStyle: "curlyMedium", hairColor: "#2a1d18", highlight: "#5a4034", fringe: "none", top: "hoodie", topColor: "#8fc1e8", bottom: "jeans", bottomColor: "#4a5f8a", shoes: "sneakers", shoeColor: "#f6c453", socks: "ankle", sockColor: "#ffffff", accent: "#f6c453" },
  wide: { skin: "#e8b796", bodyWidth: 1.28, bodyHeight: 0.94, eye: "#3a6b4a", eyeShape: "droopy", brow: "arched", browColor: "#6b4a2f", lip: "#c97a7a", blush: true, freckles: true, lashes: true,
    hairStyle: "bob", hairColor: "#8a5a34", highlight: "#c08a55", fringe: "sideSwept", top: "sweater", topColor: "#7fb48a", bottom: "trousers", bottomColor: "#d9c08a", shoes: "boots", shoeColor: "#6b4a2f", socks: "none", sockColor: "#ffffff", accent: "#e98b6d" },
};

export async function buildDoll(THREE, look, kit, report = console.warn) {
  const load = async (n) => { try { return await import(`./doll-${n}.js`); } catch (e) { report(`doll-${n}: ${e.message}`); return null; } };
  // newer versions of a module win when they exist (face2 over face, hair2 over hair)
  const first = async (...names) => { for (const n of names) { try { return await import(`./doll-${n}.js`); } catch {} } report(`doll-${names.at(-1)}: not available`); return null; };
  const [body, face, hair, tops, bottoms, shoes, motion] = await Promise.all([load("body"), first("face2", "face"), first("hair2", "hair"), first("tops"), first("bottoms"), first("shoes"), first("motion")]);
  if (!body) return null;
  let root; try { root = body.buildBody(THREE, look, kit); } catch (e) { report("body: " + e.message); return null; }
  const head = root.getObjectByName("head");
  // Hand corrections after Elodie's review: hands were sculpted too small, and the head carried a dark painted gradient.
  for (const n of ["handL", "handR"]) root.getObjectByName(n)?.scale.multiplyScalar(1.7);
  head?.traverse((o) => { if (o.isMesh && o.material && o.userData.slot === "skin") { o.material = o.material.clone(); o.material.map = null; o.material.color = new THREE.Color(look.skin); o.material.needsUpdate = true; } });
  let faceGroup = null, hairGroup = null;
  if (face && head) try { faceGroup = face.buildFace(THREE, look, kit); head.add(faceGroup); } catch (e) { report("face: " + e.message); }
  if (hair && head) try { hairGroup = hair.buildHair(THREE, look, kit); head.add(hairGroup); } catch (e) { report("hair: " + e.message); }
  for (const [mod, fn] of [[tops, "wearTop"], [bottoms, "wearBottom"], [shoes, "wearShoes"]]) if (mod?.[fn]) try { mod[fn](THREE, root, look, kit); } catch (e) { report(`${fn}: ${e.message}`); }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  let animator = null; if (motion?.createAnimator) try { animator = motion.createAnimator(root); animator.play("idle"); } catch (e) { report("motion: " + e.message); }
  return {
    root, look,
    play: (clip, opts) => { try { animator?.play(clip, opts); } catch (e) { report(`clip ${clip}: ${e.message}`); } },
    express: (name) => { try { face?.setExpression?.(faceGroup, name); } catch {} },
    walkSpeed: (clip) => motion?.walkSpeed?.(clip) ?? 0.5,
    update(t, dt) {
      if (animator) animator.update(dt); else if (body.pose) body.pose(root, "stand", t);
      if (faceGroup && face?.blink) face.blink(faceGroup, t);
      if (hairGroup && hair?.sway) hair.sway(hairGroup, t, 1);
    },
  };
}
