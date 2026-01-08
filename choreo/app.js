// ChoreoMarker - Vanilla JavaScript Version
// Choreography marking tool for dance rehearsals

// ============================================================================
// IndexedDB Helpers
// ============================================================================
const DB_NAME = 'ChoreoMarkerDB';
const DB_VERSION = 1;
const AUDIO_STORE = 'audioFiles';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE);
      }
    };
  });
};

const saveAudioToDB = async (blob, fileName) => {
  try {
    const db = await openDB();
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE);
    store.put({ blob, fileName, timestamp: Date.now() }, 'currentAudio');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Error saving audio to IndexedDB:', err);
  }
};

const loadAudioFromDB = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const store = tx.objectStore(AUDIO_STORE);
    const request = store.get('currentAudio');
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error loading audio from IndexedDB:', err);
    return null;
  }
};

const deleteAudioFromDB = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE);
    store.delete('currentAudio');
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Error deleting audio from IndexedDB:', err);
  }
};

// ============================================================================
// Utility Functions
// ============================================================================
const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mDisplay = m < 10 && h > 0 ? "0" + m : m;
  const sDisplay = s < 10 ? "0" + s : s;
  return h > 0 ? `${h}:${mDisplay}:${sDisplay}` : `${mDisplay}:${sDisplay}`;
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const generateColor = (id) => {
  const colors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
  return colors[id % colors.length];
};

// ============================================================================
// Application State
// ============================================================================
const state = {
  audioSrc: null,
  fileName: "",
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  bookmarks: [],
  dancers: [],
  currentPositions: {},
  draggedDancerId: null,
  editingDancer: null,
  editingBookmarkId: null,
  tempBookmarkName: "",
  showDancers: false,
  audioFileBlob: null,
  isLoading: false,
  hasDragged: false,
  animationFrameId: null
};

// ============================================================================
// Audio Context Helper
// ============================================================================
let sharedAudioContext = null;

const getAudioContext = () => {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return sharedAudioContext;
};

// ============================================================================
// Waveform Visualization
// ============================================================================
class Waveform {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.audioBuffer = null;
  }

  async loadAudio(audioSrc) {
    try {
      const response = await fetch(audioSrc);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = getAudioContext();
      this.audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      this.draw();
    } catch (e) {
      console.error('Error loading waveform:', e);
    }
  }

  draw() {
    if (!this.audioBuffer) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.clearRect(0, 0, width, height);

    const data = this.audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    this.ctx.fillStyle = '#111827';
    this.ctx.fillRect(0, 0, width, height);

    const progress = state.duration ? state.currentTime / state.duration : 0;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      this.ctx.fillStyle = i / width < progress ? '#818cf8' : '#374151';
      const barHeight = Math.max(2, (max - min) * amp);
      const y = (height - barHeight) / 2;
      this.ctx.fillRect(i, y, 1, barHeight);
    }

    // Draw markers
    state.bookmarks.forEach(m => {
      if (!state.duration) return;
      const x = (m.time / state.duration) * width;
      this.ctx.fillStyle = m.type === 'manual' ? '#f97316' : '#10b981';
      this.ctx.fillRect(x, 0, 2, height);

      this.ctx.beginPath();
      this.ctx.moveTo(x - 3, 0);
      this.ctx.lineTo(x + 5, 0);
      this.ctx.lineTo(x + 1, 6);
      this.ctx.fill();
    });
  }
}

// ============================================================================
// DOM References
// ============================================================================
const refs = {
  audio: null,
  stage: null,
  waveformCanvas: null,
  waveform: null,
  fileInput: null,
  jsonInput: null,
  bookmarksContainer: null
};

// ============================================================================
// Storage Functions
// ============================================================================
const saveToLocalStorage = () => {
  if (state.isLoading) return;
  localStorage.setItem('choreo_dancers', JSON.stringify(state.dancers));
  localStorage.setItem('choreo_bookmarks', JSON.stringify(state.bookmarks));
  localStorage.setItem('choreo_positions', JSON.stringify(state.currentPositions));
  localStorage.setItem('choreo_fileName', state.fileName);
};

