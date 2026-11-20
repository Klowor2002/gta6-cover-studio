// Vice City Nights — Leonida Cover Studio.
//
// Photos + a caption become a multi-panel GTA-poster-style cover, painted
// on a 2D canvas and exported as an exact-size PNG. The app is fully
// offline: no libraries, no network requests, no storage — every photo
// lives in memory and never leaves the machine.
//
// Two looks ship in the one app: "Vice Sunset" (a warm 3-panel diagonal
// collage) and "Neon Nights" (a teal/magenta 4-panel grid). One painter,
// renderCover(), draws both; the editor chrome only drives its state.

const SIZES = {
  "1080x1080": [1080, 1080],
  "1080x1350": [1080, 1350],
  "1920x1080": [1920, 1080],
};

const SAMPLES = ["boulevard", "pier"];

const stage = document.getElementById("cover-canvas");
const ctx = stage.getContext("2d");

const cover = {
  look: "sunset", // "sunset" | "neon"
  sizeKey: "1920x1080",
  images: [], // { el: HTMLImageElement, label: string }
  cells: [], // { photo: number, ox: number, oy: number, zoom: number }
  selected: 0,
  title: "VICE CITY NIGHTS",
  tagline: "Welcome back to Leonida",
  titleScale: 1,
};

const byId = (id) => document.getElementById(id);
const zoomInput = byId("panel-zoom");

// ------------------------------------------------------------------ cells

function blankCell(photo) {
  return { photo, ox: 0, oy: 0, zoom: 1 };
}

function cellCount() {
  return cover.look === "sunset" ? 3 : 4;
}

function syncCells() {
  const n = cellCount();
  const keep = cover.cells.slice(0, n);
  while (keep.length < n) keep.push(blankCell(0));
  cover.cells = keep;
  cover.selected = Math.min(cover.selected, n - 1);
}

// Cell outlines as polygons in unit space (fractions of the canvas).
// Sunset: a tall hero on the left and two stacked cells on the right,
// with slanted inner edges and white gutters, like poster key art.
function sunsetShapes() {
  return [
    [[0, 0], [0.58, 0], [0.51, 1], [0, 1]],
    [[0.62, 0], [1, 0], [1, 0.47], [0.58, 0.47]],
    [[0.55, 0.51], [1, 0.51], [1, 1], [0.47, 1]],
  ];
}

// Neon: a plain 2x2 grid with a narrow gutter between the cells.
function neonShapes() {
  const gap = 0.02;
  const side = 0.5 - gap / 2;
  const quad = (x, y) => [[x, y], [x + side, y], [x + side, y + side], [x, y + side]];
  return [
    quad(0, 0),
    quad(0.5 + gap / 2, 0),
    quad(0, 0.5 + gap / 2),
    quad(0.5 + gap / 2, 0.5 + gap / 2),
  ];
}

function shapes() {
  return cover.look === "sunset" ? sunsetShapes() : neonShapes();
}

function polyBox(poly) {
  let loX = 1, loY = 1, hiX = 0, hiY = 0;
  for (const [x, y] of poly) {
    if (x < loX) loX = x;
    if (x > hiX) hiX = x;
    if (y < loY) loY = y;
    if (y > hiY) hiY = y;
  }
  return { x: loX, y: loY, w: hiX - loX, h: hiY - loY };
}

