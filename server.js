const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { Pool } = require('pg');

let cloudinary = null;
try { cloudinary = require('cloudinary').v2; } catch (_) {}

const app = express();
app.disable('x-powered-by');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const SONGS_DIR = path.join(ROOT, 'songs');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const IMAGES_DIR = path.join(ROOT, 'images');
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '').trim();
const DATABASE_URL = process.env.DATABASE_URL;

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.ogg']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024;

for (const dir of [SONGS_DIR, UPLOADS_DIR, IMAGES_DIR]) fs.mkdirSync(dir, { recursive: true });

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
}) : null;

function clean(value, fallback = '') {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 500) || fallback;
}

function safeFilename(value) {
  const base = path.basename(String(value || ''));
  return base.replace(/[^a-zA-Z0-9._()\- ]/g, '_').replace(/\s+/g, '_').slice(0, 180);
}

function encodePath(parts) {
  return parts.map(part => encodeURIComponent(part)).join('/');
}

function youtubeIdFromUrl(rawUrl) {
  const input = clean(rawUrl);
  if (!input) return null;
  let url;
  try { url = new URL(input); } catch (_) { return null; }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null;
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
    }
    const match = url.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
    return match ? match[2] : null;
  }
  return null;
}

function normalizeSong(row) {
  const sourceType = row.source_type === 'youtube' || row.youtube_id ? 'youtube' : 'mp3';
  return {
    id: row.id,
    title: clean(row.title, 'Untitled'),
    artist: clean(row.artist, 'SwarAJ'),
    album: clean(row.album, 'SwarAJ'),
    category: clean(row.category, 'All Songs'),
    language: clean(row.language, 'Marathi'),
    source_type: sourceType,
    audio_url: sourceType === 'mp3' ? (row.audio_url || null) : null,
    file_path: sourceType === 'mp3' ? (row.file_path || null) : null,
    youtube_url: sourceType === 'youtube' ? (row.youtube_url || (row.youtube_id ? `https://www.youtube.com/watch?v=${row.youtube_id}` : null)) : null,
    youtube_id: sourceType === 'youtube' ? (row.youtube_id || null) : null,
    cover_url: row.cover_url || null,
    duration: Number(row.duration || 0),
    is_active: row.is_active !== false,
    created_at: row.created_at || null
  };
}

async function columnExists(client, column) {
  const result = await client.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='songs' AND column_name=$1`, [column]);
  return result.rowCount > 0;
}

async function ensureColumn(client, column, definition) {
  if (!(await columnExists(client, column))) {
    await client.query(`ALTER TABLE songs ADD COLUMN ${column} ${definition}`);
    console.log(`DB migration: added songs.${column}`);
  }
}

async function migrateDatabase() {
  if (!pool) {
    console.warn('DATABASE_URL not configured; database features disabled.');
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS songs (id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL DEFAULT 'Untitled', artist TEXT NOT NULL DEFAULT 'SwarAJ', album TEXT NOT NULL DEFAULT 'SwarAJ', category TEXT NOT NULL DEFAULT 'All Songs', language TEXT NOT NULL DEFAULT 'Marathi', file_path TEXT NULL, audio_url TEXT NULL, youtube_url TEXT NULL, youtube_id TEXT NULL, source_type TEXT NOT NULL DEFAULT 'mp3', cover_url TEXT NULL, duration INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await ensureColumn(client, 'title', `TEXT NOT NULL DEFAULT 'Untitled'`);
    await ensureColumn(client, 'artist', `TEXT NOT NULL DEFAULT 'SwarAJ'`);
    await ensureColumn(client, 'album', `TEXT NOT NULL DEFAULT 'SwarAJ'`);
    await ensureColumn(client, 'category', `TEXT NOT NULL DEFAULT 'All Songs'`);
    await ensureColumn(client, 'language', `TEXT NOT NULL DEFAULT 'Marathi'`);
    await ensureColumn(client, 'file_path', 'TEXT NULL');
    await ensureColumn(client, 'audio_url', 'TEXT NULL');
    await ensureColumn(client, 'youtube_url', 'TEXT NULL');
    await ensureColumn(client, 'youtube_id', 'TEXT NULL');
    await ensureColumn(client, 'source_type', `TEXT NOT NULL DEFAULT 'mp3'`);
    await ensureColumn(client, 'cover_url', 'TEXT NULL');
    await ensureColumn(client, 'duration', 'INTEGER NOT NULL DEFAULT 0');
    await ensureColumn(client, 'is_active', 'BOOLEAN NOT NULL DEFAULT TRUE');
    await ensureColumn(client, 'created_at', 'TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    await ensureColumn(client, 'updated_at', 'TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    await client.query(`ALTER TABLE songs ALTER COLUMN file_path DROP NOT NULL`);
    await client.query(`ALTER TABLE songs ALTER COLUMN audio_url DROP NOT NULL`);
    await client.query(`UPDATE songs SET source_type='youtube' WHERE youtube_id IS NOT NULL AND youtube_id<>'' AND (source_type IS NULL OR source_type='mp3')`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_songs_active ON songs(is_active)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_songs_source_type ON songs(source_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_songs_category ON songs(category)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_songs_youtube_id ON songs(youtube_id)`);
    await client.query('COMMIT');
    console.log('PostgreSQL migration completed.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('DATABASE MIGRATION ERROR:', error);
    throw error;
  } finally { client.release(); }
}

function authAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ success: false, error: 'ADMIN_TOKEN is not configured on the server.' });
  const supplied = req.get('x-admin-token') || req.body?.admin_token || '';
  if (supplied !== ADMIN_TOKEN) return res.status(401).json({ success: false, error: 'Unauthorized admin request.' });
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeFilename(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 2 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'audio' && AUDIO_EXTENSIONS.has(ext)) return cb(null, true);
    if (file.fieldname === 'cover' && IMAGE_EXTENSIONS.has(ext)) return cb(null, true);
    cb(new Error(`Unsupported ${file.fieldname} file type.`));
  }
});

function localUploadUrl(file) { return file ? `/uploads/${encodeURIComponent(file.filename)}` : null; }

async function uploadToCloudinary(file, folder, resourceType) {
  if (!cloudinary || !process.env.CLOUDINARY_URL || !file) return null;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: resourceType }, (error, result) => {
      if (error) reject(error); else resolve(result.secure_url);
    });
    fs.createReadStream(file.path).pipe(stream);
  });
}

async function persistFile(file, folder, resourceType) {
  if (!file) return null;
  if (cloudinary && process.env.CLOUDINARY_URL) {
    try {
      const url = await uploadToCloudinary(file, folder, resourceType);
      fs.rmSync(file.path, { force: true });
      return url;
    } catch (error) {
      console.error('Cloudinary upload failed:', error.message);
      throw new Error('Cloudinary upload failed. Check CLOUDINARY_URL and Cloudinary limits.');
    }
  }
  return localUploadUrl(file);
}

function walkSongs(directory, result = []) {
  let entries = [];
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (error) { console.error('SCAN ERROR:', error.message); return result; }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) { walkSongs(absolute, result); continue; }
    const ext = path.extname(entry.name).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;
    const relative = path.relative(SONGS_DIR, absolute);
    const parts = relative.split(path.sep);
    const category = parts.length > 1 ? clean(parts[0], 'All Songs') : 'All Songs';
    const encoded = `/songs/${encodePath(parts)}`;
    result.push({
      id: `local:${relative}`,
      title: path.basename(entry.name, ext).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(),
      artist: 'SwarAJ', album: 'SwarAJ', category, language: 'Marathi',
      source_type: 'mp3', audio_url: encoded, file_path: relative,
      youtube_url: null, youtube_id: null, cover_url: `/api/cover/${encodeURIComponent(category)}`,
      duration: 0, is_active: true, created_at: null
    });
  }
  return result;
}

async function getDbSongs() {
  if (!pool) return [];
  const result = await pool.query(`SELECT * FROM songs WHERE COALESCE(is_active, TRUE)=TRUE ORDER BY created_at DESC NULLS LAST, id DESC`);
  return result.rows.map(normalizeSong);
}

async function getAllSongsForAdmin() {
  if (!pool) return [];
  const result = await pool.query(`SELECT * FROM songs ORDER BY created_at DESC NULLS LAST, id DESC`);
  return result.rows.map(normalizeSong);
}

async function getAllSongs() {
  const localSongs = walkSongs(SONGS_DIR);
  const dbSongs = await getDbSongs();
  return [...dbSongs, ...localSongs];
}

function findCover(category) {
  const candidates = [category, category.toLowerCase(), category.replace(/\s+/g, '-'), category.replace(/\s+/g, '_'), 'default', 'ganpati'];
  for (const name of candidates) for (const ext of IMAGE_EXTENSIONS) {
    const file = path.join(IMAGES_DIR, `${name}${ext}`);
    if (fs.existsSync(file)) return `/images/${encodeURIComponent(path.basename(file))}`;
  }
  return null;
}

app.get('/api/health', async (req, res) => {
  let db = false;
  if (pool) { try { await pool.query('SELECT 1'); db = true; } catch (_) {} }
  const songs = await getAllSongs().catch(() => []);
  res.json({ success: true, status: 'ok', service: 'SwarAJ', database: db, songCount: songs.length, timestamp: new Date().toISOString() });
});

