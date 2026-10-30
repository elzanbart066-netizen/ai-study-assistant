// Edits one part of a picture ("dye the hair black") without a key or a server:
// a text-prompted segmentation model (CLIPSeg, Apache-2.0) runs in the browser
// through transformers.js, finds the part, and only those pixels are recoloured.
// The model (about 150 MB) is downloaded once and kept in the browser cache.
import type { RecolorRequest } from "./imageOps.js";

const MODEL_ID = "Xenova/clipseg-rd64-refined";
// Work on at most this many pixels per side; enough for the low-resolution mask.
const MAX_SIDE = 2400;

type Segmenter = (canvas: HTMLCanvasElement, prompt: string) => Promise<LowResMask>;

// What a part is most often confused with. The model scores the part against all
// of these at once, so "hair" no longer spills onto the face or the background.
const RIVALS = ["face", "skin", "background", "clothes", "body"];

/** Turns per-prompt logits into the target's share of each pixel (softmax, target first). */
export function targetShare(logits: Float32Array, prompts: number, size: number): Float32Array {
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    let max = -Infinity;
    for (let k = 0; k < prompts; k++) max = Math.max(max, logits[k * size + i]);
    let sum = 0;
    for (let k = 0; k < prompts; k++) sum += Math.exp(logits[k * size + i] - max);
    out[i] = Math.exp(logits[i] - max) / sum;
  }
  return out;
}

let segmenter: Promise<Segmenter> | null = null;

function loadSegmenter(onProgress?: (fraction: number) => void): Promise<Segmenter> {
  if (!segmenter) {
    segmenter = (async () => {
      const { AutoProcessor, AutoTokenizer, CLIPSegForImageSegmentation, RawImage } = await import("@huggingface/transformers");
      const files = new Map<string, { loaded: number; total: number }>();
      const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== "progress" || !p.file || !p.total) return;
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        onProgress?.(total ? loaded / total : 0);
      };
      const [tokenizer, processor, model] = await Promise.all([
        AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback }),
        AutoProcessor.from_pretrained(MODEL_ID, { progress_callback }),
        CLIPSegForImageSegmentation.from_pretrained(MODEL_ID, { progress_callback }),
      ]);
      return async (canvas, prompt) => {
        const image = RawImage.fromCanvas(canvas);
        const imageInputs = await processor(image);
        const run = async (texts: string[]) => {
          const { logits } = await model({ ...tokenizer(texts, { padding: true, truncation: true }), ...imageInputs });
          return { dims: logits.dims as number[], data: logits.data as Float32Array };
        };
        const prompts = [prompt, ...RIVALS.filter((r) => !prompt.includes(r) && !(prompt === "face" && r === "skin"))];
        // All prompts in one pass; if this build of the model needs one image per prompt, ask one by one.
        let out = await run(prompts).catch(() => null);
        if (!out || (out.dims.length > 2 ? out.dims[0] : 1) !== prompts.length) {
          const parts = [];
          for (const text of prompts) parts.push(await run([text]));
          const size = parts[0].data.length;
          const data = new Float32Array(size * prompts.length);
          parts.forEach((p, k) => data.set(p.data.subarray(0, size), k * size));
          out = { dims: [prompts.length, ...parts[0].dims.slice(-2)], data };
        }
        const height = out.dims[out.dims.length - 2];
        const width = out.dims[out.dims.length - 1];
        return { mask: targetShare(out.data, prompts.length, width * height), width, height };
      };
    })();
    segmenter.catch(() => {
      segmenter = null;
    });
  }
  return segmenter;
}

export class NothingFoundError extends Error {}

/**
 * Recolours the requested part of the image and returns it as a data URL.
 * Throws NothingFoundError when the model cannot find the part.
 */
export async function recolorImage(
  img: HTMLImageElement,
  request: RecolorRequest,
  mime: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const segment = await loadSegmenter(onProgress);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const found = await segment(canvas, request.target);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (!recolorPixels(pixels.data, canvas.width, canvas.height, found, request.color)) throw new NothingFoundError(request.target);
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL(mime, 0.92);
}

