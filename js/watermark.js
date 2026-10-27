// Pure watermark geometry and settings math for Stampic.
// No DOM, no canvas, no imports: every function is testable in Node.
// A watermark's size is expressed as a percentage of the photo width;
// its height follows the watermark's own aspect ratio (text width is
// measured by the renderer; logo height follows the logo aspect).

export const MAX_PHOTOS = 20;
export const MIN_OPACITY = 0;
export const MAX_OPACITY = 100;
export const MIN_SIZE = 5;
export const MAX_SIZE = 100;
export const MIN_ROTATION = -180;
export const MAX_ROTATION = 180;
export const MIN_MARGIN = 0;
export const MAX_MARGIN = 200;
export const MIN_TILE_SPACING = 0;
export const MAX_TILE_SPACING = 500;

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function clampOpacity(v) { return clamp(v, MIN_OPACITY, MAX_OPACITY); }
export function clampSize(v) { return clamp(v, MIN_SIZE, MAX_SIZE); }
export function clampRotation(v) { return clamp(v, MIN_ROTATION, MAX_ROTATION); }
export function clampMargin(v) { return clamp(v, MIN_MARGIN, MAX_MARGIN); }
export function clampTileSpacing(v) { return clamp(v, MIN_TILE_SPACING, MAX_TILE_SPACING); }

export function defaultSettings() {
  return {
    mode: 'text', // 'text' | 'logo'
    placement: 'single', // 'single' | 'tiled'
    text: 'krrish',
    fontFamily: 'Arial, sans-serif',
    color: '#FFFFFF',
    bold: false,
    opacity: 50,
    size: 20, // percent of photo width
    rotation: -30,
    position: 'bottom-right', // one of POSITIONS keys
    margin: 24, // px at full photo resolution
    tileSpacing: 60, // px at full photo resolution
  };
}

export function normalizeSettings(input = {}) {
  const base = defaultSettings();
  const out = { ...base, ...input };
  out.mode = out.mode === 'logo' ? 'logo' : 'text';
  out.placement = out.placement === 'tiled' ? 'tiled' : 'single';
  out.text = typeof out.text === 'string' && out.text.trim() !== '' ? out.text : base.text;
  out.fontFamily = typeof out.fontFamily === 'string' && out.fontFamily ? out.fontFamily : base.fontFamily;
  out.color = typeof out.color === 'string' && out.color ? out.color : base.color;
  out.bold = out.bold === true;
  out.opacity = clampOpacity(out.opacity);
  out.size = clampSize(out.size);
  out.rotation = clampRotation(out.rotation);
  out.position = POSITIONS[out.position] ? out.position : base.position;
  out.margin = clampMargin(out.margin);
  out.tileSpacing = clampTileSpacing(out.tileSpacing);
  return out;
}

// 9-point grid: ax/ay are the anchor fractions inside the usable area.
export const POSITIONS = {
  'top-left': { ax: 0, ay: 0 },
  'top-center': { ax: 0.5, ay: 0 },
  'top-right': { ax: 1, ay: 0 },
  'middle-left': { ax: 0, ay: 0.5 },
  'middle-center': { ax: 0.5, ay: 0.5 },
  'middle-right': { ax: 1, ay: 0.5 },
  'bottom-left': { ax: 0, ay: 1 },
  'bottom-center': { ax: 0.5, ay: 1 },
  'bottom-right': { ax: 1, ay: 1 },
};

export const POSITION_LABELS = {
  'top-left': 'Top left', 'top-center': 'Top center', 'top-right': 'Top right',
  'middle-left': 'Middle left', 'middle-center': 'Middle center', 'middle-right': 'Middle right',
  'bottom-left': 'Bottom left', 'bottom-center': 'Bottom center', 'bottom-right': 'Bottom right',
};

// Width of a watermark drawn at `size` percent of the photo width.
export function watermarkWidth(photoWidth, size) {
  return Math.max(1, photoWidth * (clampSize(size) / 100));
}

