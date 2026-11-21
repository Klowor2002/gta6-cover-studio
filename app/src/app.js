/* Leonida Cover Studio — cover renderer + editor, written from scratch.
   Two looks, one canvas:
   - Vice Sunset: a wide hero photo up top, two smaller panels below it split
     by a diagonal cut, and a warm caption band along the bottom edge.
   - Neon Nights: a tall photo column on the left, three stacked panels on
     the right, and a glowing caption strip across the top.
   Photos live in memory only; nothing is ever uploaded anywhere. */

const $ = (id) => document.getElementById(id);
const canvas = $("stage");
const ctx = canvas.getContext("2d");

const EXPORT_SIZES = {
  "1080x1080": [1080, 1080],
  "1080x1350": [1080, 1350],
  "1920x1080": [1920, 1080],
};

/* The whole cover: which look, which photos, how each panel frames its
   photo, and the words on the caption band. */
const cover = {
  preset: "sunset",
  photos: [],          // { img, name }
  panels: [],          // { photo, zoom, dx, dy } — one per shape
  selected: 0,
  caption: "LEONIDA HEAT",
  subtitle: "Two outlaws. One last score.",
  captionScale: 1,
  previewSize: "1920x1080",
};

/* ---------- shapes: polygons in 0..1 cover space ---------- */

function sunsetShapes() {
  return {
    band: { x: 0, y: 0.86, w: 1, h: 0.14 },
    panels: [
      // Hero: full width, top 56%.
      [[0, 0], [1, 0], [1, 0.56], [0, 0.56]],
      // Lower left: slants down to the right.
      [[0, 0.58], [0.42, 0.58], [0.38, 0.84], [0, 0.84]],
      // Lower right: the matching slant.
      [[0.44, 0.58], [1, 0.58], [1, 0.84], [0.40, 0.84]],
    ],
  };
}

function neonShapes() {
  return {
    band: { x: 0, y: 0, w: 1, h: 0.13 },
    panels: [
      [[0, 0.15], [0.44, 0.15], [0.44, 1], [0, 1]],
      [[0.46, 0.15], [1, 0.15], [1, 0.42], [0.46, 0.42]],
      [[0.46, 0.44], [1, 0.44], [1, 0.71], [0.46, 0.71]],
      [[0.46, 0.73], [1, 0.73], [1, 1], [0.46, 1]],
    ],
  };
}

function shapesFor(preset) {
  return preset === "neon" ? neonShapes() : sunsetShapes();
}

/* Ray-casting test: is point (x, y) inside polygon pts? Coordinates here
   are in the same space as the polygon (0..1 cover space). */
function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const crosses = (yi > y) !== (yj > y)
      && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/* Bounding box of a polygon, in 0..1 space — used for cover-fit math. */
function polyBox(pts) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function resetPanels() {
  const count = shapesFor(cover.preset).panels.length;
  // Each slot starts on a different slice of the photo, so a single photo
  // reads as a multi-panel poster rather than the same crop repeated.
  const framing = [
    { zoom: 1.0, dx: 0, dy: 0 },
    { zoom: 1.25, dx: 0, dy: -0.4 },
    { zoom: 1.25, dx: 0, dy: 0.4 },
    { zoom: 1.4, dx: -0.25, dy: 0 },
  ];
  cover.panels = Array.from({ length: count }, (_, i) => ({
    photo: cover.photos.length ? i % cover.photos.length : -1,
    zoom: framing[i].zoom,
    dx: framing[i].dx,
    dy: framing[i].dy,
  }));
  cover.selected = 0;
}

/* ---------- photos ---------- */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}

async function addPhoto(img, name) {
  if (cover.photos.length >= 3) cover.photos.shift();
  cover.photos.push({ img, name });
  cover.panels.forEach((p) => {
    if (p.photo < 0) p.photo = cover.photos.length - 1;
  });
  renderPreview();
  refreshChips();
  refreshPanelList();
}