/** Bilinear resize of the model's low-resolution mask to the image size. */
export function resizeMask(mask: Float32Array, w: number, h: number, outW: number, outH: number): Float32Array {
  const out = new Float32Array(outW * outH);
  for (let y = 0; y < outH; y++) {
    const fy = Math.min(h - 1, Math.max(0, ((y + 0.5) * h) / outH - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(h - 1, y0 + 1);
    const dy = fy - y0;
    for (let x = 0; x < outW; x++) {
      const fx = Math.min(w - 1, Math.max(0, ((x + 0.5) * w) / outW - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(w - 1, x0 + 1);
      const dx = fx - x0;
      const top = mask[y0 * w + x0] * (1 - dx) + mask[y0 * w + x1] * dx;
      const bottom = mask[y1 * w + x0] * (1 - dx) + mask[y1 * w + x1] * dx;
      out[y * outW + x] = top * (1 - dy) + bottom * dy;
    }
  }
  return out;
}

export interface LowResMask {
  mask: Float32Array;
  width: number;
  height: number;
}

/**
 * Where the part may be: the model's mask (relative to its own peak, because
 * the model is often unsure in the middle of a part), with enclosed holes
 * filled and grown a little, so the whole part is covered, not only the
 * spots the model was sure about. Works on the mask's own small grid.
 */
export function partZone(low: LowResMask): Uint8Array {
  const { mask, width: w, height: h } = low;
  let peak = 0;
  for (const v of mask) peak = Math.max(peak, v);
  const threshold = Math.max(0.12, peak * 0.2);
  const zone = new Uint8Array(w * h);
  for (let i = 0; i < zone.length; i++) zone[i] = mask[i] >= threshold ? 1 : 0;

  // Fill holes: everything outside the zone that the border cannot reach is enclosed by it.
  const outside = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (i: number) => {
    if (!zone[i] && !outside[i]) {
      outside[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  for (let i = 0; i < zone.length; i++) if (!outside[i]) zone[i] = 1;

  // Grow by a few percent of the picture so strands at the edge are included.
  const r = Math.max(2, Math.round(Math.max(w, h) * 0.03));
  return dilate(dilate(zone, w, h, r, 0), w, h, 0, r);
}

/** Box dilation along one axis (dx or dy), linear time with a running count. */
function dilate(src: Uint8Array, w: number, h: number, rx: number, ry: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const horizontal = rx > 0;
  const r = horizontal ? rx : ry;
  const lines = horizontal ? h : w;
  const len = horizontal ? w : h;
  const at = (line: number, k: number) => (horizontal ? line * w + k : k * w + line);
  for (let line = 0; line < lines; line++) {
    let count = 0;
    for (let k = 0; k < Math.min(r, len); k++) count += src[at(line, k)];
    for (let k = 0; k < len; k++) {
      if (k + r < len) count += src[at(line, k + r)];
      if (k - r - 1 >= 0) count -= src[at(line, k - r - 1)];
      out[at(line, k)] = count > 0 ? 1 : 0;
    }
  }
  return out;
}

type Lab = [number, number, number];

/**
 * Recolours RGBA pixels in place, keeping each pixel's light and shade so the
 * texture (strands of hair, folds) survives. The model's mask only says roughly
 * where the part is; the exact pixels are the ones in that area whose colour
 * matches the part's main colours (found by clustering the mask's confident
 * core), so the whole part changes and its neighbours (skin, outlines) do not.
 * Returns false when no pixel is confidently part of the target.
 */
export function recolorPixels(data: Uint8ClampedArray, width: number, height: number, low: LowResMask, hex: string): boolean {
  const n = width * height;
  const prob = resizeMask(low.mask, low.width, low.height, width, height);
  const zoneLow = partZone(low);
  let peak = 0;
  for (const v of low.mask) peak = Math.max(peak, v);
  // Only the most confident core is used to learn the part's colours: a blurry mask spills onto its neighbours.
  const seedThreshold = Math.max(0.4, peak * 0.7);

  // Colours of the confident core, sampled.
  const seeds: number[] = [];
  for (let i = 0; i < n; i++) if (prob[i] >= seedThreshold && data[i * 4 + 3] >= 16) seeds.push(i);
  if (seeds.length < Math.max(16, n * 0.001)) return false;
  const step = Math.max(1, Math.floor(seeds.length / 20000));
  const labs: Lab[] = [];
  const weights: number[] = [];
  for (let k = 0; k < seeds.length; k += step) {
    const p = seeds[k] * 4;
    labs.push(rgbToLab(data[p], data[p + 1], data[p + 2]));
    weights.push(prob[seeds[k]] ** 2);
  }
  const parts = mainColors(labs, weights);
  // Grey parts (black hair) differ from their neighbours mostly by lightness, coloured ones by hue.
  const wL = parts[0].weightL;

  // A coloured part keeps roughly its hue in its darkest and lightest strands and outlines.
  const mainChroma = Math.hypot(parts[0].lab[1], parts[0].lab[2]);
  const mainHue = Math.atan2(parts[0].lab[2], parts[0].lab[1]);
  const distance = (p: number) => {
    const [l, a, b] = rgbToLab(data[p], data[p + 1], data[p + 2]);
    let best = Infinity;
    for (const c of parts) {
      const d = Math.sqrt((wL * (l - c.lab[0])) ** 2 + (a - c.lab[1]) ** 2 + (b - c.lab[2]) ** 2) / c.radius;
      if (d < best) best = d;
    }
    if (mainChroma >= 15) {
      const chroma = Math.hypot(a, b);
      let dh = Math.abs(Math.atan2(b, a) - mainHue);
      if (dh > Math.PI) dh = 2 * Math.PI - dh;
      // Shadows and drawn strands drift in hue (mint green turns olive), so darker pixels get more room.
      // Lighter pixels must be clearly coloured: a pale tint around the part is background, not part.
      const darker = l < parts[0].lab[0] - 15;
      const tolerance = ((darker ? 50 : 25) * Math.PI) / 180;
      const minChroma = (darker ? 0.2 : 0.45) * mainChroma;
      const hueD = dh / tolerance;
      const chromaD = chroma >= minChroma ? 0 : (2 * (minChroma - chroma)) / minChroma;
      best = Math.min(best, Math.max(hueD, chromaD));
    }
    return best;
  };

  // Light of the part, measured on its matching pixels.
  const alpha = new Float32Array(n);
  let lightSum = 0;
  let lightCount = 0;
  for (let y = 0; y < height; y++) {
    const ly = Math.min(low.height - 1, Math.floor((y * low.height) / height));
    for (let x = 0; x < width; x++) {
      const lx = Math.min(low.width - 1, Math.floor((x * low.width) / width));
      if (!zoneLow[ly * low.width + lx]) continue;
      const i = y * width + x;
      if (data[i * 4 + 3] < 16) continue;
      const d = distance(i * 4);
      // Full strength inside the colour range, fading out over its edge.
      const a = d <= 1 ? 1 : d < 1.6 ? (1.6 - d) / 0.6 : 0;
      if (a === 0) continue;
      alpha[i] = a;
      if (a === 1) {
        lightSum += rgbToHsl(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])[2];
        lightCount++;
      }
    }
  }
  if (lightCount < 16) return false;
  const meanL = Math.max(0.02, Math.min(0.98, lightSum / lightCount));

  const [th, ts, tl] = rgbToHsl(...hexToRgb(hex));
  for (let i = 0; i < n; i++) {
    const a = alpha[i];
    if (a === 0) continue;
    const p = i * 4;
    const l0 = rgbToHsl(data[p], data[p + 1], data[p + 2])[2];
    // The target's lightness plus a softened copy of the original shading, kept close
    // to the target so "black" can never come out light.
    const l = Math.min(tl + 0.2, Math.max(tl - 0.2, tl + (l0 - meanL) * 0.6));
    const [nr, ng, nb] = hslToRgb(th, ts, Math.min(1, Math.max(0, l)));
    data[p] = data[p] * (1 - a) + nr * a;
    data[p + 1] = data[p + 1] * (1 - a) + ng * a;
    data[p + 2] = data[p + 2] * (1 - a) + nb * a;
  }
  return true;
}

/**
 * The part's main colours: k-means (k = 3) over the core's colours, keeping
 * clusters that hold at least 15% of it (thin outlines and stray skin drop out).
 * Each colour gets a matching radius from its own spread.
 */
function mainColors(labs: Lab[], weights: number[]): { lab: Lab; radius: number; weightL: number }[] {
  const k = Math.min(3, labs.length);
  const wL = 0.6;
  const sorted = [...labs].sort((x, y) => x[0] - y[0]);
  let centers: Lab[] = Array.from({ length: k }, (_, j) => [...sorted[Math.floor(((j + 0.5) * sorted.length) / k)]] as Lab);
  const assign = new Int32Array(labs.length);
  const dist2 = (x: Lab, c: Lab) => (wL * (x[0] - c[0])) ** 2 + (x[1] - c[1]) ** 2 + (x[2] - c[2]) ** 2;
  for (let iter = 0; iter < 10; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    labs.forEach((x, i) => {
      let best = 0;
      for (let j = 1; j < k; j++) if (dist2(x, centers[j]) < dist2(x, centers[best])) best = j;
      assign[i] = best;
      const s = sums[best];
      s[0] += x[0];
      s[1] += x[1];
      s[2] += x[2];
      s[3]++;
    });
    centers = centers.map((c, j) => (sums[j][3] ? [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3]] : c));
  }
  // Each colour's share counts the model's confidence, so the colour where the model is surest wins.
  const spread = centers.map(() => [0, 0, 0]);
  let total = 0;
  labs.forEach((x, i) => {
    spread[assign[i]][0] += dist2(x, centers[assign[i]]);
    spread[assign[i]][1]++;
    spread[assign[i]][2] += weights[i];
    total += weights[i];
  });
  const clusters = centers
    .map((lab, j) => ({ lab, share: spread[j][2] / total, sd: Math.sqrt(spread[j][0] / Math.max(1, spread[j][1])) }))
    .sort((x, y) => y.share - x.share);
  // The biggest cluster is the part. Another one counts too when it is a shade of
  // the same colour (lighter or darker strands) or clearly a second main colour,
  // but not when it is a bit of background or skin the blurry mask spilled onto.
  const main = clusters[0];
  return clusters
    .filter((c) => c === main || c.share >= 0.3 || (c.share >= 0.1 && Math.hypot(c.lab[1] - main.lab[1], c.lab[2] - main.lab[2]) < 25))
    .map(({ lab, sd }) => ({ lab, radius: Math.min(40, Math.max(14, sd * 2.5)), weightL: Math.hypot(main.lab[1], main.lab[2]) < 15 ? 1 : 0.35 }));
}

function rgbToLab(r: number, g: number, b: number): Lab {
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function hexToRgb(hex: string): [number, number, number] {
  const v = Number.parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}
