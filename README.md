# Stampic

I kept running into the same small problem: I had a photo I wanted to share, and I wanted my name on it so it was clearly mine, but every tool I found wanted an upload, an account, or a subscription. So I built this one to run entirely in the browser. You drop photos in, set a text or logo watermark, and download the results. Nothing leaves your device.

## What it does

- Up to 20 photos, added by file picker, drag and drop, or paste.
- Watermark modes: custom text (font family, colour, bold) or an uploaded logo image, which keeps its own aspect ratio.
- Controls: opacity 0-100%, size as a percentage of photo width, rotation -180 to 180 degrees, a 9-point positioning grid, and a margin from the edge.
- Tiled repeat mode: the watermark repeats across the whole photo with adjustable spacing, using the same opacity, size and rotation.
- Before/after toggle for the selected photo, so you can compare the original against the watermarked version.
- Batch export: the same settings apply to every loaded photo. Download one photo as PNG or JPEG, or download all of them as a ZIP.
- No uploads needed to try it: "Load sample photos" fills six canvas-drawn scenes (sunset, ocean, forest, city, desert, neon grid).

## How it is put together

Vanilla JavaScript ES modules, no build step, no images committed to the repo (the sample photos are drawn on a canvas at runtime). The only CDN dependency is JSZip 3.10.1, used for the ZIP download.

- `js/watermark.js` — pure geometry and settings math: 9-point position math, tile grid math, opacity/size/rotation/margin/spacing clamps, photo-list operations, export filenames. No DOM, no canvas.
- `js/render.js` — `drawWatermarked`, the single function that draws a watermarked photo. The preview and the export both call it; the preview just runs it at a capped scale (long side at most 960 px) with margin and tile spacing scaled by the same factor, while export runs it at full photo size.
- `js/main.js` — DOM wiring only. It never computes a position or draws anything itself.

## Honest limitations

- This is a watermark tool, not a photo editor: there is no cropping, filtering, or freeform placement by dragging the watermark itself.
- The ZIP download needs the JSZip CDN script. If it cannot load (offline, or a blocked CDN), the tool falls back to downloading each photo individually and says so on screen, instead of failing silently.
- Text watermarks use the fonts installed on your device, so the exact look of a font can differ slightly between machines.
- HEIC photos will not open in most browsers, and that is a browser limitation, not something this page can fix.
- Paste works with images copied as image data; copying a file path or a web page image reference will not add a photo.
- The preview is a scaled render (see above), so at extreme zoom the preview may look slightly softer than the exported file. The export is always the full-size render.

## Privacy

Your photos are processed locally in your browser and never uploaded. There is no server, no account, and no analytics in this page.
