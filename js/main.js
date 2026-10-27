// DOM wiring for Stampic only. All geometry lives in watermark.js;
// all drawing lives in render.js (drawWatermarked, shared by preview
// and export). This module never computes a position itself.
import {
  MAX_PHOTOS, addPhotos, removePhoto, clearPhotos, normalizeSettings,
  settingsSummary, exportFileName, POSITION_LABELS,
} from './watermark.js';
import { drawWatermarked, SAMPLE_SCENES, drawSampleScene } from './render.js';

const $ = (id) => document.getElementById(id);
const PREVIEW_MAX = 960;

let photos = []; // { name, source (canvas|img), width, height }
let selected = 0;
let logoImage = null;
let logoName = '';
let view = 'after'; // 'before' | 'after'

function settings() {
  return normalizeSettings({
    mode: $('modeSelect').value,
    placement: $('placementSelect').value,
    text: $('wmText').value,
    fontFamily: $('fontFamily').value,
    color: $('fontColor').value,
    bold: $('boldCheck').checked,
    opacity: Number($('opacityRange').value),
    size: Number($('sizeRange').value),
    rotation: Number($('rotationRange').value),
    position: document.querySelector('.posBtn.active')?.dataset.pos || 'bottom-right',
    margin: Number($('marginRange').value),
    tileSpacing: Number($('tileSpacingRange').value),
    logoImage,
  });
}

function scaleFor(w, h) {
  return Math.min(1, PREVIEW_MAX / Math.max(w, h));
}

function renderPreview() {
  const canvas = $('previewCanvas');
  const empty = $('emptyNote');
  if (photos.length === 0) {
    canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    empty.hidden = false;
    $('selectedName').textContent = 'No photo selected';
    $('exportSizeText').textContent = 'No photo selected';
    return;
  }
  empty.hidden = true;
  if (selected >= photos.length) selected = photos.length - 1;
  const photo = photos[selected];
  const s = scaleFor(photo.width, photo.height);
  canvas.width = Math.max(1, Math.round(photo.width * s));
  canvas.height = Math.max(1, Math.round(photo.height * s));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // Preview at capped scale: margin and tile spacing scale with it so
  // the preview matches the export proportions.
  const previewSettings = { ...settings(), margin: Math.round(settings().margin * s), tileSpacing: Math.round(settings().tileSpacing * s) };
  drawWatermarked(ctx, photo.source, previewSettings, view);
  $('selectedName').textContent = photo.name;
  $('exportSizeText').textContent = `Export size: ${photo.width} x ${photo.height} px · ${photos.length} photo${photos.length === 1 ? '' : 's'} loaded`;
}

function renderList() {
  const list = $('photoList');
  list.innerHTML = '';
  photos.forEach((photo, i) => {
    const item = document.createElement('div');
    item.className = 'photo-item' + (i === selected ? ' selected' : '');
    const label = document.createElement('button');
    label.type = 'button'; label.className = 'photo-label'; label.textContent = `${i + 1}. ${photo.name}`;
    label.addEventListener('click', () => { selected = i; renderAll(); });
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'removeBtn'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      photos = removePhoto(photos, i);
      if (selected >= photos.length) selected = Math.max(0, photos.length - 1);
      renderAll();
    });
    item.append(label, remove);
    list.appendChild(item);
  });
  $('photoCountText').textContent = `${photos.length}/${MAX_PHOTOS} photos`;
  $('exportBtn').disabled = photos.length === 0;
  $('exportAllBtn').disabled = photos.length === 0;
  $('settingsSummary').textContent = settingsSummary(settings());
  $('statusText').textContent = photos.length === 0
    ? 'Add photos to start watermarking.'
    : `Selected: ${photos[selected] ? photos[selected].name : ''} · ${POSITION_LABELS[settings().position]} · ${view === 'before' ? 'showing original' : 'showing watermarked'}`;
}

function renderAll() { renderList(); renderPreview(); }

function addPhotoObjects(incoming) {
  const before = photos.length;
  photos = addPhotos(photos, incoming);
  if (photos.length === before && incoming.length > 0) {
    $('statusText').textContent = `Photo limit reached (${MAX_PHOTOS}). Remove a photo to add more.`;
  }
  renderAll();
}

function loadSamples() {
  const incoming = SAMPLE_SCENES.map((scene) => {
    const canvas = document.createElement('canvas');
    canvas.width = scene.w; canvas.height = scene.h;
    const ctx = canvas.getContext('2d');
    if (ctx) drawSampleScene(ctx, scene.name, scene.w, scene.h);
    return { name: scene.name, source: canvas, width: scene.w, height: scene.h };
  });
  addPhotoObjects(incoming);
}