async function loadSample(kind) {
  const file = kind === "pier" ? "pier.jpg" : "boulevard.jpg";
  const res = await fetch(`samples/${file}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    await addPhoto(await loadImage(url), file);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- drawing ---------- */

/* Draw one photo into a polygon panel, cover-fit, with the panel's
   pan/zoom applied. The photo is clipped to the polygon. */
function drawPhoto(c, img, poly, W, H, panel) {
  const box = polyBox(poly);
  const px = box.x * W, py = box.y * H, pw = box.w * W, ph = box.h * H;
  const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
  const s = base * panel.zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const cx = px + pw / 2 + panel.dx * pw * 0.4;
  const cy = py + ph / 2 + panel.dy * ph * 0.4;
  c.save();
  c.beginPath();
  poly.forEach(([x, y], i) => {
    if (i === 0) c.moveTo(x * W, y * H);
    else c.lineTo(x * W, y * H);
  });
  c.closePath();
  c.clip();
  c.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  c.restore();
}

function drawEmptyPanel(c, poly, W, H) {
  const box = polyBox(poly);
  const px = box.x * W, py = box.y * H, pw = box.w * W, ph = box.h * H;
  c.save();
  c.beginPath();
  poly.forEach(([x, y], i) => {
    if (i === 0) c.moveTo(x * W, y * H);
    else c.lineTo(x * W, y * H);
  });
  c.closePath();
  c.fillStyle = cover.preset === "neon" ? "#171738" : "#e8d9c8";
  c.fill();
  c.clip();
  c.fillStyle = cover.preset === "neon" ? "#5a5aa8" : "#9a8a76";
  c.font = `600 ${Math.max(12, ph * 0.09)}px system-ui, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("Add a photo", px + pw / 2, py + ph / 2);
  c.font = `400 ${Math.max(10, ph * 0.055)}px system-ui, sans-serif`;
  c.fillText("click a sample, or upload your own", px + pw / 2, py + ph / 2 + ph * 0.11);
  c.restore();
}

/* The colour grade for the current preset, painted over the panels. */
function drawGrade(c, W, H) {
  if (cover.preset === "neon") {
    const teal = c.createLinearGradient(0, 0, W, H);
    teal.addColorStop(0, "rgba(34, 230, 210, 0.30)");
    teal.addColorStop(1, "rgba(34, 230, 210, 0.05)");
    c.save();
    c.globalCompositeOperation = "screen";
    c.fillStyle = teal;
    c.fillRect(0, 0, W, H);
    c.restore();
    const mag = c.createLinearGradient(W, H, 0, 0);
    mag.addColorStop(0, "rgba(255, 46, 166, 0.30)");
    mag.addColorStop(1, "rgba(255, 46, 166, 0.04)");
    c.save();
    c.globalCompositeOperation = "screen";
    c.fillStyle = mag;
    c.fillRect(0, 0, W, H);
    c.restore();
    c.save();
    c.globalCompositeOperation = "multiply";
    c.fillStyle = "rgba(8, 8, 30, 0.18)";
    c.fillRect(0, 0, W, H);
    c.restore();
    return;
  }
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(255, 122, 26, 0.28)");
  g.addColorStop(0.55, "rgba(255, 77, 141, 0.22)");
  g.addColorStop(1, "rgba(94, 42, 168, 0.30)");
  c.save();
  c.globalCompositeOperation = "overlay";
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.restore();
  const warm = c.createLinearGradient(0, 0, 0, H);
  warm.addColorStop(0, "rgba(255, 190, 90, 0.10)");
  warm.addColorStop(1, "rgba(255, 90, 60, 0.14)");
  c.save();
  c.globalCompositeOperation = "soft-light";
  c.fillStyle = warm;
  c.fillRect(0, 0, W, H);
  c.restore();
}

function halftone(c, W, H) {
  c.save();
  c.globalAlpha = 0.07;
  c.fillStyle = "#000";
  const step = Math.max(6, Math.round(W / 220));
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      c.beginPath();
      c.arc(x, y, Math.max(1, step * 0.16), 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

function vignette(c, W, H) {
  const r = Math.hypot(W, H) / 2;
  const g = c.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.38)");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

/* The caption band: background strip, big Anton caption, subtitle line. */
function drawCaption(c, band, W, H) {
  const bx = band.x * W, by = band.y * H, bw = band.w * W, bh = band.h * H;
  if (cover.preset === "neon") {
    c.fillStyle = "#0a0a18";
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = "#ff2ea6";
    c.fillRect(bx, by + bh - Math.max(2, H * 0.004), bw, Math.max(2, H * 0.004));
  } else {
    const g = c.createLinearGradient(bx, by, bx + bw, by);
    g.addColorStop(0, "#2b1055");
    g.addColorStop(0.5, "#ff4d6d");
    g.addColorStop(1, "#ff7a1a");
    c.fillStyle = g;
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillRect(bx, by, bw, Math.max(2, H * 0.003));
  }
  const capSize = bh * 0.52 * cover.captionScale;
  c.save();
  c.font = `${capSize}px Anton, sans-serif`;
  try { c.letterSpacing = `${Math.round(capSize * 0.04)}px`; } catch {}
  // Long captions shrink to fit the band instead of spilling past it.
  const words = cover.caption.toUpperCase();
  const fit = Math.min(1, (bw * 0.94) / Math.max(1, c.measureText(words).width));
  if (fit < 1) {
    const shrunk = capSize * fit;
    c.font = `${shrunk}px Anton, sans-serif`;
    try { c.letterSpacing = `${Math.round(shrunk * 0.04)}px`; } catch {}
  }
  c.textAlign = "center";
  c.textBaseline = "middle";
  const cy = by + bh * 0.42;
  if (cover.preset === "neon") {
    c.shadowColor = "#ff2ea6";
    c.shadowBlur = capSize * 0.35;
    c.fillStyle = "#ffffff";
    c.fillText(words, bx + bw / 2, cy);
    c.shadowColor = "#22e6d2";
    c.shadowBlur = capSize * 0.18;
    c.fillText(words, bx + bw / 2, cy);
    c.shadowBlur = 0;
  } else {
    c.shadowColor = "rgba(0,0,0,0.45)";
    c.shadowBlur = capSize * 0.12;
    c.shadowOffsetY = capSize * 0.05;
    c.fillStyle = "#ffffff";
    c.fillText(words, bx + bw / 2, cy);
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
  }
  const subSize = Math.max(10, bh * 0.17);
  c.font = `600 ${subSize}px system-ui, sans-serif`;
  try { c.letterSpacing = `${Math.round(subSize * 0.12)}px`; } catch {}
  c.fillStyle = cover.preset === "neon" ? "#9ff5ea" : "rgba(255,255,255,0.92)";
  c.fillText(cover.subtitle, bx + bw / 2, by + bh * 0.82);
  c.restore();
}

/* Paint the whole cover onto context c at W x H pixels. */
function renderCover(c, W, H) {
  const shapes = shapesFor(cover.preset);
  const gutter = Math.max(3, Math.round(Math.min(W, H) * 0.006));
  c.fillStyle = cover.preset === "neon" ? "#0a0a18" : "#fff6ec";
  c.fillRect(0, 0, W, H);
  // Gutters: shrink every polygon a touch toward its own centre so the
  // paper backdrop shows through as thin white gaps between panels.
  shapes.panels.forEach((poly, i) => {
    const box = polyBox(poly);
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const gx = gutter / W, gy = gutter / H;
    const shrunk = poly.map(([x, y]) => [
      x + (x < cx ? gx : x > cx ? -gx : 0),
      y + (y < cy ? gy : y > cy ? -gy : 0),
    ]);
    const slot = cover.panels[i];
    const photo = slot && slot.photo >= 0 ? cover.photos[slot.photo] : null;
    if (photo) drawPhoto(c, photo.img, shrunk, W, H, slot);
    else drawEmptyPanel(c, shrunk, W, H);
    if (cover.preset === "neon") {
      c.save();
      c.beginPath();
      shrunk.forEach(([x, y], k) => {
        if (k === 0) c.moveTo(x * W, y * H);
        else c.lineTo(x * W, y * H);
      });
      c.closePath();
      c.strokeStyle = "rgba(255,46,166,0.55)";
      c.lineWidth = Math.max(1, H * 0.002);
      c.stroke();
      c.restore();
    }
  });
  drawGrade(c, W, H);
  halftone(c, W, H);
  vignette(c, W, H);
  drawCaption(c, shapes.band, W, H);
}

/* ---------- preview ---------- */

function renderPreview() {
  const [W, H] = EXPORT_SIZES[cover.previewSize];
  canvas.width = W;
  canvas.height = H;
  renderCover(ctx, W, H);
}

/* ---------- export ---------- */

function exportPNG(sizeKey) {
  const [W, H] = EXPORT_SIZES[sizeKey];
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  renderCover(off.getContext("2d"), W, H);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leonida-cover-${sizeKey}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve({ width: W, height: H, bytes: blob.size });
    }, "image/png");
  });
}

