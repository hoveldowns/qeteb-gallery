// Qeteb Meriri — drop gallery + "make your own" generator.
// Static curated gallery (index.html) + a style-locked generate/save loop.
// This is the drops product Loaf pointed at: host a drop, lock the style,
// let people generate a subject inside it and save the good ones.
const express = require('express');
const app = express();
app.use(express.json());

// ── Locked style for the Qeteb drop ────────────────────────────────
// Users control the SUBJECT; the look is fixed here. This is "vibe the
// styles controlled" — swap this string to define a different drop.
const QETEB_STYLE =
  'Qeteb Meriri, the midday demon: an amorphous coiled mass of overlapping ' +
  'dark scales and shaggy hair, a single glowing eye set at its heart, resting ' +
  'on the hard border between blinding noon sunlight and black shadow; aged ' +
  'lithographic engraving texture, ochre bone-dust and shadow-umber palette, ' +
  'gallery-grade poster composition';

function buildImageUrl(subject, seed) {
  const prompt = `${QETEB_STYLE}. Subject: ${subject}`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
         `?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
}

// In-memory saved creations. NOTE: resets when the Render instance restarts
// or spins down. Postgres persistence is the next increment.
const community = [];

app.post('/api/generate', (req, res) => {
  const subject = String(req.body.subject || '').slice(0, 200).trim();
  if (!subject) return res.status(400).json({ error: 'subject required' });
  const seed = Math.floor(Math.random() * 1e9);
  res.json({ subject, seed, url: buildImageUrl(subject, seed) });
});

app.post('/api/save', (req, res) => {
  const subject = String(req.body.subject || '').slice(0, 200).trim();
  const seed = Number(req.body.seed);
  if (!subject || !Number.isFinite(seed)) {
    return res.status(400).json({ error: 'subject and seed required' });
  }
  const item = { subject, seed, url: buildImageUrl(subject, seed), at: Date.now() };
  community.unshift(item);
  if (community.length > 200) community.pop();
  res.status(201).json(item);
});

app.get('/api/community', (req, res) => res.json({ creations: community }));

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`qeteb-gallery running on port ${PORT}`));
