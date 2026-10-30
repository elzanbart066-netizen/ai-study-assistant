// Edits one part of a picture ("dye the hair black") without a key or a server:
// a text-prompted segmentation model (CLIPSeg, Apache-2.0) runs in the browser
// through transformers.js, finds the part, and only those pixels are recoloured.
// The model (about 150 MB) is downloaded once and kept in the browser cache.
import type { RecolorRequest } from "./imageOps.js";

const MODEL_ID = "Xenova/clipseg-rd64-refined";
// Work on at most this many pixels per side; enough for the low-resolution mask.
const MAX_SIDE = 2400;

type Segmenter = (canvas: HTMLCanvasElement, prompt: string) => Promise<{ mask: Float32Array; width: number; height: number }>;

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
        const textInputs = tokenizer([prompt], { padding: true, truncation: true });
        const imageInputs = await processor(image);
        const { logits } = await model({ ...textInputs, ...imageInputs });
        const dims = logits.dims as number[];
        const height = dims[dims.length - 2];
        const width = dims[dims.length - 1];
        const data = logits.data as Float32Array;
        const mask = new Float32Array(width * height);
        for (let i = 0; i < mask.length; i++) mask[i] = 1 / (1 + Math.exp(-data[i]));
        return { mask, width, height };
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
  const mask = resizeMask(found.mask, found.width, found.height, canvas.width, canvas.height);
  if (!recolorPixels(pixels.data, mask, request.color)) throw new NothingFoundError(request.target);
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

// Mask probability below LOW is left alone, above HIGH is fully recoloured.
const LOW = 0.3;
const HIGH = 0.55;

/**
 * Recolours RGBA pixels in place where the mask is confident, keeping each
 * pixel's light and shade so the texture (strands of hair, folds) survives.
 * The mask is sharpened with colour similarity to the part's own average
 * colour, because the model's mask is blurry at the edges.
 * Returns false when no pixel is confidently part of the target.
 */
export function recolorPixels(data: Uint8ClampedArray, mask: Float32Array, hex: string): boolean {
  // Average colour and lightness of the confident core of the part.
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < HIGH || data[i * 4 + 3] < 16) continue;
    r += data[i * 4];
    g += data[i * 4 + 1];
    b += data[i * 4 + 2];
    n++;
  }
  if (n < Math.max(16, mask.length * 0.002)) return false;
  r /= n;
  g /= n;
  b /= n;
  let spread = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < HIGH || data[i * 4 + 3] < 16) continue;
    spread += (data[i * 4] - r) ** 2 + (data[i * 4 + 1] - g) ** 2 + (data[i * 4 + 2] - b) ** 2;
  }
  const sigma2 = 2 * Math.max(45 ** 2, (spread / n) * 2.5);
  const meanL = Math.max(0.02, Math.min(0.98, rgbToHsl(r, g, b)[2]));

  const [th, ts, tl] = rgbToHsl(...hexToRgb(hex));
  for (let i = 0; i < mask.length; i++) {
    const m = Math.min(1, Math.max(0, (mask[i] - LOW) / (HIGH - LOW)));
    if (m === 0) continue;
    const p = i * 4;
    const d2 = (data[p] - r) ** 2 + (data[p + 1] - g) ** 2 + (data[p + 2] - b) ** 2;
    const alpha = m * Math.exp(-d2 / sigma2);
    if (alpha < 0.01) continue;
    const l0 = rgbToHsl(data[p], data[p + 1], data[p + 2])[2];
    // Move the part's average lightness to the target's while keeping relative shading.
    const l = tl <= meanL ? (l0 * tl) / meanL : 1 - ((1 - l0) * (1 - tl)) / (1 - meanL);
    const [nr, ng, nb] = hslToRgb(th, ts, Math.min(1, Math.max(0, l)));
    data[p] = data[p] * (1 - alpha) + nr * alpha;
    data[p + 1] = data[p + 1] * (1 - alpha) + ng * alpha;
    data[p + 2] = data[p + 2] * (1 - alpha) + nb * alpha;
  }
  return true;
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