const loadFromLocalStorage = () => {
  try {
    const savedDancers = localStorage.getItem('choreo_dancers');
    const savedBookmarks = localStorage.getItem('choreo_bookmarks');
    const savedPositions = localStorage.getItem('choreo_positions');
    const savedFileName = localStorage.getItem('choreo_fileName');

    if (savedDancers) state.dancers = JSON.parse(savedDancers);
    if (savedBookmarks) state.bookmarks = JSON.parse(savedBookmarks);
    if (savedPositions) state.currentPositions = JSON.parse(savedPositions);
    if (savedFileName) state.fileName = savedFileName;
  } catch (err) {
    console.error('Error loading from localStorage:', err);
  }
};

// ============================================================================
// Audio Functions
// ============================================================================
const togglePlay = async () => {
  if (refs.audio) {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (state.isPlaying) {
      refs.audio.pause();
      state.isPlaying = false;
      cancelAnimationFrame(state.animationFrameId);
    } else {
      refs.audio.play();
      state.isPlaying = true;
      animationLoop();
    }
    renderPlayer(); // Update play/pause icon
  }
};

const animationLoop = () => {
  if (!state.isPlaying) return;

  state.currentTime = refs.audio.currentTime;
  
  if (!state.draggedDancerId) {
    updatePositionsFromTime(state.currentTime);
  }
  
  updatePlayerVisuals();
  renderStage(); // We'll optimize renderStage next to not destroy DOM if not needed
  
  state.animationFrameId = requestAnimationFrame(animationLoop);
};

const handleTimeUpdate = () => {
  if (refs.audio && !state.isPlaying) {
    // Only update on timeupdate event if NOT playing (e.g. seeking or slow updates)
    // When playing, the animation loop handles it for smoothness
    state.currentTime = refs.audio.currentTime;
    updatePositionsFromTime(state.currentTime);
    updatePlayerVisuals();
    renderStage();
  }
};

const handleSeek = (e) => {
  const time = parseFloat(e.target.value);
  if (refs.audio) {
    refs.audio.currentTime = time;
    state.currentTime = time;
    updatePositionsFromTime(time);
    updatePlayerVisuals();
    renderStage();
  }
};

const handleLoadedMetadata = (e) => {
  state.duration = e.target.duration;
  renderPlayer(); // Re-render to update max slider value and duration text
};

const handleAudioEnded = () => {
  state.isPlaying = false;
  render();
};

const handleAudioUpload = async (e) => {
  const file = e.target.files[0];
  if (file) {
    if (state.audioSrc) {
      URL.revokeObjectURL(state.audioSrc);
    }

    const url = URL.createObjectURL(file);
    state.audioSrc = url;
    state.fileName = file.name;
    state.bookmarks = [];
    state.isPlaying = false;
    state.currentTime = 0;
    state.audioFileBlob = file;

    // Set audio element source
    if (refs.audio) {
      refs.audio.src = url;
    }

    // Save audio to IndexedDB
    await saveAudioToDB(file, file.name);

    // Load waveform
    if (refs.waveform) {
      await refs.waveform.loadAudio(url);
    }

    saveToLocalStorage();
    render();
  }
};

// ============================================================================
// Position & Movement Functions
// ============================================================================
const updatePositionsFromTime = (time) => {
  const newPositions = {};

  state.dancers.forEach(dancer => {
    const hasHistory = state.bookmarks.some(b => b.positions && b.positions[dancer.id]);

    if (!hasHistory) {
      newPositions[dancer.id] = state.currentPositions[dancer.id] || { x: 50, y: 50 };
    } else {
      const relevantMark = state.bookmarks
        .filter(b => b.time <= time && b.positions && b.positions[dancer.id])
        .sort((a, b) => b.time - a.time)[0];

      if (relevantMark) {
        newPositions[dancer.id] = relevantMark.positions[dancer.id];
      } else {
        newPositions[dancer.id] = { x: 50, y: 50 };
      }
    }
  });

  state.currentPositions = newPositions;
};

