// ── DOM refs ──
const petCanvas = document.getElementById('pet-canvas');
const petCtx = petCanvas.getContext('2d');
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubble-text');
const zzzEl = document.getElementById('zzz');
const ctxMenu = document.getElementById('context-menu');
const container = document.getElementById('pet-container');

// ── State ──
let settings = { scale: 1, speed: 1, bubbleDuration: 5000, opacity: 0.95 };
let quotes = [];
let state = 'IDLE';
let idleTimer = null;
let sleepTimer = null;
let walkAnimId = null;
let bubbleTimer = null;
let jumpTimer = null;
let specialTimer = null;
let lastInteraction = Date.now();
let isFlipped = false;

// ── Drag state ──
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let dragWinStartX = 0, dragWinStartY = 0;
let dragMoved = false;

// ── Image processing: remove black background ──
function removeBlackBackground(sourceImg) {
  const w = sourceImg.width;
  const h = sourceImg.height;
  petCanvas.width = w;
  petCanvas.height = h;
  petCanvas.style.maxWidth = '85%';
  petCanvas.style.maxHeight = '80%';

  petCtx.drawImage(sourceImg, 0, 0);
  const data = petCtx.getImageData(0, 0, w, h);
  const pixels = data.data;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Remove near-black pixels (threshold below 40 on all channels)
    // Use brightness for edge feathering
    const brightness = (r + g + b) / 3;
    if (brightness < 35) {
      pixels[i + 3] = 0; // fully transparent
    } else if (brightness < 65) {
      // Gradual fade at edges
      pixels[i + 3] = Math.round((brightness - 35) / 30 * 255);
    }
  }

  petCtx.putImageData(data, 0, 0);
}

// ── Init ──
async function init() {
  // Load and process image first
  const img = new Image();
  img.src = '../assets/野原新之助.png';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  removeBlackBackground(img);

  settings = await window.petAPI.getSettings();
  quotes = await window.petAPI.getQuotes();

  window.petAPI.onSettingsChanged((s) => {
    settings = s;
  });
  window.petAPI.onQuotesUpdated((q) => { quotes = q; });

  setState('IDLE');
  startIdleTimer();
  startSleepTimer();
}

// ── State Machine ──
function setState(newState) {
  state = newState;
  petCanvas.className = '';

  switch (newState) {
    case 'IDLE':
      petCanvas.classList.add('idle');
      break;
    case 'WALKING':
      petCanvas.classList.add('walking');
      break;
    case 'SLEEPING':
      zzzEl.classList.remove('hidden');
      zzzEl.classList.add('show');
      break;
  }
}

async function onJump() {
  if (state === 'JUMPING' || state === 'SPECIAL') return;
  cancelWalk();
  clearTimeout(jumpTimer);
  setState('JUMPING');
  petCanvas.classList.add('jumping');
  showRandomBubble();

  jumpTimer = setTimeout(() => {
    petCanvas.classList.remove('jumping');
    if (state === 'JUMPING') setState('IDLE');
    resetSleepTimer();
  }, 500);
}

async function onSpecial() {
  if (state === 'SPECIAL') return;
  cancelWalk();
  clearTimeout(jumpTimer);
  clearTimeout(specialTimer);
  petCanvas.classList.remove('jumping');
  setState('SPECIAL');
  petCanvas.classList.add('spinning');
  showBubble('看我的动感光波——biu！');

  specialTimer = setTimeout(() => {
    petCanvas.classList.remove('spinning');
    if (state === 'SPECIAL') setState('IDLE');
    resetSleepTimer();
  }, 800);
}

// ── Walk ──
function startIdleTimer() {
  clearTimeout(idleTimer);
  const delay = 10000 + Math.random() * 30000;
  idleTimer = setTimeout(() => {
    if (state === 'IDLE') startWalk();
  }, delay / (settings.speed || 1));
}

function cancelWalk() {
  if (walkAnimId) {
    cancelAnimationFrame(walkAnimId);
    walkAnimId = null;
  }
}

async function startWalk() {
  if (state !== 'IDLE') return;
  setState('WALKING');

  const screenW = window.screen.width;
  const screenH = window.screen.height;
  const speed = (settings.speed || 1) * 0.8;

  const targetX = 50 + Math.random() * (screenW - 250);
  const targetY = 50 + Math.random() * (screenH - 350);
  let curX = window.screenX;
  let curY = window.screenY;

  const dx = targetX - curX;
  const dy = targetY - curY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const totalFrames = Math.max(20, Math.round(dist / speed));
  const stepX = dx / totalFrames;
  const stepY = dy / totalFrames;

  if (stepX > 1) setFlip(false);
  else if (stepX < -1) setFlip(true);

  let frame = 0;
  walkAnimId = requestAnimationFrame(function step() {
    frame++;
    curX += stepX;
    curY += stepY;

    if (curX < 0) curX = 0;
    if (curY < 0) curY = 0;
    if (curX > screenW - 200) curX = screenW - 200;
    if (curY > screenH - 260) curY = screenH - 260;

    window.petAPI.moveWindow(curX, curY);

    if (frame < totalFrames) {
      walkAnimId = requestAnimationFrame(step);
    } else {
      walkAnimId = null;
      savePosition();
      setState('IDLE');
      startIdleTimer();
    }
  });
}

