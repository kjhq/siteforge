# siteforge

multi-agent ai website builder on gemma 4 via cerebras. describe a site — 6 agents plan, review, code, iterate at 1000+ tok/s.

![react](https://img.shields.io/badge/react-61DAFB?style=flat-square&logo=react&logoColor=black)
![node.js](https://img.shields.io/badge/node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![cerebras](https://img.shields.io/badge/cerebras-000000?style=flat-square)

`react` `node.js` `cerebras` `gemma 4`

---

## how it works

```
you write a prompt
        │
        ▼
  ┌─────────────┐
  │ design      │ color, typography, layout, structure
  │ planner     │
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────────────┐
  │ designer │ code reviewer │ bug finder │ auditor │
  └─────────────┴───────┬───────────────────────┘
                        │  (4 run in parallel)
                        ▼
                  ┌──────────┐
                  │ unifier  │ merges reviews → spec
                  └────┬─────┘
                       │
                       ▼
                  ┌──────────┐
                  │ coder    │ html/css/js
                  └────┬─────┘
                       │
                       ▼
                  live preview → review loop (up to 2x)
```

every build: 6 agents, ~30-45s wall time on gemma 4 31b via cerebras.

---

## features

- cerebras speed — 1000+ tok/s on gemma 4 31b
- multi-agent pipeline — planner → 4 parallel reviewers → unifier → coder
- visual review — design agents get full-page screenshots
- element inspector — click to select, edit in place
- mobile preview — iphone 16 pro viewport (430px)
- multi-page support — index, about, contact with nav links
- instant edits — type a change, coder applies immediately
- live metrics — tok/s, wall time, per-agent timing
- project persistence — save, rename, switch projects

---

## stack

| layer | tech |
|-------|------|
| inference | gemma 4 31b on cerebras api |
| agents | custom streaming over `@earendil-works/pi-ai` |
| frontend | react 19 + vite 8 |
| backend | node.js + express 5 |
| screenshots | puppeteer (full-page jpeg) |
| streaming | sse for real-time agent status |

---

## quick start

```bash
git clone https://github.com/kjhq/siteforge.git
cd siteforge

npm install
cd server && npm install && cd ..

echo 'CEREBRAS_API_KEY=your-key-here' > .env
npm run dev
```

- frontend: http://localhost:5173
- api: http://localhost:3001

### production

```bash
npm run build
node server/index.js
```

---

## architecture

```
browser:5173 ──vite proxy──▶ server:3001 ──sse──▶ cerebras (gemma 4 31b)
```

sse events: `agent:*:start`, `agent:*:delta`, `agent:*:end`, `build:complete`

---

## agent pipeline

| # | agent | role |
|---|-------|------|
| 0 | design planner | visual direction |
| 1 | designer | layout, color, typography |
| 1 | code reviewer | security, a11y, performance |
| 1 | bug finder | logic, edge cases |
| 1 | auditor | code quality |
| 2 | unifier | merged spec |
| 3 | coder | html/css/js output |
| 4 | review loop | up to 2 iterations |

---

## project structure

```
├── src/                 # react frontend
├── server/              # express + agent pipeline
│   └── skills/          # agent system prompts
├── generated/           # built sites (gitignored)
└── vite.config.js
```

---

## license

mit

---

<div align="center">

built for cerebras x google deepmind gemma 4 hackathon · [kjhq](https://kjhq.dev) · [@kjhqdev](https://x.com/kjhqdev)

</div>
