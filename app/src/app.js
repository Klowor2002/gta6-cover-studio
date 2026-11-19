// Vice City Nights — Leonida Cover Studio
// Turns photos + a caption into multi-panel GTA-style poster covers.
// Pure canvas 2D, no libraries, no network. Two presets ship in one app:
// "Vice Sunset" (3-panel diagonal collage) and "Neon Nights" (4-panel grid).

const SIZES = {
  "1080x1080": { w: 1080, h: 1080 },
  "1080x1350": { w: 1080, h: 1350 },
  "1920x1080": { w: 1920, h: 1080 },
};

const stage = document.getElementById("stage");
const ctx = stage.getContext("2d");

const state = {
  preset: "sunset",
  sizeKey: "1920x1080",
  photos: [], // { img, key }
  panels: [], // per-panel { photo, panX, panY, zoom }
  selected: 0,
  caption: "VICE CITY NIGHTS",
  subtitle: "Welcome back to Leonida",
  captionScale: 1,
};

function blankPanel(photo) {
  return { photo, panX: 0, panY: 0, zoom: 1 };
}

function resetPanels() {
  const count = state.preset === "sunset" ? 3 : 4;
  const old = state.panels;
  state.panels = [];
  for (let i = 0; i < count; i++) {
    const p = old[i] || blankPanel(i);
    p.photo = Math.min(p.photo, Math.max(0, state.photos.length - 1));
    state.panels.push(p);
  }
  state.selected = Math.min(state.selected, count - 1);
}

// ---------- panel geometry (fractions of the canvas) ----------

function sunsetPanels() {
  // Diagonal collage: one hero panel left, two stacked right, slanted cuts.
  return [
    { poly: [[0, 0], [0.605, 0], [0.52, 1], [0, 1]] },
    { poly: [[0.648, 0], [1, 0], [1, 0.482], [0.598, 0.482]] },
    { poly: [[0.572, 0.518], [1, 0.518], [1, 1], [0.492, 1]] },
  ];
}

function neonPanels() {
  const g = 0.014; // gutter, as a fraction
  const w = 0.5 - g / 2, h = 0.5 - g / 2;
  const rect = (x, y) => ({ poly: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] });
  return [rect(0, 0), rect(0.5 + g / 2, 0), rect(0, 0.5 + g / 2), rect(0.5 + g / 2, 0.5 + g / 2)];
}

function panelShapes() {
  return state.preset === "sunset" ? sunsetPanels() : neonPanels();
}

function panelBox(shape) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const [x, y] of shape.poly) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function tracePath(c, shape, W, H) {
  c.beginPath();
  shape.poly.forEach(([fx, fy], i) => {
    if (i === 0) c.moveTo(fx * W, fy * H); else c.lineTo(fx * W, fy * H);
  });
  c.closePath();
}

// ---------- drawing ----------

function drawPhoto(c, img, box, W, H, panel) {
  const bw = box.w * W, bh = box.h * H;
  const scale = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const dx = box.x * W + (bw - dw) / 2 + panel.panX * bw;
  const dy = box.y * H + (bh - dh) / 2 + panel.panY * bh;
  c.drawImage(img, dx, dy, dw, dh);
}

function drawPlaceholder(c, box, W, H, index) {
  const sunsets = [["#ff9a3d", "#e83e8c"], ["#e83e8c", "#7b2ff7"], ["#ffb347", "#d6336c"]];
  const neons = [["#0b3d4a", "#12b5a5"], ["#3d0b3a", "#c218a8"], ["#0a2e4a", "#1e88c7"], ["#2e0a3d", "#7b2ff7"]];
  const [a, b] = (state.preset === "sunset" ? sunsets : neons)[index % 4];
  const grad = c.createLinearGradient(box.x * W, box.y * H, (box.x + box.w) * W, (box.y + box.h) * H);
  grad.addColorStop(0, a); grad.addColorStop(1, b);
  c.fillStyle = grad;
  c.fillRect(box.x * W, box.y * H, box.w * W, box.h * H);
  c.fillStyle = "rgba(255,255,255,0.20)";
  c.font = `${Math.round(box.h * H * 0.5)}px Anton, sans-serif`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(String(index + 1), (box.x + box.w / 2) * W, (box.y + box.h / 2) * H);
}

