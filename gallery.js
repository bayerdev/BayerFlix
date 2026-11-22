const USERS = [
  { username: 'gagang@bayer.fam', name: 'Roselyn', role: 'sibling', label: '1st born', color: '#e50914', birthday: '10-16' },
  { username: 'kokong@bayer.fam', name: 'Reymark', role: 'sibling', label: '2nd born', color: '#0071eb', birthday: '01-07', memorial: true },
  { username: 'bibi@bayer.fam', name: 'Rubby Ann', role: 'sibling', label: '3rd born', color: '#f5a623', birthday: '08-05' },
  { username: 'lang@bayer.fam', name: 'Annalou', role: 'sibling', label: '4th born', color: '#2ecc71', birthday: '02-03' },
  { username: 'pem@bayer.fam', name: 'Ephrem', role: 'sibling', label: '5th born', color: '#9b59b6', birthday: '06-09' },
  { username: 'yang@bayer.fam', name: 'Andrea', role: 'sibling', label: '6th born', color: '#e84393', birthday: '08-16' },
  { username: 'landex@bayer.fam', name: 'Rolando', role: 'parent', color: '#16a085', birthday: '09-18', callName: 'Papa' },
  { username: 'an-an@bayer.fam', name: 'Anselma', role: 'parent', color: '#d35400', birthday: '12-24', callName: 'Mama' },
  { username: 'pani@bayer.fam', name: 'Stephany', role: 'niece', color: '#c0392b' },
  { username: 'lian@bayer.fam', name: 'Leainn', role: 'niece', color: '#2980b9' },
  { username: 'boki@bayer.fam', name: 'Kiannah', role: 'niece', color: '#27ae60' },
  { username: 'ziang@bayer.fam', name: 'Zhea', role: 'niece', color: '#8e44ad' },
  { username: 'babysmall@bayer.fam', name: 'Kezzianah', role: 'niece', color: '#f39c12' }
];

const ROLE_LABELS = { parent: 'Parent', sibling: 'Sibling', niece: 'Niece' };

function roleLabel(user) {
  return user.label || ROLE_LABELS[user.role];
}

const GENRES = [
  'Birthday',
  'Graduation',
  'Family Event',
  'Christmas',
  'New Year',
  'Vacation',
  'Anniversary',
  'Reunion',
  'Remembering Reymark',
  'Everyday',
  'Other'
];

const GENRE_ICONS = {
  Birthday: 'fa-cake-candles',
  Graduation: 'fa-graduation-cap',
  'Family Event': 'fa-people-roof',
  Christmas: 'fa-tree',
  'New Year': 'fa-champagne-glasses',
  Vacation: 'fa-umbrella-beach',
  Anniversary: 'fa-heart',
  Reunion: 'fa-users',
  'Remembering Reymark': 'fa-dove',
  Everyday: 'fa-sun',
  Other: 'fa-folder'
};

const DB_NAME = 'bayerFamilyGallery';
const STORE = 'media';
const EVENT_STORE = 'events';
const AVATAR_KEY = 'bayerAvatars';
const THEME_KEY = 'bayerTheme';

let db = null;
let allItems = [];
let currentUser = null;
let activeGenre = 'All';
let activeTag = null;
let activeView = 'home';
let searchTerm = '';
let uploaderFilter = 'all';
let sortMode = 'newest';
let currentList = [];
let currentIndex = 0;
let pendingFiles = [];
let pendingUser = null;
let avatars = {};
let theme = { mode: 'dark' };
let selectMode = false;
let selectedIds = new Set();
let editingId = null;
let confirmResolver = null;
const systemQuery = window.matchMedia('(prefers-color-scheme: light)');
const urlCache = new Map();
const openPhotoComments = new Set();
let slideOn = false;
let slideTimer = null;

const $ = (id) => document.getElementById(id);

const GENRE_KEYWORDS = {
  Birthday: ['birthday', 'bday', 'b-day', 'kaarawan'],
  Graduation: ['graduation', 'graduate', 'graduating'],
  Christmas: ['christmas', 'xmas', 'pasko', 'noche buena'],
  'New Year': ['new year', 'bagong taon'],
  Vacation: ['vacation', 'beach', 'getaway'],
  Anniversary: ['anniversary'],
  Reunion: ['reunion'],
  'Remembering Reymark': ['reymark', 'kokong']
};

const MEMORIAL_GENRE = 'Remembering Reymark';
const MEMORIAL_USER = 'kokong@bayer.fam';

function itemGenres(item) {
  const base = Array.isArray(item.genres) && item.genres.length ? item.genres.slice() : [item.genre];
  const aboutHim = item.uploader === MEMORIAL_USER || itemPeople(item).includes(MEMORIAL_USER);
  if (aboutHim && !base.includes(MEMORIAL_GENRE)) base.push(MEMORIAL_GENRE);
  return base;
}

function itemDate(item) {
  return item.takenAt || item.createdAt;
}

function itemPeople(item) {
  return Array.isArray(item.people) ? item.people : [];
}

function personName(username) {
  const found = userByUsername(username);
  return found ? found.name : '';
}

function personSearch(username) {
  return personName(username) + ' ' + username.split('@')[0];
}

function buildPeopleChecks(containerId) {
  const wrap = $(containerId);
  wrap.innerHTML = '';
  USERS.forEach((user) => {
    const label = document.createElement('label');
    label.className = 'check-chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = user.username;
    label.appendChild(input);
    label.appendChild(document.createTextNode(user.name));
    wrap.appendChild(label);
  });
}

function dateToString(ts) {
  const d = new Date(ts);
  return (
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  );
}

function stringToTimestamp(str, fallback) {
  if (!str) return fallback;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

function buildGenreChecks(containerId) {
  const wrap = $(containerId);
  wrap.innerHTML = '';
  GENRES.forEach((genre) => {
    const label = document.createElement('label');
    label.className = 'check-chip';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = genre;
    label.appendChild(input);
    label.appendChild(document.createTextNode(genre));
    wrap.appendChild(label);
  });
}

function getChecked(containerId) {
  return Array.from(document.querySelectorAll('#' + containerId + ' input:checked')).map((i) => i.value);
}

function setChecked(containerId, values) {
  document.querySelectorAll('#' + containerId + ' input').forEach((input) => {
    input.checked = values.includes(input.value);
  });
}

function autoCheckFromCaption(captionId, containerId) {
  const text = $(captionId).value.toLowerCase();
  GENRES.forEach((genre) => {
    const words = GENRE_KEYWORDS[genre] || [];
    if (words.some((w) => text.includes(w))) {
      const box = document.querySelector('#' + containerId + ' input[value="' + genre + '"]');
      if (box) box.checked = true;
    }
  });
}

function loadAvatars() {
  try {
    avatars = JSON.parse(localStorage.getItem(AVATAR_KEY)) || {};
  } catch (error) {
    avatars = {};
  }
}

function cacheAvatars() {
  try {
    localStorage.setItem(AVATAR_KEY, JSON.stringify(avatars));
  } catch (error) {}
}

async function syncAvatars() {
  try {
    const { data, error } = await sb.from('avatars').select('username,data_url');
    if (error) throw error;
    const next = {};
    data.forEach((row) => {
      next[row.username] = row.data_url;
    });
    avatars = next;
    cacheAvatars();
  } catch (error) {}
}

async function saveAvatar(username) {
  try {
    if (avatars[username]) {
      const { error } = await sb
        .from('avatars')
        .upsert({ username, data_url: avatars[username], updated_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      const { error } = await sb.from('avatars').delete().eq('username', username);
      if (error) throw error;
    }
    cacheAvatars();
    return true;
  } catch (error) {
    return false;
  }
}

function applyAvatar(el, user) {
  if (!el || !user) return;
  const src = avatars[user.username];
  if (src) {
    el.style.backgroundImage = 'url(' + src + ')';
    el.style.backgroundColor = '#000';
    el.textContent = '';
  } else {
    el.style.backgroundImage = 'none';
    el.style.backgroundColor = user.color;
    el.textContent = user.name.charAt(0).toUpperCase();
  }
}

function processAvatar(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('load'));
    };
    img.src = url;
  });
}

function getUrl(item) {
  if (item.blob instanceof Blob) {
    if (!urlCache.has(item.id)) {
      urlCache.set(item.id, URL.createObjectURL(item.blob));
    }
    return urlCache.get(item.id);
  }
  return item._url || '';
}

function thumbUrl(item) {
  return item._thumb || getUrl(item);
}

function revokeUrl(id) {
  if (urlCache.has(id)) {
    URL.revokeObjectURL(urlCache.get(id));
    urlCache.delete(id);
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function findUser(username) {
  return USERS.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
}

function userByUsername(username) {
  return USERS.find((u) => u.username === username);
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function loadTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_KEY));
    if (saved) {
      if (['dark', 'light', 'system'].includes(saved.mode)) theme.mode = saved.mode;
    }
  } catch (error) {
    theme = { mode: 'dark' };
  }
}

function saveTheme() {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  } catch (error) {
    return;
  }
}

function applyTheme() {
  const resolved = theme.mode === 'system' ? (systemQuery.matches ? 'light' : 'dark') : theme.mode;
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  document
    .querySelectorAll('#modeOptions button')
    .forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === theme.mode));
}