app.get('/api/songs', async (req, res) => {
  try { const songs = await getAllSongs(); res.json({ success: true, count: songs.length, songs }); }
  catch (error) { console.error('GET SONGS ERROR:', error); res.status(500).json({ success: false, songs: [], error: error.message }); }
});

app.get('/api/youtube', async (req, res) => {
  try { const songs = (await getDbSongs()).filter(song => song.source_type === 'youtube'); res.json({ success: true, count: songs.length, songs }); }
  catch (error) { console.error('GET YOUTUBE ERROR:', error); res.status(500).json({ success: false, songs: [], error: error.message }); }
});

app.get('/api/categories', async (req, res) => {
  try {
    const songs = await getAllSongs();
    const map = new Map();
    for (const song of songs) {
      if (!map.has(song.category)) map.set(song.category, { name: song.category, count: 0, cover: song.cover_url || findCover(song.category), mp3: 0, youtube: 0 });
      const item = map.get(song.category); item.count++; item[song.source_type === 'youtube' ? 'youtube' : 'mp3']++;
    }
    res.json({ success: true, count: map.size, categories: [...map.values()] });
  } catch (error) { console.error('CATEGORY ERROR:', error); res.status(500).json({ success: false, categories: [], error: error.message }); }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = clean(req.query.q).toLowerCase();
    if (!q) return res.json({ success: true, count: 0, songs: [] });
    const songs = await getAllSongs();
    const results = songs.filter(song => [song.title, song.artist, song.album, song.category, song.language].some(value => String(value || '').toLowerCase().includes(q)));
    res.json({ success: true, count: results.length, songs: results });
  } catch (error) { console.error('SEARCH ERROR:', error); res.status(500).json({ success: false, songs: [], error: error.message }); }
});

app.get('/api/cover/:category', (req, res) => {
  const url = findCover(decodeURIComponent(req.params.category || ''));
  if (!url) return res.status(404).send('Cover not found');
  res.redirect(url);
});

app.get('/api/admin/songs', authAdmin, async (req, res) => {
  try { const songs = await getAllSongsForAdmin(); res.json({ success: true, count: songs.length, songs }); }
  catch (error) { console.error('ADMIN LIST ERROR:', error); res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/admin/songs', authAdmin, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res) => {
  const files = req.files || {};
  const audioFile = files.audio?.[0];
  const coverFile = files.cover?.[0];
  try {
    if (!pool) throw new Error('DATABASE_URL is not configured.');
    const sourceType = clean(req.body.source_type || 'mp3').toLowerCase();
    const title = clean(req.body.title, 'Untitled');
    const artist = clean(req.body.artist, 'SwarAJ');
    const album = clean(req.body.album, 'SwarAJ');
    const category = clean(req.body.category, 'All Songs');
    const language = clean(req.body.language, 'Marathi');
    if (!['mp3', 'youtube'].includes(sourceType)) throw new Error('source_type must be mp3 or youtube.');

    let audioUrl = null, filePath = null, youtubeUrl = null, youtubeId = null;
    if (sourceType === 'youtube') {
      youtubeUrl = clean(req.body.youtube_url);
      youtubeId = youtubeIdFromUrl(youtubeUrl);
      if (!youtubeId) throw new Error('Enter a valid YouTube watch, youtu.be, shorts, embed, or live URL.');
    } else {
      if (!audioFile) throw new Error('MP3/audio file is required for an MP3 song.');
      const relativeName = path.join('uploads', audioFile.filename).replaceAll('\\', '/');
      audioUrl = await persistFile(audioFile, 'swaraj/audio', 'video');
      filePath = (cloudinary && process.env.CLOUDINARY_URL) ? null : relativeName;
    }
    const coverUrl = coverFile ? await persistFile(coverFile, 'swaraj/covers', 'image') : (clean(req.body.cover_url) || null);
    const result = await pool.query(`INSERT INTO songs (title,artist,album,category,language,file_path,audio_url,youtube_url,youtube_id,source_type,cover_url,duration,is_active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,NOW(),NOW()) RETURNING *`, [title, artist, album, category, language, filePath, audioUrl, youtubeUrl, youtubeId, sourceType, coverUrl, 0]);
    res.status(201).json({ success: true, song: normalizeSong(result.rows[0]) });
  } catch (error) {
    console.error('ADD SONG ERROR:', error);
    for (const file of [audioFile, coverFile]) if (file && file.path) fs.rmSync(file.path, { force: true });
    res.status(400).json({ success: false, error: error.message || 'Failed to add song' });
  }
});

app.post('/api/admin/upload', authAdmin, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), (req, res, next) => {
  req.body.source_type = 'mp3';
  next();
}, async (req, res) => {
  // Delegate to the same endpoint logic through a small internal implementation.
  const audioFile = req.files?.audio?.[0]; const coverFile = req.files?.cover?.[0];
  try {
    if (!pool) throw new Error('DATABASE_URL is not configured.');
    if (!audioFile) throw new Error('Audio file is required.');
    const audioUrl = await persistFile(audioFile, 'swaraj/audio', 'video');
    const coverUrl = coverFile ? await persistFile(coverFile, 'swaraj/covers', 'image') : (clean(req.body.cover_url) || null);
    const values = [clean(req.body.title,'Untitled'), clean(req.body.artist,'SwarAJ'), clean(req.body.album,'SwarAJ'), clean(req.body.category,'All Songs'), clean(req.body.language,'Marathi'), path.join('uploads', audioFile.filename).replaceAll('\\','/'), audioUrl, null, null, 'mp3', coverUrl, 0];
    const result = await pool.query(`INSERT INTO songs (title,artist,album,category,language,file_path,audio_url,youtube_url,youtube_id,source_type,cover_url,duration,is_active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,NOW(),NOW()) RETURNING *`, values);
    res.status(201).json({ success:true, song: normalizeSong(result.rows[0]) });
  } catch (error) { console.error('ADMIN UPLOAD ERROR:', error); res.status(400).json({success:false,error:error.message}); }
});