function setFlip(flip) {
  if (flip !== isFlipped) {
    isFlipped = flip;
    petCanvas.style.transform = flip ? 'scaleX(-1)' : 'scaleX(1)';
  }
}

// ── Sleep ──
function startSleepTimer() {
  clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {
    if (state === 'IDLE') {
      setState('SLEEPING');
    }
  }, 180000);
}

function resetSleepTimer() {
  lastInteraction = Date.now();
  if (state === 'SLEEPING') {
    zzzEl.classList.remove('show');
    zzzEl.classList.add('hidden');
    setState('IDLE');
    startIdleTimer();
  }
  startSleepTimer();
}

// ── Dialogue Bubble ──
function showBubble(text) {
  clearTimeout(bubbleTimer);
  bubbleText.textContent = text;
  bubble.className = 'show';

  bubbleTimer = setTimeout(() => {
    bubble.className = 'hide';
  }, settings.bubbleDuration || 5000);
}

function showRandomBubble() {
  const period = getTimePeriod();
  const candidates = quotes.filter(q => {
    const tags = q.tags || [];
    return tags.includes('anytime') || tags.includes(period);
  });

  if (candidates.length === 0) {
    const fallback = quotes.filter(q => (q.tags || []).includes('anytime'));
    if (fallback.length > 0) candidates.push(...fallback);
  }
  if (candidates.length === 0 && quotes.length > 0) {
    candidates.push(...quotes);
  }
  if (candidates.length === 0) {
    showBubble('你好呀~');
    return;
  }

  const totalWeight = candidates.reduce((s, q) => s + (q.weight || 1), 0);
  let r = Math.random() * totalWeight;
  for (const q of candidates) {
    r -= (q.weight || 1);
    if (r <= 0) {
      showBubble(q.text);
      return;
    }
  }
  showBubble(candidates[0].text);
}

function getTimePeriod() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 9) return 'morning';
  if (hour >= 11 && hour < 13) return 'noon';
  if (hour >= 22 || hour < 6) return 'night';
  return 'daytime';
}

// ── Context Menu ──
function showContextMenu(x, y) {
  ctxMenu.classList.remove('hidden');
  ctxMenu.style.left = x + 'px';
  ctxMenu.style.top = y + 'px';
}

function hideContextMenu() {
  ctxMenu.classList.add('hidden');
}

ctxMenu.addEventListener('click', (e) => {
  const action = e.target.closest('.menu-item')?.dataset.action;
  hideContextMenu();

  switch (action) {
    case 'talk': showRandomBubble(); onJump(); break;
    case 'settings': window.petAPI.openSettings(); break;
    case 'quit': window.petAPI.quitApp(); break;
  }
});

// ── Input Handling ──
container.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  hideContextMenu();

  dragStartX = e.screenX;
  dragStartY = e.screenY;
  dragWinStartX = window.screenX;
  dragWinStartY = window.screenY;
  isDragging = true;
  dragMoved = false;

  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const dx = e.screenX - dragStartX;
  const dy = e.screenY - dragStartY;

  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    dragMoved = true;
    window.petAPI.moveWindow(dragWinStartX + dx, dragWinStartY + dy);
  }
});

document.addEventListener('mouseup', (e) => {
  if (!isDragging) return;
  isDragging = false;

  if (!dragMoved) {
    onJump();
    resetSleepTimer();
  } else {
    savePosition();
    setState('IDLE');
    startIdleTimer();
    resetSleepTimer();
  }
});

container.addEventListener('dblclick', (e) => {
  onSpecial();
  resetSleepTimer();
});

container.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showContextMenu(e.offsetX, e.offsetY);
});

document.addEventListener('click', (e) => {
  if (!ctxMenu.contains(e.target)) hideContextMenu();
});

// ── Position save ──
function savePosition() {
  window.petAPI.savePosition(window.screenX, window.screenY);
}

// ── Periodic self-speak ──
setInterval(() => {
  if (state === 'IDLE' && Math.random() < 0.15) {
    showRandomBubble();
  }
}, 30000);

// ── Start ──
init();