function filesToPhotos(files) {
  const list = [...files].filter((f) => f.type && f.type.startsWith('image/'));
  if (list.length === 0) return;
  list.forEach((file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      addPhotoObjects([{ name: file.name, source: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); };
    img.src = url;
  });
}

function renderOffscreen(photo, format) {
  const canvas = document.createElement('canvas');
  canvas.width = photo.width; canvas.height = photo.height;
  const ctx = canvas.getContext('2d');
  drawWatermarked(ctx, photo.source, settings(), 'after');
  return new Promise((resolve) => {
    const type = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => resolve({ blob, type }), type, 0.92);
    } else {
      resolve({ blob: null, type });
    }
  });
}

function triggerDownload(blob, filename) {
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

async function exportSelected() {
  if (photos.length === 0) return;
  const format = $('formatSelect').value;
  const photo = photos[selected];
  const { blob } = await renderOffscreen(photo, format);
  const filename = exportFileName(photo.name, format, selected);
  const ok = triggerDownload(blob, filename);
  $('statusText').textContent = ok
    ? `Exported ${photo.name} as ${filename} — download started.`
    : `Exported ${photo.name} as ${filename} — download attempted (browser blocked the automatic download; try again).`;
  $('zipStatus').textContent = '';
}

async function exportAll() {
  if (photos.length === 0) return;
  const format = $('formatSelect').value;
  const JSZipGlobal = window.JSZip;
  if (!JSZipGlobal) {
    $('zipStatus').textContent = 'ZIP library unavailable (offline or CDN blocked) — downloading photos individually instead.';
    for (let i = 0; i < photos.length; i += 1) {
      const { blob } = await renderOffscreen(photos[i], format);
      triggerDownload(blob, exportFileName(photos[i].name, format, i));
    }
    $('statusText').textContent = `Downloaded ${photos.length} watermarked photos individually (ZIP unavailable).`;
    return;
  }
  const zip = new JSZipGlobal();
  for (let i = 0; i < photos.length; i += 1) {
    const { blob } = await renderOffscreen(photos[i], format);
    if (blob) zip.file(exportFileName(photos[i].name, format, i), blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, 'stampic-watermarked.zip');
  $('zipStatus').textContent = `ZIP ready: stampic-watermarked.zip with ${photos.length} photos.`;
  $('statusText').textContent = `Exported all ${photos.length} photos as stampic-watermarked.zip — download started.`;
}

function syncLabels() {
  $('opacityValue').textContent = `${$('opacityRange').value}%`;
  $('sizeValue').textContent = `${$('sizeRange').value}%`;
  $('rotationValue').textContent = `${$('rotationRange').value}°`;
  $('marginValue').textContent = `${$('marginRange').value} px`;
  $('tileSpacingValue').textContent = `${$('tileSpacingRange').value} px`;
  const tiled = $('placementSelect').value === 'tiled';
  $('tileRow').hidden = !tiled;
  $('positionRow').hidden = tiled;
  $('marginRow').hidden = tiled;
  const logoMode = $('modeSelect').value === 'logo';
  $('textControls').hidden = logoMode;
  $('logoControls').hidden = !logoMode;
}

function init() {
  $('fileInput').addEventListener('change', (e) => { filesToPhotos(e.target.files); e.target.value = ''; });
  const zone = $('dropZone');
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag'); filesToPhotos(e.dataTransfer.files); });
  document.addEventListener('paste', (e) => {
    const items = [...(e.clipboardData?.items || [])].filter((it) => it.type.startsWith('image/'));
    if (items.length === 0) return;
    items.forEach((it, i) => {
      const file = it.getAsFile();
      if (file) filesToPhotos([file]);
    });
  });
  $('sampleBtn').addEventListener('click', loadSamples);
  $('clearBtn').addEventListener('click', () => { photos = clearPhotos(); selected = 0; renderAll(); });
  $('modeSelect').addEventListener('change', () => { syncLabels(); renderAll(); });
  $('placementSelect').addEventListener('change', () => { syncLabels(); renderAll(); });
  $('wmText').addEventListener('input', renderAll);
  $('fontFamily').addEventListener('change', renderAll);
  $('fontColor').addEventListener('input', renderAll);
  $('boldCheck').addEventListener('change', renderAll);
  for (const id of ['opacityRange', 'sizeRange', 'rotationRange', 'marginRange', 'tileSpacingRange']) {
    $(id).addEventListener('input', () => { syncLabels(); renderAll(); });
  }
  document.querySelectorAll('.posBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.posBtn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderAll();
    });
  });
  $('logoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); logoImage = img; logoName = file.name; $('logoName').textContent = file.name; renderAll(); };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    e.target.value = '';
  });
  $('clearLogoBtn').addEventListener('click', () => { logoImage = null; logoName = ''; $('logoName').textContent = 'No logo loaded'; renderAll(); });
  $('beforeBtn').addEventListener('click', () => { view = 'before'; renderAll(); });
  $('afterBtn').addEventListener('click', () => { view = 'after'; renderAll(); });
  $('formatSelect').addEventListener('change', renderAll);
  $('exportBtn').addEventListener('click', exportSelected);
  $('exportAllBtn').addEventListener('click', exportAll);
  syncLabels();
  renderAll();
}

init();
