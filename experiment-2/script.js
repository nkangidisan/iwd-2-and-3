/* =========================================================
   Experiment 2 – Live Profile Studio
   Captures user input, validates it instantly and updates
   headings, labels and paragraphs on the page in real time.
   ========================================================= */
'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

// ---------- DOM references ----------
const form = $('#profileForm');
const inputs = {
  name: $('#nameInput'),
  email: $('#emailInput'),
  role: $('#roleInput'),
  bio: $('#bioInput'),
};
const preview = {
  card: $('#previewCard'),
  avatar: $('#pvAvatar'),
  name: $('#pvName'),
  role: $('#pvRole'),
  email: $('#pvEmail'),
  bio: $('#pvBio'),
  updated: $('#pvUpdated'),
};
const fontSize = $('#fontSize');
const STORAGE_KEY = 'exp2-saved-profiles';
const touched = new Set();   // fields the user has interacted with

// ---------- Validation rules (return '' when valid) ----------
const validators = {
  name(v) {
    v = v.trim();
    if (!v) return 'Name is required.';
    if (!/^[A-Za-z][A-Za-z .'-]*$/.test(v)) return 'Use letters, spaces, dots or hyphens only.';
    if (v.length < 3) return `Too short – ${3 - v.length} more character(s).`;
    return '';
  },
  email(v) {
    v = v.trim();
    if (!v) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v)) return 'Enter a valid email like name@example.com.';
    return '';
  },
  role(v) {
    return v ? '' : 'Please choose a role.';
  },
  bio(v) {
    const len = v.trim().length;
    if (len < 20) return `Write at least 20 characters (${20 - len} more).`;
    return '';
  },
};

const successText = {
  name: 'Looks great!',
  email: 'Valid email address.',
  role: 'Nice choice.',
  bio: 'Perfect length.',
};

// ---------- Simple sentiment lexicon ----------
const POSITIVE = new Set(('love loves loved passionate passion enjoy enjoys happy great good excellent amazing awesome ' +
  'creative curious excited exciting innovative best brilliant fun friendly helpful inspire inspired inspiring ' +
  'kind motivated positive proud skilled success successful smart strong talented thrive wonderful dedicated ' +
  'enthusiastic eager growth improve learning learn build building solve fascinated').split(' '));
const NEGATIVE = new Set(('hate hates hated bad boring sad angry poor terrible awful worst lazy weak difficult ' +
  'hard fail failed failure confused confusing stress stressed tired problem problems annoying worried ' +
  'afraid fear struggle struggling never').split(' '));

// ---------- Helpers ----------
function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getAccent() {
  return $('input[name="accent"]:checked').value;
}