const recordMovement = (dancerId, newPos) => {
  state.currentPositions[dancerId] = newPos;

  const dancer = state.dancers.find(d => d.id === dancerId);
  const initials = getInitials(dancer?.name);

  const existingMarkIndex = state.bookmarks.findIndex(b =>
    b.type === 'movement' && Math.abs(b.time - state.currentTime) < 0.1
  );

  if (existingMarkIndex !== -1) {
    const mark = state.bookmarks[existingMarkIndex];
    let newName = mark.name;
    if (!newName.includes(initials)) {
      newName += `, ${initials}`;
    }
    state.bookmarks[existingMarkIndex] = {
      ...mark,
      name: newName,
      positions: { ...mark.positions, [dancerId]: newPos }
    };
  } else {
    const newBookmark = {
      id: Date.now(),
      time: state.currentTime,
      type: 'movement',
      name: `Mov: ${initials}`,
      positions: { ...state.currentPositions }
    };
    state.bookmarks.push(newBookmark);
    state.bookmarks.sort((a, b) => a.time - b.time);
    scrollToBottom();
  }

  saveToLocalStorage();
};

// ============================================================================
// Bookmark Functions
// ============================================================================
const addManualBookmark = () => {
  const newBookmark = {
    id: Date.now(),
    time: state.currentTime,
    type: 'manual',
    name: `Note`,
    positions: JSON.parse(JSON.stringify(state.currentPositions))
  };
  state.bookmarks.push(newBookmark);
  state.bookmarks.sort((a, b) => a.time - b.time);
  saveToLocalStorage();
  scrollToBottom();
  render();
};

const jumpToBookmark = (bookmark) => {
  if (refs.audio) {
    refs.audio.currentTime = bookmark.time;
    state.currentTime = bookmark.time;
    updatePositionsFromTime(bookmark.time);
    if (!state.isPlaying) {
      refs.audio.play();
      state.isPlaying = true;
    }
    render();
  }
};

const deleteBookmark = (id) => {
  state.bookmarks = state.bookmarks.filter(b => b.id !== id);
  saveToLocalStorage();
  render();
};

const startEditingBookmark = (bookmark) => {
  state.editingBookmarkId = bookmark.id;
  state.tempBookmarkName = bookmark.name;
  render();
};

const saveBookmarkName = (id) => {
  state.bookmarks = state.bookmarks.map(b =>
    b.id === id ? { ...b, name: state.tempBookmarkName } : b
  );
  state.editingBookmarkId = null;
  saveToLocalStorage();
  render();
};

const scrollToBottom = () => {
  setTimeout(() => {
    if (refs.bookmarksContainer) {
      refs.bookmarksContainer.scrollTop = refs.bookmarksContainer.scrollHeight;
    }
  }, 100);
};

// ============================================================================
// Dancer Functions
// ============================================================================
const addDancer = () => {
  const newDancer = {
    id: `d_${Date.now()}`,
    name: `Dancer ${state.dancers.length + 1}`,
    color: generateColor(state.dancers.length)
  };
  state.dancers.push(newDancer);
  state.currentPositions[newDancer.id] = { x: 50, y: 50 };
  saveToLocalStorage();
  render();
};

const deleteDancer = (id) => {
  state.dancers = state.dancers.filter(d => d.id !== id);
  delete state.currentPositions[id];
  state.bookmarks = state.bookmarks.map(b => {
    if (!b.positions) return b;
    const newPos = { ...b.positions };
    delete newPos[id];
    return { ...b, positions: newPos };
  });
  state.editingDancer = null;
  saveToLocalStorage();
  render();
};

const startEditingDancer = (dancer) => {
  state.editingDancer = dancer;
  render();
  // Focus the input after render
  setTimeout(() => {
    const input = document.getElementById('edit-dancer-input');
    if (input) input.focus();
  }, 0);
};

const saveDancerName = (newName) => {
  if (state.editingDancer) {
    state.dancers = state.dancers.map(d =>
      d.id === state.editingDancer.id ? { ...d, name: newName } : d
    );
    state.editingDancer = null;
    saveToLocalStorage();
    render();
  }
};