function trace(c, poly, W, H) {
  c.beginPath();
  poly.forEach(([fx, fy], i) => {
    const x = fx * W, y = fy * H;
    if (i === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  });
  c.closePath();
}

// Ray-casting point-in-polygon, for picking the cell under the pointer.
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const crosses = (yi > py) !== (yj > py)
      && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

// ------------------------------------------------------------------ painting

// Cover-fit a photo into a cell box, honoring the cell's pan and zoom.
function drawPhoto(c, img, box, W, H, cell) {
  const bw = box.w * W;
  const bh = box.h * H;
  const fit = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
  const scale = fit * cell.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = box.x * W + (bw - dw) / 2 + cell.ox * bw;
  const dy = box.y * H + (bh - dh) / 2 + cell.oy * bh;
  c.drawImage(img, dx, dy, dw, dh);
}

// A cell with no photo yet: a warm or cool gradient and a big numeral.
function drawEmptyCell(c, box, W, H, index) {
  const warmPairs = [
    ["#ff9a3d", "#e83e8c"],
    ["#e83e8c", "#7b2ff7"],
    ["#ffb347", "#d6336c"],
  ];
  const coolPairs = [
    ["#0b3d4a", "#12b5a5"],
    ["#3d0b3a", "#c218a8"],
    ["#0a2e4a", "#1e88c7"],
    ["#2e0a3d", "#7b2ff7"],
  ];
  const [from, to] = (cover.look === "sunset" ? warmPairs : coolPairs)[index % 4];
  const grad = c.createLinearGradient(box.x * W, box.y * H, (box.x + box.w) * W, (box.y + box.h) * H);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  c.fillStyle = grad;
  c.fillRect(box.x * W, box.y * H, box.w * W, box.h * H);
  c.fillStyle = "rgba(255,255,255,0.22)";
  c.font = `${Math.round(box.h * H * 0.5)}px Anton, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(String(index + 1), (box.x + box.w / 2) * W, (box.y + box.h / 2) * H);
  // A small nudge under the numeral so an empty panel explains itself.
  c.fillStyle = "rgba(255,255,255,0.75)";
  c.font = `600 ${Math.max(14, Math.round(box.h * H * 0.045))}px "Segoe UI", system-ui, sans-serif`;
  c.fillText("ADD A PHOTO", (box.x + box.w / 2) * W, (box.y + box.h / 2 + box.h * H * 0.32) * H);
}

// A warm (sunset) or cool (neon) wash over the photo inside a cell.
function drawGrade(c, box, W, H) {
  const x = box.x * W, y = box.y * H, w = box.w * W, h = box.h * H;
  const wash = c.createLinearGradient(x, y, x + w * 0.4, y + h);
  if (cover.look === "sunset") {
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

// Staggered halftone dots across the whole cover (sunset look only).
function drawHalftone(c, W, H) {
  const step = Math.max(14, W * 0.014);
  c.fillStyle = "rgba(255,255,255,0.055)";
  let row = 0;
  for (let y = step / 2; y < H; y += step, row++) {
    const shift = row % 2 ? step / 2 : 0;
    for (let x = shift + step / 2; x < W; x += step) {
      c.beginPath();
      c.arc(x, y, step * 0.16, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function drawVignette(c, W, H) {
  const radius = Math.hypot(W, H) / 2;
  const shade = c.createRadialGradient(W / 2, H / 2, radius * 0.45, W / 2, H / 2, radius);
  shade.addColorStop(0, "rgba(8,3,18,0)");
  shade.addColorStop(1, cover.look === "sunset" ? "rgba(8,3,18,0.36)" : "rgba(4,2,12,0.52)");
  c.fillStyle = shade;
  c.fillRect(0, 0, W, H);
}

// Fit the headline to the available width, shrinking from `start` if needed.
function fitTitle(c, text, start, maxWidth) {
  let size = start;
  c.font = `${size}px Anton, sans-serif`;
  const measured = c.measureText(text).width;
  if (measured > maxWidth) size = Math.max(12, Math.floor(size * (maxWidth / measured)));
  c.font = `${size}px Anton, sans-serif`;
  return size;
}

function drawCaption(c, W, H) {
  const title = (cover.title || "").toUpperCase();
  const tagline = cover.tagline || "";
  const bandH = H * 0.205;
  const bandTop = H - bandH;

  if (cover.look === "sunset") {
    c.fillStyle = "rgba(14,6,26,0.90)";
    c.fillRect(0, bandTop, W, bandH);
    const stripe = c.createLinearGradient(0, bandTop, W, bandTop);
    stripe.addColorStop(0, "#ff8a2a");
    stripe.addColorStop(0.5, "#ff4fa3");
    stripe.addColorStop(1, "#7b2ff7");
    c.fillStyle = stripe;
    c.fillRect(0, bandTop, W, Math.max(3, H * 0.007));
  }

  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  try { c.letterSpacing = `${Math.round(W * 0.004)}px`; } catch { /* older canvas */ }

  const baseSize = H * 0.104 * cover.titleScale;
  const centerY = bandTop + bandH * 0.6;

  if (cover.look === "neon") {
    fitTitle(c, title, baseSize, W * 0.92);
    // Neon tube effect: cyan and magenta ghosts behind a bright core.
    c.shadowColor = "rgba(46,230,200,0.9)";
    c.shadowBlur = H * 0.028;
    c.fillStyle = "#0b2b33";
    c.fillText(title, W / 2 - W * 0.0022, centerY);
    c.shadowColor = "rgba(255,47,150,0.95)";
    c.fillStyle = "#330b26";
    c.fillText(title, W / 2 + W * 0.0022, centerY);
    c.shadowBlur = H * 0.012;
    c.fillStyle = "#f2fffc";
    c.fillText(title, W / 2, centerY);
    c.shadowBlur = 0;
    if (tagline) {
      c.font = `600 ${Math.round(H * 0.030)}px "Segoe UI", system-ui, sans-serif`;
      c.fillStyle = "#7dfbe9";
      c.shadowColor = "rgba(46,230,200,0.8)";
      c.shadowBlur = H * 0.012;
      c.fillText(tagline, W / 2, centerY + H * 0.052);
      c.shadowBlur = 0;
    }
  } else {
    fitTitle(c, title, baseSize, W * 0.92);
    c.shadowColor = "rgba(0,0,0,0.55)";
    c.shadowBlur = H * 0.008;
    c.shadowOffsetY = H * 0.004;
    c.fillStyle = "#ffffff";
    c.fillText(title, W / 2, centerY);
    c.shadowColor = "transparent";
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
    if (tagline) {
      c.font = `600 ${Math.round(H * 0.030)}px "Segoe UI", system-ui, sans-serif`;
      try { c.letterSpacing = `${Math.round(W * 0.006)}px`; } catch { /* ignore */ }
      c.fillStyle = "#ffd9ec";
      c.fillText(tagline, W / 2, centerY + H * 0.054);
    }
  }
  try { c.letterSpacing = "0px"; } catch { /* ignore */ }
}

// The one painter: draws the whole cover at the current size. In editor
// mode it also outlines the selected cell so the user can see it.
function renderCover(forExport = false) {
  const [W, H] = SIZES[cover.sizeKey];
  if (stage.width !== W || stage.height !== H) {
    stage.width = W;
    stage.height = H;
  }

  ctx.fillStyle = cover.look === "sunset" ? "#f5efe6" : "#07040f";
  ctx.fillRect(0, 0, W, H);

  const polys = shapes();
  polys.forEach((poly, i) => {
    const cell = cover.cells[i];
    const box = polyBox(poly);
    ctx.save();
    trace(ctx, poly, W, H);
    ctx.clip();
    const photo = cover.images[Math.min(cell.photo, Math.max(0, cover.images.length - 1))];
    if (photo) drawPhoto(ctx, photo.el, box, W, H, cell);
    else drawEmptyCell(ctx, box, W, H, i);
    drawGrade(ctx, box, W, H);
    ctx.restore();
  });

  if (cover.look === "sunset") drawHalftone(ctx, W, H);
  drawVignette(ctx, W, H);
  drawCaption(ctx, W, H);

  if (!forExport) {
    const shape = polys[cover.selected];
    if (shape) {
      ctx.save();
      trace(ctx, shape, W, H);
      ctx.strokeStyle = "#2ee6c8";
      ctx.lineWidth = Math.max(3, W * 0.0035);
      ctx.shadowColor = "rgba(46,230,200,0.8)";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }
  }
  refreshPanelUI();
}

// ------------------------------------------------------------------ controls

function refreshPanelUI() {
  byId("panel-readout").textContent = `Panel ${cover.selected + 1} of ${cover.cells.length}`;
  const cell = cover.cells[cover.selected];
  if (cell && document.activeElement !== zoomInput) {
    zoomInput.value = String(cell.zoom);
  }
  document.querySelectorAll(".photo-rack button").forEach((btn, i) => {
    btn.classList.toggle("in-use", !!cell && cell.photo === i);
  });
}

function setLook(name) {
  cover.look = name;
  document.body.dataset.look = name;
  byId("look-sunset").classList.toggle("is-on", name === "sunset");
  byId("look-neon").classList.toggle("is-on", name === "neon");
  syncCells();
  renderCover();
}

byId("look-sunset").addEventListener("click", () => setLook("sunset"));
byId("look-neon").addEventListener("click", () => setLook("neon"));

function addPhoto(img, label) {
  const found = cover.images.findIndex((p) => p.label === label);
  if (found >= 0) return found;
  cover.images.push({ el: img, label });
  if (cover.images.length > 3) cover.images.splice(0, cover.images.length - 3);
  buildRack();
  return cover.images.length - 1;
}

function buildRack() {
  const rack = byId("photo-rack");
  rack.innerHTML = "";
  cover.images.forEach((photo, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = `Put photo ${i + 1} in the selected panel`;
    const thumb = document.createElement("img");
    thumb.src = photo.el.src;
    thumb.alt = `Photo ${i + 1}`;
    btn.appendChild(thumb);
    btn.addEventListener("click", () => {
      cover.cells[cover.selected].photo = i;
      renderCover();
    });
    rack.appendChild(btn);
  });
}

function loadSample(name) {
  const label = `sample:${name}`;
  const found = cover.images.findIndex((p) => p.label === label);
  if (found >= 0) {
    cover.cells[cover.selected].photo = found;
    renderCover();
    return;
  }
  const img = new Image();
  img.onload = () => {
    const idx = addPhoto(img, label);
    cover.cells[cover.selected].photo = idx;
    renderCover();
  };
  img.src = `samples/${name}.jpg`;
}

byId("try-boulevard").addEventListener("click", () => loadSample("boulevard"));
byId("try-pier").addEventListener("click", () => loadSample("pier"));

byId("photo-files").addEventListener("change", (event) => {
  const files = [...event.target.files].slice(0, 3);
  if (!files.length) return;
  cover.images = [];
  cover.cells.forEach((cell) => { cell.photo = 0; cell.ox = 0; cell.oy = 0; cell.zoom = 1; });
  let done = 0;
  files.forEach((file, i) => {
    const img = new Image();
    img.onload = () => {
      cover.images[i] = { el: img, label: `upload:${file.name}` };
      done++;
      if (done === files.length) {
        cover.images = cover.images.filter(Boolean);
        buildRack();
        renderCover();
      }
    };
    img.src = URL.createObjectURL(file);
  });
  event.target.value = "";
});

zoomInput.addEventListener("input", () => {
  cover.cells[cover.selected].zoom = Number(zoomInput.value);
  renderCover();
});

byId("headline").addEventListener("input", (e) => { cover.title = e.target.value; renderCover(); });
byId("tagline").addEventListener("input", (e) => { cover.tagline = e.target.value; renderCover(); });
byId("headline-scale").addEventListener("input", (e) => { cover.titleScale = Number(e.target.value); renderCover(); });

// ------------------------------------------------------------------ pointer

function pointerFraction(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

let drag = null;

stage.addEventListener("pointerdown", (event) => {
  const pt = pointerFraction(event);
  const polys = shapes();
  for (let i = polys.length - 1; i >= 0; i--) {
    if (pointInPoly(pt.x, pt.y, polys[i])) {
      cover.selected = i;
      const cell = cover.cells[i];
      drag = {
        fromX: event.clientX,
        fromY: event.clientY,
        ox: cell.ox,
        oy: cell.oy,
        box: polyBox(polys[i]),
      };
      try { stage.setPointerCapture(event.pointerId); } catch { /* synthetic events */ }
      stage.classList.add("panning");
      renderCover();
      break;
    }
  }
});

stage.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const rect = stage.getBoundingClientRect();
  const cell = cover.cells[cover.selected];
  cell.ox = drag.ox + (event.clientX - drag.fromX) / (rect.width * drag.box.w);
  cell.oy = drag.oy + (event.clientY - drag.fromY) / (rect.height * drag.box.h);
  // Keep the photo covering its cell: never pan so far that a gap opens.
  const photo = cover.images[Math.min(cell.photo, Math.max(0, cover.images.length - 1))];
  if (photo) {
    const [W, H] = SIZES[cover.sizeKey];
    const bw = drag.box.w * W;
    const bh = drag.box.h * H;
    const fit = Math.max(bw / photo.el.naturalWidth, bh / photo.el.naturalHeight) * cell.zoom;
    const slackX = Math.max(0, (photo.el.naturalWidth * fit - bw) / 2 / bw);
    const slackY = Math.max(0, (photo.el.naturalHeight * fit - bh) / 2 / bh);
    cell.ox = Math.min(slackX, Math.max(-slackX, cell.ox));
    cell.oy = Math.min(slackY, Math.max(-slackY, cell.oy));
  }
  renderCover();
});

const endDrag = () => { drag = null; stage.classList.remove("panning"); };
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

// Wheel zooms the selected cell; double-click cycles its photo.
stage.addEventListener("wheel", (event) => {
  event.preventDefault();
  const cell = cover.cells[cover.selected];
  const step = event.deltaY < 0 ? 1.06 : 1 / 1.06;
  cell.zoom = Math.min(3, Math.max(1, cell.zoom * step));
  renderCover();
}, { passive: false });

stage.addEventListener("dblclick", (event) => {
  if (cover.images.length < 2) return;
  const pt = pointerFraction(event);
  const polys = shapes();
  for (let i = polys.length - 1; i >= 0; i--) {
    if (pointInPoly(pt.x, pt.y, polys[i])) {
      cover.selected = i;
      const cell = cover.cells[i];
      cell.photo = (cell.photo + 1) % cover.images.length;
      renderCover();
      break;
    }
  }
});

// ------------------------------------------------------------------ export

document.querySelectorAll(".export").forEach((btn) => {
  btn.addEventListener("click", () => {
    cover.sizeKey = btn.dataset.export;
    renderCover(true);
    stage.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vice-city-nights-${cover.sizeKey}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      renderCover();
    }, "image/png");
  });
});

// ------------------------------------------------------------------ staging

function applyStaging() {
  const q = new URLSearchParams(location.search);
  if (q.get("shot") === "cover") document.body.classList.add("shot-cover");
  if (q.get("caption")) {
    cover.title = q.get("caption");
    byId("headline").value = cover.title;
  }
  if (q.get("subtitle")) {
    cover.tagline = q.get("subtitle");
    byId("tagline").value = cover.tagline;
  }
  const size = q.get("size");
  if (size && SIZES[size]) cover.sizeKey = size;
  const look = q.get("preset");
  if (look === "neon" || look === "sunset") setLook(look);
  const photo = q.get("photo");
  if (SAMPLES.includes(photo)) loadSample(photo);
}

syncCells();
document.body.dataset.look = cover.look;
applyStaging();
renderCover();
if (document.fonts && document.fonts.load) {
  document.fonts.load("80px Anton").then(() => renderCover()).catch(() => {});
}

// Small handle for automated checks: state + repaint, nothing else.
window.__vcn = { cover, renderCover, SIZES };