function analyzeText(text) {
  const words = text.match(/\S+/g) || [];
  const tokens = text.toLowerCase().match(/[a-z']+/g) || [];
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length;
  let score = 0;
  tokens.forEach((t) => {
    if (POSITIVE.has(t)) score++;
    if (NEGATIVE.has(t)) score--;
  });
  return {
    words: words.length,
    chars: text.length,
    sentences,
    readSeconds: Math.ceil((words.length / 200) * 60), // ~200 words per minute
    score,
  };
}

const transforms = {
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  title: (s) => s.toLowerCase().replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toUpperCase()),
  sentence: (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase()),
  clean: (s) => s.replace(/\s+/g, ' ').trim(),
};

// ---------- Field feedback ----------
function validateField(key, show = touched.has(key)) {
  const error = validators[key](inputs[key].value);
  const field = inputs[key].closest('.field');
  const msg = $(`#${key}Msg`);

  if (!msg.dataset.hint) msg.dataset.hint = msg.textContent;

  field.classList.toggle('is-invalid', show && !!error);
  field.classList.toggle('is-valid', show && !error);
  inputs[key].setAttribute('aria-invalid', show && !!error);
  msg.textContent = !show ? msg.dataset.hint : (error || successText[key]);
  return error;
}

// ---------- Render: push input values into the page ----------
function render() {
  const name = inputs.name.value.trim();
  const email = inputs.email.value.trim();
  const role = inputs.role.value;
  const bio = inputs.bio.value.trim();
  const nameOk = !validators.name(name);

  // Heading: dynamic greeting
  const firstName = name.split(/\s+/)[0];
  $('#greeting').textContent = nameOk ? `${timeGreeting()}, ${firstName}! 👋` : `${timeGreeting()}! 👋`;
  document.title = nameOk ? `${name} · Live Profile Studio` : 'Live Profile Studio | Experiment 2';

  // Preview card
  preview.avatar.textContent = getInitials(name);
  preview.name.textContent = name || 'Your Name';
  preview.name.classList.toggle('placeholder', !name);
  preview.role.textContent = role || 'Your role';
  preview.email.textContent = '✉ ' + (email || 'your@email.com');
  preview.bio.textContent = bio || 'Your bio will appear here as you type…';
  preview.bio.classList.toggle('placeholder', !bio);

  // Counters
  updateCounter($('#nameCount'), inputs.name);
  updateCounter($('#bioCount'), inputs.bio);

  // Completeness bar
  const validCount = Object.keys(validators).filter((k) => !validators[k](inputs[k].value)).length;
  const pct = Math.round((validCount / 4) * 100);
  $('#completeBar').style.width = pct + '%';
  $('#completeText').textContent = pct === 100 ? 'Ready to save ✓' : `${pct}% complete`;

  renderAnalytics(inputs.bio.value);
}

function updateCounter(el, input) {
  const max = Number(input.maxLength);
  const len = input.value.length;
  el.textContent = `${len}/${max}`;
  el.classList.toggle('warn', len >= max * 0.9);
}

function renderAnalytics(text) {
  const a = analyzeText(text);
  $('#stWords').textContent = a.words;
  $('#stChars').textContent = a.chars;
  $('#stSentences').textContent = a.sentences;
  $('#stRead').textContent = a.readSeconds < 60 ? `${a.readSeconds}s` : `${(a.readSeconds / 60).toFixed(1)}m`;

  let label = 'Neutral 😐';
  let hint = 'Uses a small keyword lexicon to estimate the tone of your bio.';
  if (a.score > 0) {
    label = a.score > 2 ? 'Very positive 🤩' : 'Positive 😊';
    hint = 'Upbeat words detected – great for a profile!';
  } else if (a.score < 0) {
    label = a.score < -2 ? 'Very negative 😟' : 'Negative 🙁';
    hint = 'Try swapping a few words for more positive ones.';
  }
  const pos = Math.max(4, Math.min(96, 50 + a.score * 14));
  $('#sentNeedle').style.left = pos + '%';
  $('#sentLabel').textContent = label;
  $('#sentHint').textContent = a.words ? hint : 'Uses a small keyword lexicon to estimate the tone of your bio.';
}

function flashPreview() {
  preview.card.classList.remove('pulse');
  void preview.card.offsetWidth; // restart animation
  preview.card.classList.add('pulse');
  preview.updated.textContent = 'Last updated at ' + new Date().toLocaleTimeString();
}

// ---------- Theme & accent ----------
function setAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  try { localStorage.setItem('exp2-theme', theme); } catch (e) { /* storage unavailable */ }
}

// ---------- Toast ----------
let toastTimer;
function toast(message, type = 'ok') {
  const el = $('#toast');
  el.textContent = message;
  el.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ---------- Saved profiles (DOM elements created with JS) ----------
function loadProfiles() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; }
}
let profiles = loadProfiles();

function saveProfiles() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); } catch (e) { /* storage unavailable */ }
}