// ============================================================================
// Drag & Drop Functions
// ============================================================================
const handleDragStart = (e, id) => {
  if (e.type === 'touchstart') {
    document.body.style.overflow = 'hidden';
  }
  if (state.isPlaying) {
    refs.audio.pause();
    state.isPlaying = false;
  }
  state.hasDragged = false;
  state.draggedDancerId = id;

  window.addEventListener('mousemove', handleDragMove);
  window.addEventListener('mouseup', handleDragEnd);
  window.addEventListener('touchmove', handleDragMove, { passive: false });
  window.addEventListener('touchend', handleDragEnd);
};

const handleDragMove = (e) => {
  if (!state.draggedDancerId || !refs.stage) return;
  state.hasDragged = true;

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const rect = refs.stage.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

  state.currentPositions[state.draggedDancerId] = { x, y };
  render();
};

const handleDragEnd = () => {
  document.body.style.overflow = '';

  if (state.draggedDancerId) {
    const pos = state.currentPositions[state.draggedDancerId];
    recordMovement(state.draggedDancerId, pos);
    state.draggedDancerId = null;
  }

  window.removeEventListener('mousemove', handleDragMove);
  window.removeEventListener('mouseup', handleDragEnd);
  window.removeEventListener('touchmove', handleDragMove);
  window.removeEventListener('touchend', handleDragEnd);

  render();
};

// ============================================================================
// Import/Export Functions
// ============================================================================
const exportData = () => {
  const data = {
    version: 1,
    meta: { audioFile: state.fileName },
    dancers: state.dancers,
    bookmarks: state.bookmarks
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.fileName ? state.fileName.split('.')[0] : 'choreo'}_data.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const importData = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.dancers) state.dancers = data.dancers;
      if (data.bookmarks) state.bookmarks = data.bookmarks;
      state.currentTime = 0;
      if (refs.audio) refs.audio.currentTime = 0;
      saveToLocalStorage();
      render();
    } catch (err) {
      alert("Error parsing JSON file");
    }
  };
  reader.readAsText(file);
  e.target.value = null;
};

const clearAllStorage = async () => {
  if (!confirm('Clear all saved data including audio file? This cannot be undone.')) return;

  // Clear localStorage
  localStorage.removeItem('choreo_dancers');
  localStorage.removeItem('choreo_bookmarks');
  localStorage.removeItem('choreo_positions');
  localStorage.removeItem('choreo_fileName');

  // Clear IndexedDB
  await deleteAudioFromDB();

  // Reset state
  state.dancers = [];
  state.bookmarks = [];
  state.currentPositions = {};
  state.fileName = "";
  if (state.audioSrc) {
    URL.revokeObjectURL(state.audioSrc);
    state.audioSrc = null;
  }
  state.isPlaying = false;
  state.currentTime = 0;
  state.duration = 0;

  render();
  alert('All data cleared!');
};

// ============================================================================
// Rendering Functions
// ============================================================================
const render = () => {
  renderStage();
  renderPlayer();
  renderDancersList();
  renderTimeline();
  renderEditDancerModal();

  // Update waveform
  if (refs.waveform) {
    refs.waveform.draw();
  }
};

const renderStage = () => {
  if (!refs.stage) return;
  const stageContent = refs.stage.querySelector('.stage-content');
  if (!stageContent) return;

  // check if we need to rebuild
  const existingDancers = stageContent.querySelectorAll('[data-dancer-id]');
  if (existingDancers.length !== state.dancers.length) {
      // Rebuild completely
      const dancersHTML = state.dancers.map(dancer => {
        const pos = state.currentPositions[dancer.id] || { x: 50, y: 50 };
        return `
          <div
            data-dancer-id="${dancer.id}"
            class="absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center font-bold text-sm shadow-xl z-10 touch-none select-none transition-transform hover:scale-110"
            style="left: ${pos.x}%; top: ${pos.y}%; background-color: ${dancer.color}; cursor: grab; border: 3px solid rgba(255,255,255,0.9)"
            title="${dancer.name}"
          >
            ${getInitials(dancer.name)}
            <div class="absolute -bottom-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white/90"></div>
          </div>
        `;
      }).join('');

      stageContent.innerHTML = dancersHTML;

      // Attach event listeners
      state.dancers.forEach(dancer => {
        const el = stageContent.querySelector(`[data-dancer-id="${dancer.id}"]`);
        if (el) {
          el.addEventListener('mousedown', (e) => handleDragStart(e, dancer.id));
          el.addEventListener('touchstart', (e) => handleDragStart(e, dancer.id));
        }
      });
  } else {
      // Update positions only
      state.dancers.forEach(dancer => {
          const el = stageContent.querySelector(`[data-dancer-id="${dancer.id}"]`);
          if (el) {
              const pos = state.currentPositions[dancer.id] || { x: 50, y: 50 };
              el.style.left = `${pos.x}%`;
              el.style.top = `${pos.y}%`;
              el.style.cursor = state.draggedDancerId === dancer.id ? 'grabbing' : 'grab';
              el.style.backgroundColor = dancer.color; // Update color in case of edit
              // Update content if name changed (could be optimized further but text replacement is cheap)
              const initials = getInitials(dancer.name);
              if(!el.innerText.includes(initials)) {
                 el.innerHTML = `${initials}<div class="absolute -bottom-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white/90"></div>`;
              }
          }
      });
  }
};