/* ---------- editor UI ---------- */

function refreshChips() {
  const box = $("photoChips");
  box.innerHTML = "";
  cover.photos.forEach((p, i) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = `${i + 1} · ${p.name}`;
    chip.title = "Assign this photo to the selected panel";
    chip.addEventListener("click", () => {
      cover.panels[cover.selected].photo = i;
      renderPreview();
      refreshPanelList();
    });
    box.appendChild(chip);
  });
}

function refreshPanelList() {
  const box = $("panelList");
  box.innerHTML = "";
  shapesFor(cover.preset).panels.forEach((_, i) => {
    const slot = cover.panels[i];
    const name = slot && slot.photo >= 0 ? cover.photos[slot.photo].name : "Empty";
    const btn = document.createElement("button");
    btn.className = "panel-item" + (i === cover.selected ? " is-selected" : "");
    btn.type = "button";
    const label = document.createElement("span");
    label.textContent = `Panel ${i + 1}`;
    const small = document.createElement("small");
    small.textContent = name;
    btn.append(label, small);
    btn.addEventListener("click", () => {
      cover.selected = i;
      syncSliders();
      renderPreview();
      refreshPanelList();
    });
    box.appendChild(btn);
  });
}

function syncSliders() {
  const slot = cover.panels[cover.selected];
  if (!slot) return;
  $("zoomRange").value = slot.zoom;
  $("zoomValue").textContent = `${slot.zoom.toFixed(2)}×`;
  $("panXRange").value = Math.round(slot.dx * 100);
  $("panXValue").textContent = Math.round(slot.dx * 100);
  $("panYRange").value = Math.round(slot.dy * 100);
  $("panYValue").textContent = Math.round(slot.dy * 100);
}

