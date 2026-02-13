// ChoreoMarker - Choreography marking tool for dance rehearsals

// IndexedDB
const openDB = () => new Promise(resolve => {
  const req = indexedDB.open('ChoreoMarkerDB', 1);
  req.onupgradeneeded = e => e.target.result.createObjectStore('audio');
  req.onsuccess = () => resolve(req.result);
});

const saveAudioToDB = async (blob, fileName) => {
  const db = await openDB();
  const tx = db.transaction('audio', 'readwrite');
  tx.objectStore('audio').put({ blob, fileName }, 'current');
};

const loadAudioFromDB = async () => {
  const db = await openDB();
  return new Promise(resolve => {
    const req = db.transaction('audio', 'readonly').objectStore('audio').get('current');
    req.onsuccess = () => resolve(req.result);
  });
};

const deleteAudioFromDB = async () => {
  const db = await openDB();
  db.transaction('audio', 'readwrite').objectStore('audio').delete('current');
};

// Utils
const formatTime = s => {
  if (!s && s !== 0) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

const getInitials = name => {
  if (!name) return "?";
  const p = name.trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

// State
const state = {
  audioSrc: null, fileName: "", isPlaying: false, currentTime: 0, duration: 0,
  bookmarks: [], dancers: [], positions: {}, 
  draggedId: null, editingDancer: null, editingBookmarkId: null, tempName: "",
  showDancers: false, isLoading: false, animationId: null
};

// DOM refs
let audio, stage, waveformCanvas, waveform, fileInput, jsonInput, bookmarksContainer;

// Audio Context & Waveform
let audioCtx = null;
const getAudioCtx = () => audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());

class Waveform {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.buffer = null;
  }

  async load(src) {
    const data = await fetch(src).then(r => r.arrayBuffer());
    this.buffer = await getAudioCtx().decodeAudioData(data);
    this.draw();
  }

  draw() {
    if (!this.buffer) return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const data = this.buffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;
    const progress = state.duration ? state.currentTime / state.duration : 0;

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < width; i++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const d = data[i * step + j];
        if (d < min) min = d;
        if (d > max) max = d;
      }
      ctx.fillStyle = i / width < progress ? '#818cf8' : '#374151';
      ctx.fillRect(i, (height - Math.max(2, (max - min) * amp)) / 2, 1, Math.max(2, (max - min) * amp));
    }

    // Markers
    state.bookmarks.forEach(m => {
      if (!state.duration) return;
      const x = (m.time / state.duration) * width;
      ctx.fillStyle = m.type === 'manual' ? '#f97316' : '#10b981';
      ctx.fillRect(x, 0, 2, height);
      ctx.beginPath();
      ctx.moveTo(x - 3, 0);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x + 1, 6);
      ctx.fill();
    });
  }
}

// Storage
const save = () => {
  if (state.isLoading) return;
  localStorage.setItem('choreo_dancers', JSON.stringify(state.dancers));
  localStorage.setItem('choreo_bookmarks', JSON.stringify(state.bookmarks));
  localStorage.setItem('choreo_positions', JSON.stringify(state.positions));
  localStorage.setItem('choreo_fileName', state.fileName);
};

const load = () => {
  state.dancers = JSON.parse(localStorage.getItem('choreo_dancers') || '[]');
  state.bookmarks = JSON.parse(localStorage.getItem('choreo_bookmarks') || '[]');
  state.positions = JSON.parse(localStorage.getItem('choreo_positions') || '{}');
  state.fileName = localStorage.getItem('choreo_fileName') || '';
};

// Position tracking
const updatePositions = time => {
  state.dancers.forEach(d => {
    const mark = state.bookmarks
      .filter(b => b.time <= time && b.positions?.[d.id])
      .sort((a, b) => b.time - a.time)[0];
    state.positions[d.id] = mark?.positions[d.id] || state.positions[d.id] || { x: 50, y: 50 };
  });
};

const recordMovement = (id, pos) => {
  state.positions[id] = pos;
  const dancer = state.dancers.find(d => d.id === id);
  const initials = getInitials(dancer?.name);
  const existing = state.bookmarks.find(b => b.type === 'movement' && Math.abs(b.time - state.currentTime) < 0.1);

  if (existing) {
    if (!existing.name.includes(initials)) existing.name += `, ${initials}`;
    existing.positions = { ...existing.positions, [id]: pos };
  } else {
    state.bookmarks.push({
      id: Date.now(), time: state.currentTime, type: 'movement',
      name: `Mov: ${initials}`, positions: { ...state.positions }
    });
    state.bookmarks.sort((a, b) => a.time - b.time);
  }
  save();
};

