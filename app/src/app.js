// Vice City Nights — Leonida Cover Studio.
// Turns 1-3 photos + a caption into multi-panel GTA-style poster cover art
// and exports exact-size PNGs. All rendering is plain canvas 2D; photos are
// read on the user's machine and never leave it. Original art only.

const canvas = document.getElementById('coverCanvas');
const ctx = canvas.getContext('2d');

const $ = (id) => document.getElementById(id);
const statusLine = $('statusLine');
const captionInput = $('captionInput');
const subtitleInput = $('subtitleInput');

const SAMPLES = {
  boulevard: { file: 'samples/boulevard.jpg', label: 'Boulevard' },
  pier: { file: 'samples/pier.jpg', label: 'Pier' },
};

// One photo slot per upload/sample (max 3). A panel points at a slot, so one
// photo can fill several panels with different crops.
const photos = [null, null, null];
const photoNames = ['', '', ''];

// Panel slots: Sunset uses panels 0-2, Neon Nights uses all four.
const panels = [
  { photo: 0, zoom: 1.0, ox: 0, oy: 0, name: 'Hero panel' },
  { photo: 0, zoom: 1.3, ox: 0, oy: 40, name: 'Top-right panel' },
  { photo: 0, zoom: 1.2, ox: 0, oy: 30, name: 'Bottom-right panel' },
  { photo: 0, zoom: 1.3, ox: 0, oy: 30, name: 'Bottom-left panel' },
];

const state = {
  preset: 'sunset',
  caption: 'VICE CITY NIGHTS',
  subtitle: 'LEONIDA • EST. 2026',
  captionScale: 1.0,
  selected: 0,
  coverOnly: false,
};

function setStatus(text) { statusLine.textContent = text; }

// ---------- layout ----------

// Panel polygons for the current preset, in cover coordinates (W x H).
// Sunset: hero ~55% left with a diagonal right edge, two stacked on the right.
// Neon: an even 2x2 grid.
function panelPolygons(preset, W, H) {
  const g = Math.max(4, Math.round(W * 0.012)); // white gutter
  if (preset === 'neon') {
    const mx = W / 2, my = H / 2;
    return [
      [[0, 0], [mx - g / 2, 0], [mx - g / 2, my - g / 2], [0, my - g / 2]],
      [[mx + g / 2, 0], [W, 0], [W, my - g / 2], [mx + g / 2, my - g / 2]],
      [[0, my + g / 2], [mx - g / 2, my + g / 2], [mx - g / 2, H], [0, H]],
      [[mx + g / 2, my + g / 2], [W, my + g / 2], [W, H], [mx + g / 2, H]],
    ];
  }
  const edge = (y) => 0.60 * W + g - 0.07 * W * (y / H); // right panels' left edge
  return [
    [[0, 0], [0.60 * W, 0], [0.53 * W, H], [0, H]],
    [[edge(0), 0], [W, 0], [W, 0.485 * H], [edge(0.485 * H), 0.485 * H]],
    [[edge(0.515 * H), 0.515 * H], [W, 0.515 * H], [W, H], [edge(H), H]],
  ];
}

function tracePolygon(c, poly) {
  c.beginPath();
  c.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) c.lineTo(poly[i][0], poly[i][1]);
  c.closePath();
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------- photo drawing ----------

function drawPhotoInPanel(c, img, poly, panel, W, H) {
  // Bounding box of the polygon, then cover-fit the photo inside it.
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pw = x1 - x0, ph = y1 - y0;
  const scale = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const dx = x0 + (pw - dw) / 2 + panel.ox * (W / 1920);
  const dy = y0 + (ph - dh) / 2 + panel.oy * (W / 1920);
  c.save();
  tracePolygon(c, poly);
  c.clip();
  c.drawImage(img, dx, dy, dw, dh);
  c.fillStyle = 'rgba(24, 4, 48, 0.10)';
  c.fillRect(x0, y0, pw, ph);
  c.restore();
}

