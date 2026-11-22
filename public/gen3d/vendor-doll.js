// A ready-made CC0 character (Kenney Mini Characters, KayKit Adventurers) wearing the same interface as our own doll,
// so the room can try one as the Gemi: viewer.html?body=kenney/character-female-e. Local trial only.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const Q = new URLSearchParams(location.search), HIDE = new RegExp("sword|knife|dagger|axe|shield|crossbow|staff|spellbook|wand|mug|arrow|quiver|2h_|1h_|throwable" + (Q.has("cape") ? "" : "|cape") + (Q.has("hat") ? "" : "|_hat"), "i");   // tools of the fantasy trade stay in the box; ?cape and ?hat bring those back
const CLIPS = {   // what the room asks for -> clip names to look for, in order (KayKit names first, then Kenney's)
  idle: ["idle"], walk: ["walking_a", "walk"], sitDown: ["sit_floor_idle", "sit"], writeAtDesk: ["sit_chair_idle", "sit"],
  wave: ["cheer", "emote-yes"], think: ["idle"], stretch: ["cheer", "emote-yes"], reachShelf: ["interact", "use_item", "pick-up"], sleep: ["lie_idle", "sit"],
};
// Since 21 Nov evening the ready-made body is the default in the local edition; ?body=doll brings our own jointed doll back.
const CAST = { mochi: "kaykit/Mage", pip: "kaykit/Rogue", kai: "kaykit/Rogue_Hooded", wide: "kaykit/Rogue" };
export const bodyFor = (name) => { const b = Q.get("body"); return b === "doll" ? null : b ?? CAST[name] ?? "kaykit/Mage"; };
export async function buildVendorDoll(THREE, name, err) {
  try {
    const g = await new GLTFLoader().loadAsync(`/vendor/${name}.glb`), o = g.scene, root = new THREE.Group();
        o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; if (HIDE.test(m.name + (m.parent?.name ?? ""))) m.visible = false; } });
    // Height is measured on what is left showing, so a hidden staff or hat does not shrink the body.
    o.updateMatrixWorld(true); const b = new THREE.Box3(); o.traverse((m) => { if (m.isMesh && m.visible) b.union(new THREE.Box3().setFromObject(m)); });
    const h = b.max.y - b.min.y, s = (+Q.get("tall") || 0.98) / h; o.scale.setScalar(s); o.position.y = -b.min.y * s; root.add(o);
    const mixer = new THREE.AnimationMixer(o), by = (keys) => { for (const k of keys) { const c = g.animations.find((a) => a.name.toLowerCase() === k) ?? g.animations.find((a) => a.name.toLowerCase().startsWith(k)); if (c) return c; } return g.animations[0]; };
    let now = null;
    const play = (clip) => { const c = by(CLIPS[clip] ?? [clip.toLowerCase(), "idle"]); if (!c) return; const a = mixer.clipAction(c); if (a === now) return; a.reset().fadeIn(0.25).play(); now?.fadeOut(0.25); now = a; };
    play("idle");
    let headY = 0.72; o.updateMatrixWorld(true); o.traverse((m) => { if (m.isMesh && m.visible && /head/i.test(m.name)) headY = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).y; });
    return { root, vendor: true, headY, seatLift: +Q.get("seat") || 0.14, play, express() {}, walkSpeed: () => 0.55, update: (t, dt) => mixer.update(dt) };
  } catch (e) { err?.("vendor doll: " + e.message); return null; }
}