// Audio controls
const togglePlay = async () => {
  if (!audio) return;
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') await ctx.resume();

  if (state.isPlaying) {
    audio.pause();
    cancelAnimationFrame(state.animationId);
  } else {
    audio.play();
    animationLoop();
  }
  state.isPlaying = !state.isPlaying;
  render();
};

const animationLoop = () => {
  if (!state.isPlaying) return;
  state.currentTime = audio.currentTime;
  if (!state.draggedId) updatePositions(state.currentTime);
  updatePlayerUI();
  renderStage();
  state.animationId = requestAnimationFrame(animationLoop);
};

const seek = time => {
  if (!audio) return;
  audio.currentTime = time;
  state.currentTime = time;
  updatePositions(time);
  updatePlayerUI();
  renderStage();
};

// Bookmarks
const addBookmark = () => {
  state.bookmarks.push({
    id: Date.now(), time: state.currentTime, type: 'manual',
    name: 'Note', positions: JSON.parse(JSON.stringify(state.positions))
  });
  state.bookmarks.sort((a, b) => a.time - b.time);
  save();
  render();
  setTimeout(() => bookmarksContainer?.scrollTo(0, bookmarksContainer.scrollHeight), 100);
};

const jumpTo = b => {
  seek(b.time);
  if (!state.isPlaying) { audio.play(); state.isPlaying = true; }
  render();
};

// Dancers
const addDancer = () => {
  const d = { id: `d_${Date.now()}`, name: `Dancer ${state.dancers.length + 1}`, color: COLORS[state.dancers.length % COLORS.length] };
  state.dancers.push(d);
  state.positions[d.id] = { x: 50, y: 50 };
  save();
  render();
};

const deleteDancer = id => {
  state.dancers = state.dancers.filter(d => d.id !== id);
  delete state.positions[id];
  state.bookmarks.forEach(b => b.positions && delete b.positions[id]);
  state.editingDancer = null;
  save();
  render();
};

// Drag handling
const startDrag = (e, id) => {
  if (e.type === 'touchstart') document.body.style.overflow = 'hidden';
  if (state.isPlaying) { audio.pause(); state.isPlaying = false; }
  state.draggedId = id;
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchmove', onDrag, { passive: false });
  window.addEventListener('touchend', endDrag);
};

const onDrag = e => {
  if (!state.draggedId || !stage) return;
  const touch = e.touches?.[0] || e;
  const rect = stage.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
  state.positions[state.draggedId] = { x, y };
  renderStage();
};

const endDrag = () => {
  document.body.style.overflow = '';
  if (state.draggedId) {
    recordMovement(state.draggedId, state.positions[state.draggedId]);
    state.draggedId = null;
  }
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', endDrag);
  window.removeEventListener('touchmove', onDrag);
  window.removeEventListener('touchend', endDrag);
  render();
};

