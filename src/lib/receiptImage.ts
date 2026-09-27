// Prepara la foto de una boleta para el OCR, todo en el dispositivo:
// 1. Recorta el papel automáticamente (la zona clara más grande).
// 2. Endereza la boleta (detecta la inclinación de las líneas de texto).
// 3. Escala para que la letra quede del tamaño que mejor lee Tesseract.
// 4. Aplana la iluminación (quita sombras) sin binarizar: Tesseract binariza
//    mejor por su cuenta sobre una imagen pareja que sobre una ya umbralizada.

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  angle: number;     // grados que se enderezó
  cropped: boolean;  // si se recortó el papel automáticamente
}

const TARGET_PITCH = 60;   // px entre líneas de texto en la imagen final
const MAX_SIDE = 4200;
const MAX_AREA = 12_000_000; // Safari en iOS deja en blanco los canvas de más de ~16,7 MP
const ANALYSIS_WIDTH = 700;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}

function grayOf(ctx: CanvasRenderingContext2D, w: number, h: number): Uint8Array {
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) {
    g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }
  return g;
}

function otsu(g: Uint8Array): number {
  const hist = new Float64Array(256);
  for (const v of g) hist[v]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = g.length - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) { best = between; t = i; }
  }
  return t;
}

/** Media local con tabla integral (ventana 2r+1). */
function boxMean(g: Uint8Array, w: number, h: number, r: number): Float32Array {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      out[y * w + x] = s / ((x1 - x0) * (y1 - y0));
    }
  }
  return out;
}

/** Máximo local separable (dilatación en gris): borra el texto y deja el papel. */
function localMax(g: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) if (g[y * w + k] > m) m = g[y * w + k];
      tmp[y * w + x] = m;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) if (tmp[k * w + x] > m) m = tmp[k * w + x];
      out[y * w + x] = m;
    }
  }
  return out;
}

interface Box { x0: number; y0: number; x1: number; y1: number }
interface Paper extends Box { mask: Uint8Array } // 1 = papel (con agujeros rellenos)

/** La mancha clara conectada más grande (el papel sobre la mesa). */
function findPaper(g: Uint8Array, w: number, h: number): Paper | null {
  const t = otsu(g);
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let best: (Box & { area: number; label: number }) | null = null;
  let label = 0;
  for (let start = 0; start < g.length; start++) {
    if (seen[start] || g[start] <= t) continue;
    label++;
    let sp = 0, area = 0;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    stack[sp++] = start; seen[start] = label;
    while (sp) {
      const p = stack[--sp];
      const x = p % w, y = (p - x) / w;
      area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && !seen[q] && g[q] > t) { seen[q] = label; stack[sp++] = q; }
    }
    if (!best || area > best.area) best = { x0, y0, x1, y1, area, label };
  }
  if (!best) return null;
  const boxArea = (best.x1 - best.x0 + 1) * (best.y1 - best.y0 + 1);
  // Muy chico = no encontró el papel; casi toda la foto = ya viene recortada
  if (best.area < g.length * 0.04 || boxArea > g.length * 0.9) return null;

  // Máscara: todo lo que no se alcanza desde el borde sin cruzar el papel
  const outside = new Uint8Array(w * h);
  let sp = 0;
  const push = (p: number) => { if (!outside[p] && seen[p] !== best!.label) { outside[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = outside[i] ? 0 : 1;
  return { x0: best.x0, y0: best.y0, x1: best.x1, y1: best.y1, mask };
}

/** Mínimo local (erosión) de una máscara 0/1. */
function erode(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const inv = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) inv[i] = m[i] ? 0 : 1;
  const grown = localMax(inv, w, h, r);
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = grown[i] ? 0 : 1;
  return out;
}

/**
 * Inclinación (grados) y distancia entre líneas (px) a partir de los píxeles
 * de texto: el ángulo correcto es el que deja el perfil de filas más "picudo".
 */
function skewAndPitch(g: Uint8Array, w: number, h: number): { angle: number; pitch: number | null } {
  const mean = boxMean(g, w, h, 7);
  const paper = otsu(g);
  const xs: number[] = [], ys: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (g[i] < mean[i] - 18 && mean[i] > paper * 0.8) { xs.push(x); ys.push(y); }
  }
  if (xs.length < 200) return { angle: 0, pitch: null };
  const step = Math.max(1, Math.floor(xs.length / 60000));
  const diag = Math.ceil(Math.hypot(w, h));

  const profile = (deg: number) => {
    const a = (deg * Math.PI) / 180, s = Math.sin(a), c = Math.cos(a);
    const hist = new Float64Array(diag * 2 + 2);
    for (let k = 0; k < xs.length; k += step) hist[Math.round(ys[k] * c - xs[k] * s) + diag]++;
    return hist;
  };
  const score = (hist: Float64Array) => { let s = 0; for (const v of hist) s += v * v; return s; };

  let bestAngle = 0, bestScore = -1;
  for (let d = -12; d <= 12; d += 0.5) {
    const sc = score(profile(d));
    if (sc > bestScore) { bestScore = sc; bestAngle = d; }
  }
  for (let d = bestAngle - 0.4; d <= bestAngle + 0.4; d += 0.1) {
    const sc = score(profile(d));
    if (sc > bestScore) { bestScore = sc; bestAngle = d; }
  }

  // Distancia entre líneas: primer pico fuerte de la autocorrelación del perfil
  const hist = profile(bestAngle);
  let lo = 0, hi = hist.length - 1;
  while (lo < hi && !hist[lo]) lo++;
  while (hi > lo && !hist[hi]) hi--;
  const prof = Array.from(hist.slice(lo, hi + 1));
  const avg = prof.reduce((a, b) => a + b, 0) / prof.length;
  const ac = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < prof.length; i++) s += (prof[i] - avg) * (prof[i + lag] - avg);
    return s / (prof.length - lag);
  };
  const ac0 = ac(0);
  let pitch: number | null = null;
  for (let lag = 4; lag < Math.min(90, prof.length / 3); lag++) {
    const v = ac(lag);
    if (v > ac0 * 0.25 && v >= ac(lag - 1) && v >= ac(lag + 1)) { pitch = lag; break; }
  }
  return { angle: bestAngle, pitch };
}