// Rough text width estimate (used only where no canvas measure exists).
// Real rendering measures with ctx.measureText; this keeps the pure
// module honest about text sizing without a canvas.
export function estimateTextWidth(text, fontSizePx, bold) {
  const avg = bold ? 0.62 : 0.58;
  return Math.max(1, String(text).length * fontSizePx * avg);
}

// Font size for text mode: the size slider is a percent of photo width.
export function textFontSize(photoWidth, size) {
  return Math.max(8, Math.round(watermarkWidth(photoWidth, size)));
}

// Top-left of a single watermark, given its drawn size. The margin is
// inset from every edge; the anchor picks the point inside that inset
// rectangle. The result is clamped so the watermark never leaves the
// photo, even when the margin is larger than the photo allows.
export function singleWatermarkRect(photoWidth, photoHeight, wmWidth, wmHeight, settings) {
  const s = normalizeSettings(settings);
  const w = Math.min(wmWidth, photoWidth);
  const h = Math.min(wmHeight, photoHeight);
  const usableW = Math.max(0, photoWidth - 2 * s.margin);
  const usableH = Math.max(0, photoHeight - 2 * s.margin);
  const anchor = POSITIONS[s.position];
  const maxX = Math.max(0, photoWidth - w);
  const maxY = Math.max(0, photoHeight - h);
  // When the inset rectangle is smaller than the watermark, the anchor
  // range collapses; clamp keeps the rect fully inside the photo.
  const x = s.margin + anchor.ax * Math.max(0, usableW - w);
  const y = s.margin + anchor.ay * Math.max(0, usableH - h);
  return { x: clamp(x, 0, maxX), y: clamp(y, 0, maxY), width: w, height: h };
}

// Tile grid: how many whole watermarks fit, and where each starts.
// The grid is centred in the photo; spacing is the gap between tiles.
// Returns at least one tile even when the watermark is wider than the photo.
export function tileGrid(photoWidth, photoHeight, wmWidth, wmHeight, tileSpacing) {
  const spacing = clampTileSpacing(tileSpacing);
  const w = Math.max(1, wmWidth);
  const h = Math.max(1, wmHeight);
  const cols = Math.max(1, Math.floor((photoWidth + spacing) / (w + spacing)));
  const rows = Math.max(1, Math.floor((photoHeight + spacing) / (h + spacing)));
  const totalW = cols * w + (cols - 1) * spacing;
  const totalH = rows * h + (rows - 1) * spacing;
  const startX = (photoWidth - totalW) / 2;
  const startY = (photoHeight - totalH) / 2;
  const tiles = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      tiles.push({ x: startX + c * (w + spacing), y: startY + r * (h + spacing), width: w, height: h });
    }
  }
  return { cols, rows, count: tiles.length, tiles };
}

// Centre of a rect, the point rotations pivot around.
export function rectCenter(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

// Photo-list operations (pure, capped at MAX_PHOTOS).
export function addPhotos(photos, incoming) {
  const next = [...photos];
  for (const photo of incoming) {
    if (next.length >= MAX_PHOTOS) break;
    next.push(photo);
  }
  return next;
}
export function removePhoto(photos, index) {
  if (index < 0 || index >= photos.length) return [...photos];
  return photos.filter((_, i) => i !== index);
}
export function clearPhotos() { return []; }

// One-line human summary of the current settings for the status area.
export function settingsSummary(settings) {
  const s = normalizeSettings(settings);
  const what = s.mode === 'logo' ? 'Logo image' : `Text "${s.text}"`;
  const where = s.placement === 'tiled'
    ? `tiled, ${s.tileSpacing}px spacing`
    : `${POSITION_LABELS[s.position]}, ${s.margin}px margin`;
  return `${what} · ${s.opacity}% opacity · ${s.size}% size · ${s.rotation}° rotation · ${where}`;
}

export function exportFileName(photoName, format, index) {
  const base = String(photoName || `photo-${index + 1}`).replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `photo-${index + 1}`;
  return `stampic-${base}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}