function renderSaved() {
  const list = $('#savedList');
  list.innerHTML = '';
  profiles.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'saved-item';
    li.style.setProperty('--c', p.accent);

    const avatar = document.createElement('div');
    avatar.className = 'mini-avatar';
    avatar.textContent = getInitials(p.name);

    const body = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = p.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${p.role} · ${p.email}`;
    const bio = document.createElement('p');
    bio.textContent = p.bio.length > 90 ? p.bio.slice(0, 90) + '…' : p.bio;

    const row = document.createElement('div');
    row.className = 'row';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn ghost small';
    loadBtn.type = 'button';
    loadBtn.textContent = 'Edit';
    loadBtn.addEventListener('click', () => loadIntoForm(p));
    const delBtn = document.createElement('button');
    delBtn.className = 'btn ghost small';
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      profiles = profiles.filter((x) => x.id !== p.id);
      saveProfiles();
      renderSaved();
      toast(`Deleted ${p.name}`);
    });

    row.append(loadBtn, delBtn);
    body.append(h3, meta, bio, row);
    li.append(avatar, body);
    list.append(li);
  });

  $('#savedCount').textContent = profiles.length;
  $('#emptyState').hidden = profiles.length > 0;
  $('#clearAll').hidden = profiles.length === 0;
}

function loadIntoForm(p) {
  inputs.name.value = p.name;
  inputs.email.value = p.email;
  inputs.role.value = p.role;
  inputs.bio.value = p.bio;
  const radio = $(`input[name="accent"][value="${p.accent}"]`);
  if (radio) radio.checked = true;
  setAccent(p.accent);
  Object.keys(inputs).forEach((k) => { touched.add(k); validateField(k); });
  render();
  flashPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(`Loaded ${p.name} into the form`);
}

// ---------- Events ----------
Object.entries(inputs).forEach(([key, input]) => {
  const evt = input.tagName === 'SELECT' ? 'change' : 'input';
  input.addEventListener(evt, () => {
    touched.add(key);
    validateField(key);
    render();
    flashPreview();
  });
  input.addEventListener('blur', () => {
    if (input.value) { touched.add(key); validateField(key); }
  });
});

$$('[data-transform]').forEach((btn) => {
  btn.addEventListener('click', () => {
    inputs.bio.value = transforms[btn.dataset.transform](inputs.bio.value);
    inputs.bio.dispatchEvent(new Event('input'));
    inputs.bio.focus();
  });
});

$$('input[name="accent"]').forEach((radio) => {
  radio.addEventListener('change', () => { setAccent(radio.value); flashPreview(); });
});

fontSize.addEventListener('input', () => {
  preview.bio.style.fontSize = fontSize.value + 'px';
  $('#fontSizeOut').textContent = fontSize.value + 'px';
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const errors = Object.keys(inputs).filter((k) => {
    touched.add(k);
    return validateField(k);
  });

  if (errors.length) {
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
    inputs[errors[0]].focus();
    toast(`Please fix ${errors.length} field(s) before saving.`, 'error');
    return;
  }

  const profile = {
    id: Date.now(),
    name: inputs.name.value.trim(),
    email: inputs.email.value.trim(),
    role: inputs.role.value,
    bio: inputs.bio.value.trim(),
    accent: getAccent(),
  };
  profiles.unshift(profile);
  saveProfiles();
  renderSaved();
  toast(`✓ Profile for ${profile.name} saved!`);
  form.reset();
});

form.addEventListener('reset', () => {
  // wait for the browser to clear the fields, then refresh the UI
  setTimeout(() => {
    touched.clear();
    Object.keys(inputs).forEach((k) => validateField(k, false));
    setAccent(getAccent());
    preview.bio.style.fontSize = '';
    $('#fontSizeOut').textContent = fontSize.value + 'px';
    preview.updated.textContent = 'Waiting for input…';
    render();
  });
});

$('#clearAll').addEventListener('click', () => {
  if (!confirm('Delete all saved profiles?')) return;
  profiles = [];
  saveProfiles();
  renderSaved();
  toast('All profiles cleared');
});

$('#themeToggle').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

// Show the current viewport width – handy for testing responsiveness
function updateViewport() {
  const w = window.innerWidth;
  const device = w < 600 ? 'Mobile' : w < 1024 ? 'Tablet' : 'Desktop';
  $('#viewport').textContent = `${device} · ${w}px`;
}
window.addEventListener('resize', updateViewport);

// ---------- Init ----------
(function init() {
  let theme = null;
  try { theme = localStorage.getItem('exp2-theme'); } catch (e) { /* ignore */ }
  if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(theme);
  setAccent(getAccent());
  updateViewport();
  renderSaved();
  render();
})();