const renderPlayer = () => {
  const playerContainer = document.getElementById('player-container');
  if (!playerContainer) return;

  if (!state.audioSrc) {
    if (!document.getElementById('upload-prompt')) {
      playerContainer.innerHTML = `
        <div class="h-24 border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-800" id="upload-prompt">
          <span class="flex items-center gap-2">
            <span style="font-size: 20px">⬆️</span> Load Audio
          </span>
        </div>
      `;
      document.getElementById('upload-prompt').addEventListener('click', () => refs.fileInput.click());
    }
    return;
  } 

  // If audio is loaded but player UI not built yet
  if (!document.getElementById('seek-slider')) {
    playerContainer.innerHTML = `
      <div class="space-y-4">
        <div class="relative h-16 w-full bg-gray-950 rounded-lg overflow-hidden group">
          <div class="absolute inset-0">
            <canvas id="waveform-canvas" width="800" height="64" class="w-full h-16 rounded-lg opacity-90"></canvas>
          </div>
          <input
            type="range"
            id="seek-slider"
            min="0"
            max="${state.duration || 0}"
            value="${state.currentTime}"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          <div
            id="progress-bar"
            class="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
            style="left: 0%"
          >
            <div class="absolute -top-1 -ml-[6px] w-[13px] h-[13px] bg-white rounded-full shadow-md"></div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <div id="current-time-display" class="font-mono text-xs text-gray-400 w-12">00:00</div>
          <div class="flex items-center gap-6">
            <button id="rewind-btn" class="p-2 text-gray-400 hover:text-white">
              <span style="font-size: 20px">⏪</span>
            </button>
            <button id="play-btn" class="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
              <span style="font-size: 28px">▶️</span>
            </button>
            <button id="forward-btn" class="p-2 text-gray-400 hover:text-white">
              <span style="font-size: 20px">⏩</span>
            </button>
          </div>
          <div id="duration-display" class="font-mono text-xs text-gray-400 w-12 text-right">00:00</div>
        </div>

        <button id="mark-btn" class="w-full bg-indigo-600 hover:bg-indigo-500 py-3 text-lg font-bold rounded-xl px-4 transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 active:scale-95 touch-manipulation focus:ring-indigo-500 text-white shadow-lg shadow-indigo-500/20">
          <span style="font-size: 20px">📝</span> Mark
        </button>
      </div>
    `;

    // Initialize Waveform
    refs.waveformCanvas = document.getElementById('waveform-canvas');
    refs.waveform = new Waveform(refs.waveformCanvas);
    if (state.audioSrc) {
      refs.waveform.loadAudio(state.audioSrc);
    }

    // Attach event listeners
    document.getElementById('seek-slider').addEventListener('input', handleSeek);
    document.getElementById('play-btn').addEventListener('click', togglePlay);
    document.getElementById('rewind-btn').addEventListener('click', () => {
      if (refs.audio) {
        refs.audio.currentTime -= 5;
        handleSeek({ target: { value: refs.audio.currentTime } }); // Update UI
      }
    });
    document.getElementById('forward-btn').addEventListener('click', () => {
      if (refs.audio) {
        refs.audio.currentTime += 5;
        handleSeek({ target: { value: refs.audio.currentTime } }); // Update UI
      }
    });
    document.getElementById('mark-btn').addEventListener('click', addManualBookmark);
  } else {
    // Just re-attach waveform canvas context if it was lost (e.g. resize/re-layout)
    // although with this logic it shouldn't be lost often.
    if(refs.waveform && !refs.waveform.ctx) {
       refs.waveform.canvas = document.getElementById('waveform-canvas');
       refs.waveform.ctx = refs.waveform.canvas.getContext('2d');
       refs.waveform.draw();
    }
  }

  // Update static/semi-static elements
  const playBtn = document.getElementById('play-btn');
  if(playBtn) playBtn.innerHTML = `<span style="font-size: 28px">${state.isPlaying ? '⏸️' : '▶️'}</span>`;

  const durationDisplay = document.getElementById('duration-display');
  if(durationDisplay) durationDisplay.textContent = formatTime(state.duration);
  
  const slider = document.getElementById('seek-slider');
  if(slider) slider.max = state.duration || 0;

  updatePlayerVisuals();
};

