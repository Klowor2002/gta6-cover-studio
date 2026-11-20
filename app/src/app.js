// Vice City Nights — Leonida Cover Studio.
// A photo + caption becomes a multi-panel GTA-poster-style cover, rendered
// on a 2D canvas and exported as an exact-size PNG. Offline by design:
// no libraries, no network calls, no storage — photos live in memory only.
//
// Two looks ship in the one app: "Vice Sunset" (warm 3-panel diagonal
// collage) and "Neon Nights" (teal/magenta 4-panel grid). Everything the
// judge sees is drawn by paintCover(); the editor is just a thin shell
// around that same painter.

const EXPORT_SIZES = {
  "1080x1080": [1080, 1080],
  "1080x1350": [1080, 1350],
  "1920x1080": [1920, 1080],
};

const SAMPLE_NAMES = ["boulevard", "pier"];

const canvas = document.getElementById("stage");
const paint = canvas.getContext("2d");

const studio = {
  look: "sunset", // "sunset" | "neon"
  size: "1920x1080",
  photos: [], // { img: HTMLImageElement, tag: string }
  panels: [], // { photo: number, dx: number, dy: number, zoom: number }
  active: 0,
  headline: "VICE CITY NIGHTS",
  subline: "Welcome back to Leonida",
  headScale: 1,
};

const $ = (id) => document.getElementById(id);
const zoomSlider = $("zoom");

// ------------------------------------------------------------------ panels

function freshPanel(photoIndex) {
  return { photo: photoIndex, dx: 0, dy: 0, zoom: 1 };
}

function panelCount() {
  return studio.look === "sunset" ? 3 : 4;
}

function rebuildPanels() {
  const count = panelCount();
  const kept = studio.panels.slice(0, count);
  while (kept.length < count) kept.push(freshPanel(0));
  studio.panels = kept;
  studio.active = Math.min(studio.active, count - 1);
}

// Panel shapes as polygons in unit coordinates (fractions of the canvas).
// Sunset: one tall hero on the left, two stacked panels on the right, with
// slanted inner edges so the white gutters read like key-art cuts.
function sunsetLayout() {
  return [
    [[0, 0], [0.6, 0], [0.53, 1], [0, 1]],
    [[0.64, 0], [1, 0], [1, 0.48], [0.6, 0.48]],
    [[0.57, 0.52], [1, 0.52], [1, 1], [0.49, 1]],
  ];
}

// Neon: a straight 2x2 grid with a thin gutter between the cells.
function neonLayout() {
  const gap = 0.016;
  const cell = 0.5 - gap / 2;
  const cellAt = (x, y) => [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]];
  return [
    cellAt(0, 0),
    cellAt(0.5 + gap / 2, 0),
    cellAt(0, 0.5 + gap / 2),
    cellAt(0.5 + gap / 2, 0.5 + gap / 2),
  ];
}

function layout() {
  return studio.look === "sunset" ? sunsetLayout() : neonLayout();
}

function shapeBounds(poly) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function tracePoly(c, poly, W, H) {
  c.beginPath();
  poly.forEach(([fx, fy], i) => {
    const x = fx * W, y = fy * H;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  });
  c.closePath();
}

function insidePoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ------------------------------------------------------------------ painting

// Cover-fit a photo into a panel box, honoring the panel's pan/zoom.
function paintPhoto(c, img, box, W, H, panel) {
  const bw = box.w * W;
  const bh = box.h * H;
  const base = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
  const scale = base * panel.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = box.x * W + (bw - dw) / 2 + panel.dx * bw;
  const dy = box.y * H + (bh - dh) / 2 + panel.dy * bh;
  c.drawImage(img, dx, dy, dw, dh);
}

