/* Shared online storage for Bayerflix (Supabase).
   Replaces the old per-browser IndexedDB so everyone sees the same gallery. */
(function () {
  const cfg = window.BAYER_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.startsWith('PASTE') && !cfg.SUPABASE_ANON_KEY.startsWith('PASTE');
  window.sb = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      })
    : null;
})();

const BUCKET = 'family-media';
const MAX_VIDEO_MB = (window.BAYER_CONFIG && window.BAYER_CONFIG.MAX_VIDEO_MB) || 50;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
const URL_CACHE_KEY = 'bayerUrlCache';
const URL_TTL_SECONDS = 7 * 24 * 3600;

// The sign-in email for a profile. Change here if you ever use a different address format.
function authEmail(user) {
  return user.username;
}

function friendlyError(message) {
  const err = new Error(message);
  err.friendly = true;
  return err;
}

function errMsg(err, fallback) {
  return err && err.friendly ? err.message : fallback;
}

function tableFor(store) {
  return store === EVENT_STORE ? 'events' : 'media';
}

/* ---------- signed links (the storage bucket is private) ---------- */

function readUrlCache() {
  try {
    return JSON.parse(localStorage.getItem(URL_CACHE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function clearUrlCache() {
  try {
    localStorage.removeItem(URL_CACHE_KEY);
  } catch (e) {}
}

async function signedUrlMap(paths) {
  const cache = readUrlCache();
  const now = Date.now();
  const out = {};
  const keep = {};
  const need = [];
  paths.forEach((p) => {
    const c = cache[p];
    if (c && c.exp - now > 24 * 3600 * 1000) {
      out[p] = c.url;
      keep[p] = c;
    } else {
      need.push(p);
    }
  });
  for (let i = 0; i < need.length; i += 100) {
    const chunk = need.slice(i, i + 100);
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(chunk, URL_TTL_SECONDS);
    if (error) throw error;
    data.forEach((d) => {
      if (d.signedUrl) {
        out[d.path] = d.signedUrl;
        keep[d.path] = { url: d.signedUrl, exp: now + URL_TTL_SECONDS * 1000 };
      }
    });
  }
  try {
    localStorage.setItem(URL_CACHE_KEY, JSON.stringify(keep));
  } catch (e) {}
  return out;
}

async function signedDownloadUrl(path, fileName) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 300, { download: fileName || true });
  if (error) throw error;
  return data.signedUrl;
}

/* ---------- photo preparation (smaller files = more room, faster pages) ---------- */

async function prepareMedia(file) {
  const isImage = file.type.startsWith('image/');
  const rawExt = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = rawExt || (isImage ? 'jpg' : 'mp4');
  const untouched = { main: file, thumb: null, mime: file.type, ext, converted: false };
  if (!isImage || file.type === 'image/gif' || file.type === 'image/svg+xml') return untouched;

  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch (e) {
    return untouched;
  }
  const draw = (max, quality) =>
    new Promise((resolve) => {
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });

  const result = { ...untouched };
  if (Math.max(bmp.width, bmp.height) > 2400 || file.size > 1.5 * 1024 * 1024) {
    const smaller = await draw(2400, 0.85);
    if (smaller && smaller.size < file.size) {
      result.main = smaller;
      result.mime = 'image/jpeg';
      result.ext = 'jpg';
      result.converted = true;
    }
  }
  result.thumb = await draw(480, 0.75);
  if (bmp.close) bmp.close();
  return result;
}

/* ---------- the data layer used by gallery.js ---------- */

async function dbGetAll(store = STORE) {
  const table = tableFor(store);
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('data').order('id').range(from, from + 999);
    if (error) throw error;
    rows = rows.concat(data);
    if (data.length < 1000) break;
  }
  const items = rows.map((r) => r.data);
  const paths = [];
  items.forEach((i) => {
    if (i.filePath) paths.push(i.filePath);
    if (i.thumbPath) paths.push(i.thumbPath);
  });
  const urls = await signedUrlMap(paths);
  items.forEach((i) => {
    i._url = (i.filePath && urls[i.filePath]) || '';
    i._thumb = (i.thumbPath && urls[i.thumbPath]) || '';
  });
  return items;
}

async function dbPut(item, store = STORE) {
  const table = tableFor(store);
  const data = { ...item };
  const blob = data.blob;
  delete data.blob;
  delete data._url;
  delete data._thumb;

  const oldPaths = [];
  const newPaths = [];

  if (blob instanceof Blob) {
    if (blob.type.startsWith('video/') && blob.size > MAX_VIDEO_BYTES) {
      throw friendlyError('That video is bigger than ' + MAX_VIDEO_MB + ' MB. Please trim or compress it first.');
    }
    if (data.filePath) oldPaths.push(data.filePath);
    if (data.thumbPath) oldPaths.push(data.thumbPath);
    const prep = await prepareMedia(blob);
    const base = table + '/' + data.id + '-' + Date.now().toString(36);
    const up = await sb.storage.from(BUCKET).upload(base + '.' + prep.ext, prep.main, {
      contentType: prep.mime || undefined,
      cacheControl: '31536000',
      upsert: false
    });
    if (up.error) throw up.error;
    newPaths.push(up.data.path);
    data.filePath = up.data.path;
    delete data.thumbPath;
    if (prep.thumb) {
      const th = await sb.storage.from(BUCKET).upload(base + '-thumb.jpg', prep.thumb, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false
      });
      if (!th.error) {
        newPaths.push(th.data.path);
        data.thumbPath = th.data.path;
      }
    }
    if (prep.converted) {
      data.fileName = (data.fileName || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
      if (table === 'media') data.mime = 'image/jpeg';
    }
  } else if (blob === null) {
    if (data.filePath) oldPaths.push(data.filePath);
    if (data.thumbPath) oldPaths.push(data.thumbPath);
    delete data.filePath;
    delete data.thumbPath;
  }

  const { error } = await sb.from(table).upsert({ id: data.id, data, updated_at: new Date().toISOString() });
  if (error) {
    if (newPaths.length) await sb.storage.from(BUCKET).remove(newPaths);
    throw error;
  }
  if (oldPaths.length) await sb.storage.from(BUCKET).remove(oldPaths);
}

async function dbDelete(id, store = STORE) {
  const table = tableFor(store);
  const found = await sb.from(table).select('data').eq('id', id).maybeSingle();
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) throw error;
  const d = found.data && found.data.data;
  const paths = d ? [d.filePath, d.thumbPath].filter(Boolean) : [];
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
}