function drawPanelFrames(c, polys, preset, W) {
  c.lineJoin = 'round';
  polys.forEach((poly, i) => {
    tracePolygon(c, poly);
    if (preset === 'neon') {
      c.strokeStyle = i % 2 ? '#ff2e88' : '#22d3ee';
      c.lineWidth = Math.max(2, W * 0.004);
    } else {
      c.strokeStyle = '#fff7e8';
      c.lineWidth = Math.max(3, W * 0.006);
    }
    c.stroke();
  });
}

// ---------- grades & effects ----------

function applySunsetGrade(c, W, H) {
  const grad = c.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, 'rgba(255, 154, 60, 0.55)');
  grad.addColorStop(0.5, 'rgba(255, 46, 136, 0.45)');
  grad.addColorStop(1, 'rgba(123, 47, 247, 0.55)');
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.fillStyle = grad;
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'soft-light';
  c.fillStyle = 'rgba(255, 120, 40, 0.35)';
  c.fillRect(0, 0, W, H);
  c.restore();
}

function applyNeonGrade(c, W, H) {
  const grad = c.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, 'rgba(0, 240, 200, 0.5)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(255, 46, 136, 0.55)');
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.fillStyle = grad;
  c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, W * 0.6);
  glow.addColorStop(0, 'rgba(255, 46, 136, 0.20)');
  glow.addColorStop(1, 'rgba(255, 46, 136, 0)');
  c.globalCompositeOperation = 'screen';
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);
  c.restore();
}

