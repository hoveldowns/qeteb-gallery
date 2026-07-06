// Qeteb Meriri — drop gallery + style-locked generator.
// Static curated gallery (index.html) + a generate/save loop.
// Generation can be free (default) or x402-gated (PAYMENTS_ENABLED=true) so
// agents pay per image — a real service in the machine economy.
const express = require('express');

// x402 (only used when PAYMENTS_ENABLED) — same stack as listening-heart.
const { paymentMiddleware, x402ResourceServer } = require('@x402/express');
const { HTTPFacilitatorClient } = require('@x402/core/server');
const { ExactEvmScheme } = require('@x402/evm/exact/server');

const app = express();
app.use(express.json());

// ── Drop config ─────────────────────────────────────────────────────
const STYLE =
  'Qeteb Meriri, the midday demon: an amorphous coiled mass of overlapping ' +
  'dark scales and shaggy hair, a single glowing eye set at its heart, resting ' +
  'on the hard border between blinding noon sunlight and black shadow; aged ' +
  'lithographic engraving texture, ochre bone-dust and shadow-umber palette, ' +
  'gallery-grade poster composition';

// ── Payment config ──────────────────────────────────────────────────
const PAYMENTS_ENABLED = process.env.PAYMENTS_ENABLED === 'true';
const NETWORK = process.env.NETWORK || 'eip155:8453';                 // Base mainnet
const FACILITATOR = process.env.FACILITATOR_URL || 'https://facilitator.daydreams.systems';
const PAY_TO = process.env.PAY_TO || '0x79d86d70588Ed7f9742446849417d50d3Bf1a707'; // agent 57812
const GENERATE_PRICE = process.env.GENERATE_PRICE || '$0.01';

function buildImageUrl(subject, seed) {
  const prompt = `${STYLE}. Subject: ${subject}`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
         `?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
}

const community = []; // in-memory (resets on restart; Postgres = next increment)

// ── Handlers ────────────────────────────────────────────────────────
function generate(req, res) {
  const subject = String(req.body.subject || '').slice(0, 200).trim();
  if (!subject) return res.status(400).json({ error: 'subject required' });
  const seed = Math.floor(Math.random() * 1e9);
  res.json({ subject, seed, url: buildImageUrl(subject, seed) });
}

// POST /api/generate — free by default, x402-gated when PAYMENTS_ENABLED.
if (PAYMENTS_ENABLED) {
  const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR });
  const resourceServer = new x402ResourceServer(facilitatorClient)
    .register(NETWORK, new ExactEvmScheme());

  const gate = paymentMiddleware(
    {
      'POST /api/generate': {
        accepts: { scheme: 'exact', price: GENERATE_PRICE, network: NETWORK, payTo: PAY_TO },
        description: 'Generate one image in the Qeteb drop style',
      },
    },
    resourceServer
  );

  app.post('/api/generate', gate, generate);

  // Initialize the facilitator (fetch supported kinds) before serving.
  (async () => {
    try {
      await Promise.race([
        resourceServer.initialize(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('x402 init timeout')), 10000)),
      ]);
      console.log(`x402 gating ON — ${GENERATE_PRICE} on ${NETWORK} → ${PAY_TO}`);
    } catch (e) {
      console.warn('x402 initialize warning (continuing):', e.message);
    }
  })();
} else {
  app.post('/api/generate', generate);
  console.log('x402 gating OFF — generation is free');
}

app.post('/api/save', (req, res) => {
  const subject = String(req.body.subject || '').slice(0, 200).trim();
  const seed = Number(req.body.seed);
  if (!subject || !Number.isFinite(seed)) return res.status(400).json({ error: 'bad input' });
  const item = { subject, seed, url: buildImageUrl(subject, seed), at: Date.now() };
  community.unshift(item);
  if (community.length > 200) community.pop();
  res.status(201).json(item);
});

app.get('/api/community', (_req, res) => res.json({ creations: community }));

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`qeteb-gallery running on port ${PORT}`));