const updatePlayerVisuals = () => {
  if (!state.audioSrc) return;
  
  const slider = document.getElementById('seek-slider');
  const timeDisplay = document.getElementById('current-time-display');
  const progressBar = document.getElementById('progress-bar');
  
  if (slider && document.activeElement !== slider) {
    slider.value = state.currentTime;
  }
  
  if (timeDisplay) {
    timeDisplay.textContent = formatTime(state.currentTime);
  }
  
  if (progressBar) {
    const progress = state.duration ? (state.currentTime / state.duration) * 100 : 0;
    progressBar.style.left = `${progress}%`;
  }
  
  // Also redraw waveform progress if needed (optional, depends on if waveform moves)
  if (refs.waveform) {
    refs.waveform.draw();
  }
};

const renderDancersList = () => {
  const dancersListContainer = document.getElementById('dancers-list');
  if (!dancersListContainer) return;

  if (state.dancers.length === 0) {
    dancersListContainer.innerHTML = '';
    return;
  }

  const dancersHTML = state.dancers.map(dancer => `
    <div class="flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700">
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
          style="background-color: ${dancer.color}"
        >
          ${getInitials(dancer.name)}
        </div>
        <span class="text-gray-100">${dancer.name}</span>
      </div>
      <div class="flex gap-2">
        <button class="p-2 text-gray-400 hover:text-white" data-edit-dancer="${dancer.id}">
          <span style="font-size: 16px">✏️</span>
        </button>
        <button class="p-2 text-gray-400 hover:text-red-400" data-delete-dancer="${dancer.id}">
          <span style="font-size: 16px">🗑️</span>
        </button>
      </div>
    </div>
  `).join('');

  dancersListContainer.innerHTML = `
    <div class="space-y-3">
      <div
        class="flex items-center justify-between px-2 cursor-pointer hover:bg-gray-800/30 rounded-lg p-2 transition-colors"
        id="dancers-toggle"
      >
        <h2 class="font-semibold text-gray-300">Dancers (${state.dancers.length})</h2>
        <span class="text-gray-400">${state.showDancers ? '▼' : '▶'}</span>
      </div>
      ${state.showDancers ? `<div class="space-y-2">${dancersHTML}</div>` : ''}
    </div>
  `;

  // Attach event listeners
  document.getElementById('dancers-toggle').addEventListener('click', () => {
    state.showDancers = !state.showDancers;
    render();
  });

  state.dancers.forEach(dancer => {
    const editBtn = document.querySelector(`[data-edit-dancer="${dancer.id}"]`);
    const deleteBtn = document.querySelector(`[data-delete-dancer="${dancer.id}"]`);
    if (editBtn) editBtn.addEventListener('click', () => startEditingDancer(dancer));
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteDancer(dancer.id));
  });
};

