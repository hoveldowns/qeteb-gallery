---
name: drop-gallery
description: >
  Build and deploy a "drop" — a themed, style-locked AI-art gallery where
  visitors generate images inside a fixed aesthetic and save the good ones.
  Use when an agent (or its operator) wants to run its own art drop: define a
  style, host a curated gallery, and open a generate/save loop. Covers the file
  layout, the style-lock pattern, a keyless generator (Pollinations) or an
  x402-gated one, optional TaskMarket bounty sourcing, and a Render deploy.
  Triggers: "run a drop", "make my own gallery", "style-locked generation",
  "art drop", "curate submissions", "generate in a style and save".
---

# Drop Gallery

A **drop** is a themed art event with a **locked style**. Visitors control the
*subject*; the *look* is fixed by you. The result is a gallery that reads like an
exhibition, plus a live "make your own" loop where anyone generates a piece in the
drop's style and saves the ones worth keeping.

This skill produces a single small Node/Express service that serves:
- a **curated gallery** (your hand-picked pieces, e.g. bounty submissions),
- a **generator** (`/api/generate`) that locks the style and takes only a subject,
- a **save + community** loop (`/api/save`, `/api/community`).

It deploys to Render as one web service. Start keyless (Pollinations, no API key),
add x402-gating later to make generation a paid, agent-callable API.

---

## 1. Define the drop (the only creative decision that matters)

A drop is one string: its **locked style**. Everything else is boilerplate. Write a
style that fully specifies the *look* and leaves a slot for the subject.

```js
const STYLE =
  'Qeteb Meriri, the midday demon: an amorphous coiled mass of overlapping dark ' +
  'scales and shaggy hair, a single glowing eye at its heart, on the hard border ' +
  'between blinding noon light and black shadow; aged lithographic engraving ' +
  'texture, ochre bone-dust and shadow-umber palette, gallery-grade composition';
```

**Principle — control the style, not the subject.** The user sends only a subject;
the server prepends `STYLE`. This is what makes a *drop* (coherent, on-brand) instead
of a generic image box. Never let the client send raw prompts.

---

## 2. The server

Three endpoints + static hosting. Generation is keyless via Pollinations
(`image.pollinations.ai`) — returns a real image URL in ~5–10s, no API key.

```js
const express = require('express');
const app = express();
app.use(express.json());

const STYLE = '...';                 // your locked style from step 1
const community = [];                // in-memory (see §5 for persistence)

function imageUrl(subject, seed) {
  const prompt = `${STYLE}. Subject: ${subject}`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
         `?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
}

app.post('/api/generate', (req, res) => {
  const subject = String(req.body.subject || '').slice(0, 200).trim();
  if (!subject) return res.status(400).json({ error: 'subject required' });
  const seed = Math.floor(Math.random() * 1e9);
  res.json({ subject, seed, url: imageUrl(subject, seed) });   // seed = reproducible
});

app.post('/api/save', (req, res) => {
  const subject = String(req.body.subject || '').slice(0, 200).trim();
  const seed = Number(req.body.seed);
  if (!subject || !Number.isFinite(seed)) return res.status(400).json({ error: 'bad input' });
  const item = { subject, seed, url: imageUrl(subject, seed), at: Date.now() };
  community.unshift(item);
  if (community.length > 200) community.pop();
  res.status(201).json(item);
});

app.get('/api/community', (_req, res) => res.json({ creations: community }));

app.use(express.static(__dirname));
app.listen(process.env.PORT || 3000);
```

Note: you store only `{subject, seed}` — the image is re-derivable from the
Pollinations URL, so you never store bytes.

---

## 3. The gallery page

One `index.html`. Three parts, top to bottom:

1. **Header** — title, one-line premise, submission count.
2. **Curated grid** — your chosen pieces. Card = `<img>` + agent label + title + one
   short evocative note. Crown the winner with a distinct border + tag.
3. **Make-your-own + Community** — a subject input → `POST /api/generate` → show image
   → Save button → `POST /api/save` → refresh a community grid from `/api/community`.

Client logic is ~30 lines of vanilla JS: submit subject, render returned `url`, wire a
Save button, re-fetch community. Keep the style in the CSS, not per-card.

### Curation lessons (learned the hard way)

- **It's an exhibition, not a QA report.** Do NOT put per-card pass/fail "meets-spec"
  checkboxes under fine-art pieces — when everything passes they carry zero information
  and cheapen the look. Image + title + one line is stronger.
- **Crown one winner, lead with it.** Move the winner to the front; give it a gold
  border and a small "Winner" tag.
- **Cut the duds.** Exclude non-art submissions (e.g. an agent that submits its *plan*
  as a text screenshot) rather than showing broken tiles.
- **Bundle assets with correct relative paths.** If curated images are files, ship them
  in `images/` and reference `images/x.png` — never absolute `file://` paths.

---

## 4. Deploy (Render, one web service)

```
project/
  index.html
  images/            # curated pieces (if any)
  server.js
  package.json       # { "scripts": { "start": "node server.js" }, deps: express }
  render.yaml
```

`render.yaml`:

```yaml
services:
  - type: web
    name: my-drop
    runtime: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
```

Push to a repo → Render → **New + → Blueprint** → connect the repo → Apply. You get
`https://<name>.onrender.com`. Render auto-redeploys on every push.

> Prefer a Render **web service** (not a static site or GitHub Pages): the generate/save
> API needs a server, and this way one URL grows from gallery → product with no migration.

---

## 5. Persistence (next increment)

`community` is in-memory and resets when the free instance spins down. To persist saved
creations across restarts, add Postgres (Render free Postgres) and replace the array
with a `creations` table storing `{subject, seed, created_at}` — the URL is rebuilt from
`imageUrl(subject, seed)` on read.

---

## 6. Make generation a paid, agent-callable API (x402)

Keyless generation is free and open. To make it agent-native and monetized, gate
`POST /api/generate` behind x402 so a caller pays per generation.

- Use the `@x402/express` middleware (v2). Register scheme `exact` on network
  **`eip155:8453`** (Base mainnet). The `@x402/evm` `ExactEvmScheme` resolves mainnet
  USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) automatically from the price.
- Use a **v2-capable mainnet facilitator**: `https://facilitator.daydreams.systems`
  (advertises `x402Version 2, exact, eip155:8453`). The public `x402.org/facilitator`
  is testnet-only and will reject mainnet.
- Set `payTo` to the drop owner's wallet; price per generation e.g. `$0.01`.

This turns the drop into a service other agents can call and pay for — a generate
endpoint in the machine economy, not just a web toy.

The reference repo implements exactly this behind `PAYMENTS_ENABLED=true`: flip the env
var to gate `POST /api/generate` ($0.01 on Base mainnet via `facilitator.daydreams.systems`);
leave it off to keep a free, clickable web demo.

---

## 7. Sourcing the curated pieces (optional: TaskMarket)

The curated grid can be seeded by a TaskMarket bounty: post the drop's brief as a task,
collect submissions, then curate the best into the gallery and crown a winner. Resolve
each piece's creator from `https://api.taskmarket.dev/api/tasks/{taskId}` (`requester`
/ agent id). Announce the winner and link the live gallery — the reveal doubles as the
drop's launch.

---

## Reference implementation

The repository this skill ships in **is** a complete working drop ("Qeteb Meriri"):
`index.html` (curated gallery + make-your-own), `server.js` (generate/save/community),
`render.yaml`, and `images/`. Copy it, swap `STYLE` and the curated pieces, and you have
a new drop.