function updateTopbar() {
  const solid = window.scrollY > 40 || document.body.classList.contains('no-hero');
  $('topbar').classList.toggle('solid', solid);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function extractTags(text) {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) || [];
  return matches.map((t) => t.slice(1).toLowerCase());
}

function parseTags(caption, tagsText) {
  const fromCaption = extractTags(caption);
  const fromField = tagsText
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => t.replace(/^#+/, '').toLowerCase())
    .filter(Boolean);
  return [...new Set([...fromCaption, ...fromField])];
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function monthLabel(ts) {
  return new Date(ts).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}

function renderProfiles() {
  const grid = $('profileGrid');
  grid.innerHTML = '';
  USERS.forEach((user) => {
    const btn = document.createElement('button');
    btn.className = 'profile-card';
    const avatar = document.createElement('div');
    avatar.className = 'profile-avatar';
    applyAvatar(avatar, user);
    const name = document.createElement('span');
    name.className = 'profile-name';
    name.textContent = user.name;
    const role = document.createElement('span');
    role.className = 'profile-role';
    role.textContent = roleLabel(user);
    btn.appendChild(avatar);
    btn.appendChild(name);
    btn.appendChild(role);
    btn.addEventListener('click', () => openLogin(user));
    grid.appendChild(btn);
  });
}

function openLogin(user) {
  pendingUser = user;
  $('loginName').textContent = 'Hi, ' + user.name;
  $('loginCode').value = '';
  $('loginError').textContent = '';
  openModal('loginModal');
  setTimeout(() => $('loginCode').focus(), 50);
}

async function handleLogin(event) {
  event.preventDefault();
  const code = $('loginCode').value.trim();
  if (!code) return;
  const button = $('loginForm').querySelector('button[type="submit"]');
  button.disabled = true;
  $('loginError').textContent = '';
  try {
    const { error } = await sb.auth.signInWithPassword({ email: authEmail(pendingUser), password: code });
    if (error) {
      const offline = /fetch|network/i.test(error.message || '');
      $('loginError').textContent = offline
        ? 'Could not connect. Please check your internet and try again.'
        : 'That access code is not right. Please try again.';
      return;
    }
    $('loginCode').value = '';
    closeModal('loginModal');
    await startApp(pendingUser);
  } finally {
    button.disabled = false;
  }
}

async function logout() {
  try {
    await sb.auth.signOut();
  } catch (error) {}
  clearUrlCache();
  currentUser = null;
  $('userMenu').classList.add('hidden');
  selectMode = false;
  selectedIds.clear();
  $('selectBar').classList.add('hidden');
  document.body.classList.remove('selecting');
  $('app').classList.add('hidden');
  $('profileScreen').classList.remove('hidden');
  document.querySelectorAll('.modal:not(.hidden)').forEach((m) => closeModal(m.id));
  renderProfiles();
}

async function startApp(user) {
  currentUser = user;
  $('profileScreen').classList.add('hidden');
  $('app').classList.remove('hidden');
  applyAvatar($('userAvatar'), user);
  $('userName').textContent = user.name;
  activeGenre = 'All';
  activeTag = null;
  activeView = 'home';
  searchTerm = '';
  uploaderFilter = 'all';
  sortMode = 'newest';
  $('searchInput').value = '';
  $('sortSelect').value = 'newest';
  setNavActive('navHome');
  await syncAvatars();
  applyAvatar($('userAvatar'), user);
  renderProfiles();
  try {
    await refreshItems();
    await refreshEvents();
  } catch (error) {
    toast('Could not load the gallery. Please check your connection.');
  }
  applyUrlParams();
  render();
  window.scrollTo(0, 0);
}

async function refreshItems() {
  allItems = await dbGetAll();
  allItems.forEach((item) => {
    item.tags = (item.tags || []).filter(Boolean);
    item.uploaderName = personName(item.uploader) || item.uploaderName;
  });
  allItems.sort((a, b) => b.createdAt - a.createdAt);
}

function applyUrlParams() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const genre = params.get('genre');
  if (q) {
    searchTerm = q;
    $('searchInput').value = q;
    $('searchBox').classList.add('open');
  }
  if (genre && GENRES.includes(genre)) {
    activeGenre = genre;
  }
}

function setNavActive(id) {
  document.querySelectorAll('.nav-link').forEach((el) => el.classList.remove('active'));
  $(id).classList.add('active');
}

function sortItems(list) {
  const copy = list.slice();
  if (sortMode === 'oldest') {
    copy.sort((a, b) => itemDate(a) - itemDate(b));
  } else if (sortMode === 'az') {
    copy.sort((a, b) => (a.caption || '~').toLowerCase().localeCompare((b.caption || '~').toLowerCase()));
  } else if (sortMode === 'uploader') {
    copy.sort((a, b) => a.uploaderName.localeCompare(b.uploaderName) || itemDate(b) - itemDate(a));
  } else {
    copy.sort((a, b) => itemDate(b) - itemDate(a));
  }
  return copy;
}

function getFiltered() {
  const term = searchTerm.trim().toLowerCase().replace(/^#/, '');
  const result = allItems.filter((item) => {
    if (activeView === 'photos' && item.type !== 'image') return false;
    if (activeView === 'videos' && item.type !== 'video') return false;
    if (activeView === 'mine' && item.uploader !== currentUser.username) return false;
    if (uploaderFilter !== 'all' && item.uploader !== uploaderFilter) return false;
    if (activeGenre !== 'All' && !itemGenres(item).includes(activeGenre)) return false;
    if (activeTag && !item.tags.includes(activeTag)) return false;
    if (term) {
      const haystack = [
        item.caption,
        itemGenres(item).join(' '),
        item.uploaderName,
        item.uploader ? item.uploader.split('@')[0] : '',
        itemPeople(item).map(personSearch).join(' '),
        item.tags.join(' ')
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    }
    return true;
  });
  return sortItems(result);
}

function hasActiveFilters() {
  return (
    activeGenre !== 'All' ||
    activeTag !== null ||
    searchTerm.trim() !== '' ||
    uploaderFilter !== 'all'
  );
}

function isAlbumOverview() {
  return activeView === 'albums' && !hasActiveFilters();
}

function isFiltering() {
  return hasActiveFilters() || activeView !== 'home';
}

function renderGenreChips() {
  const wrap = $('genreChips');
  wrap.innerHTML = '';
  ['All', ...GENRES].forEach((genre) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (activeGenre === genre ? ' active' : '');
    chip.textContent = genre;
    chip.addEventListener('click', () => {
      activeGenre = genre;
      render();
    });
    wrap.appendChild(chip);
  });
}

function renderTagChips() {
  const wrap = $('tagChips');
  wrap.innerHTML = '';
  const counts = {};
  allItems.forEach((item) => item.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .forEach(([tag]) => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (activeTag === tag ? ' active' : '');
      chip.textContent = '#' + tag;
      chip.addEventListener('click', () => {
        activeTag = activeTag === tag ? null : tag;
        render();
      });
      wrap.appendChild(chip);
    });
}

function fillUploaderSelect() {
  const select = $('uploaderFilter');
  select.innerHTML = '';
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = 'Everyone';
  select.appendChild(all);
  USERS.forEach((user) => {
    const option = document.createElement('option');
    option.value = user.username;
    option.textContent = user.name;
    select.appendChild(option);
  });
}

function renderToolbar() {
  const photos = allItems.filter((i) => i.type === 'image').length;
  const videos = allItems.filter((i) => i.type === 'video').length;
  const albums = new Set(allItems.flatMap((i) => itemGenres(i))).size;
  const contributors = new Set(allItems.map((i) => i.uploader)).size;
  let html =
    '<b>' + photos + '</b> photos · <b>' + videos + '</b> videos · <b>' + albums +
    '</b> albums · <b>' + contributors + '</b> contributors';
  if (isFiltering() && !isAlbumOverview()) {
    html += ' · Showing <b>' + getFiltered().length + '</b>';
  }
  $('stats').innerHTML = html;
  $('uploaderFilter').value = uploaderFilter;
  $('sortSelect').value = sortMode;
  $('clearFilters').classList.toggle('hidden', !hasActiveFilters());
  $('addToAlbum').classList.toggle('hidden', activeGenre === 'All');
  $('addToAlbumLabel').textContent = 'Add to ' + activeGenre;
  $('selectLabel').textContent = selectMode ? 'Done' : 'Select';
  $('selectBtn').classList.toggle('hidden', allItems.length === 0);
  $('slideshowBtn').classList.toggle('hidden', slideshowList().length === 0);
}

function renderHero() {
  const hero = $('hero');
  const hideHero = isFiltering() || allItems.length === 0;
  document.body.classList.toggle('no-hero', hideHero && allItems.length > 0);
  if (allItems.length === 0) {
    hero.classList.remove('hidden');
    hero.innerHTML =
      '<div class="hero-info">' +
      '<span class="hero-badge">Welcome</span>' +
      '<h2 class="hero-title">Our Family Gallery</h2>' +
      '<p class="hero-meta">No memories yet. Upload the first photo or video for the family.</p>' +
      '<div class="hero-actions"><button class="btn btn-light" id="heroUpload"><i class="fa-solid fa-upload"></i> Upload now</button></div>' +
      '</div>';
    $('heroUpload').addEventListener('click', () => openModal('uploadModal'));
    return;
  }
  if (hideHero) {
    hero.classList.add('hidden');
    hero.innerHTML = '';
    return;
  }
  hero.classList.remove('hidden');
  const item = allItems[0];
  const url = getUrl(item);
  const media =
    item.type === 'video'
      ? '<video class="hero-media" src="' + url + '" autoplay muted loop playsinline></video>'
      : '<img class="hero-media" src="' + url + '" alt="">';
  hero.innerHTML =
    media +
    '<div class="hero-info">' +
    '<span class="hero-badge">Latest · ' + escapeHtml(itemGenres(item).join(' · ')) + '</span>' +
    '<h2 class="hero-title">' + escapeHtml(item.caption || 'Family memory') + '</h2>' +
    '<p class="hero-meta">Uploaded by ' + escapeHtml(item.uploaderName) + ' · ' + formatDate(itemDate(item)) + '</p>' +
    '<div class="hero-actions">' +
    '<button class="btn btn-light" id="heroPlay"><i class="fa-solid fa-play"></i> ' + (item.type === 'video' ? 'Play' : 'View') + '</button>' +
    '<button class="btn btn-ghost" id="heroUploadMore"><i class="fa-solid fa-plus"></i> Upload</button>' +
    '</div>' +
    '</div>';
  $('heroPlay').addEventListener('click', () => openViewer(allItems, 0));
  $('heroUploadMore').addEventListener('click', () => openModal('uploadModal'));
}

function createCard(item, list, index) {
  const card = document.createElement('div');
  card.className = 'card';
  const url = getUrl(item);
  const media =
    item.type === 'video'
      ? '<video class="card-media" src="' + url + '#t=0.1" preload="metadata" muted playsinline></video>'
      : '<img class="card-media" src="' + thumbUrl(item) + '" alt="" loading="lazy">';
  card.innerHTML =
    media +
    '<span class="card-type"><i class="fa-solid ' + (item.type === 'video' ? 'fa-play' : 'fa-image') + '"></i></span>' +
    '<div class="card-overlay">' +
    '<div class="card-caption">' + escapeHtml(item.caption || 'Untitled') + '</div>' +
    '<div class="card-sub"><span class="mini-avatar"></span>' + escapeHtml(item.uploaderName) + ' · ' + escapeHtml(itemGenres(item).join(', ')) + '</div>' +
    '</div>';
  applyAvatar(card.querySelector('.mini-avatar'), userByUsername(item.uploader));
  card.dataset.id = item.id;
  if (selectMode) {
    if (canEdit(item)) {
      const check = document.createElement('span');
      check.className = 'card-check';
      check.innerHTML = '<i class="fa-solid fa-check"></i>';
      card.appendChild(check);
      card.classList.add('selectable');
      if (selectedIds.has(item.id)) card.classList.add('selected');
      card.addEventListener('click', () => toggleSelect(item.id));
    } else {
      card.classList.add('locked');
    }
  } else {
    card.addEventListener('click', () => openViewer(list, index));
  }
  return card;
}

function createRow(title, items, countLabel) {
  const row = document.createElement('section');
  row.className = 'row';
  const heading = document.createElement('h2');
  heading.className = 'row-title';
  heading.innerHTML = escapeHtml(title) + '<small>' + countLabel + '</small>';
  const scroller = document.createElement('div');
  scroller.className = 'row-scroller';
  items.forEach((item, index) => scroller.appendChild(createCard(item, items, index)));
  row.appendChild(heading);
  row.appendChild(scroller);
  return row;
}

function renderGrid(list) {
  const content = $('content');
  const grouped = sortMode === 'newest' || sortMode === 'oldest';
  if (!grouped) {
    const grid = document.createElement('div');
    grid.className = 'grid';
    list.forEach((item, index) => grid.appendChild(createCard(item, list, index)));
    content.appendChild(grid);
    return;
  }
  let currentLabel = null;
  let grid = null;
  let title = null;
  let groupCount = 0;
  list.forEach((item, index) => {
    const label = monthLabel(itemDate(item));
    if (label !== currentLabel) {
      if (title) title.innerHTML = escapeHtml(currentLabel) + '<small>' + groupCount + '</small>';
      currentLabel = label;
      groupCount = 0;
      title = document.createElement('h3');
      title.className = 'group-title';
      grid = document.createElement('div');
      grid.className = 'grid';
      content.appendChild(title);
      content.appendChild(grid);
    }
    groupCount += 1;
    grid.appendChild(createCard(item, list, index));
  });
  if (title) title.innerHTML = escapeHtml(currentLabel) + '<small>' + groupCount + '</small>';
}

function renderAlbums() {
  const content = $('content');
  const albumTitle = document.createElement('h2');
  albumTitle.className = 'section-title';
  albumTitle.innerHTML = 'Event Albums<small>' + GENRES.length + ' albums</small>';
  content.appendChild(albumTitle);
  const albumGrid = document.createElement('div');
  albumGrid.className = 'album-grid';
  GENRES.forEach((genre) => {
    const items = allItems.filter((i) => itemGenres(i).includes(genre));
    const photos = items.filter((i) => i.type === 'image').length;
    const videos = items.length - photos;
    const card = document.createElement('button');
    card.className = 'album-card' + (items.length ? '' : ' empty-album');
    let cover = '<div class="album-placeholder"><i class="fa-solid ' + GENRE_ICONS[genre] + '"></i></div>';
    if (items.length) {
      const first = items[0];
      const url = getUrl(first);
      cover =
        first.type === 'video'
          ? '<video class="album-cover" src="' + url + '#t=0.1" preload="metadata" muted playsinline></video>'
          : '<img class="album-cover" src="' + thumbUrl(first) + '" alt="" loading="lazy">';
    }
    card.innerHTML =
      cover +
      '<div class="album-info">' +
      '<div class="album-name">' + escapeHtml(genre) + '</div>' +
      '<div class="album-count">' + (items.length ? photos + ' photos · ' + videos + ' videos' : 'Empty') + '</div>' +
      '</div>';
    card.addEventListener('click', () => {
      activeGenre = genre;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    albumGrid.appendChild(card);
  });
  content.appendChild(albumGrid);

  const memberTitle = document.createElement('h2');
  memberTitle.className = 'section-title';
  memberTitle.innerHTML = 'Family Members<small>' + USERS.length + ' people</small>';
  content.appendChild(memberTitle);
  const memberGrid = document.createElement('div');
  memberGrid.className = 'member-grid';
  USERS.forEach((user) => {
    const count = allItems.filter((i) => i.uploader === user.username).length;
    const card = document.createElement('button');
    card.className = 'member-card';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    applyAvatar(avatar, user);
    const name = document.createElement('span');
    name.className = 'member-name';
    name.textContent = user.name;
    const countEl = document.createElement('span');
    countEl.className = 'member-count';
    countEl.textContent = count + (count === 1 ? ' upload' : ' uploads');
    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(countEl);
    card.addEventListener('click', () => {
      uploaderFilter = user.username;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    memberGrid.appendChild(card);
  });
  content.appendChild(memberGrid);
}

function birthdayDays(user) {
  const [m, d] = user.birthday.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next - today) / 86400000);
}

function birthdayDateLabel(user) {
  const [m, d] = user.birthday.split('-').map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric' });
}

function renderBirthdays(content) {
  const upcoming = USERS.filter((u) => u.birthday)
    .map((u) => ({ user: u, days: birthdayDays(u) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4);
  if (upcoming.length === 0) return;
  const row = document.createElement('section');
  row.className = 'row';
  const heading = document.createElement('h2');
  heading.className = 'row-title';
  heading.textContent = 'Upcoming Birthdays';
  const grid = document.createElement('div');
  grid.className = 'birthday-grid';
  upcoming.forEach(({ user, days }) => {
    const call = user.callName || user.name;
    const base = user.memorial ? 'Remembering ' + call + "'s birthday" : call + "'s birthday";
    const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days';
    const count = allItems.filter(
      (i) => i.uploader === user.username || itemPeople(i).includes(user.username)
    ).length;
    const card = document.createElement('button');
    card.className = 'birthday-card' + (days === 0 ? ' today' : '');
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    applyAvatar(avatar, user);
    const info = document.createElement('div');
    info.className = 'birthday-info';
    const title = document.createElement('div');
    title.className = 'birthday-title';
    title.textContent = base + ' ' + when;
    const sub = document.createElement('div');
    sub.className = 'birthday-sub';
    sub.textContent =
      birthdayDateLabel(user) + ' · ' + (count === 0 ? 'No photos yet' : count + (count === 1 ? ' photo' : ' photos'));
    info.appendChild(title);
    info.appendChild(sub);
    card.appendChild(avatar);
    card.appendChild(info);
    card.addEventListener('click', () => {
      searchTerm = user.name;
      $('searchInput').value = user.name;
      $('searchBox').classList.add('open');
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    grid.appendChild(card);
  });
  row.appendChild(heading);
  row.appendChild(grid);
  content.appendChild(row);
}

function renderContent() {
  const content = $('content');
  content.innerHTML = '';
  if (!isFiltering()) renderBirthdays(content);
  if (allItems.length === 0) {
    content.insertAdjacentHTML(
      'beforeend',
      '<div class="empty"><i class="fa-solid fa-film"></i><h3>Nothing here yet</h3><p>Tap Upload to add your first family memory.</p></div>'
    );
    currentList = [];
    return;
  }
  if (isAlbumOverview()) {
    renderAlbums();
    return;
  }
  if (isFiltering()) {
    const filtered = getFiltered();
    currentList = filtered;
    if (filtered.length === 0) {
      content.innerHTML =
        '<div class="empty"><i class="fa-solid fa-magnifying-glass"></i><h3>No results</h3><p>Try a different word, hashtag, event or member.</p></div>';
      return;
    }
    renderGrid(filtered);
    return;
  }
  const sorted = sortItems(allItems);
  const now = new Date();
  const onThisDay = sorted
    .filter((i) => {
      if (!i.takenAt) return false;
      const d = new Date(i.takenAt);
      return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getFullYear() < now.getFullYear();
    })
    .sort((x, y) => y.takenAt - x.takenAt);
  if (onThisDay.length) {
    content.appendChild(
      createRow('On This Day', onThisDay, onThisDay.length + (onThisDay.length === 1 ? ' memory' : ' memories'))
    );
  }
  content.appendChild(createRow('Recently Added', allItems.slice(0, 15), allItems.length + ' total'));
  const videos = sorted.filter((i) => i.type === 'video');
  if (videos.length) {
    content.appendChild(createRow('Family Videos', videos, videos.length + ' videos'));
  }
  GENRES.forEach((genre) => {
    const items = sorted.filter((i) => itemGenres(i).includes(genre));
    if (items.length) {
      content.appendChild(createRow(genre, items, items.length + (items.length === 1 ? ' memory' : ' memories')));
    }
  });
  USERS.forEach((user) => {
    const items = sorted.filter((i) => i.uploader === user.username);
    if (items.length) {
      content.appendChild(createRow('By ' + user.name, items, items.length + ' uploads'));
    }
  });
}

function render() {
  const eventsView = activeView === 'events';
  $('eventsPage').classList.toggle('hidden', !eventsView);
  ['hero', 'filtersSection', 'toolbarSection', 'content'].forEach((id) => {
    $(id).classList.toggle('hidden', eventsView);
  });
  if (eventsView) {
    document.body.classList.add('no-hero');
    renderEvents();
    updateTopbar();
    return;
  }
  renderGenreChips();
  renderTagChips();
  renderToolbar();
  renderHero();
  renderContent();
  updateTopbar();
}

function clearFilters() {
  activeGenre = 'All';
  activeTag = null;
  searchTerm = '';
  uploaderFilter = 'all';
  $('searchInput').value = '';
  render();
}

function openModal(id) {
  if (id === 'uploadModal') {
    resetUploadForm();
  }
  if (id === 'profileModal') {
    fillProfileModal();
  }
  if (id === 'shareModal') {
    const link = location.origin === 'null' ? location.href : location.origin + location.pathname;
    $('shareLink').value = link;
    $('qrImage').src =
      'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=' + encodeURIComponent(link);
  }
  $(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  if (id === 'confirmModal' && confirmResolver) {
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(false);
  }
  $(id).classList.add('hidden');
  if (id === 'viewerModal') {
    setSlide(false);
    $('viewerMedia').innerHTML = '';
  }
  const anyOpen = document.querySelector('.modal:not(.hidden)');
  if (!anyOpen) document.body.style.overflow = '';
}

function fillProfileModal() {
  applyAvatar($('profileAvatarLarge'), currentUser);
  $('profileModalName').textContent = currentUser.name;
  $('profileModalMeta').textContent = roleLabel(currentUser) + ' · ' + currentUser.username;
  $('avatarError').textContent = '';
  $('removeAvatar').classList.toggle('hidden', !avatars[currentUser.username]);
}

function refreshAvatarUi() {
  applyAvatar($('userAvatar'), currentUser);
  fillProfileModal();
  renderProfiles();
  render();
}

async function handleAvatarChange(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    $('avatarError').textContent = 'Please choose an image.';
    return;
  }
  try {
    const dataUrl = await processAvatar(file);
    const previous = avatars[currentUser.username];
    avatars[currentUser.username] = dataUrl;
    if (!(await saveAvatar(currentUser.username))) {
      if (previous) {
        avatars[currentUser.username] = previous;
      } else {
        delete avatars[currentUser.username];
      }
      $('avatarError').textContent = 'Could not save photo. Please check your connection and try again.';
      return;
    }
    refreshAvatarUi();
    toast('Profile photo updated');
  } catch (error) {
    $('avatarError').textContent = 'Could not read that image.';
  }
}

async function handleAvatarRemove() {
  const ok = await askConfirm('Remove your photo?', 'Your profile photo will be removed and your initial will show instead.', 'Remove');
  if (!ok) return;
  delete avatars[currentUser.username];
  await saveAvatar(currentUser.username);
  refreshAvatarUi();
  toast('Profile photo removed');
}

function askConfirm(title, message, confirmText) {
  return new Promise((resolve) => {
    confirmResolver = resolve;
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    $('confirmOk').textContent = confirmText;
    openModal('confirmModal');
  });
}

const EVENT_CATEGORIES = [
  { name: 'Milestone', icon: 'fa-trophy' },
  { name: 'Trip', icon: 'fa-plane' },
  { name: 'School', icon: 'fa-graduation-cap' },
  { name: 'Work', icon: 'fa-briefcase' },
  { name: 'Celebration', icon: 'fa-champagne-glasses' },
  { name: 'Moving', icon: 'fa-truck-moving' },
  { name: 'Just an update', icon: 'fa-comment-dots' }
];

let allEvents = [];
let eventFilter = 'all';
let openComments = new Set();
let editingEventId = null;
let eventFile = null;
let removeEventMedia = false;

function eventIcon(name) {
  const found = EVENT_CATEGORIES.find((c) => c.name === name);
  return found ? found.icon : 'fa-star';
}

function todayString() {
  const d = new Date();
  return (
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  );
}

function parseDateString(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysUntil(str) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseDateString(str) - start) / 86400000);
}

function countdownLabel(str) {
  const n = daysUntil(str);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 1) return 'In ' + n + ' days';
  if (n === -1) return 'Yesterday';
  return Math.abs(n) + ' days ago';
}

function formatEventDate(str) {
  return parseDateString(str).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function canEditEvent(ev) {
  return ev.author === currentUser.username || currentUser.role === 'parent';
}

async function refreshEvents() {
  allEvents = await dbGetAll(EVENT_STORE);
  allEvents.forEach((ev) => {
    ev.authorName = personName(ev.author) || ev.authorName;
    ev.comments.forEach((c) => {
      c.name = personName(c.user) || c.name;
    });
  });
}

function fillEventCategories() {
  const select = $('eventCategory');
  select.innerHTML = '';
  EVENT_CATEGORIES.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat.name;
    option.textContent = cat.name;
    select.appendChild(option);
  });
}

function eventMatches(ev) {
  const term = searchTerm.trim().toLowerCase().replace(/^#/, '');
  if (term) {
    const haystack = [ev.title, ev.details, ev.location, ev.authorName, ev.category]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  if (eventFilter === 'all') return true;
  if (eventFilter === 'upcoming') return !!ev.date && ev.date >= todayString();
  if (eventFilter === 'mine') return ev.author === currentUser.username;
  return ev.category === eventFilter;
}

function renderEventFilters() {
  const wrap = $('eventFilters');
  wrap.innerHTML = '';
  const filters = [
    ['all', 'All'],
    ['upcoming', 'Upcoming'],
    ['mine', 'My updates'],
    ...EVENT_CATEGORIES.map((c) => [c.name, c.name])
  ];
  filters.forEach(([value, label]) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (eventFilter === value ? ' active' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => {
      eventFilter = value;
      renderEvents();
    });
    wrap.appendChild(chip);
  });
}

function appendEventSection(list, title, events) {
  if (events.length === 0) return;
  const heading = document.createElement('h3');
  heading.className = 'event-section-title';
  heading.innerHTML = escapeHtml(title) + '<small>' + events.length + '</small>';
  list.appendChild(heading);
  events.forEach((ev) => list.appendChild(createEventCard(ev)));
}

function renderEvents() {
  renderEventFilters();
  const list = $('eventsList');
  list.innerHTML = '';
  if (allEvents.length === 0) {
    list.innerHTML =
      '<div class="empty"><i class="fa-solid fa-calendar-days"></i><h3>No updates yet</h3><p>Share what is happening with you, like a trip, a new job or a milestone, so the family stays close.</p></div>';
    return;
  }
  const filtered = allEvents.filter(eventMatches);
  if (filtered.length === 0) {
    list.innerHTML =
      '<div class="empty"><i class="fa-solid fa-magnifying-glass"></i><h3>Nothing here</h3><p>Try a different filter or search.</p></div>';
    return;
  }
  const today = todayString();
  const upcoming = filtered.filter((e) => e.date && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const rest = filtered.filter((e) => !(e.date && e.date >= today)).sort((a, b) => b.createdAt - a.createdAt);
  if (eventFilter === 'all') {
    appendEventSection(list, 'Coming up', upcoming);
    appendEventSection(list, 'Recent updates', rest);
  } else if (eventFilter === 'upcoming') {
    appendEventSection(list, 'Coming up', upcoming);
  } else {
    appendEventSection(list, 'Updates', [...upcoming, ...rest].sort((a, b) => b.createdAt - a.createdAt));
  }
}

function createEventCard(ev) {
  const card = document.createElement('article');
  card.className = 'event-card';
  const author = userByUsername(ev.author);
  const isUpcoming = ev.date && ev.date >= todayString();
  const hearted = ev.hearts.includes(currentUser.username);
  const commentsOpen = openComments.has(ev.id);
  const heartNames = ev.hearts
    .map((u) => {
      const found = userByUsername(u);
      return found ? found.name : u;
    })
    .join(', ');
  let dateBlock;
  if (ev.date) {
    const d = parseDateString(ev.date);
    dateBlock =
      '<div class="event-date"><div class="month">' +
      d.toLocaleDateString('en-PH', { month: 'short' }) +
      '</div><div class="day">' +
      d.getDate() +
      '</div></div>';
  } else {
    dateBlock = '<div class="event-date plain"><i class="fa-solid ' + eventIcon(ev.category) + '"></i></div>';
  }
  const meta = ['<span><span class="mini-avatar"></span>' + escapeHtml(ev.authorName) + '</span>'];
  if (ev.date) {
    meta.push('<span><i class="fa-regular fa-calendar"></i> ' + escapeHtml(formatEventDate(ev.date)) + '</span>');
  }
  if (ev.location) {
    meta.push('<span><i class="fa-solid fa-location-dot"></i> ' + escapeHtml(ev.location) + '</span>');
  }
  meta.push('<span>Posted ' + formatDate(ev.createdAt) + '</span>');
  card.innerHTML =
    dateBlock +
    '<div class="event-main">' +
    '<div class="event-top"><span class="event-badge"><i class="fa-solid ' + eventIcon(ev.category) + '"></i> ' + escapeHtml(ev.category) + '</span>' +
    (ev.date ? '<span class="event-countdown">' + (isUpcoming ? '' : 'Was ') + countdownLabel(ev.date).toLowerCase().replace(/^./, (c) => (isUpcoming ? c.toUpperCase() : c)) + '</span>' : '') +
    '</div>' +
    '<h3 class="event-title">' + escapeHtml(ev.title) + '</h3>' +
    '<div class="event-meta">' + meta.join('') + '</div>' +
    (ev.details ? '<p class="event-details">' + escapeHtml(ev.details) + '</p>' : '') +
    '<div class="event-media-slot"></div>' +
    '<div class="event-actions">' +
    '<button class="event-action' + (hearted ? ' active' : '') + '" data-act="heart" title="' + escapeHtml(heartNames) + '"><i class="fa-' + (hearted ? 'solid' : 'regular') + ' fa-heart"></i> ' + ev.hearts.length + '</button>' +
    '<button class="event-action' + (commentsOpen ? ' active' : '') + '" data-act="comments"><i class="fa-regular fa-comment"></i> ' + ev.comments.length + '</button>' +
    (canEditEvent(ev)
      ? '<div class="event-owner-actions"><button class="event-action" data-act="edit"><i class="fa-solid fa-pen"></i> Edit</button><button class="event-action" data-act="delete"><i class="fa-solid fa-trash"></i> Delete</button></div>'
      : '') +
    '</div>' +
    '<div class="event-comments-slot"></div>' +
    '</div>';
  applyAvatar(card.querySelector('.mini-avatar'), author);
  if (ev.blob || ev.filePath) {
    const url = getUrl(ev);
    const media = document.createElement(ev.mediaType === 'video' ? 'video' : 'img');
    media.className = 'event-media';
    media.src = url;
    if (ev.mediaType === 'video') {
      media.controls = true;
      media.preload = 'metadata';
      media.playsInline = true;
    } else {
      media.alt = '';
    }
    card.querySelector('.event-media-slot').appendChild(media);
  }
  if (commentsOpen) {
    renderComments(card.querySelector('.event-comments-slot'), ev);
  }
  card.querySelector('[data-act="heart"]').addEventListener('click', () => toggleHeart(ev));
  card.querySelector('[data-act="comments"]').addEventListener('click', () => {
    if (openComments.has(ev.id)) {
      openComments.delete(ev.id);
    } else {
      openComments.add(ev.id);
    }
    renderEvents();
  });
  const editBtn = card.querySelector('[data-act="edit"]');
  const deleteBtn = card.querySelector('[data-act="delete"]');
  if (editBtn) editBtn.addEventListener('click', () => openEventModal(ev));
  if (deleteBtn) deleteBtn.addEventListener('click', () => deleteEvent(ev));
  return card;
}

function renderComments(slot, ev) {
  const wrap = document.createElement('div');
  wrap.className = 'event-comments';
  ev.comments.forEach((comment) => {
    const row = document.createElement('div');
    row.className = 'comment';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    applyAvatar(avatar, userByUsername(comment.user) || { username: comment.user, name: comment.name, color: '#555' });
    const body = document.createElement('div');
    body.className = 'comment-body';
    body.innerHTML =
      '<b>' + escapeHtml(comment.name) + '</b><small>' + formatDate(comment.at) + '</small>';
    if (comment.user === currentUser.username || currentUser.role === 'parent') {
      const del = document.createElement('button');
      del.className = 'comment-delete';
      del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      del.title = 'Delete comment';
      del.addEventListener('click', () => deleteComment(ev, comment.id));
      body.appendChild(del);
    }
    const text = document.createElement('div');
    text.textContent = comment.text;
    body.appendChild(text);
    row.appendChild(avatar);
    row.appendChild(body);
    wrap.appendChild(row);
  });
  const form = document.createElement('form');
  form.className = 'comment-form';
  form.innerHTML =
    '<input type="text" placeholder="Write a comment..." maxlength="300"><button type="submit" class="btn btn-red">Send</button>';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const value = input.value.trim();
    if (value) addComment(ev, value);
  });
  wrap.appendChild(form);
  slot.appendChild(wrap);
}

async function toggleHeart(ev) {
  const index = ev.hearts.indexOf(currentUser.username);
  if (index >= 0) {
    ev.hearts.splice(index, 1);
  } else {
    ev.hearts.push(currentUser.username);
  }
  await dbPut(ev, EVENT_STORE);
  renderEvents();
}

async function addComment(ev, text) {
  ev.comments.push({
    id: uid(),
    user: currentUser.username,
    name: currentUser.name,
    text,
    at: Date.now()
  });
  openComments.add(ev.id);
  await dbPut(ev, EVENT_STORE);
  renderEvents();
}

async function deleteComment(ev, commentId) {
  const ok = await askConfirm('Delete this comment?', 'This comment will be permanently removed. This cannot be undone.', 'Delete');
  if (!ok) return;
  ev.comments = ev.comments.filter((c) => c.id !== commentId);
  await dbPut(ev, EVENT_STORE);
  renderEvents();
}

function openEventModal(ev) {
  editingEventId = ev ? ev.id : null;
  eventFile = null;
  removeEventMedia = false;
  $('eventModalTitle').textContent = ev ? 'Edit update' : 'Share an update';
  $('eventSubmit').textContent = ev ? 'Save changes' : 'Post update';
  $('eventTitle').value = ev ? ev.title : '';
  $('eventCategory').value = ev ? ev.category : EVENT_CATEGORIES[0].name;
  $('eventDate').value = ev ? ev.date || '' : '';
  $('eventLocation').value = ev ? ev.location || '' : '';
  $('eventDetails').value = ev ? ev.details || '' : '';
  $('eventFile').value = '';
  $('eventFileName').textContent =
    ev && (ev.blob || ev.filePath) ? 'Current: ' + (ev.fileName || 'attached file') : 'No photo or video attached';
  $('eventRemoveMedia').classList.toggle('hidden', !(ev && (ev.blob || ev.filePath)));
  $('eventError').textContent = '';
  openModal('eventModal');
}

async function saveEvent(event) {
  event.preventDefault();
  const title = $('eventTitle').value.trim();
  if (!title) {
    $('eventError').textContent = 'Please write what is happening.';
    return;
  }
  const existing = editingEventId ? allEvents.find((e) => e.id === editingEventId) : null;
  const base = existing || {
    id: uid(),
    author: currentUser.username,
    authorName: currentUser.name,
    createdAt: Date.now(),
    hearts: [],
    comments: [],
    blob: null,
    mediaType: '',
    fileName: ''
  };
  const record = {
    ...base,
    title,
    category: $('eventCategory').value,
    date: $('eventDate').value,
    location: $('eventLocation').value.trim(),
    details: $('eventDetails').value.trim()
  };
  if (eventFile) {
    record.blob = eventFile;
    record.mediaType = eventFile.type.startsWith('video/') ? 'video' : 'image';
    record.fileName = eventFile.name;
  } else if (removeEventMedia) {
    record.blob = null;
    record.mediaType = '';
    record.fileName = '';
  }
  const submit = $('eventSubmit');
  submit.disabled = true;
  try {
    await dbPut(record, EVENT_STORE);
    if (existing && (eventFile || removeEventMedia)) revokeUrl(existing.id);
    closeModal('eventModal');
    await refreshEvents();
    render();
    toast(existing ? 'Update saved' : 'Update shared with the family');
  } catch (error) {
    $('eventError').textContent = errMsg(error, 'Could not save. Please check your connection and try again.');
  }
  submit.disabled = false;
}

async function deleteEvent(ev) {
  const ok = await askConfirm(
    'Delete this update?',
    'It will be permanently removed for everyone in the family. This cannot be undone.',
    'Delete'
  );
  if (!ok) return;
  await dbDelete(ev.id, EVENT_STORE);
  revokeUrl(ev.id);
  openComments.delete(ev.id);
  await refreshEvents();
  render();
  toast('Update deleted');
}

function canEdit(item) {
  return item.uploader === currentUser.username || currentUser.role === 'parent';
}

function updateSelectBar() {
  const count = selectedIds.size;
  $('selectCount').textContent = count + ' selected';
  $('moveBtn').disabled = count === 0;
  $('bulkDeleteBtn').disabled = count === 0;
}

function setSelectMode(on) {
  selectMode = on;
  selectedIds.clear();
  $('selectBar').classList.toggle('hidden', !on);
  document.body.classList.toggle('selecting', on);
  updateSelectBar();
  render();
}

function toggleSelect(id) {
  const selected = !selectedIds.has(id);
  if (selected) {
    selectedIds.add(id);
  } else {
    selectedIds.delete(id);
  }
  document.querySelectorAll('.card[data-id="' + id + '"]').forEach((card) => {
    card.classList.toggle('selected', selected);
  });
  updateSelectBar();
}

async function bulkMove() {
  const genre = $('moveGenre').value;
  const items = allItems.filter((i) => selectedIds.has(i.id) && canEdit(i));
  if (items.length === 0) return;
  const ok = await askConfirm(
    'Move ' + items.length + (items.length > 1 ? ' items?' : ' item?'),
    'The selected ' + (items.length > 1 ? 'items' : 'item') + ' will be moved to ' + genre + ' and taken out of their other albums.',
    'Move'
  );
  if (!ok) return;
  for (const item of items) {
    await dbPut({ ...item, genre, genres: [genre], editedAt: Date.now() });
  }
  await refreshItems();
  setSelectMode(false);
  toast(items.length + ' moved to ' + genre);
}

async function bulkDelete() {
  const items = allItems.filter((i) => selectedIds.has(i.id) && canEdit(i));
  if (items.length === 0) return;
  const ok = await askConfirm(
    'Delete ' + items.length + (items.length > 1 ? ' items?' : ' item?'),
    'The selected ' + (items.length > 1 ? 'items' : 'item') + ' will be permanently removed from the family gallery. This cannot be undone.',
    'Delete'
  );
  if (!ok) return;
  for (const item of items) {
    await dbDelete(item.id);
    revokeUrl(item.id);
  }
  await refreshItems();
  setSelectMode(false);
  toast(items.length + ' deleted');
}

function openEdit() {
  const item = currentList[currentIndex];
  if (!item || !canEdit(item)) return;
  editingId = item.id;
  const inCaption = extractTags(item.caption || '');
  $('editCaption').value = item.caption || '';
  setChecked('editGenreChecks', itemGenres(item));
  $('editTaken').value = item.takenAt ? dateToString(item.takenAt) : '';
  setChecked('editPeopleChecks', itemPeople(item));
  $('editTags').value = item.tags
    .filter((t) => !inCaption.includes(t))
    .map((t) => '#' + t)
    .join(' ');
  $('editFile').value = '';
  $('editFileName').textContent = 'Keep current file';
  $('editError').textContent = '';
  closeModal('viewerModal');
  openModal('editModal');
}

async function saveEdit(event) {
  event.preventDefault();
  const item = allItems.find((i) => i.id === editingId);
  if (!item) {
    closeModal('editModal');
    return;
  }
  const caption = $('editCaption').value.trim();
  const genres = getChecked('editGenreChecks');
  if (genres.length === 0) {
    $('editError').textContent = 'Choose at least one album.';
    return;
  }
  const tags = parseTags(caption, $('editTags').value);
  const takenAt = stringToTimestamp($('editTaken').value, null);
  const people = getChecked('editPeopleChecks');
  const updated = { ...item, caption, genre: genres[0], genres, people, tags, takenAt, editedAt: Date.now() };
  const file = $('editFile').files[0];
  if (file) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      $('editError').textContent = 'Please choose a photo or video.';
      return;
    }
    updated.blob = file;
    updated.type = file.type.startsWith('video/') ? 'video' : 'image';
    updated.mime = file.type;
    updated.fileName = file.name;
  }
  try {
    await dbPut(updated);
    if (file) revokeUrl(item.id);
    closeModal('editModal');
    await refreshItems();
    render();
    toast('Changes saved');
  } catch (error) {
    $('editError').textContent = errMsg(error, 'Could not save changes. Please check your connection and try again.');
  }
}

function openUploadWith(prefill) {
  openModal('uploadModal');
  const genres = prefill.genres || (prefill.genre ? [prefill.genre] : null);
  if (genres) setChecked('genreChecks', genres);
  if (prefill.taken) $('takenInput').value = prefill.taken;
  if (prefill.people) setChecked('peopleChecks', prefill.people);
  if (prefill.caption) $('captionInput').value = prefill.caption;
  if (prefill.tags) $('tagsInput').value = prefill.tags;
}

function openViewer(list, index) {
  currentList = list;
  currentIndex = index;
  showViewerItem();
  openModal('viewerModal');
}

function showViewerItem() {
  const item = currentList[currentIndex];
  if (!item) return;
  const url = getUrl(item);
  $('viewerMedia').innerHTML =
    item.type === 'video'
      ? '<video src="' + url + '" controls autoplay playsinline></video>'
      : '<img src="' + url + '" alt="">';
  $('viewerCaption').textContent = item.caption || 'Untitled';
  $('viewerMeta').textContent =
    item.uploaderName + ' · ' + itemGenres(item).join(' + ') + ' · ' + (item.takenAt ? formatDate(item.takenAt) : 'Date not known');
  const tagsWrap = $('viewerTags');
  tagsWrap.innerHTML = '';
  itemGenres(item).forEach((genreName) => {
    const genreChip = document.createElement('button');
    genreChip.className = 'chip';
    genreChip.textContent = genreName;
    genreChip.addEventListener('click', () => {
      closeModal('viewerModal');
      activeGenre = genreName;
      activeTag = null;
      render();
      $('genreChips').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    tagsWrap.appendChild(genreChip);
  });
  itemPeople(item).forEach((username) => {
    const name = personName(username);
    if (!name) return;
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = name;
    chip.addEventListener('click', () => {
      closeModal('viewerModal');
      activeGenre = 'All';
      activeTag = null;
      searchTerm = name;
      $('searchInput').value = name;
      $('searchBox').classList.add('open');
      render();
      $('genreChips').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    tagsWrap.appendChild(chip);
  });
  item.tags.forEach((tag) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = '#' + tag;
    chip.addEventListener('click', () => {
      closeModal('viewerModal');
      activeTag = tag;
      activeGenre = 'All';
      render();
      $('genreChips').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    tagsWrap.appendChild(chip);
  });
  const editable = canEdit(item);
  $('deleteBtn').classList.toggle('hidden', !editable);
  $('editBtn').classList.toggle('hidden', !editable);
  $('prevBtn').style.display = currentList.length > 1 ? '' : 'none';
  $('nextBtn').style.display = currentList.length > 1 ? '' : 'none';
  renderViewerReactions(item);
  if (slideOn) scheduleSlide();
}

function itemHearts(item) {
  return Array.isArray(item.hearts) ? item.hearts : [];
}

function itemComments(item) {
  return Array.isArray(item.comments) ? item.comments : [];
}

function renderViewerReactions(item) {
  const hearts = itemHearts(item);
  const comments = itemComments(item);
  const hearted = hearts.includes(currentUser.username);
  const heartBtn = $('viewerHeart');
  heartBtn.classList.toggle('active', hearted);
  heartBtn.innerHTML = '<i class="fa-' + (hearted ? 'solid' : 'regular') + ' fa-heart"></i> ' + hearts.length;
  heartBtn.title = hearts.map(personName).filter(Boolean).join(', ');
  const open = openPhotoComments.has(item.id);
  const toggle = $('viewerCommentToggle');
  toggle.classList.toggle('active', open);
  toggle.innerHTML = '<i class="fa-regular fa-comment"></i> ' + comments.length;
  const box = $('viewerComments');
  box.classList.toggle('hidden', !open);
  box.innerHTML = '';
  if (!open) return;
  comments.forEach((comment) => {
    const row = document.createElement('div');
    row.className = 'comment';
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    applyAvatar(avatar, userByUsername(comment.user) || { username: comment.user, name: comment.name, color: '#555' });
    const body = document.createElement('div');
    body.className = 'comment-body';
    body.innerHTML = '<b>' + escapeHtml(comment.name) + '</b><small>' + formatDate(comment.at) + '</small>';
    if (comment.user === currentUser.username || currentUser.role === 'parent') {
      const del = document.createElement('button');
      del.className = 'comment-delete';
      del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      del.title = 'Delete comment';
      del.addEventListener('click', () => deletePhotoComment(item, comment.id));
      body.appendChild(del);
    }
    const text = document.createElement('div');
    text.textContent = comment.text;
    body.appendChild(text);
    row.appendChild(avatar);
    row.appendChild(body);
    box.appendChild(row);
  });
  const form = document.createElement('form');
  form.className = 'comment-form';
  form.innerHTML =
    '<input type="text" placeholder="Write a comment..." maxlength="300"><button type="submit" class="btn btn-red">Send</button>';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = form.querySelector('input').value.trim();
    if (value) addPhotoComment(item, value);
  });
  box.appendChild(form);
}

async function togglePhotoHeart(item) {
  const hearts = itemHearts(item).slice();
  const index = hearts.indexOf(currentUser.username);
  if (index >= 0) {
    hearts.splice(index, 1);
  } else {
    hearts.push(currentUser.username);
  }
  item.hearts = hearts;
  await dbPut(item);
  renderViewerReactions(item);
}

async function addPhotoComment(item, text) {
  item.comments = itemComments(item).concat({
    id: uid(),
    user: currentUser.username,
    name: currentUser.name,
    text,
    at: Date.now()
  });
  openPhotoComments.add(item.id);
  await dbPut(item);
  renderViewerReactions(item);
}

async function deletePhotoComment(item, commentId) {
  const ok = await askConfirm('Delete this comment?', 'This comment will be permanently removed. This cannot be undone.', 'Delete');
  if (!ok) return;
  item.comments = itemComments(item).filter((c) => c.id !== commentId);
  await dbPut(item);
  renderViewerReactions(item);
}

function slideshowList() {
  if (isAlbumOverview()) return [];
  if (isFiltering()) return getFiltered();
  return sortItems(allItems);
}

function updateSlideButton() {
  $('slideBtn').innerHTML =
    '<i class="fa-solid ' + (slideOn ? 'fa-pause' : 'fa-play') + '"></i> <span>' + (slideOn ? 'Pause' : 'Slideshow') + '</span>';
}

function advanceSlide() {
  if (!slideOn) return;
  if (/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
    slideTimer = setTimeout(advanceSlide, 5000);
    return;
  }
  stepViewer(1);
}

function scheduleSlide() {
  clearTimeout(slideTimer);
  if (!slideOn) return;
  const video = $('viewerMedia').querySelector('video');
  if (video) {
    video.onended = advanceSlide;
    const playing = video.play();
    if (playing) {
      playing.catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
    return;
  }
  slideTimer = setTimeout(advanceSlide, 5000);
}

function setSlide(on) {
  slideOn = on;
  clearTimeout(slideTimer);
  updateSlideButton();
  if (on) scheduleSlide();
}

function startSlideshow() {
  const list = slideshowList();
  if (list.length === 0) return;
  openViewer(list, 0);
  setSlide(true);
}

async function downloadCurrent() {
  const item = currentList[currentIndex];
  if (!item) return;
  const ext = (item.mime || '').split('/')[1] || (item.type === 'video' ? 'mp4' : 'jpg');
  const name = item.fileName || 'bayer-family-memory.' + ext;
  try {
    const href = item.filePath ? await signedDownloadUrl(item.filePath, name) : getUrl(item);
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast('Download started');
  } catch (error) {
    toast('Could not download. Please try again.');
  }
}

function stepViewer(direction) {
  if (currentList.length < 2) return;
  currentIndex = (currentIndex + direction + currentList.length) % currentList.length;
  showViewerItem();
}

async function deleteCurrent() {
  const item = currentList[currentIndex];
  if (!item) return;
  const ok = await askConfirm(
    'Delete this memory?',
    'This will permanently remove it from the family gallery. This cannot be undone.',
    'Delete'
  );
  if (!ok) return;
  await dbDelete(item.id);
  revokeUrl(item.id);
  closeModal('viewerModal');
  await refreshItems();
  render();
  toast('Deleted');
}

function resetUploadForm() {
  pendingFiles = [];
  $('uploadForm').reset();
  $('previewList').innerHTML = '';
  $('dropText').textContent = 'Click or drop photos and videos here';
  $('uploadError').textContent = '';
  $('uploadSubmit').disabled = false;
  $('uploadSubmit').textContent = 'Upload';
}

function addPendingFiles(fileList) {
  const accepted = Array.from(fileList).filter(
    (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
  );
  if (accepted.length === 0) {
    $('uploadError').textContent = 'Please choose photos or videos only.';
    return;
  }
  const tooBig = accepted.filter((f) => f.type.startsWith('video/') && f.size > MAX_VIDEO_BYTES);
  const usable = accepted.filter((f) => !tooBig.includes(f));
  $('uploadError').textContent = tooBig.length
    ? tooBig.length + (tooBig.length > 1 ? ' videos are' : ' video is') + ' over ' + MAX_VIDEO_MB + ' MB and was skipped. Please trim or compress it first.'
    : '';
  if (usable.length === 0) return;
  pendingFiles = pendingFiles.concat(usable);
  renderPreviews();
}

function renderPreviews() {
  const list = $('previewList');
  list.innerHTML = '';
  pendingFiles.forEach((file) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const el = document.createElement('div');
    el.className = 'preview-item';
    el.innerHTML =
      (isVideo
        ? '<video src="' + url + '#t=0.1" muted preload="metadata"></video>'
        : '<img src="' + url + '" alt="">') +
      '<span class="preview-type">' + (isVideo ? 'VIDEO' : 'PHOTO') + '</span>';
    list.appendChild(el);
  });
  $('dropText').textContent = pendingFiles.length + ' file' + (pendingFiles.length > 1 ? 's' : '') + ' selected';
}

async function handleUpload(event) {
  event.preventDefault();
  if (pendingFiles.length === 0) {
    $('uploadError').textContent = 'Choose at least one photo or video.';
    return;
  }
  const caption = $('captionInput').value.trim();
  const genres = getChecked('genreChecks');
  if (genres.length === 0) {
    $('uploadError').textContent = 'Choose at least one family event.';
    return;
  }
  const takenAt = stringToTimestamp($('takenInput').value, null);
  const people = getChecked('peopleChecks');
  const tags = parseTags(caption, $('tagsInput').value);
  const submit = $('uploadSubmit');
  submit.disabled = true;
  submit.textContent = 'Uploading...';
  try {
    let done = 0;
    for (const file of pendingFiles) {
      done += 1;
      submit.textContent = 'Uploading ' + done + ' of ' + pendingFiles.length + '...';
      await dbPut({
        id: uid(),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        mime: file.type,
        fileName: file.name,
        blob: file,
        caption,
        genre: genres[0],
        genres,
        takenAt,
        people,
        tags,
        uploader: currentUser.username,
        uploaderName: currentUser.name,
        createdAt: Date.now()
      });
    }
    const count = pendingFiles.length;
    closeModal('uploadModal');
    await refreshItems();
    render();
    toast(count + (count > 1 ? ' memories added' : ' memory added'));
  } catch (error) {
    $('uploadError').textContent = errMsg(error, 'Upload failed. Please check your connection and try again.');
    submit.disabled = false;
    submit.textContent = 'Upload';
  }
}

function copyShareLink() {
  const input = $('shareLink');
  input.select();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(input.value).then(() => toast('Link copied'));
  } else {
    document.execCommand('copy');
    toast('Link copied');
  }
}

function setView(view, navId) {
  activeView = view;
  setNavActive(navId);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function bindEvents() {
  $('loginForm').addEventListener('submit', handleLogin);
  $('menuProfile').addEventListener('click', () => {
    $('userMenu').classList.add('hidden');
    openModal('profileModal');
  });
  $('menuSwitch').addEventListener('click', () => {
    $('userMenu').classList.add('hidden');
    logout();
  });
  $('menuLogout').addEventListener('click', async () => {
    $('userMenu').classList.add('hidden');
    const ok = await askConfirm(
      'Sign out?',
      'You will need to choose your profile and enter your username to sign back in.',
      'Sign out'
    );
    if (ok) logout();
  });
  $('confirmOk').addEventListener('click', () => {
    const resolve = confirmResolver;
    confirmResolver = null;
    closeModal('confirmModal');
    if (resolve) resolve(true);
  });
  $('confirmCancel').addEventListener('click', () => closeModal('confirmModal'));
  document.addEventListener('click', (e) => {
    if (!$('userMenuWrap').contains(e.target)) $('userMenu').classList.add('hidden');
    if (!$('uploadMenuWrap').contains(e.target)) $('uploadMenu').classList.add('hidden');
  });
  $('uploadBtn').addEventListener('click', () => {
    $('userMenu').classList.add('hidden');
    $('uploadMenu').classList.toggle('hidden');
  });
  $('menuUploadMedia').addEventListener('click', () => {
    $('uploadMenu').classList.add('hidden');
    openModal('uploadModal');
  });
  $('menuUploadKokong').addEventListener('click', () => {
    $('uploadMenu').classList.add('hidden');
    openUploadWith({ genres: [MEMORIAL_GENRE], people: [MEMORIAL_USER] });
  });
  $('menuUploadUpdate').addEventListener('click', () => {
    $('uploadMenu').classList.add('hidden');
    openEventModal(null);
  });
  $('shareBtn').addEventListener('click', () => openModal('shareModal'));
  $('userChip').addEventListener('click', () => {
    $('uploadMenu').classList.add('hidden');
    $('userMenu').classList.toggle('hidden');
  });
  $('themeBtn').addEventListener('click', () => openModal('themeModal'));
  $('addToAlbum').addEventListener('click', () => openUploadWith({ genre: activeGenre }));
  $('selectBtn').addEventListener('click', () => setSelectMode(!selectMode));
  $('cancelSelect').addEventListener('click', () => setSelectMode(false));
  $('moveBtn').addEventListener('click', bulkMove);
  $('bulkDeleteBtn').addEventListener('click', bulkDelete);
  $('editBtn').addEventListener('click', openEdit);
  $('editForm').addEventListener('submit', saveEdit);
  $('editFileBtn').addEventListener('click', () => $('editFile').click());
  $('editFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    $('editFileName').textContent = file ? file.name : 'Keep current file';
  });
  $('addMoreBtn').addEventListener('click', () => {
    const item = currentList[currentIndex];
    if (!item) return;
    const inCaption = extractTags(item.caption || '');
    const extraTags = item.tags
      .filter((t) => !inCaption.includes(t))
      .map((t) => '#' + t)
      .join(' ');
    closeModal('viewerModal');
    openUploadWith({
      genres: itemGenres(item),
      caption: item.caption,
      tags: extraTags,
      taken: item.takenAt ? dateToString(item.takenAt) : '',
      people: itemPeople(item)
    });
  });
  $('themeFab').addEventListener('click', () => openModal('themeModal'));
  document.querySelectorAll('#modeOptions button').forEach((btn) => {
    btn.addEventListener('click', () => {
      theme.mode = btn.dataset.mode;
      saveTheme();
      applyTheme();
    });
  });
  systemQuery.addEventListener('change', () => {
    if (theme.mode === 'system') applyTheme();
  });
  $('changeAvatar').addEventListener('click', () => $('avatarInput').click());
  $('avatarInput').addEventListener('change', handleAvatarChange);
  $('removeAvatar').addEventListener('click', handleAvatarRemove);
  $('copyLink').addEventListener('click', copyShareLink);
  $('uploadForm').addEventListener('submit', handleUpload);
  $('captionInput').addEventListener('input', () => autoCheckFromCaption('captionInput', 'genreChecks'));
  $('editCaption').addEventListener('input', () => autoCheckFromCaption('editCaption', 'editGenreChecks'));
  $('fileInput').addEventListener('change', (e) => addPendingFiles(e.target.files));
  $('deleteBtn').addEventListener('click', deleteCurrent);
  $('prevBtn').addEventListener('click', () => stepViewer(-1));
  $('nextBtn').addEventListener('click', () => stepViewer(1));
  $('downloadBtn').addEventListener('click', downloadCurrent);
  $('slideshowBtn').addEventListener('click', startSlideshow);
  $('slideBtn').addEventListener('click', () => setSlide(!slideOn));
  $('viewerHeart').addEventListener('click', () => {
    const item = currentList[currentIndex];
    if (item) togglePhotoHeart(item);
  });
  $('viewerCommentToggle').addEventListener('click', () => {
    const item = currentList[currentIndex];
    if (!item) return;
    if (openPhotoComments.has(item.id)) {
      openPhotoComments.delete(item.id);
    } else {
      openPhotoComments.add(item.id);
    }
    renderViewerReactions(item);
  });
  $('clearFilters').addEventListener('click', clearFilters);

  $('uploaderFilter').addEventListener('change', (e) => {
    uploaderFilter = e.target.value;
    render();
  });

  $('sortSelect').addEventListener('change', (e) => {
    sortMode = e.target.value;
    render();
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('mousedown', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  const dropZone = $('dropZone');
  ['dragenter', 'dragover'].forEach((type) =>
    dropZone.addEventListener(type, (e) => {
      e.preventDefault();
      dropZone.classList.add('drag');
    })
  );
  ['dragleave', 'drop'].forEach((type) =>
    dropZone.addEventListener(type, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag');
    })
  );
  dropZone.addEventListener('drop', (e) => addPendingFiles(e.dataTransfer.files));

  $('searchToggle').addEventListener('click', () => {
    const box = $('searchBox');
    box.classList.toggle('open');
    if (box.classList.contains('open')) {
      $('searchInput').focus();
    } else if (searchTerm) {
      searchTerm = '';
      $('searchInput').value = '';
      render();
    }
  });

  $('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    render();
  });

  $('navHome').addEventListener('click', () => {
    activeGenre = 'All';
    activeTag = null;
    searchTerm = '';
    uploaderFilter = 'all';
    $('searchInput').value = '';
    setView('home', 'navHome');
  });
  $('navAlbums').addEventListener('click', () => {
    activeGenre = 'All';
    activeTag = null;
    searchTerm = '';
    uploaderFilter = 'all';
    $('searchInput').value = '';
    setView('albums', 'navAlbums');
  });
  $('navEvents').addEventListener('click', () => {
    if (selectMode) {
      selectMode = false;
      selectedIds.clear();
      $('selectBar').classList.add('hidden');
      document.body.classList.remove('selecting');
    }
    setView('events', 'navEvents');
  });
  $('newEventBtn').addEventListener('click', () => openEventModal(null));
  $('eventForm').addEventListener('submit', saveEvent);
  $('eventFileBtn').addEventListener('click', () => $('eventFile').click());
  $('eventFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      $('eventError').textContent = 'Please choose a photo or video.';
      e.target.value = '';
      return;
    }
    $('eventError').textContent = '';
    eventFile = file;
    removeEventMedia = false;
    $('eventFileName').textContent = file.name;
    $('eventRemoveMedia').classList.remove('hidden');
  });
  $('eventRemoveMedia').addEventListener('click', () => {
    eventFile = null;
    removeEventMedia = true;
    $('eventFile').value = '';
    $('eventFileName').textContent = 'The photo or video will be removed when you save';
    $('eventRemoveMedia').classList.add('hidden');
  });
  $('navPhotos').addEventListener('click', () => setView('photos', 'navPhotos'));
  $('navVideos').addEventListener('click', () => setView('videos', 'navVideos'));
  $('navMine').addEventListener('click', () => setView('mine', 'navMine'));

  window.addEventListener('scroll', () => {
    updateTopbar();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not(.hidden)').forEach((m) => closeModal(m.id));
    }
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (!$('viewerModal').classList.contains('hidden') && !typing) {
      if (e.key === 'ArrowLeft') stepViewer(-1);
      if (e.key === 'ArrowRight') stepViewer(1);
    }
  });
}

function fillGenreSelect() {
  const select = $('moveGenre');
  select.innerHTML = '';
  GENRES.forEach((genre) => {
    const option = document.createElement('option');
    option.value = genre;
    option.textContent = genre;
    select.appendChild(option);
  });
  buildGenreChecks('genreChecks');
  buildGenreChecks('editGenreChecks');
  buildPeopleChecks('peopleChecks');
  buildPeopleChecks('editPeopleChecks');
}

function dataSignature() {
  const items = allItems.map((i) => i.id + ':' + (i.editedAt || 0) + ':' + itemHearts(i).length + ':' + itemComments(i).length);
  const events = allEvents.map((e) => e.id + ':' + (e.hearts || []).length + ':' + (e.comments || []).length + ':' + (e.title || '').length + ':' + (e.filePath || ''));
  return items.join(',') + '|' + events.join(',');
}

async function autoRefresh() {
  if (!currentUser || document.hidden || selectMode) return;
  if (document.querySelector('.modal:not(.hidden)')) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const before = dataSignature();
  try {
    await refreshItems();
    await refreshEvents();
  } catch (error) {
    return;
  }
  if (dataSignature() !== before) render();
}

async function init() {
  loadTheme();
  applyTheme();
  loadAvatars();
  fillGenreSelect();
  fillEventCategories();
  fillUploaderSelect();
  renderProfiles();
  bindEvents();
  if (!sb) {
    $('profileGrid').innerHTML =
      '<p style="max-width:32rem;text-align:center;line-height:1.5">The online storage is not set up yet. ' +
      'Open <b>config.js</b> and paste in your Supabase project URL and key (see README).</p>';
    return;
  }
  document.addEventListener('visibilitychange', autoRefresh);
  setInterval(autoRefresh, 60000);
  try {
    const { data } = await sb.auth.getSession();
    const email = data && data.session && data.session.user && data.session.user.email;
    const user = email ? USERS.find((u) => authEmail(u).toLowerCase() === email.toLowerCase()) : null;
    if (user) {
      startApp(user);
    } else if (email) {
      await sb.auth.signOut();
    }
  } catch (error) {}
}

init();