const renderTimeline = () => {
  const timelineContainer = document.getElementById('timeline-container');
  if (!timelineContainer) return;

  if (state.bookmarks.length === 0) {
    timelineContainer.innerHTML = '';
    return;
  }

  const bookmarksHTML = state.bookmarks.map(bookmark => {
    const isCurrent = Math.abs(state.currentTime - bookmark.time) < 0.5;
    const isMov = bookmark.type === 'movement';
    const isEditing = state.editingBookmarkId === bookmark.id;
    const isStart = bookmark.time === 0;
    const isEnd = state.duration && Math.abs(bookmark.time - state.duration) < 0.1;

    return `
      <div
        class="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isCurrent ? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800 hover:bg-gray-800/50'} ${isMov ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-orange-500'}"
        data-bookmark-id="${bookmark.id}"
      >
        <div class="flex items-center gap-3 flex-1">
          <div class="font-mono text-xs ${isStart ? 'text-blue-400 font-bold' : isEnd ? 'text-purple-400 font-bold' : 'text-gray-500'} w-10">${formatTime(bookmark.time)}</div>
          <div class="flex flex-col flex-1">
            <div class="flex items-center gap-2">
              <span style="font-size: 14px" class="${isMov ? 'text-emerald-500' : 'text-orange-500'} flex-shrink-0">${isMov ? '🚶' : '📝'}</span>
              ${isEditing ? `
                <div class="flex items-center gap-2 w-full max-w-[200px]">
                  <input
                    class="bg-gray-800 text-white text-sm px-2 py-1 rounded border border-gray-600 w-full focus:border-indigo-500 outline-none"
                    value="${state.tempBookmarkName}"
                    id="edit-bookmark-input-${bookmark.id}"
                  />
                  <button class="text-green-400" data-save-bookmark="${bookmark.id}">
                    <span style="font-size: 16px">✅</span>
                  </button>
                </div>
              ` : `
                <span class="${isMov ? 'text-emerald-400' : 'text-orange-400'} font-medium truncate">
                  ${isStart ? '<span class="text-blue-400 font-bold">START</span> • ' : ''}${isEnd ? '<span class="text-purple-400 font-bold">END</span> • ' : ''}${bookmark.name}
                </span>
              `}
            </div>
          </div>
        </div>
        <div class="flex gap-1">
          ${!isEditing ? `
            <button class="p-2 text-gray-600 hover:text-white" data-edit-bookmark="${bookmark.id}">
              <span style="font-size: 16px">✏️</span>
            </button>
          ` : ''}
          <button class="p-2 text-gray-600 hover:text-red-400" data-delete-bookmark="${bookmark.id}">
            <span style="font-size: 16px">🗑️</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  timelineContainer.innerHTML = `
    <div class="space-y-3 pb-24 md:pb-6">
      <div class="flex items-center justify-between px-2">
        <h2 class="font-semibold text-gray-300">Timeline (${state.bookmarks.length})</h2>
        <button id="clear-bookmarks-btn" class="bg-transparent hover:bg-white/5 focus:ring-white/20 text-gray-400 hover:text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 active:scale-95 touch-manipulation !py-1 !px-2 text-xs">
          Clear All
        </button>
      </div>
      <div class="space-y-2 max-h-[400px] overflow-y-auto pr-2" id="bookmarks-scroll">
        ${bookmarksHTML}
      </div>
    </div>
  `;

  refs.bookmarksContainer = document.getElementById('bookmarks-scroll');

  // Attach event listeners
  document.getElementById('clear-bookmarks-btn').addEventListener('click', () => {
    state.bookmarks = [];
    saveToLocalStorage();
    render();
  });

  state.bookmarks.forEach(bookmark => {
    const bookmarkEl = document.querySelector(`[data-bookmark-id="${bookmark.id}"]`);
    const editBtn = document.querySelector(`[data-edit-bookmark="${bookmark.id}"]`);
    const saveBtn = document.querySelector(`[data-save-bookmark="${bookmark.id}"]`);
    const deleteBtn = document.querySelector(`[data-delete-bookmark="${bookmark.id}"]`);

    if (bookmarkEl) {
      bookmarkEl.addEventListener('click', (e) => {
        // Don't jump if clicking on buttons
        if (e.target.closest('button') || e.target.closest('input')) return;
        jumpToBookmark(bookmark);
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startEditingBookmark(bookmark);
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveBookmarkName(bookmark.id);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteBookmark(bookmark.id);
      });
    }

    // Handle input change
    const input = document.getElementById(`edit-bookmark-input-${bookmark.id}`);
    if (input) {
      input.addEventListener('input', (e) => {
        state.tempBookmarkName = e.target.value;
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveBookmarkName(bookmark.id);
        }
      });
      input.addEventListener('click', (e) => e.stopPropagation());
    }
  });
};

const renderEditDancerModal = () => {
  const modalContainer = document.getElementById('edit-dancer-modal');
  if (!modalContainer) return;

  if (!state.editingDancer) {
    modalContainer.innerHTML = '';
    modalContainer.style.display = 'none';
    return;
  }

  modalContainer.style.display = 'flex';
  modalContainer.innerHTML = `
    <div class="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700">
      <h3 class="text-lg font-semibold mb-4">Edit Dancer</h3>
      <input
        id="edit-dancer-input"
        class="w-full bg-gray-900 border border-gray-600 rounded-xl p-3 text-white mb-4"
        value="${state.editingDancer.name}"
      />
      <div class="flex justify-between gap-3">
        <button id="delete-dancer-btn" class="bg-red-500/10 text-red-400 hover:bg-red-500/20 focus:ring-red-500 px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 active:scale-95 touch-manipulation">
          Delete & Clear Entries
        </button>
        <div class="flex gap-2">
          <button id="cancel-edit-dancer-btn" class="bg-gray-700 hover:bg-gray-600 focus:ring-gray-500 text-gray-100 px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 active:scale-95 touch-manipulation">Cancel</button>
          <button id="save-dancer-btn" class="bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500 text-white shadow-lg shadow-indigo-500/20 px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 active:scale-95 touch-manipulation">Save</button>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  const input = document.getElementById('edit-dancer-input');
  document.getElementById('delete-dancer-btn').addEventListener('click', () => deleteDancer(state.editingDancer.id));
  document.getElementById('cancel-edit-dancer-btn').addEventListener('click', () => {
    state.editingDancer = null;
    render();
  });
  document.getElementById('save-dancer-btn').addEventListener('click', () => saveDancerName(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveDancerName(input.value);
    }
  });
};

// ============================================================================
// Initialization
// ============================================================================
const init = async () => {
  // Get DOM references
  refs.audio = document.getElementById('audio-element');
  refs.stage = document.getElementById('stage');
  refs.fileInput = document.getElementById('file-input');
  refs.jsonInput = document.getElementById('json-input');

  // Attach audio event listeners
  refs.audio.addEventListener('timeupdate', handleTimeUpdate);
  refs.audio.addEventListener('loadedmetadata', handleLoadedMetadata);
  refs.audio.addEventListener('ended', handleAudioEnded);

  // Attach file input listeners
  refs.fileInput.addEventListener('change', handleAudioUpload);
  refs.jsonInput.addEventListener('change', importData);

  // Attach header button listeners
  document.getElementById('upload-audio-btn').addEventListener('click', () => refs.fileInput.click());
  document.getElementById('import-btn').addEventListener('click', () => refs.jsonInput.click());
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('clear-storage-btn').addEventListener('click', clearAllStorage);
  document.getElementById('add-dancer-btn').addEventListener('click', addDancer);

  // Load saved data
  state.isLoading = true;
  loadFromLocalStorage();

  const audioData = await loadAudioFromDB();
  if (audioData && audioData.blob) {
    const url = URL.createObjectURL(audioData.blob);
    state.audioSrc = url;
    state.audioFileBlob = audioData.blob;

    // Set audio element source
    if (refs.audio) {
      refs.audio.src = url;
    }
  }

  state.isLoading = false;

  // Initial render
  render();

  // If we have audio, load waveform
  if (state.audioSrc) {
    refs.waveformCanvas = document.getElementById('waveform-canvas');
    if (refs.waveformCanvas) {
      refs.waveform = new Waveform(refs.waveformCanvas);
      await refs.waveform.loadAudio(state.audioSrc);
    }
  }
};

// ============================================================================
// Service Worker Registration
// ============================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/choreo/sw.js')
      .then(registration => console.log('SW registered:', registration.scope))
      .catch(error => console.log('SW registration failed:', error));
  });
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
