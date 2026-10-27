// Drawing for Stampic: the single draw function used by BOTH the
// preview and the export, plus the canvas-drawn sample scenes.
// drawWatermarked never reads the DOM; it draws onto the ctx given.
import {
  normalizeSettings, watermarkWidth, textFontSize, singleWatermarkRect,
  tileGrid, rectCenter,
} from './watermark.js';

// Measure the text watermark at the given font, falling back to an
// estimate when the context cannot measure (defensive only; browsers
// always measure).
function measureText(ctx, settings, fontSize) {
  ctx.font = `${settings.bold ? '700' : '400'} ${fontSize}px ${settings.fontFamily}`;
  if (typeof ctx.measureText === 'function') {
    const m = ctx.measureText(settings.text);
    if (m && Number.isFinite(m.width) && m.width > 0) return m.width;
  }
  return Math.max(1, settings.text.length * fontSize * 0.58);
}

// Draw one watermark instance centred on (cx, cy), rotated in degrees.
function drawInstance(ctx, settings, cx, cy, width, height) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((settings.rotation * Math.PI) / 180);
  ctx.globalAlpha = settings.opacity / 100;
  if (settings.mode === 'logo' && settings.logoImage) {
    const img = settings.logoImage;
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
  } else {
    ctx.font = `${settings.bold ? '700' : '400'} ${settings.fontSizePx}px ${settings.fontFamily}`;
    ctx.fillStyle = settings.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(settings.text, 0, 0);
  }
  ctx.restore();
}

// The shared draw: photo fills the canvas, then the watermark goes on
// top. `source` is a canvas or image with width/height. `settings` may
// carry logoImage (canvas/image) for logo mode. `view` is 'after' or
// 'before' (before draws the photo only, for the comparison toggle).
export function drawWatermarked(ctx, source, settingsInput, view = 'after') {
  const settings = normalizeSettings(settingsInput);
  const w = source.width;
  const h = source.height;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  if (view !== 'after') return { width: w, height: h };
  const hasWatermark = settings.mode === 'text' ? !!settings.text : !!settings.logoImage;
  if (!hasWatermark) return { width: w, height: h };

  if (settings.mode === 'logo' && settings.logoImage) {
    const logo = settings.logoImage;
    const logoW = watermarkWidth(w, settings.size);
    const logoH = logoW * (logo.height / Math.max(1, logo.width));
    if (settings.placement === 'tiled') {
      const grid = tileGrid(w, h, logoW, logoH, settings.tileSpacing);
      for (const tile of grid.tiles) {
        const c = rectCenter(tile);
        drawInstance(ctx, { ...settings, fontSizePx: 0 }, c.x, c.y, tile.width, tile.height);
      }
      return { width: w, height: h, tiles: grid.count };
    }
    const rect = singleWatermarkRect(w, h, logoW, logoH, settings);
    const c = rectCenter(rect);
    drawInstance(ctx, { ...settings, fontSizePx: 0 }, c.x, c.y, rect.width, rect.height);
    return { width: w, height: h, rect };
  }

  // Text mode.
  const fontSize = textFontSize(w, settings.size);
  const textW = measureText(ctx, settings, fontSize);
  const textH = fontSize;
  if (settings.placement === 'tiled') {
    const grid = tileGrid(w, h, textW, textH, settings.tileSpacing);
    for (const tile of grid.tiles) {
      const c = rectCenter(tile);
      drawInstance(ctx, { ...settings, fontSizePx: fontSize }, c.x, c.y, tile.width, tile.height);
    }
    return { width: w, height: h, tiles: grid.count };
  }
  const rect = singleWatermarkRect(w, h, textW, textH, settings);
  const c = rectCenter(rect);
  drawInstance(ctx, { ...settings, fontSizePx: fontSize }, c.x, c.y, rect.width, rect.height);
  return { width: w, height: h, rect };
}

export const SAMPLE_SCENES = [
  { name: 'Sunset hills', w: 800, h: 600 },
  { name: 'Ocean waves', w: 800, h: 600 },
  { name: 'Forest pines', w: 800, h: 600 },
  { name: 'City skyline', w: 800, h: 600 },
  { name: 'Desert dunes', w: 800, h: 600 },
  { name: 'Neon grid', w: 800, h: 600 },
];

// Draw one sample scene onto ctx (canvas already sized w x h).
export function drawSampleScene(ctx, scene, w, h) {
  const sky = (top, bottom) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };
  if (scene === 'Sunset hills') {
    sky('#E5484D', '#F5C86B');
    ctx.fillStyle = '#F5F5F7'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.35, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3A2A33'; ctx.beginPath(); ctx.moveTo(0, h * 0.7); ctx.lineTo(w * 0.4, h * 0.45); ctx.lineTo(w * 0.8, h * 0.7); ctx.lineTo(w, h * 0.55); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  } else if (scene === 'Ocean waves') {
    sky('#1E6FA8', '#7FC4E8');
    ctx.fillStyle = '#0B4A73'; ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.strokeStyle = '#F5F5F7'; ctx.lineWidth = 6; ctx.beginPath();
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * 0.62 + Math.sin(x / 40) * 12);
    ctx.stroke();
    ctx.fillStyle = '#F5F5F7'; ctx.beginPath(); ctx.arc(w * 0.25, h * 0.25, 45, 0, Math.PI * 2); ctx.fill();
  } else if (scene === 'Forest pines') {
    sky('#123524', '#2E7D4F');
    ctx.fillStyle = '#0E2A1C'; ctx.fillRect(0, h * 0.75, w, h * 0.25);
    ctx.fillStyle = '#1F5C3D';
    for (let i = 0; i < 7; i += 1) {
      const x = 60 + i * 110; const s = 60 + (i % 3) * 20;
      ctx.beginPath(); ctx.moveTo(x, h * 0.75 - s * 2); ctx.lineTo(x - s, h * 0.75); ctx.lineTo(x + s, h * 0.75); ctx.closePath(); ctx.fill();
    }
  } else if (scene === 'City skyline') {
    sky('#0B0B0F', '#23232E');
    ctx.fillStyle = '#3A3A48';
    for (let i = 0; i < 8; i += 1) {
      const bw = 70 + (i % 3) * 20; const bh = 180 + (i % 4) * 60;
      ctx.fillRect(20 + i * 98, h - bh, bw, bh);
    }
    ctx.fillStyle = '#E5484D'; ctx.fillRect(0, h * 0.9, w, h * 0.1);
  } else if (scene === 'Desert dunes') {
    sky('#E8B86B', '#F5E3B8');
    ctx.fillStyle = '#C98A3A'; ctx.beginPath(); ctx.moveTo(0, h * 0.6); ctx.quadraticCurveTo(w * 0.5, h * 0.35, w, h * 0.65); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#A86E28'; ctx.beginPath(); ctx.moveTo(0, h * 0.8); ctx.quadraticCurveTo(w * 0.5, h * 0.6, w, h * 0.85); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  } else { // Neon grid
    ctx.fillStyle = '#0B0B0F'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#E5484D'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= w; x += 80) { ctx.moveTo(x, h * 0.5); ctx.lineTo(x - 160, h); }
    for (let y = h * 0.5; y <= h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    ctx.fillStyle = '#E5484D'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.3, 50, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(11,11,15,0.55)'; ctx.fillRect(0, h - 34, w, 34);
  ctx.fillStyle = '#F5F5F7'; ctx.font = '20px Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(scene, 16, h - 17);
}
