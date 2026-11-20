/* Leonida Cover Studio — canvas cover renderer + editor.
   Original design: "horizon" layout for Vice Sunset (full-width hero on top,
   two panels below, caption band along the bottom) and "tower" layout for
   Neon Nights (tall left panel, three stacked right, glowing caption strip
   on top). Pure canvas 2D, no libraries, no network at run time. */

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const sctx = stage.getContext("2d");

const SIZES = {
  "1080x1080": [1080, 1080],
  "1080x1350": [1080, 1350],
  "1920x1080": [1920, 1080],
};

const state = {
  preset: "sunset",
  photos: [],            // { img, name } — in memory only
  panels: [],           // { photo, zoom, dx, dy } per layout slot
  selected: 0,
  caption: "LEONIDA HEAT",
  subtitle: "Two outlaws. One last score.",
  captionScale: 1,
  previewSize: "1920x1080",
};

/* ---------- layouts: rects in 0..1 cover space ---------- */
function layoutFor(preset) {
  if (preset === "neon") {
    // Tower: caption strip on top, tall panel left, three stacked right.
    return {
      band: { x: 0, y: 0, w: 1, h: 0.13 },
      panels: [
        { x: 0.0, y: 0.15, w: 0.44, h: 0.85 },
        { x: 0.46, y: 0.15, w: 0.54, h: 0.27 },
        { x: 0.46, y: 0.44, w: 0.54, h: 0.27 },
        { x: 0.46, y: 0.73, w: 0.54, h: 0.27 },
      ],
    };
  }
  // Horizon: hero across the top, two panels below, band along the bottom.
  return {
    band: { x: 0, y: 0.86, w: 1, h: 0.14 },
    panels: [
      { x: 0.0, y: 0.0, w: 1.0, h: 0.56 },
      { x: 0.0, y: 0.58, w: 0.4, h: 0.26 },
      { x: 0.42, y: 0.58, w: 0.58, h: 0.26 },
    ],
  };
}

function resetPanels() {
  const n = layoutFor(state.preset).panels.length;
  // Default framing per slot: the hero shows the whole photo, the smaller
  // panels each show a different slice of it, so one photo reads as a
  // multi-panel poster instead of four copies of the same crop.
  const framing = [
    { zoom: 1.0, dx: 0, dy: 0 },
    { zoom: 1.2, dx: 0, dy: -0.35 },
    { zoom: 1.2, dx: 0, dy: 0.35 },
    { zoom: 1.35, dx: -0.2, dy: 0 },
  ];
  state.panels = Array.from({ length: n }, (_, i) => ({
    photo: state.photos.length ? i % state.photos.length : -1,
    zoom: framing[i].zoom,
    dx: framing[i].dx,
    dy: framing[i].dy,
  }));
  state.selected = 0;
}

/* ---------- photo helpers ---------- */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not load image"));
    img.src = src;
  });
}