function gradePanel(c, box, W, H) {
  const x = box.x * W, y = box.y * H, w = box.w * W, h = box.h * H;
  const grad = c.createLinearGradient(x, y, x + w * 0.3, y + h);
  if (state.preset === "sunset") {
    grad.addColorStop(0, "rgba(255,138,42,0.30)");
    grad.addColorStop(0.45, "rgba(255,64,140,0.16)");
    grad.addColorStop(1, "rgba(46,10,92,0.38)");
  } else {
    grad.addColorStop(0, "rgba(46,230,200,0.15)");
    grad.addColorStop(0.55, "rgba(20,10,40,0.10)");
    grad.addColorStop(1, "rgba(255,47,150,0.22)");
  }
  c.fillStyle = grad;
  c.fillRect(x, y, w, h);
}

function halftone(c, W, H) {
  const step = Math.max(14, W * 0.014);
  c.fillStyle = "rgba(255,255,255,0.055)";
  let row = 0;
  for (let y = step / 2; y < H; y += step, row++) {
    for (let x = (row % 2 ? step / 2 : 0) + step / 2; x < W; x += step) {
      c.beginPath();
      c.arc(x, y, step * 0.16, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function vignette(c, W, H) {
  const r = Math.hypot(W, H) / 2;
  const grad = c.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
  grad.addColorStop(0, "rgba(8,3,18,0)");
  grad.addColorStop(1, state.preset === "sunset" ? "rgba(8,3,18,0.36)" : "rgba(4,2,12,0.52)");
  c.fillStyle = grad;
  c.fillRect(0, 0, W, H);
}

function fitFontSize(c, text, base, maxWidth, family) {
  let size = base;
  c.font = `${size}px ${family}`;
  const width = c.measureText(text).width;
  if (width > maxWidth) size = Math.floor(size * (maxWidth / width));
  c.font = `${size}px ${family}`;
  return size;
}

function drawCaption(c, W, H) {
  const caption = (state.caption || "").toUpperCase();
  const subtitle = state.subtitle || "";
  const bandH = H * 0.205;
  const bandY = H - bandH;

  if (state.preset === "sunset") {
    c.fillStyle = "rgba(14,6,26,0.90)";
    c.fillRect(0, bandY, W, bandH);
    const line = c.createLinearGradient(0, bandY, W, bandY);
    line.addColorStop(0, "#ff8a2a"); line.addColorStop(0.5, "#ff4fa3"); line.addColorStop(1, "#7b2ff7");
    c.fillStyle = line;
    c.fillRect(0, bandY, W, Math.max(3, H * 0.007));
  }

  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  try { c.letterSpacing = `${Math.round(W * 0.004)}px`; } catch { /* older engines */ }

  const capBase = H * 0.104 * state.captionScale;
  if (state.preset === "neon") {
    const size = fitFontSize(c, caption, capBase, W * 0.92, "Anton, sans-serif");
    const cy = bandY + bandH * 0.58;
    c.shadowColor = "rgba(46,230,200,0.9)"; c.shadowBlur = H * 0.028;
    c.fillStyle = "#0b2b33";
    c.fillText(caption, W / 2 - W * 0.0022, cy);
    c.shadowColor = "rgba(255,47,150,0.95)";
    c.fillStyle = "#330b26";
    c.fillText(caption, W / 2 + W * 0.0022, cy);
    c.shadowBlur = H * 0.012;
    c.fillStyle = "#f2fffc";
    c.fillText(caption, W / 2, cy);
    c.shadowBlur = 0;
    if (subtitle) {
      c.font = `600 ${Math.round(H * 0.030)}px "Segoe UI", system-ui, sans-serif`;
      c.fillStyle = "#7dfbe9";
      c.shadowColor = "rgba(46,230,200,0.8)"; c.shadowBlur = H * 0.012;
      c.fillText(subtitle, W / 2, cy + H * 0.052);
      c.shadowBlur = 0;
    }
    void size;
  } else {
    fitFontSize(c, caption, capBase, W * 0.92, "Anton, sans-serif");
    const cy = bandY + bandH * 0.60;
    c.shadowColor = "rgba(0,0,0,0.55)"; c.shadowBlur = H * 0.008; c.shadowOffsetY = H * 0.004;
    c.fillStyle = "#ffffff";
    c.fillText(caption, W / 2, cy);
    c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetY = 0;
    if (subtitle) {
      c.font = `600 ${Math.round(H * 0.030)}px "Segoe UI", system-ui, sans-serif`;
      try { c.letterSpacing = `${Math.round(W * 0.006)}px`; } catch { /* ignore */ }
      c.fillStyle = "#ffd9ec";
      c.fillText(subtitle, W / 2, cy + H * 0.054);
    }
  }
  try { c.letterSpacing = "0px"; } catch { /* ignore */ }
}

function render(forExport = false) {
  const { w: W, h: H } = SIZES[state.sizeKey];
  if (stage.width !== W || stage.height !== H) { stage.width = W; stage.height = H; }

  ctx.fillStyle = state.preset === "sunset" ? "#f5efe6" : "#07040f";
  ctx.fillRect(0, 0, W, H);

  const shapes = panelShapes();
  shapes.forEach((shape, i) => {
    const panel = state.panels[i];
    const box = panelBox(shape);
    ctx.save();
    tracePath(ctx, shape, W, H);
    ctx.clip();
    const photo = state.photos[Math.min(panel.photo, Math.max(0, state.photos.length - 1))];
    if (photo) drawPhoto(ctx, photo.img, box, W, H, panel);
    else drawPlaceholder(ctx, box, W, H, i);
    gradePanel(ctx, box, W, H);
    ctx.restore();
  });

  if (state.preset === "sunset") halftone(ctx, W, H);
  vignette(ctx, W, H);
  drawCaption(ctx, W, H);

  if (!forExport) {
    const shape = shapes[state.selected];
    if (shape) {
      ctx.save();
      tracePath(ctx, shape, W, H);
      ctx.strokeStyle = "#2ee6c8";
      ctx.lineWidth = Math.max(3, W * 0.0035);
      ctx.shadowColor = "rgba(46,230,200,0.8)";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }
  }
  syncPanelUi();
}

// ---------- controls ----------

const $ = (id) => document.getElementById(id);
const zoomInput = $("zoom");
const panelLabel = $("panel-label");

function syncPanelUi() {
  panelLabel.textContent = `Panel ${state.selected + 1} of ${state.panels.length}`;
  const p = state.panels[state.selected];
  if (p && document.activeElement !== zoomInput) zoomInput.value = String(p.zoom);
  document.querySelectorAll(".photo-strip button").forEach((btn, i) => {
    btn.classList.toggle("assigned", p && p.photo === i);
  });
}

function setPreset(name) {
  state.preset = name;
  document.body.dataset.preset = name;
  $("preset-sunset").classList.toggle("active", name === "sunset");
  $("preset-neon").classList.toggle("active", name === "neon");
  resetPanels();
  render();
}

$("preset-sunset").addEventListener("click", () => setPreset("sunset"));
$("preset-neon").addEventListener("click", () => setPreset("neon"));

function addPhoto(img, key) {
  const found = state.photos.findIndex((p) => p.key === key);
  if (found >= 0) return found;
  state.photos.push({ img, key });
  if (state.photos.length > 3) state.photos.splice(0, state.photos.length - 3);
  buildStrip();
  return state.photos.length - 1;
}

function buildStrip() {
  const strip = $("photo-strip");
  strip.innerHTML = "";
  state.photos.forEach((photo, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = `Put photo ${i + 1} in the selected panel`;
    const thumb = document.createElement("img");
    thumb.src = photo.img.src;
    thumb.alt = `Photo ${i + 1}`;
    btn.appendChild(thumb);
    btn.addEventListener("click", () => {
      state.panels[state.selected].photo = i;
      render();
    });
    strip.appendChild(btn);
  });
}

function loadSample(name) {
  const key = `sample:${name}`;
  const existing = state.photos.findIndex((p) => p.key === key);
  if (existing >= 0) {
    state.panels[state.selected].photo = existing;
    render();
    return;
  }
  const img = new Image();
  img.onload = () => {
    const idx = addPhoto(img, key);
    state.panels[state.selected].photo = idx;
    render();
  };
  img.src = `samples/${name}.jpg`;
}

$("sample-boulevard").addEventListener("click", () => loadSample("boulevard"));
$("sample-pier").addEventListener("click", () => loadSample("pier"));

$("file-input").addEventListener("change", (event) => {
  const files = [...event.target.files].slice(0, 3);
  if (!files.length) return;
  state.photos = [];
  state.panels.forEach((p) => { p.photo = 0; p.panX = 0; p.panY = 0; p.zoom = 1; });
  let loaded = 0;
  files.forEach((file, i) => {
    const img = new Image();
    img.onload = () => {
      state.photos[i] = { img, key: `upload:${file.name}` };
      loaded++;
      if (loaded === files.length) {
        state.photos = state.photos.filter(Boolean);
        buildStrip();
        render();
      }
    };
    img.src = URL.createObjectURL(file);
  });
  event.target.value = "";
});

zoomInput.addEventListener("input", () => {
  state.panels[state.selected].zoom = Number(zoomInput.value);
  render();
});

$("caption").addEventListener("input", (e) => { state.caption = e.target.value; render(); });
$("subtitle").addEventListener("input", (e) => { state.subtitle = e.target.value; render(); });
$("caption-size").addEventListener("input", (e) => { state.captionScale = Number(e.target.value); render(); });

// ---------- canvas interaction: select + drag to pan ----------

function canvasPoint(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

let drag = null;

stage.addEventListener("pointerdown", (event) => {
  const pt = canvasPoint(event);
  const shapes = panelShapes();
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (pointInPoly(pt.x, pt.y, shapes[i].poly)) {
      state.selected = i;
      const p = state.panels[i];
      drag = { x: event.clientX, y: event.clientY, panX: p.panX, panY: p.panY, box: panelBox(shapes[i]) };
      try { stage.setPointerCapture(event.pointerId); } catch { /* synthetic events have no active pointer */ }
      stage.classList.add("dragging");
      render();
      break;
    }
  }
});

stage.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const rect = stage.getBoundingClientRect();
  const p = state.panels[state.selected];
  p.panX = drag.panX + (event.clientX - drag.x) / (rect.width * drag.box.w);
  p.panY = drag.panY + (event.clientY - drag.y) / (rect.height * drag.box.h);
  render();
});

const endDrag = () => { drag = null; stage.classList.remove("dragging"); };
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

// Scroll over the canvas zooms the selected panel; double-click cycles
// which loaded photo fills it.
stage.addEventListener("wheel", (event) => {
  event.preventDefault();
  const p = state.panels[state.selected];
  const step = event.deltaY < 0 ? 1.06 : 1 / 1.06;
  p.zoom = Math.min(3, Math.max(1, p.zoom * step));
  render();
}, { passive: false });

stage.addEventListener("dblclick", (event) => {
  if (state.photos.length < 2) return;
  const pt = canvasPoint(event);
  const shapes = panelShapes();
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (pointInPoly(pt.x, pt.y, shapes[i].poly)) {
      state.selected = i;
      const p = state.panels[i];
      p.photo = (p.photo + 1) % state.photos.length;
      render();
      break;
    }
  }
});

// ---------- export ----------

document.querySelectorAll(".export-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.sizeKey = btn.dataset.size;
    render(true);
    stage.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vice-city-nights-${state.sizeKey}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      render();
    }, "image/png");
  });
});

// ---------- deterministic staging + boot ----------

function applyStaging() {
  const q = new URLSearchParams(location.search);
  if (q.get("shot") === "cover") document.body.classList.add("shot-cover");
  if (q.get("caption")) { state.caption = q.get("caption"); $("caption").value = state.caption; }
  if (q.get("subtitle")) { state.subtitle = q.get("subtitle"); $("subtitle").value = state.subtitle; }
  const size = q.get("size");
  if (size && SIZES[size]) state.sizeKey = size;
  const preset = q.get("preset");
  if (preset === "neon" || preset === "sunset") setPreset(preset);
  const photo = q.get("photo");
  if (photo === "boulevard" || photo === "pier") loadSample(photo);
}

resetPanels();
document.body.dataset.preset = state.preset;
applyStaging();
render();
if (document.fonts && document.fonts.load) {
  document.fonts.load('80px Anton').then(() => render()).catch(() => {});
}