app.put('/api/admin/songs/:id', authAdmin, async (req, res) => {
  try {
    if (!pool) throw new Error('DATABASE_URL is not configured.');
    const id = Number(req.params.id); if (!Number.isInteger(id)) throw new Error('Invalid song id.');
    const fields = ['title','artist','album','category','language','cover_url','youtube_url','youtube_id','source_type','is_active'];
    const sets=[]; const values=[];
    for (const field of fields) if (Object.prototype.hasOwnProperty.call(req.body, field)) { let value=req.body[field]; if (field==='is_active') value=Boolean(value); if (field==='source_type') value=String(value)==='youtube'?'youtube':'mp3'; sets.push(`${field}=$${values.length+1}`); values.push(value); }
    if (!sets.length) throw new Error('No fields to update.');
    sets.push('updated_at=NOW()'); values.push(id);
    const result=await pool.query(`UPDATE songs SET ${sets.join(',')} WHERE id=$${values.length} RETURNING *`, values);
    if (!result.rowCount) return res.status(404).json({success:false,error:'Song not found.'});
    res.json({success:true,song:normalizeSong(result.rows[0])});
  } catch(error){ console.error('UPDATE SONG ERROR:',error); res.status(400).json({success:false,error:error.message}); }
});

app.delete('/api/admin/songs/:id', authAdmin, async (req,res)=>{
  try{ if(!pool) throw new Error('DATABASE_URL is not configured.'); const id=Number(req.params.id); if(!Number.isInteger(id)) throw new Error('Invalid song id.'); const result=await pool.query('DELETE FROM songs WHERE id=$1 RETURNING *',[id]); if(!result.rowCount)return res.status(404).json({success:false,error:'Song not found.'}); res.json({success:true,song:normalizeSong(result.rows[0])}); }
  catch(error){console.error('DELETE SONG ERROR:',error);res.status(400).json({success:false,error:error.message});}
});

app.use('/songs', express.static(SONGS_DIR, { acceptRanges:true, fallthrough:false, setHeaders:(res)=>res.setHeader('Cache-Control','public,max-age=31536000') }));
app.use('/uploads', express.static(UPLOADS_DIR, { acceptRanges:true }));
app.use('/images', express.static(IMAGES_DIR, { maxAge:'7d' }));
app.use(express.static(ROOT, { extensions:['html'] }));

app.get('*', (req,res,next)=>{
  if(req.path.startsWith('/api/')||req.path.startsWith('/songs/')||req.path.startsWith('/uploads/')||req.path.startsWith('/images/')) return next();
  res.sendFile(path.join(ROOT,'index.html'));
});

app.use((error,req,res,next)=>{ console.error('SERVER ERROR:',error); if(res.headersSent)return next(error); res.status(500).json({success:false,error:error.message||'Internal server error'}); });

(async()=>{
  try { await migrateDatabase(); } catch(error) { console.error('Startup DB migration failed:', error.message); }
  app.listen(PORT,'0.0.0.0',()=>console.log(`SwarAJ running on 0.0.0.0:${PORT}`));
})();

process.on('SIGTERM', async()=>{ if(pool) await pool.end().catch(()=>{}); process.exit(0); });
