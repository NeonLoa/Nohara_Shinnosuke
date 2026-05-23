// ── DOM refs ──
const slScale = document.getElementById('scale');
const slSpeed = document.getElementById('speed');
const slBubble = document.getElementById('bubble-duration');
const slOpacity = document.getElementById('opacity');
const aiBaseUrl = document.getElementById('ai-base-url');
const aiApiKey = document.getElementById('ai-api-key');
const aiModel = document.getElementById('ai-model');
const aiTemperature = document.getElementById('ai-temperature');
const aiSystemPrompt = document.getElementById('ai-system-prompt');
const quoteList = document.getElementById('quote-list');
const newQuote = document.getElementById('new-quote');
const newTags = document.getElementById('new-tags');
const btnAdd = document.getElementById('add-quote');
const btnSave = document.getElementById('save');
const btnCancel = document.getElementById('cancel');

let quotes = [];
let originalSettings = {};
let originalQuotes = [];

// ── Init ──
async function init() {
  const s = await window.petAPI.getSettings();
  originalSettings = {
    scale: s.scale || 1,
    speed: s.speed || 1,
    bubbleDuration: s.bubbleDuration || 5000,
    opacity: s.opacity != null ? s.opacity : 0.95,
    aiBaseUrl: s.aiBaseUrl || '',
    aiApiKey: s.aiApiKey || '',
    aiModel: s.aiModel || '',
    aiTemperature: s.aiTemperature != null ? s.aiTemperature : 0.8,
    aiSystemPrompt: s.aiSystemPrompt || ''
  };
  slScale.value = originalSettings.scale;
  slSpeed.value = originalSettings.speed;
  slBubble.value = originalSettings.bubbleDuration;
  slOpacity.value = originalSettings.opacity;
  aiBaseUrl.value = originalSettings.aiBaseUrl;
  aiApiKey.value = originalSettings.aiApiKey;
  aiModel.value = originalSettings.aiModel;
  aiTemperature.value = originalSettings.aiTemperature;
  aiSystemPrompt.value = originalSettings.aiSystemPrompt;

  quotes = await window.petAPI.getQuotes();
  originalQuotes = JSON.parse(JSON.stringify(quotes));
  renderQuotes();

  bindSliders();
  updateLabels();
}

function bindSliders() {
  slScale.addEventListener('input', () => {
    updateLabels();
    window.petAPI.resizeWindow(parseFloat(slScale.value));
  });
  slSpeed.addEventListener('input', updateLabels);
  slBubble.addEventListener('input', updateLabels);
  slOpacity.addEventListener('input', updateLabels);
  aiTemperature.addEventListener('input', updateLabels);
}

function updateLabels() {
  document.getElementById('scale-val').textContent = parseFloat(slScale.value).toFixed(1) + 'x';
  document.getElementById('speed-val').textContent = parseFloat(slSpeed.value).toFixed(1) + 'x';
  document.getElementById('bubble-val').textContent = Math.round(slBubble.value / 1000) + '秒';
  document.getElementById('opacity-val').textContent = Math.round(slOpacity.value * 100) + '%';
  document.getElementById('ai-temp-val').textContent = parseFloat(aiTemperature.value).toFixed(1);
}

// ── Quote list ──
function renderQuotes() {
  quoteList.innerHTML = '';
  quotes.forEach((q, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="q-text">${esc(q.text)}</span>
      <span class="q-tags">${(q.tags || []).join(', ')}</span>
      <span class="q-del" data-idx="${i}">✕</span>
    `;
    quoteList.appendChild(li);
  });

  quoteList.querySelectorAll('.q-del').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      quotes.splice(idx, 1);
      renderQuotes();
    });
  });
}

function addQuote() {
  const text = newQuote.value.trim();
  if (!text) return;
  const tags = newTags.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);
  quotes.push({ text, tags, weight: 1 });
  newQuote.value = '';
  newTags.value = '';
  renderQuotes();
}

btnAdd.addEventListener('click', addQuote);
newQuote.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addQuote();
});

// ── Build current settings ──
function currentSettings() {
  return {
    scale: parseFloat(slScale.value),
    speed: parseFloat(slSpeed.value),
    bubbleDuration: parseInt(slBubble.value),
    opacity: parseFloat(slOpacity.value),
    aiBaseUrl: aiBaseUrl.value.trim(),
    aiApiKey: aiApiKey.value.trim(),
    aiModel: aiModel.value.trim(),
    aiTemperature: parseFloat(aiTemperature.value),
    aiSystemPrompt: aiSystemPrompt.value.trim()
  };
}

// ── Save / Cancel ──
btnSave.addEventListener('click', async () => {
  await window.petAPI.saveSettings(currentSettings());
  await window.petAPI.saveQuotes(quotes);
  window.close();
});

btnCancel.addEventListener('click', async () => {
  if (JSON.stringify(originalSettings) !== JSON.stringify(currentSettings())) {
    await window.petAPI.saveSettings(originalSettings);
  }
  window.close();
});

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

init();