async function addPhoto(img, name) {
  if (state.photos.length >= 3) state.photos.shift();
  state.photos.push({ img, name });
  // Fill empty panels with the new photo, keep existing assignments.
  state.panels.forEach((p) => {
    if (p.photo < 0) p.photo = state.photos.length - 1;
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
    const img = await loadImage(url);
    await addPhoto(img, file);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- drawing ---------- */
function drawPhotoInto(ctx, img, rect, panel) {
  const px = rect.x, py = rect.y, pw = rect.w, ph = rect.h;
  const base = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
  const s = base * panel.zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const cx = px + pw / 2 + panel.dx * pw * 0.4;
  const cy = py + ph / 2 + panel.dy * ph * 0.4;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function gradeSunset(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(255, 122, 26, 0.28)");
  g.addColorStop(0.55, "rgba(255, 77, 141, 0.22)");
  g.addColorStop(1, "rgba(94, 42, 168, 0.30)");
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const warm = ctx.createLinearGradient(0, 0, 0, H);
  warm.addColorStop(0, "rgba(255, 190, 90, 0.10)");
  warm.addColorStop(1, "rgba(255, 90, 60, 0.14)");
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function gradeNeon(ctx, W, H) {
  const teal = ctx.createLinearGradient(0, 0, W, H);
  teal.addColorStop(0, "rgba(34, 230, 210, 0.30)");
  teal.addColorStop(1, "rgba(34, 230, 210, 0.05)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = teal;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const mag = ctx.createLinearGradient(W, H, 0, 0);
  mag.addColorStop(0, "rgba(255, 46, 166, 0.30)");
  mag.addColorStop(1, "rgba(255, 46, 166, 0.04)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = mag;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(8, 8, 30, 0.18)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function halftone(ctx, W, H) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#000";
  const step = Math.max(6, Math.round(W / 220));
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, step * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function vignette(ctx, W, H) {
  const r = Math.hypot(W, H) / 2;
  const g = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawBand(ctx, band, W, H) {
  const bx = band.x * W, by = band.y * H, bw = band.w * W, bh = band.h * H;
  if (state.preset === "neon") {
    ctx.fillStyle = "#0a0a18";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#ff2ea6";
    ctx.fillRect(bx, by + bh - Math.max(2, H * 0.004), bw, Math.max(2, H * 0.004));
  } else {
    const g = ctx.createLinearGradient(bx, by, bx + bw, by);
    g.addColorStop(0, "#2b1055");
    g.addColorStop(0.5, "#ff4d6d");
    g.addColorStop(1, "#ff7a1a");
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(bx, by, bw, Math.max(2, H * 0.003));
  }
  // Caption, centred in the band.
  const capSize = bh * 0.52 * state.captionScale;
  ctx.save();
  ctx.font = `${capSize}px Anton, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(capSize * 0.04)}px`; } catch {}
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cy = by + bh * 0.42;
  if (state.preset === "neon") {
    ctx.shadowColor = "#ff2ea6";
    ctx.shadowBlur = capSize * 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(state.caption.toUpperCase(), bx + bw / 2, cy);
    ctx.shadowColor = "#22e6d2";
    ctx.shadowBlur = capSize * 0.18;
    ctx.fillText(state.caption.toUpperCase(), bx + bw / 2, cy);
    ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = capSize * 0.12;
    ctx.shadowOffsetY = capSize * 0.05;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(state.caption.toUpperCase(), bx + bw / 2, cy);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  // Subtitle, smaller, under the caption.
  const subSize = Math.max(10, bh * 0.17);
  ctx.font = `600 ${subSize}px system-ui, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(subSize * 0.12)}px`; } catch {}
  ctx.fillStyle = state.preset === "neon" ? "#9ff5ea" : "rgba(255,255,255,0.92)";
  ctx.fillText(state.subtitle, bx + bw / 2, by + bh * 0.82);
  ctx.restore();
}

function renderCover(ctx, W, H) {
  const layout = layoutFor(state.preset);
  const gutter = Math.max(3, Math.round(Math.min(W, H) * 0.006));
  // Backdrop: warm paper for sunset, deep navy for neon.
  ctx.fillStyle = state.preset === "neon" ? "#0a0a18" : "#fff6ec";
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < layout.panels.length; i++) {
    const p = layout.panels[i];
    const rect = {
      x: p.x * W + gutter,
      y: p.y * H + gutter,
      w: p.w * W - gutter * 2,
      h: p.h * H - gutter * 2,
    };
    const slot = state.panels[i];
    const photo = slot && slot.photo >= 0 ? state.photos[slot.photo] : null;
    if (photo) {
      drawPhotoInto(ctx, photo.img, rect, slot);
    } else {
      ctx.fillStyle = state.preset === "neon" ? "#171738" : "#e8d9c8";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = state.preset === "neon" ? "#3d3d7a" : "#9a8a76";
      ctx.font = `600 ${Math.max(12, rect.h * 0.09)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Add a photo", rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    if (state.preset === "neon") {
      ctx.strokeStyle = "rgba(255,46,166,0.55)";
      ctx.lineWidth = Math.max(1, H * 0.002);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  }
  if (state.preset === "sunset") gradeSunset(ctx, W, H);
  else gradeNeon(ctx, W, H);
  halftone(ctx, W, H);
  vignette(ctx, W, H);
  drawBand(ctx, layout.band, W, H);
}

/* ---------- preview ---------- */
function renderPreview() {
  const [W, H] = SIZES[state.previewSize];
  stage.width = W;
  stage.height = H;
  renderCover(sctx, W, H);
}

function previewRects() {
  const layout = layoutFor(state.preset);
  const rect = stage.getBoundingClientRect();
  const scaleX = rect.width / stage.width;
  const scaleY = rect.height / stage.height;
  return layout.panels.map((p) => ({
    x: p.x * rect.width,
    y: p.y * rect.height,
    w: p.w * rect.width,
    h: p.h * rect.height,
    scaleX, scaleY,
  }));
}

/* ---------- export ---------- */
function exportPNG(sizeKey) {
  const [W, H] = SIZES[sizeKey];
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
  state.photos.forEach((p, i) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = `${i + 1} · ${p.name}`;
    chip.title = "Assign this photo to the selected panel";
    chip.addEventListener("click", () => {
      state.panels[state.selected].photo = i;
      renderPreview();
      refreshPanelList();
    });
    box.appendChild(chip);
  });
}

function refreshPanelList() {
  const box = $("panelList");
  box.innerHTML = "";
  layoutFor(state.preset).panels.forEach((_, i) => {
    const slot = state.panels[i];
    const name = slot && slot.photo >= 0 ? state.photos[slot.photo].name : "Empty";
    const btn = document.createElement("button");
    btn.className = "panel-item" + (i === state.selected ? " is-selected" : "");
    btn.type = "button";
    const label = document.createElement("span");
    label.textContent = `Panel ${i + 1}`;
    const small = document.createElement("small");
    small.textContent = name;
    btn.append(label, small);
    btn.addEventListener("click", () => {
      state.selected = i;
      syncSliders();
      renderPreview();
      refreshPanelList();
    });
    box.appendChild(btn);
  });
}

function syncSliders() {
  const slot = state.panels[state.selected];
  if (!slot) return;
  $("zoomRange").value = slot.zoom;
  $("zoomValue").textContent = `${slot.zoom.toFixed(2)}×`;
  $("panXRange").value = Math.round(slot.dx * 100);
  $("panXValue").textContent = Math.round(slot.dx * 100);
  $("panYRange").value = Math.round(slot.dy * 100);
  $("panYValue").textContent = Math.round(slot.dy * 100);
}

function setPreset(preset) {
  state.preset = preset;
  document.body.dataset.preset = preset;
  $("presetSunset").classList.toggle("is-active", preset === "sunset");
  $("presetNeon").classList.toggle("is-active", preset === "neon");
  $("presetSunset").setAttribute("aria-pressed", String(preset === "sunset"));
  $("presetNeon").setAttribute("aria-pressed", String(preset === "neon"));
  resetPanels();
  renderPreview();
  refreshPanelList();
}

/* ---------- pointer: select + drag to pan ---------- */
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  const rects = previewRects();
  const r = stage.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const hit = rects.findIndex((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
  if (hit < 0) return;
  state.selected = hit;
  syncSliders();
  refreshPanelList();
  const slot = state.panels[hit];
  drag = { x, y, dx: slot.dx, dy: slot.dy, rect: rects[hit] };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const r = stage.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const slot = state.panels[state.selected];
  slot.dx = Math.max(-1, Math.min(1, drag.dx + (x - drag.x) / drag.rect.w / 0.4));
  slot.dy = Math.max(-1, Math.min(1, drag.dy + (y - drag.y) / drag.rect.h / 0.4));
  renderPreview();
  syncSliders();
});
stage.addEventListener("pointerup", () => { drag = null; });

/* ---------- wire up controls ---------- */
$("photoInput").addEventListener("change", async (e) => {
  for (const file of e.target.files) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      await addPhoto(img, file.name);
    } catch { /* skip unreadable files */ }
    finally { URL.revokeObjectURL(url); }
  }
  e.target.value = "";
});
$("sampleBoulevard").addEventListener("click", () => loadSample("boulevard"));
$("samplePier").addEventListener("click", () => loadSample("pier"));
$("presetSunset").addEventListener("click", () => setPreset("sunset"));
$("presetNeon").addEventListener("click", () => setPreset("neon"));
$("captionInput").addEventListener("input", (e) => { state.caption = e.target.value; renderPreview(); });
$("subtitleInput").addEventListener("input", (e) => { state.subtitle = e.target.value; renderPreview(); });
$("sizeRange").addEventListener("input", (e) => {
  state.captionScale = Number(e.target.value) / 100;
  $("sizeValue").textContent = `${e.target.value}%`;
  renderPreview();
});
$("zoomRange").addEventListener("input", (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  renderPreview();
  syncSliders();
});
$("panXRange").addEventListener("input", (e) => {
  state.panels[state.selected].dx = Number(e.target.value) / 100;
  renderPreview();
  syncSliders();
});
$("panYRange").addEventListener("input", (e) => {
  state.panels[state.selected].dy = Number(e.target.value) / 100;
  renderPreview();
  syncSliders();
});
document.querySelectorAll(".export-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const size = btn.dataset.size;
    state.previewSize = size;
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
  if (caption !== null) { state.caption = caption; $("captionInput").value = caption; }
  const subtitle = q.get("subtitle");
  if (subtitle !== null) { state.subtitle = subtitle; $("subtitleInput").value = subtitle; }
  const size = q.get("size");
  if (size && SIZES[size]) state.previewSize = size;
  const photo = q.get("photo");
  if (photo === "boulevard" || photo === "pier") await loadSample(photo);
  if (q.get("shot") === "cover") {
    document.body.classList.add("cover-mode");
    stage.width = window.innerWidth;
    stage.height = window.innerHeight;
    renderCover(sctx, stage.width, stage.height);
    return;
  }
  renderPreview();
}

/* ---------- test hook for the CDP driver (not part of the UI) ---------- */
window.__leonida = {
  state,
  exportPNG,
  renderCover,
  loadSample,
  setPreset,
};

/* Keep a full-viewport cover filling the window if it is resized. */
window.addEventListener("resize", () => {
  if (!document.body.classList.contains("cover-mode")) return;
  stage.width = window.innerWidth;
  stage.height = window.innerHeight;
  renderCover(sctx, stage.width, stage.height);
});

/* ---------- init ---------- */
resetPanels();
refreshPanelList();
syncSliders();
try { await document.fonts.load('40px Anton'); await document.fonts.ready; } catch {}
await applyShotParams();