function drawHalftone(c, W, H) {
  c.save();
  const step = Math.max(10, Math.round(W / 120));
  for (let y = step / 2; y < H; y += step) {
    for (let x = step / 2; x < W; x += step) {
      const a = 0.05 + 0.05 * Math.sin((x + y) / (W * 0.08));
      c.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
      c.beginPath();
      c.arc(x, y, Math.max(1, step * 0.11), 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}

function drawVignette(c, W, H) {
  const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  c.save();
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  c.restore();
}

// ---------- caption ----------

function fitCaption(c, text, maxWidth, startPx) {
  let px = startPx;
  c.font = `${px}px Anton, "Arial Narrow", sans-serif`;
  while (px > 24 && c.measureText(text).width > maxWidth) {
    px -= 2;
    c.font = `${px}px Anton, "Arial Narrow", sans-serif`;
  }
  return px;
}

function drawCaptionBand(c, W, H) {
  const bandH = H * 0.17;
  const bandY = H - bandH;
  const neon = state.preset === 'neon';
  c.save();
  c.translate(W / 2, bandY + bandH / 2);
  c.rotate(-0.018);
  c.fillStyle = neon ? 'rgba(5, 5, 20, 0.90)' : 'rgba(22, 10, 38, 0.90)';
  c.fillRect(-W * 0.56, -bandH / 2, W * 1.12, bandH);
  c.fillStyle = neon ? '#22d3ee' : '#ff6a3d';
  c.fillRect(-W * 0.56, -bandH / 2, W * 1.12, Math.max(3, H * 0.006));
  c.restore();

  const caption = (state.caption || 'VICE CITY NIGHTS').toUpperCase();
  const capPx = fitCaption(c, caption, W * 0.92, H * 0.115 * state.captionScale);
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  try { c.letterSpacing = '2px'; } catch (e) { /* older canvas: ignore */ }
  if (neon) {
    c.shadowColor = '#ff2e88';
    c.shadowBlur = Math.max(8, W * 0.012);
  } else {
    c.shadowColor = 'rgba(255, 46, 136, 0.85)';
    c.shadowBlur = Math.max(6, W * 0.008);
    c.shadowOffsetY = Math.max(2, H * 0.004);
  }
  c.fillStyle = '#fff7e8';
  c.fillText(caption, W / 2, bandY + bandH * 0.42);
  c.restore();

  const sub = (state.subtitle || '').toUpperCase();
  if (sub) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `${Math.max(11, H * 0.028)}px "Segoe UI", system-ui, sans-serif`;
    try { c.letterSpacing = '4px'; } catch (e) { /* ignore */ }
    c.fillStyle = neon ? '#7df9d8' : '#ffb347';
    c.fillText(sub, W / 2, bandY + bandH * 0.80);
    c.restore();
  }
}

// ---------- master render ----------

function renderCover(c, W, H) {
  c.clearRect(0, 0, W, H);
  c.fillStyle = state.preset === 'neon' ? '#070714' : '#fff7e8';
  c.fillRect(0, 0, W, H);
  const polys = panelPolygons(state.preset, W, H);
  const count = state.preset === 'neon' ? 4 : 3;
  for (let i = 0; i < count; i++) {
    const img = photos[panels[i].photo];
    if (img) {
      drawPhotoInPanel(c, img, polys[i], panels[i], W, H);
    } else {
      c.save();
      tracePolygon(c, polys[i]);
      const grad = c.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#ff6a3d');
      grad.addColorStop(0.5, '#ff2e88');
      grad.addColorStop(1, '#7b2ff7');
      c.fillStyle = grad;
      c.fill();
      c.fillStyle = 'rgba(255, 247, 232, 0.9)';
      c.font = `${Math.max(14, H * 0.03)}px "Segoe UI", system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const xs = polys[i].map((p) => p[0]), ys = polys[i].map((p) => p[1]);
      c.fillText('ADD A PHOTO', (Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
      c.restore();
    }
  }
  drawPanelFrames(c, polys.slice(0, count), state.preset, W);
  if (state.preset === 'neon') applyNeonGrade(c, W, H);
  else applySunsetGrade(c, W, H);
  drawHalftone(c, W, H);
  drawCaptionBand(c, W, H);
  drawVignette(c, W, H);
}

function drawCoverCanvas(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off.getContext('2d'), w, h);
  return off;
}

function renderPreview() {
  if (state.coverOnly) {
    canvas.width = Math.min(1920, window.innerWidth);
    canvas.height = Math.min(1080, window.innerHeight);
  } else if (canvas.width !== 960 || canvas.height !== 540) {
    canvas.width = 960;
    canvas.height = 540;
  }
  renderCover(ctx, canvas.width, canvas.height);
}

// ---------- photos ----------

function photoReady(slot, img, name) {
  photos[slot] = img;
  photoNames[slot] = name;
  setStatus(`Loaded: ${name}. Drag a panel to pan it, then export a PNG.`);
  renderPreview();
}

function loadImageFile(file, slot) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => { photoReady(slot, img, file.name); resolve(img); };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadSamplePhoto(key, slot) {
  const sample = SAMPLES[key];
  if (!sample) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { photoReady(slot, img, sample.label); resolve(img); };
    img.onerror = reject;
    img.src = sample.file;
  });
}

function firstEmptySlot() {
  const i = photos.indexOf(null);
  return i === -1 ? 2 : i;
}

// ---------- export ----------

async function exportCover(w, h) {
  await document.fonts.ready;
  const off = drawCoverCanvas(w, h);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('export produced no PNG');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-city-nights-${w}x${h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus(`Exported ${w} × ${h} PNG — check your downloads.`);
  return blob;
}

// Test hook for the CDP verification pass: returns the exported PNG as a data URL.
window.__exportCover = async (w, h) => {
  await document.fonts.ready;
  return drawCoverCanvas(w, h).toDataURL('image/png');
};
window.__coverState = () => ({
  preset: state.preset,
  photos: photoNames.slice(),
  caption: state.caption,
  selected: state.selected,
});

// ---------- preset ----------

function setPreset(preset) {
  state.preset = preset;
  $('presetSunset').classList.toggle('active', preset === 'sunset');
  $('presetNeon').classList.toggle('active', preset === 'neon');
  updatePanelLabel();
  renderPreview();
}

function updatePanelLabel() {
  const count = state.preset === 'neon' ? 4 : 3;
  if (state.selected >= count) state.selected = 0;
  $('panelLabel').textContent = `Selected: ${panels[state.selected].name}`;
  const p = panels[state.selected];
  $('zoomRange').value = String(p.zoom);
  $('zoomValue').textContent = `${p.zoom.toFixed(2)}×`;
}

// ---------- events ----------

$('presetSunset').addEventListener('click', () => setPreset('sunset'));
$('presetNeon').addEventListener('click', () => setPreset('neon'));

$('sampleBoulevard').addEventListener('click', () => {
  loadSamplePhoto('boulevard', 0).then(() => {
    panels[0].photo = 0; panels[1].photo = photos[1] ? 1 : 0; panels[2].photo = photos[1] ? 1 : 0;
  });
});
$('samplePier').addEventListener('click', () => {
  loadSamplePhoto('pier', 1).then(() => {
    panels[1].photo = 1; panels[2].photo = 1; panels[3].photo = 1;
  });
});

$('fileInput').addEventListener('change', (e) => {
  const files = [...e.target.files].slice(0, 3);
  files.forEach((file) => loadImageFile(file, firstEmptySlot()));
  if (files.length) {
    panels[0].photo = 0;
    if (photos[1] || files.length > 1) { panels[1].photo = 1; panels[2].photo = 1; }
  }
});

$('zoomRange').addEventListener('input', (e) => {
  panels[state.selected].zoom = Number(e.target.value);
  $('zoomValue').textContent = `${panels[state.selected].zoom.toFixed(2)}×`;
  renderPreview();
});

$('fillAll').addEventListener('click', () => {
  const photo = panels[state.selected].photo;
  panels.forEach((p) => { p.photo = photo; });
  setStatus('Every panel now uses the selected photo.');
  renderPreview();
});

$('resetPan').addEventListener('click', () => {
  const p = panels[state.selected];
  p.ox = 0; p.oy = 0; p.zoom = 1;
  $('zoomRange').value = '1';
  $('zoomValue').textContent = '1.00×';
  renderPreview();
});

[['usePhoto0', 0], ['usePhoto1', 1], ['usePhoto2', 2]].forEach(([id, slot]) => {
  $(id).addEventListener('click', () => {
    if (!photos[slot]) { setStatus(`Photo ${slot + 1} is empty — upload or load a sample first.`); return; }
    panels[state.selected].photo = slot;
    renderPreview();
  });
});

captionInput.addEventListener('input', () => { state.caption = captionInput.value; renderPreview(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; renderPreview(); });
$('captionSize').addEventListener('input', (e) => {
  state.captionScale = Number(e.target.value) / 100;
  $('captionSizeValue').textContent = `${e.target.value}%`;
  renderPreview();
});

$('export1080').addEventListener('click', () => exportCover(1080, 1080));
$('export1350').addEventListener('click', () => exportCover(1080, 1350));
$('export1920').addEventListener('click', () => exportCover(1920, 1080));

// Drag to pan, click to select a panel.
let dragging = false;
let lastX = 0, lastY = 0;

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const polys = panelPolygons(state.preset, canvas.width, canvas.height);
  const count = state.preset === 'neon' ? 4 : 3;
  for (let i = 0; i < count; i++) {
    if (pointInPolygon(x, y, polys[i])) { state.selected = i; updatePanelLabel(); break; }
  }
  dragging = true;
  lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  const p = panels[state.selected];
  p.ox += (e.clientX - lastX) * (canvas.width / rect.width);
  p.oy += (e.clientY - lastY) * (canvas.height / rect.height);
  lastX = e.clientX; lastY = e.clientY;
  renderPreview();
});

canvas.addEventListener('pointerup', () => { dragging = false; });

// ---------- deterministic staging (?shot=…) ----------

window.__ready = (async () => {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  const photo = params.get('photo');
  const caption = params.get('caption');
  const subtitle = params.get('subtitle');
  const preset = params.get('preset');
  if (caption) { state.caption = caption; captionInput.value = caption; }
  if (subtitle) { state.subtitle = subtitle; subtitleInput.value = subtitle; }
  if (preset === 'neon' || preset === 'sunset') state.preset = preset;
  if (shot === 'cover') state.coverOnly = true;
  if (state.coverOnly) document.body.classList.add('cover-only');

  try { await document.fonts.load('100px Anton'); } catch (e) { /* font still renders from CSS */ }
  if (photo && SAMPLES[photo]) {
    await loadSamplePhoto(photo, 0);
    if (photo === 'boulevard') {
      await loadSamplePhoto('pier', 1).catch(() => {});
      panels[1].photo = 1; panels[2].photo = 1; panels[3].photo = 1;
    }
  }
  setPreset(state.preset);
  renderPreview();
  return true;
})();