export async function prepareReceiptImage(source: File | string): Promise<PreparedImage> {
  const isFile = typeof source !== 'string';
  const url = isFile ? URL.createObjectURL(source) : source;
  try {
    const img = await loadImage(url);
    const W = img.naturalWidth, H = img.naturalHeight;

    // 1. Buscar el papel en una versión chica
    const small = 400 / Math.max(W, H);
    const s = canvas(W * small, H * small);
    s.ctx.drawImage(img, 0, 0, s.c.width, s.c.height);
    const box = findPaper(grayOf(s.ctx, s.c.width, s.c.height), s.c.width, s.c.height);
    let crop: Box = { x0: 0, y0: 0, x1: W, y1: H };
    if (box) {
      const m = 0.02 * Math.max(W, H);
      crop = {
        x0: Math.max(0, box.x0 / small - m), y0: Math.max(0, box.y0 / small - m),
        x1: Math.min(W, (box.x1 + 1) / small + m), y1: Math.min(H, (box.y1 + 1) / small + m),
      };
    }
    const cw = crop.x1 - crop.x0, ch = crop.y1 - crop.y0;

    // 2. Inclinación y tamaño de letra sobre el recorte
    const aScale = Math.min(1.5, ANALYSIS_WIDTH / cw);
    const a = canvas(cw * aScale, ch * aScale);
    a.ctx.drawImage(img, crop.x0, crop.y0, cw, ch, 0, 0, a.c.width, a.c.height);
    const { angle, pitch } = skewAndPitch(grayOf(a.ctx, a.c.width, a.c.height), a.c.width, a.c.height);

    // 3. Escala: que las líneas queden a ~TARGET_PITCH px
    let scale = pitch ? (TARGET_PITCH * aScale) / pitch : 1600 / cw;
    scale = Math.min(scale, 4, MAX_SIDE / Math.max(cw, ch), Math.sqrt(MAX_AREA / (cw * ch * 1.3)));

    const rad = (-angle * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    const outW = (cw * cos + ch * sin) * scale;
    const outH = (cw * sin + ch * cos) * scale;
    const o = canvas(outW, outH);
    // Recorta + endereza + escala (la misma transformación para la máscara)
    const place = (ctx: CanvasRenderingContext2D, k: number, src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate((outW * k) / 2, (outH * k) / 2);
      ctx.rotate(rad);
      ctx.scale(scale * k, scale * k);
      ctx.drawImage(src, sx, sy, sw, sh, -cw / 2, -ch / 2, cw, ch);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    o.ctx.fillStyle = '#fff';
    o.ctx.fillRect(0, 0, o.c.width, o.c.height);
    place(o.ctx, 1, img, crop.x0, crop.y0, cw, ch);

    // 4. Aplanar iluminación: gris / fondo estimado (máximo local suavizado,
    //    calculado a 1/4 de resolución porque las sombras cambian lento)
    const w = o.c.width, h = o.c.height;
    const gray = grayOf(o.ctx, w, h);
    const q = canvas(w / 4, h / 4);

    // Máscara del papel en coordenadas finales (a 1/4), un poco erosionada
    // para que el borde papel/mesa no quede como un marco negro.
    let paperMask: Uint8Array | null = null;
    if (box) {
      const sw = s.c.width, sh = s.c.height;
      const mc = canvas(sw, sh);
      const mi = mc.ctx.createImageData(sw, sh);
      for (let i = 0; i < box.mask.length; i++) {
        mi.data[i * 4] = mi.data[i * 4 + 1] = mi.data[i * 4 + 2] = box.mask[i] ? 255 : 0;
        mi.data[i * 4 + 3] = 255;
      }
      mc.ctx.putImageData(mi, 0, 0);
      const mq = canvas(q.c.width, q.c.height);
      mq.ctx.fillStyle = '#000';
      mq.ctx.fillRect(0, 0, mq.c.width, mq.c.height);
      place(mq.ctx, q.c.width / w, mc.c, crop.x0 * small, crop.y0 * small, cw * small, ch * small);
      const mg = grayOf(mq.ctx, mq.c.width, mq.c.height);
      const bin = new Uint8Array(mg.length);
      for (let i = 0; i < mg.length; i++) bin[i] = mg[i] > 128 ? 1 : 0;
      paperMask = erode(bin, mq.c.width, mq.c.height, Math.max(2, Math.round(TARGET_PITCH / 4 / 4)));
    }
    q.ctx.drawImage(o.c, 0, 0, q.c.width, q.c.height);
    const qg = grayOf(q.ctx, q.c.width, q.c.height);
    const r = Math.max(2, Math.round(TARGET_PITCH / 4 / 3));
    const bgSmall = boxMean(localMax(qg, q.c.width, q.c.height, r), q.c.width, q.c.height, r);
    const bgImg = q.ctx.createImageData(q.c.width, q.c.height);
    for (let i = 0; i < bgSmall.length; i++) {
      bgImg.data[i * 4] = bgImg.data[i * 4 + 1] = bgImg.data[i * 4 + 2] = bgSmall[i];
      bgImg.data[i * 4 + 3] = 255;
    }
    q.ctx.putImageData(bgImg, 0, 0);
    const b = canvas(w, h);
    b.ctx.drawImage(q.c, 0, 0, w, h);
    const bg = grayOf(b.ctx, w, h);
    const qw = q.c.width, qh = q.c.height;

    const out = o.ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < gray.length; i++) {
      let v = 255;
      const x = i % w, y = (i - x) / w;
      if (!paperMask || paperMask[Math.min(qh - 1, y >> 2) * qw + Math.min(qw - 1, x >> 2)]) {
        v = Math.min(255, (gray[i] / Math.max(bg[i], 1)) * 255);
        v = v >= 235 ? 255 : v * (255 / 235); // papel blanco parejo
      }
      out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v;
      out.data[i * 4 + 3] = 255;
    }
    o.ctx.putImageData(out, 0, 0);

    return {
      dataUrl: o.c.toDataURL('image/png'),
      width: w, height: h,
      angle: Math.round(angle * 10) / 10,
      cropped: !!box,
    };
  } finally {
    if (isFile) URL.revokeObjectURL(url);
  }
}
