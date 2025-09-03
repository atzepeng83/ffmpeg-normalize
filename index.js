// index.js
const express = require('express');
const { execFile } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---------- Helpers ----------
function tmpName(prefix, ext) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return path.join(process.cwd(), `${prefix}_${id}.${ext}`);
}

async function downloadFile(url, filepath) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    // optional: timeout / headers hier setzen
  });
  await new Promise((resolve, reject) => {
    const w = fs.createWriteStream(filepath);
    response.data.pipe(w);
    w.on('finish', resolve);
    w.on('error', reject);
  });
}

function buildFilterChain(opts) {
  const filters = [];

  // De-Esser (standard: aktiv)
  // opts.deesser: boolean | string
  // true  -> "deesser"
  // string -> "deesser=<string>"  z. B. "f=6000:t=0.5"
  // false/undefined -> deaktiviert
  if (opts.deesser !== false) {
    if (typeof opts.deesser === 'string' && opts.deesser.trim().length > 0) {
      filters.push(`deesser=${opts.deesser.trim()}`);
    } else {
      filters.push('deesser'); // Defaults von FFmpeg
    }
  }

  // Loudness-Normalisierung (EBU R128)
  // string erlaubt, sonst Default
  if (opts.loudnorm === null) {
    // explizit aus
  } else if (typeof opts.loudnorm === 'string' && opts.loudnorm.trim().length > 0) {
    filters.push(`loudnorm=${opts.loudnorm.trim()}`);
  } else {
    // konservativer Podcast-Default
    filters.push('loudnorm=I=-16:TP=-1.0:LRA=11');
  }

  // Optionales dynamisches Leveling (vor Limiter, nach loudnorm nicht nötig, aber für Rohmaterial ok)
  if (typeof opts.dynaudnorm === 'string' && opts.dynaudnorm.trim().length > 0) {
    filters.push(`dynaudnorm=${opts.dynaudnorm.trim()}`); // z. B. "f=150:g=7"
  } else if (opts.dynaudnorm === true) {
    filters.push('dynaudnorm=f=150:g=7');
  }

  // Limiter
  if (opts.limiter === null) {
    // aus
  } else if (typeof opts.limiter === 'string' && opts.limiter.trim().length > 0) {
    filters.push(`alimiter=${opts.limiter.trim()}`);
  } else {
    filters.push('alimiter=limit=0.97');
  }

  return filters.join(',');
}

// ---------- Route ----------
/**
 * POST /normalize
 * Body:
 * {
 *   "url": "https://.../in.mp3",
 *   "o*