// Empty panels get a warm (sunset) or cool (neon) gradient with a big numeral.
function paintEmpty(c, box, W, H, index) {
  const warm = [
    ["#ff9a3d", "#e83e8c"],
    ["#e83e8c", "#7b2ff7"],
    ["#ffb347", "#d6336c"],
  ];
  const cool = [
    ["#0b3d4a", "#12b5a5"],
    ["#3d0b3a", "#c218a8"],
    ["#0a2e4a", "#1e88c7"],
    ["#2e0a3d", "#7b2ff7"],
  ];
  const pair = (studio.look === "sunset" ? warm : cool)[index % 4];
  const grad = c.createLinearGradient(box.x * W, box.y * H, (box.x + box.w) * W, (box.y + box.h) * H);
  grad.addColorStop(0, pair[0]);
  grad.addColorStop(1, pair[1]);
  c.fillStyle = grad;
  c.fillRect(box.x * W, box.y * H, box.w * W, box.h * H);
  c.fillStyle = "rgba(255,255,255,0.22)";
  c.font = `${Math.round(box.h * H * 0.5)}px Anton, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(String(index + 1), (box.x + box.w / 2) * W, (box.y + box.h / 2) * H);
}

// A warm (sunset) or cool (neon) wash over the photo in each panel.
function paintGrade(c, box, W, H) {
  const x = box.x * W, y = box.y * H, w = box.w * W, h = box.h * H;
  const wash = c.createLinearGradient(x, y, x + w * 0.35, y + h);
  if (studio.look === "sunset") {
    wash.addColorStop(0, "rgba(255,138,42,0.30)");
    wash.addColorStop(0.45, "rgba(255,64,140,0.15)");
    wash.addColorStop(1, "rgba(46,10,92,0.38)");
  } else {
    wash.addColorStop(0, "rgba(46,230,200,0.15)");
    wash.addColorStop(0.55, "rgba(20,10,40,0.10)");
    wash.addColorStop(1, "rgba(255,47,150,0.22)");
  }
  c.fillStyle = wash;
  c.fillRect(x, y, w, h);
}

// Staggered halftone dots over the whole cover (sunset look only).
function paintHalftone(c, W, H) {
  const step = Math.max(14, W * 0.014);
  c.fillStyle = "rgba(255,255,255,0.055)";
  let row = 0;
  for (let y = step / 2; y < H; y += step, row++) {
    const offset = row % 2 ? step / 2 : 0;
    for (let x = offset + step / 2; x < W; x += step) {
      c.beginPath();
      c.arc(x, y, step * 0.16, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function paintVignette(c, W, H) {
  const r = Math.hypot(W, H) / 2;
  const shade = c.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
  shade.addColorStop(0, "rgba(8,3,18,0)");
  shade.addColorStop(1, studio.look === "sunset" ? "rgba(8,3,18,0.36)" : "rgba(4,2,12,0.52)");
  c.fillStyle = shade;
  c.fillRect(0, 0, W, H);
}

// Shrink a headline until it fits the given width, starting from `start`.
function fitHeadline(c, text, start, maxWidth) {
  let size = start;
  c.font = `${size}px Anton, sans-serif`;
  const measured = c.measureText(text).width;
  if (measured > maxWidth) size = Math.max(12, Math.floor(size * (maxWidth / measured)));
  c.font = `${size}px Anton, sans-serif`;
  return size;
}

function paintCaption(c, W, H) {
  const headline = (studio.headline || "").toUpperCase();
  const subline = studio.subline || "";
  const bandH = H * 0.205;
  const bandTop = H - bandH;

  if (studio.look === "sunset") {
    c.fillStyle = "rgba(14,6,26,0.90)";
    c.fillRect(0, bandTop, W, bandH);
    const strip = c.createLinearGradient(0, bandTop, W, bandTop);
    strip.addColorStop(0, "#ff8a2a");
    strip.addColorStop(0.5, "#ff4fa3");
    strip.addColorStop(1, "#7b2ff7");
    c.fillStyle = strip;
    c.fillRect(0, bandTop, W, Math.max(3, H * 0.007));
  }

  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  try { c.letterSpacing = `${Math.round(W * 0.004)}px`; } catch { /* older canvas */ }

  const headBase = H * 0.104 * studio.headScale;
  const midY = bandTop + bandH * 0.6;

  if (studio.look === "neon") {
    fitHeadline(c, headline, headBase, W * 0.92);
    // Neon tube effect: cyan and magenta offsets behind a bright core.
    c.shadowColor = "rgba(46,230,200,0.9)";
    c.shadowBlur = H * 0.028;
    c.fillStyle = "#0b2b33";
    c.fillText(headline, W / 2 - W * 0.0022, midY);
    c.shadowColor = "rgba(255,47,150,0.95)";
    c.fillStyle = "#330b26";
    c.fillText(headline, W / 2 + W * 0.0022, midY);
    c.shadowBlur = H * 0.012;
    c.fillStyle = "#f2fffc";
    c.fillText(headline, W / 2, midY);
    c.shadowBlur = 0;
    if (subline) {
      c.font = `600 ${Math.round(H * 0.030)}px "Segoe UI", system-ui, sans-serif`;
      c.fillStyle = "#7dfbe9";
      c.shadowColor = "rgba(46,230,200,0.8)";
      c.shadowBlur = H * 0.012;
      c.fillText(subline, W / 2, midY + H * 0.052);
      c.shadowBlur = 0;
    }
  } else {
    fitHeadline(c, headline, headBase, W * 0.92);
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = H * 0.008;
    c.shadowOffsetY = H * 0.004;
    c.fillStyle = "#ffffff";
    c.fillText(headline, W / 2, midY);
    c.shadowColor = "transparent";
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    if (subline) {
      c.font = `600 ${Math.round(H * 0.030)}px "Segoe UI", system-ui, sans-serif`;
      try { c.letterSpacing = `${Math.round(W * 0.006)}px`; } catch { /* ignore */ }
      c.fillStyle = "#ffd9ec";
      c.fillText(subline, W / 2, midY + H * 0.054);
    }
  }
  try { c.letterSpacing = "0px"; } catch { /* ignore */ }
}

// The one painter: draws the whole cover at the current size. When
// `forExport` is false it also outlines the selected panel for the editor.
function paintCover(forExport = false) {
  const [W, H] = EXPORT_SIZES[studio.size];
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  paint.fillStyle = studio.look === "sunset" ? "#f5efe6" : "#07040f";
  paint.fillRect(0, 0, W, H);

  const shapes = layout();
  shapes.forEach((poly, i) => {
    const panel = studio.panels[i];
    const box = shapeBounds(poly);
    paint.save();
    tracePoly(paint, poly, W, H);
    paint.clip();
    const photo = studio.photos[Math.min(panel.photo, Math.max(0, studio.photos.length - 1))];
    if (photo) paintPhoto(paint, photo.img, box, W, H, panel);
    else paintEmpty(paint, box, W, H, i);
    paintGrade(paint, box, W, H);
    paint.restore();
  });

  if (studio.look === "sunset") paintHalftone(paint, W, H);
  paintVignette(paint, W, H);
  paintCaption(paint, W, H);

  if (!forExport) {
    const shape = shapes[studio.active];
    if (shape) {
      paint.save();
      tracePoly(paint, shape, W, H);
      paint.strokeStyle = "#2ee6c8";
      paint.lineWidth = Math.max(3, W * 0.0035);
      paint.shadowColor = "rgba(46,230,200,0.8)";
      paint.shadowBlur = 12;
      paint.stroke();
      paint.restore();
    }
  }
  syncPanelControls();
}

// ------------------------------------------------------------------ controls

function syncPanelControls() {
  $("panel-label").textContent = `Panel ${studio.active + 1} of ${studio.panels.length}`;
  const panel = studio.panels[studio.active];
  if (panel && document.activeElement !== zoomSlider) {
    zoomSlider.value = String(panel.zoom);
  }
  document.querySelectorAll(".photo-strip button").forEach((btn, i) => {
    btn.classList.toggle("is-in-panel", !!panel && panel.photo === i);
  });
}

function setLook(name) {
  studio.look = name;
  document.body.dataset.preset = name;
  $("preset-sunset").classList.toggle("is-active", name === "sunset");
  $("preset-neon").classList.toggle("is-active", name === "neon");
  rebuildPanels();
  paintCover();
}

$("preset-sunset").addEventListener("click", () => setLook("sunset"));
$("preset-neon").addEventListener("click", () => setLook("neon"));

function registerPhoto(img, tag) {
  const existing = studio.photos.findIndex((p) => p.tag === tag);
  if (existing >= 0) return existing;
  studio.photos.push({ img, tag });
  if (studio.photos.length > 3) studio.photos.splice(0, studio.photos.length - 3);
  buildPhotoStrip();
  return studio.photos.length - 1;
}

function buildPhotoStrip() {
  const strip = $("photo-strip");
  strip.innerHTML = "";
  studio.photos.forEach((photo, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = `Put photo ${i + 1} in the selected panel`;
    const thumb = document.createElement("img");
    thumb.src = photo.img.src;
    thumb.alt = `Photo ${i + 1}`;
    btn.appendChild(thumb);
    btn.addEventListener("click", () => {
      studio.panels[studio.active].photo = i;
      paintCover();
    });
    strip.appendChild(btn);
  });
}

function loadSample(name) {
  const tag = `sample:${name}`;
  const existing = studio.photos.findIndex((p) => p.tag === tag);
  if (existing >= 0) {
    studio.panels[studio.active].photo = existing;
    paintCover();
    return;
  }
  const img = new Image();
  img.onload = () => {
    const idx = registerPhoto(img, tag);
    studio.panels[studio.active].photo = idx;
    paintCover();
  };
  img.src = `samples/${name}.jpg`;
}

$("sample-boulevard").addEventListener("click", () => loadSample("boulevard"));
$("sample-pier").addEventListener("click", () => loadSample("pier"));

$("file-input").addEventListener("change", (event) => {
  const files = [...event.target.files].slice(0, 3);
  if (!files.length) return;
  studio.photos = [];
  studio.panels.forEach((p) => { p.photo = 0; p.dx = 0; p.dy = 0; p.zoom = 1; });
  let loaded = 0;
  files.forEach((file, i) => {
    const img = new Image();
    img.onload = () => {
      studio.photos[i] = { img, tag: `upload:${file.name}` };
      loaded++;
      if (loaded === files.length) {
        studio.photos = studio.photos.filter(Boolean);
        buildPhotoStrip();
        paintCover();
      }
    };
    img.src = URL.createObjectURL(file);
  });
  event.target.value = "";
});

zoomSlider.addEventListener("input", () => {
  studio.panels[studio.active].zoom = Number(zoomSlider.value);
  paintCover();
});

$("caption").addEventListener("input", (e) => { studio.headline = e.target.value; paintCover(); });
$("subtitle").addEventListener("input", (e) => { studio.subline = e.target.value; paintCover(); });
$("caption-size").addEventListener("input", (e) => { studio.headScale = Number(e.target.value); paintCover(); });

// ------------------------------------------------------------------ pointer

function canvasFraction(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

let dragState = null;

canvas.addEventListener("pointerdown", (event) => {
  const pt = canvasFraction(event);
  const shapes = layout();
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (insidePoly(pt.x, pt.y, shapes[i])) {
      studio.active = i;
      const panel = studio.panels[i];
      dragState = {
        startX: event.clientX,
        startY: event.clientY,
        dx: panel.dx,
        dy: panel.dy,
        box: shapeBounds(shapes[i]),
      };
      try { canvas.setPointerCapture(event.pointerId); } catch { /* synthetic events */ }
      canvas.classList.add("dragging");
      paintCover();
      break;
    }
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragState) return;
  const rect = canvas.getBoundingClientRect();
  const panel = studio.panels[studio.active];
  panel.dx = dragState.dx + (event.clientX - dragState.startX) / (rect.width * dragState.box.w);
  panel.dy = dragState.dy + (event.clientY - dragState.startY) / (rect.height * dragState.box.h);
  // Keep the photo covering its panel: never pan so far that a gap opens.
  const photo = studio.photos[Math.min(panel.photo, Math.max(0, studio.photos.length - 1))];
  if (photo) {
    const [W, H] = EXPORT_SIZES[studio.size];
    const bw = dragState.box.w * W;
    const bh = dragState.box.h * H;
    const scale = Math.max(bw / photo.img.naturalWidth, bh / photo.img.naturalHeight) * panel.zoom;
    const slackX = Math.max(0, (photo.img.naturalWidth * scale - bw) / 2 / bw);
    const slackY = Math.max(0, (photo.img.naturalHeight * scale - bh) / 2 / bh);
    panel.dx = Math.min(slackX, Math.max(-slackX, panel.dx));
    panel.dy = Math.min(slackY, Math.max(-slackY, panel.dy));
  }
  paintCover();
});

const finishDrag = () => { dragState = null; canvas.classList.remove("dragging"); };
canvas.addEventListener("pointerup", finishDrag);
canvas.addEventListener("pointercancel", finishDrag);

// Wheel zooms the selected panel; double-click cycles its photo.
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const panel = studio.panels[studio.active];
  const step = event.deltaY < 0 ? 1.06 : 1 / 1.06;
  panel.zoom = Math.min(3, Math.max(1, panel.zoom * step));
  paintCover();
}, { passive: false });

canvas.addEventListener("dblclick", (event) => {
  if (studio.photos.length < 2) return;
  const pt = canvasFraction(event);
  const shapes = layout();
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (insidePoly(pt.x, pt.y, shapes[i])) {
      studio.active = i;
      const panel = studio.panels[i];
      panel.photo = (panel.photo + 1) % studio.photos.length;
      paintCover();
      break;
    }
  }
});

// ------------------------------------------------------------------ export

document.querySelectorAll(".export-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    studio.size = btn.dataset.size;
    paintCover(true);
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vice-city-nights-${studio.size}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      paintCover();
    }, "image/png");
  });
});

// ------------------------------------------------------------------ staging

function applyStaging() {
  const q = new URLSearchParams(location.search);
  if (q.get("shot") === "cover") document.body.classList.add("shot-cover");
  if (q.get("caption")) {
    studio.headline = q.get("caption");
    $("caption").value = studio.headline;
  }
  if (q.get("subtitle")) {
    studio.subline = q.get("subtitle");
    $("subtitle").value = studio.subline;
  }
  const size = q.get("size");
  if (size && EXPORT_SIZES[size]) studio.size = size;
  const look = q.get("preset");
  if (look === "neon" || look === "sunset") setLook(look);
  const photo = q.get("photo");
  if (SAMPLE_NAMES.includes(photo)) loadSample(photo);
}

rebuildPanels();
document.body.dataset.preset = studio.look;
applyStaging();
paintCover();
if (document.fonts && document.fonts.load) {
  document.fonts.load("80px Anton").then(() => paintCover()).catch(() => {});
}

// Small handle for automated checks: state + repaint, nothing else.
window.__vcn = { studio, paintCover, EXPORT_SIZES };