// Import/Export
const exportData = () => {
  const blob = new Blob([JSON.stringify({ version: 1, meta: { audioFile: state.fileName }, dancers: state.dancers, bookmarks: state.bookmarks }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.fileName?.split('.')[0] || 'choreo'}_data.json`;
  a.click();
};

const importData = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const data = JSON.parse(ev.target.result);
    if (data.dancers) state.dancers = data.dancers;
    if (data.bookmarks) state.bookmarks = data.bookmarks;
    state.currentTime = 0;
    if (audio) audio.currentTime = 0;
    save();
    render();
  };
  reader.readAsText(file);
  e.target.value = null;
};

const clearStorage = async () => {
  if (!confirm('Clear all saved data including audio file?')) return;
  ['choreo_dancers', 'choreo_bookmarks', 'choreo_positions', 'choreo_fileName'].forEach(k => localStorage.removeItem(k));
  await deleteAudioFromDB();
  Object.assign(state, { dancers: [], bookmarks: [], positions: {}, fileName: '', audioSrc: null, isPlaying: false, currentTime: 0, duration: 0 });
  render();
};

const handleAudioUpload = async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (state.audioSrc) URL.revokeObjectURL(state.audioSrc);
  
  state.audioSrc = URL.createObjectURL(file);
  state.fileName = file.name;
  state.bookmarks = [];
  state.isPlaying = false;
  state.currentTime = 0;
  
  audio.src = state.audioSrc;
  await saveAudioToDB(file, file.name);
  save();
  render();
  waveform?.load(state.audioSrc);
};

// Rendering
const render = () => {
  renderStage();
  renderPlayer();
  renderDancers();
  renderTimeline();
  renderModal();
  waveform?.draw();
};

const renderStage = () => {
  const content = stage?.querySelector('.stage-content');
  if (!content) return;

  const existing = content.querySelectorAll('[data-id]');
  if (existing.length !== state.dancers.length) {
    content.innerHTML = state.dancers.map(d => {
      const p = state.positions[d.id] || { x: 50, y: 50 };
      return `<div data-id="${d.id}" class="absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center font-bold text-sm shadow-xl z-10 touch-none select-none transition-transform hover:scale-110" style="left:${p.x}%;top:${p.y}%;background:${d.color};cursor:grab;border:3px solid rgba(255,255,255,0.9)" title="${d.name}">${getInitials(d.name)}<div class="absolute -bottom-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white/90"></div></div>`;
    }).join('');
    state.dancers.forEach(d => {
      const el = content.querySelector(`[data-id="${d.id}"]`);
      el?.addEventListener('mousedown', e => startDrag(e, d.id));
      el?.addEventListener('touchstart', e => startDrag(e, d.id));
    });
  } else {
    state.dancers.forEach(d => {
      const el = content.querySelector(`[data-id="${d.id}"]`);
      if (!el) return;
      const p = state.positions[d.id] || { x: 50, y: 50 };
      el.style.left = `${p.x}%`;
      el.style.top = `${p.y}%`;
      el.style.cursor = state.draggedId === d.id ? 'grabbing' : 'grab';
    });
  }
};

const renderPlayer = () => {
  const container = document.getElementById('player-container');
  if (!container) return;

  if (!state.audioSrc) {
    if (!container.querySelector('#upload-prompt')) {
      container.innerHTML = `<div id="upload-prompt" class="h-24 border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-800"><span class="flex items-center gap-2">⬆️ Load Audio</span></div>`;
      container.querySelector('#upload-prompt').onclick = () => fileInput.click();
    }
    return;
  }

  if (!container.querySelector('#seek-slider')) {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="relative h-16 w-full bg-gray-950 rounded-lg overflow-hidden">
          <canvas id="waveform-canvas" width="800" height="64" class="w-full h-16 rounded-lg opacity-90"></canvas>
          <input type="range" id="seek-slider" min="0" max="${state.duration||0}" value="${state.currentTime}" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"/>
          <div id="progress-bar" class="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style="left:0%"><div class="absolute -top-1 -ml-[6px] w-[13px] h-[13px] bg-white rounded-full shadow-md"></div></div>
        </div>
        <div class="flex items-center justify-between gap-4">
          <div id="time-display" class="font-mono text-xs text-gray-400 w-12">0:00</div>
          <div class="flex items-center gap-6">
            <button id="rw-btn" class="p-2 text-gray-400 hover:text-white">⏪</button>
            <button id="play-btn" class="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all">▶️</button>
            <button id="ff-btn" class="p-2 text-gray-400 hover:text-white">⏩</button>
          </div>
          <div id="dur-display" class="font-mono text-xs text-gray-400 w-12 text-right">0:00</div>
        </div>
        <button id="mark-btn" class="w-full bg-indigo-600 hover:bg-indigo-500 py-3 text-lg font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 text-white shadow-lg shadow-indigo-500/20">📝 Mark</button>
      </div>`;

    waveformCanvas = document.getElementById('waveform-canvas');
    waveform = new Waveform(waveformCanvas);
    if (state.audioSrc) waveform.load(state.audioSrc);

    document.getElementById('seek-slider').oninput = e => seek(parseFloat(e.target.value));
    document.getElementById('play-btn').onclick = togglePlay;
    document.getElementById('rw-btn').onclick = () => seek(audio.currentTime - 5);
    document.getElementById('ff-btn').onclick = () => seek(audio.currentTime + 5);
    document.getElementById('mark-btn').onclick = addBookmark;
  }

  document.getElementById('play-btn').textContent = state.isPlaying ? '⏸️' : '▶️';
  document.getElementById('dur-display').textContent = formatTime(state.duration);
  document.getElementById('seek-slider').max = state.duration || 0;
  updatePlayerUI();
};

const updatePlayerUI = () => {
  if (!state.audioSrc) return;
  const slider = document.getElementById('seek-slider');
  if (slider && document.activeElement !== slider) slider.value = state.currentTime;
  document.getElementById('time-display').textContent = formatTime(state.currentTime);
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.left = `${state.duration ? (state.currentTime / state.duration) * 100 : 0}%`;
  waveform?.draw();
};

const renderDancers = () => {
  const container = document.getElementById('dancers-list');
  if (!container || !state.dancers.length) { if (container) container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="space-y-3">
      <div id="dancers-toggle" class="flex items-center justify-between px-2 cursor-pointer hover:bg-gray-800/30 rounded-lg p-2">
        <h2 class="font-semibold text-gray-300">Dancers (${state.dancers.length})</h2>
        <span class="text-gray-400">${state.showDancers ? '▼' : '▶'}</span>
      </div>
      ${state.showDancers ? `<div class="space-y-2">${state.dancers.map(d => `
        <div class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs" style="background:${d.color}">${getInitials(d.name)}</div>
            <span class="text-gray-100">${d.name}</span>
          </div>
          <div class="flex gap-2">
            <button class="p-2 text-gray-400 hover:text-white" data-edit="${d.id}">✏️</button>
            <button class="p-2 text-gray-400 hover:text-red-400" data-del="${d.id}">🗑️</button>
          </div>
        </div>`).join('')}</div>` : ''}
    </div>`;

  document.getElementById('dancers-toggle').onclick = () => { state.showDancers = !state.showDancers; render(); };
  state.dancers.forEach(d => {
    container.querySelector(`[data-edit="${d.id}"]`)?.addEventListener('click', () => { state.editingDancer = d; render(); setTimeout(() => document.getElementById('edit-dancer-input')?.focus(), 0); });
    container.querySelector(`[data-del="${d.id}"]`)?.addEventListener('click', () => deleteDancer(d.id));
  });
};

const renderTimeline = () => {
  const container = document.getElementById('timeline-container');
  if (!container || !state.bookmarks.length) { if (container) container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="space-y-3 pb-24 md:pb-6">
      <div class="flex items-center justify-between px-2">
        <h2 class="font-semibold text-gray-300">Timeline (${state.bookmarks.length})</h2>
        <button id="clear-marks" class="text-gray-400 hover:text-white text-xs px-2 py-1">Clear All</button>
      </div>
      <div id="bookmarks-scroll" class="space-y-2 max-h-[400px] overflow-y-auto pr-2">
        ${state.bookmarks.map(b => {
          const isMov = b.type === 'movement', editing = state.editingBookmarkId === b.id;
          const isCurrent = Math.abs(state.currentTime - b.time) < 0.5;
          return `<div data-bid="${b.id}" class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isCurrent ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800 hover:bg-gray-800/50'} border-l-4 ${isMov ? 'border-l-emerald-500' : 'border-l-orange-500'}">
            <div class="flex items-center gap-3 flex-1">
              <div class="font-mono text-xs text-gray-500 w-10">${formatTime(b.time)}</div>
              <span class="${isMov ? 'text-emerald-500' : 'text-orange-500'}">${isMov ? '🚶' : '📝'}</span>
              ${editing ? `<input id="edit-mark-${b.id}" class="bg-gray-800 text-white text-sm px-2 py-1 rounded border border-gray-600 w-32" value="${state.tempName}"/><button data-save-mark="${b.id}" class="text-green-400">✅</button>` : `<span class="${isMov ? 'text-emerald-400' : 'text-orange-400'} font-medium truncate">${b.name}</span>`}
            </div>
            <div class="flex gap-1">
              ${!editing ? `<button data-edit-mark="${b.id}" class="p-2 text-gray-600 hover:text-white">✏️</button>` : ''}
              <button data-del-mark="${b.id}" class="p-2 text-gray-600 hover:text-red-400">🗑️</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  bookmarksContainer = document.getElementById('bookmarks-scroll');
  document.getElementById('clear-marks').onclick = () => { state.bookmarks = []; save(); render(); };

  state.bookmarks.forEach(b => {
    const el = container.querySelector(`[data-bid="${b.id}"]`);
    el?.addEventListener('click', e => { if (!e.target.closest('button') && !e.target.closest('input')) jumpTo(b); });
    container.querySelector(`[data-edit-mark="${b.id}"]`)?.addEventListener('click', e => { e.stopPropagation(); state.editingBookmarkId = b.id; state.tempName = b.name; render(); });
    container.querySelector(`[data-save-mark="${b.id}"]`)?.addEventListener('click', e => { e.stopPropagation(); b.name = state.tempName; state.editingBookmarkId = null; save(); render(); });
    container.querySelector(`[data-del-mark="${b.id}"]`)?.addEventListener('click', e => { e.stopPropagation(); state.bookmarks = state.bookmarks.filter(x => x.id !== b.id); save(); render(); });
    const input = document.getElementById(`edit-mark-${b.id}`);
    if (input) {
      input.oninput = e => state.tempName = e.target.value;
      input.onkeydown = e => { if (e.key === 'Enter') { b.name = state.tempName; state.editingBookmarkId = null; save(); render(); } };
      input.onclick = e => e.stopPropagation();
    }
  });
};

const renderModal = () => {
  const modal = document.getElementById('edit-dancer-modal');
  if (!modal) return;
  if (!state.editingDancer) { modal.style.display = 'none'; modal.innerHTML = ''; return; }

  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700">
      <h3 class="text-lg font-semibold mb-4">Edit Dancer</h3>
      <input id="edit-dancer-input" class="w-full bg-gray-900 border border-gray-600 rounded-xl p-3 text-white mb-4" value="${state.editingDancer.name}"/>
      <div class="flex justify-between gap-3">
        <button id="modal-delete" class="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-xl">Delete</button>
        <div class="flex gap-2">
          <button id="modal-cancel" class="bg-gray-700 hover:bg-gray-600 text-gray-100 px-4 py-2 rounded-xl">Cancel</button>
          <button id="modal-save" class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl">Save</button>
        </div>
      </div>
    </div>`;

  const input = document.getElementById('edit-dancer-input');
  const saveName = () => { state.dancers.find(d => d.id === state.editingDancer.id).name = input.value; state.editingDancer = null; save(); render(); };
  document.getElementById('modal-delete').onclick = () => deleteDancer(state.editingDancer.id);
  document.getElementById('modal-cancel').onclick = () => { state.editingDancer = null; render(); };
  document.getElementById('modal-save').onclick = saveName;
  input.onkeydown = e => e.key === 'Enter' && saveName();
};

// Init
const init = async () => {
  audio = document.getElementById('audio-element');
  stage = document.getElementById('stage');
  fileInput = document.getElementById('file-input');
  jsonInput = document.getElementById('json-input');

  audio.addEventListener('loadedmetadata', () => { state.duration = audio.duration; render(); });
  audio.addEventListener('ended', () => { state.isPlaying = false; render(); });
  audio.addEventListener('timeupdate', () => { if (!state.isPlaying) { state.currentTime = audio.currentTime; updatePositions(state.currentTime); updatePlayerUI(); renderStage(); } });

  fileInput.onchange = handleAudioUpload;
  jsonInput.onchange = importData;

  document.getElementById('upload-audio-btn').onclick = () => fileInput.click();
  document.getElementById('import-btn').onclick = () => jsonInput.click();
  document.getElementById('export-btn').onclick = exportData;
  document.getElementById('clear-storage-btn').onclick = clearStorage;
  document.getElementById('add-dancer-btn').onclick = addDancer;

  state.isLoading = true;
  load();
  const audioData = await loadAudioFromDB();
  if (audioData?.blob) {
    state.audioSrc = URL.createObjectURL(audioData.blob);
    audio.src = state.audioSrc;
  }
  state.isLoading = false;
  render();

  if (state.audioSrc) {
    waveformCanvas = document.getElementById('waveform-canvas');
    if (waveformCanvas) { waveform = new Waveform(waveformCanvas); await waveform.load(state.audioSrc); }
  }
};

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/choreo/sw.js'));
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