function setPreset(preset) {
  cover.preset = preset;
  document.body.dataset.preset = preset;
  $("presetSunset").classList.toggle("is-active", preset === "sunset");
  $("presetNeon").classList.toggle("is-active", preset === "neon");
  $("presetSunset").setAttribute("aria-pressed", String(preset === "sunset"));
  $("presetNeon").setAttribute("aria-pressed", String(preset === "neon"));
  resetPanels();
  renderPreview();
  refreshPanelList();
}

/* ---------- pointer: click a panel to select it, drag to pan ---------- */

let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  const shapes = shapesFor(cover.preset);
  const hit = shapes.panels.findIndex((poly) => pointInPoly(x, y, poly));
  if (hit < 0) return;
  cover.selected = hit;
  syncSliders();
  refreshPanelList();
  const slot = cover.panels[hit];
  const box = polyBox(shapes.panels[hit]);
  drag = { x: e.clientX - r.left, y: e.clientY - r.top, dx: slot.dx, dy: slot.dy, w: box.w * r.width, h: box.h * r.height };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const r = canvas.getBoundingClientRect();
  const slot = cover.panels[cover.selected];
  slot.dx = Math.max(-1, Math.min(1, drag.dx + (e.clientX - r.left - drag.x) / drag.w / 0.4));
  slot.dy = Math.max(-1, Math.min(1, drag.dy + (e.clientY - r.top - drag.y) / drag.h / 0.4));
  renderPreview();
  syncSliders();
});
canvas.addEventListener("pointerup", () => { drag = null; });

