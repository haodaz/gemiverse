// Helpers handed to generated models, so they never touch the page themselves.
export function makeKit(THREE) {
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const smooth = (t) => t * t * (3 - 2 * t);
  return {
    canvasTexture(width, height, draw) {
      const c = document.createElement("canvas"); c.width = width; c.height = height;
      draw(c.getContext("2d"), width, height);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    },
    noise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    },
  };
}
