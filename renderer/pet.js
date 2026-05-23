// ── DOM refs ──
const petImg = document.getElementById('pet-img');
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubble-text');
const bubbleInput = document.getElementById('bubble-input');
const zzzEl = document.getElementById('zzz');
const ctxMenu = document.getElementById('context-menu');
const container = document.getElementById('pet-container');

// ── State ──
let settings = { scale: 1, speed: 1, bubbleDuration: 5000, opacity: 0.95 };
let quotes = [];
let state = 'IDLE';       // IDLE | WALKING | JUMPING | SLEEPING | SPECIAL
let idleTimer = null;
let sleepTimer = null;
let walkAnimId = null;
let bubbleTimer = null;
let jumpTimer = null;
let specialTimer = null;
let lastInteraction = Date.now();
let isFlipped = false;

// ── AI / Chat state ──
let aiConfig = { baseUrl: '', apiKey: '', model: '', systemPrompt: '', temperature: 0.8 };
let chatHistory = [];     // recent messages for context
let isChatting = false;

// ── Drag state ──
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let dragWinStartX = 0, dragWinStartY = 0;
let dragMoved = false;

// ── Init ──
async function init() {
  settings = await window.petAPI.getSettings();
  quotes = await window.petAPI.getQuotes();

  aiConfig.baseUrl = settings.aiBaseUrl || 'https://api.deepseek.com/v1';
  aiConfig.apiKey = settings.aiApiKey || '';
  aiConfig.model = settings.aiModel || 'deepseek-chat';
  aiConfig.systemPrompt = settings.aiSystemPrompt || defaultSystemPrompt();
  aiConfig.temperature = settings.aiTemperature != null ? settings.aiTemperature : 0.8;

  window.petAPI.onSettingsChanged((s) => {
    settings = s;
    aiConfig.baseUrl = s.aiBaseUrl || aiConfig.baseUrl;
    aiConfig.apiKey = s.aiApiKey || '';
    aiConfig.model = s.aiModel || aiConfig.model;
    aiConfig.systemPrompt = s.aiSystemPrompt || aiConfig.systemPrompt;
    aiConfig.temperature = s.aiTemperature != null ? s.aiTemperature : aiConfig.temperature;
  });
  window.petAPI.onQuotesUpdated((q) => { quotes = q; });

  setState('IDLE');
  startIdleTimer();
  startSleepTimer();
}

function defaultSystemPrompt() {
  return '你是野原新之助（野原しんのすけ），5岁，住在春日部。性格：调皮、好色、爱搭讪美女、讨厌吃青椒、喜欢动感超人。说话风格：可爱元气的关西腔小孩语气，句尾常用"～""！""嘛~"。回复简短（1-2句），用中文夹杂一点点日语词。';
}


// ── State Machine ──
function setState(newState) {
  state = newState;
  petImg.className = '';

  switch (newState) {
    case 'IDLE':
      petImg.classList.add('idle');
      break;
    case 'WALKING':
      petImg.classList.add('walking');
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
  petImg.classList.add('jumping');
  showRandomBubble();

  jumpTimer = setTimeout(() => {
    petImg.classList.remove('jumping');
    if (state === 'JUMPING') setState('IDLE');
    resetSleepTimer();
  }, 500);
}

async function onSpecial() {
  if (state === 'SPECIAL') return;
  cancelWalk();
  clearTimeout(jumpTimer);
  clearTimeout(specialTimer);
  petImg.classList.remove('jumping');
  setState('SPECIAL');
  petImg.classList.add('spinning');
  showBubble('看我的动感光波——biu！');

  specialTimer = setTimeout(() => {
    petImg.classList.remove('spinning');
    if (state === 'SPECIAL') setState('IDLE');
    resetSleepTimer();
  }, 800);
}

// ── Walk ──
function startIdleTimer() {
  clearTimeout(idleTimer);
  const delay = 10000 + Math.random() * 30000; // 10-40s
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
  const speed = (settings.speed || 1) * 0.8; // px per frame

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

  // Flip image toward movement direction
  if (stepX > 1) setFlip(false);
  else if (stepX < -1) setFlip(true);

  let frame = 0;
  walkAnimId = requestAnimationFrame(function step() {
    frame++;
    curX += stepX;
    curY += stepY;

    // Bounce at edges
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
    petImg.style.transform = flip ? 'scaleX(-1)' : 'scaleX(1)';
  }
}

// ── Sleep ──
function startSleepTimer() {
  clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {
    if (state === 'IDLE') {
      setState('SLEEPING');
    }
  }, 180000); // 3 min
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
  exitChatMode();
  bubbleText.classList.remove('hidden');
  bubbleText.textContent = text;
  bubble.className = 'show';

  bubbleTimer = setTimeout(() => {
    bubble.className = 'hide';
  }, settings.bubbleDuration || 5000);
}

bubble.addEventListener('click', (e) => {
  if (isChatting) return;
  if (bubble.classList.contains('show') && !bubble.classList.contains('hide')) {
    enterChatMode();
    e.stopPropagation();
  }
});

function enterChatMode() {
  isChatting = true;
  clearTimeout(bubbleTimer);

  bubbleText.classList.add('hidden');
  bubbleInput.classList.remove('hidden');
  bubbleInput.value = '';
  bubble.className = 'show';
  bubbleInput.focus();
}

function exitChatMode() {
  isChatting = false;
  bubbleInput.classList.add('hidden');
  bubbleText.classList.remove('hidden');
}

bubbleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleChatSubmit();
  }
  if (e.key === 'Escape') {
    exitChatMode();
    bubble.className = 'hide';
  }
  e.stopPropagation();
});

async function handleChatSubmit() {
  const msg = bubbleInput.value.trim();
  if (!msg) return;

  // Show user message briefly
  showBubble(msg);
  bubbleInput.classList.add('hidden');
  bubbleText.classList.remove('hidden');
  isChatting = false;

  // Show thinking indicator
  await sleep(300);
  showBubble('...');

  // Call AI
  const response = await callAI(msg);
  if (response) {
    showBubble(response);
  } else {
    showBubble('咦？好像联系不上我了...嘛~');
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function callAI(userMsg) {
  chatHistory.push({ role: 'user', content: userMsg });
  if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

  const messages = [
    { role: 'system', content: aiConfig.systemPrompt || defaultSystemPrompt() },
    ...chatHistory
  ];

  const reply = await window.petAPI.callAI(aiConfig, messages);
  if (reply) {
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);
  }
  return reply;
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

  // Weighted random
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
  ctxMenu.style.left = '';
  ctxMenu.style.top = '';

  const menuW = ctxMenu.offsetWidth;
  const menuH = ctxMenu.offsetHeight;
  const containerW = container.clientWidth;
  const containerH = container.clientHeight;

  const left = (x + menuW > containerW) ? containerW - menuW - 4 : x;
  const top = (y + menuH > containerH) ? containerH - menuH - 4 : y;

  ctxMenu.style.left = Math.max(0, left) + 'px';
  ctxMenu.style.top = Math.max(0, top) + 'px';
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
  if (e.button !== 0) return; // left click only
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

  // Skip jump if clicking on bubble or input
  if (e.target === bubble || e.target === bubbleInput || bubble.contains(e.target)) {
    if (dragMoved) { savePosition(); resetSleepTimer(); }
    return;
  }

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
}, 30000); // every 30s, 15% chance

// ── Start ──
init();