/* ---------- wire up the controls ---------- */

$("photoInput").addEventListener("change", async (e) => {
  for (const file of e.target.files) {
    const url = URL.createObjectURL(file);
    try {
      await addPhoto(await loadImage(url), file.name);
    } catch { /* skip files that cannot be read as images */ }
    finally { URL.revokeObjectURL(url); }
  }
  e.target.value = "";
});
$("sampleBoulevard").addEventListener("click", () => loadSample("boulevard"));
$("samplePier").addEventListener("click", () => loadSample("pier"));
$("presetSunset").addEventListener("click", () => setPreset("sunset"));
$("presetNeon").addEventListener("click", () => setPreset("neon"));
$("captionInput").addEventListener("input", (e) => { cover.caption = e.target.value; renderPreview(); });
$("subtitleInput").addEventListener("input", (e) => { cover.subtitle = e.target.value; renderPreview(); });
$("sizeRange").addEventListener("input", (e) => {
  cover.captionScale = Number(e.target.value) / 100;
  $("sizeValue").textContent = `${e.target.value}%`;
  renderPreview();
});
$("zoomRange").addEventListener("input", (e) => {
  cover.panels[cover.selected].zoom = Number(e.target.value);
  renderPreview();
  syncSliders();
});
$("panXRange").addEventListener("input", (e) => {
  cover.panels[cover.selected].dx = Number(e.target.value) / 100;
  renderPreview();
  syncSliders();
});
$("panYRange").addEventListener("input", (e) => {
  cover.panels[cover.selected].dy = Number(e.target.value) / 100;
  renderPreview();
  syncSliders();
});
document.querySelectorAll(".export-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const size = btn.dataset.size;
    cover.previewSize = size;
    renderPreview();
    await exportPNG(size);
  });
});

/* ---------- deterministic staging via URL params ---------- */

async function applyShotParams() {
  const q = new URLSearchParams(location.search);
  const preset = q.get("preset");
  if (preset === "sunset" || preset === "neon") setPreset(preset);
  const caption = q.get("caption");
  if (caption !== null) { cover.caption = caption; $("captionInput").value = caption; }
  const subtitle = q.get("subtitle");
  if (subtitle !== null) { cover.subtitle = subtitle; $("subtitleInput").value = subtitle; }
  const size = q.get("size");
  if (size && EXPORT_SIZES[size]) cover.previewSize = size;
  const photo = q.get("photo");
  if (photo === "boulevard" || photo === "pier") await loadSample(photo);
  if (q.get("shot") === "cover") {
    document.body.classList.add("cover-mode");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderCover(ctx, canvas.width, canvas.height);
    return;
  }
  renderPreview();
}

/* Test hook for the headless verification driver (not part of the UI). */
window.__leonida = {
  state: cover,
  exportPNG,
  renderCover,
  loadSample,
  setPreset,
  pointInPoly,
  shapesFor,
};

window.addEventListener("resize", () => {
  if (!document.body.classList.contains("cover-mode")) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  renderCover(ctx, canvas.width, canvas.height);
});

/* ---------- init ---------- */
resetPanels();
refreshPanelList();
syncSliders();
try { await document.fonts.load("40px Anton"); await document.fonts.ready; } catch {}
await applyShotParams();
