# siteforge

multi-agent ai website builder — powered by gemma 4 on cerebras.

describe a website. siteforge plans, reviews, codes, and iterates — 6 specialized ai agents working in parallel to build production-ready websites at 1000+ tok/s inference speed.

![react](https://img.shields.io/badge/react-61DAFB?style=flat-square&logo=react&logoColor=black)
![node.js](https://img.shields.io/badge/node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![cerebras](https://img.shields.io/badge/cerebras-000000?style=flat-square)

`react` `node.js` `cerebras` `gemma 4`

---

## demo

[![watch demo](https://img.shields.io/badge/watch_demo-60s-red?style=flat-square)]()

*coming soon — record a 60s screen capture and replace the link above.*

---

## how it works

```
you write a prompt
        │
        ▼
  ┌─────────────┐
  │ design      │ plans color palette, typography, layout, site structure
  │ planner     │
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────────────┐
  │  designer  │  code reviewer │ bug finder │ auditor │
  └─────────────┴───────┬───────────────────────┘
                        │  (all 4 run in parallel)
                        ▼
                  ┌──────────┐
                  │ unifier  │ merges findings → unified spec
                  └────┬─────┘
                       │
                       ▼
                  ┌──────────┐
                  │  coder   │ writes complete html/css/js
                  └────┬─────┘
                       │
                       ▼
                  live preview
                       │
                       ▼
              review loop (up to 2 iterations)
              → preview stays live the whole time
```

**every build**: 6 agents, ~30-45 seconds wall time on gemma 4 31b via cerebras.

**every edit**: coder applies change instantly → preview updates → reviewers check in background.

---

## features

- **cerebras speed** — gemma 4 31b at 1000+ tok/s. builds that take minutes on gpu finish in seconds.
- **multi-agent pipeline** — 6 specialized agents (design planner, designer, code reviewer, bug finder, auditor, unifier) review every build before coding begins.
- **visual review** — design agents receive full-page screenshots of the rendered site and point out visual problems before you see them.
- **element inspector** — click any element in the live preview to select it for targeted editing. toggle to interact mode to use buttons/links normally.
- **mobile preview** — toggle a phone-shaped viewport (iphone 16 pro, 430px) to verify responsive design.
- **multi-page support** — build sites with multiple pages (index.html, about.html, contact.html) with automatic navigation links. file tree shows all pages.
- **instant edits** — type a change like "make the hero text blue" — coder applies it immediately, reviewers verify in background.
- **live metrics** — terminal-style dashboard showing tok/s, wall time, token breakdown, and per-agent timing bars.
- **project persistence** — all projects saved. rename, switch between them, pick up where you left off.

---

## tech stack

| layer | technology |
|-------|-----------|
| **inference** | gemma 4 31b on cerebras api |
| **agent framework** | custom streaming loop over `@earendil-works/pi-ai` |
| **frontend** | react 19 + vite 8 |
| **backend** | node.js + express 5 |
| **screenshots** | puppeteer (full-page jpeg at 70% quality) |
| **streaming** | sse (server-sent events) for real-time agent status |
| **styling** | css custom properties, amber terminal theme, jetbrains mono |

---

## quick start

### prerequisites

- node.js v20+
- a cerebras api key with gemma 4 access

### setup

```bash
git clone https://github.com/kjhq/siteforge.git
cd siteforge

# install dependencies
npm install
cd server && npm install && cd ..

# create .env file in the project root
echo 'CEREBRAS_API_KEY=your-key-here' > .env

# start both servers
npm run dev
```

- **frontend**: http://localhost:5173
- **api**: http://localhost:3001

### production build

```bash
npm run build        # build frontend to dist/
node server/index.js # serve api + built frontend
```

---

## architecture

```
browser:5173 ──vite proxy──▶ server:3001 ──sse stream──▶ cerebras api (gemma 4 31b)
                  │
                  ├── /api/build         POST — start a new build or edit
                  ├── /api/build/:id/events  GET — sse event stream
                  ├── /api/build/:id/result  GET — final result json
                  ├── /api/projects          GET — list all projects
                  ├── /api/projects/:id      GET/PATCH — project details / rename
                  └── /preview/:projectId/{*page}  GET — serves generated sites
```

**sse events**: `agent:*:start`, `agent:*:delta`, `agent:*:end`, `agent:*:stats`, `build:phase`, `build:preview`, `build:complete`

---

## agent pipeline details

| # | agent | role | output |
|---|-------|------|--------|
| 0 | **design planner** | creates opinionated visual direction | `design-plan.md` |
| 1 | **designer** | reviews layout, color, typography, responsive | `design-review.md` |
| 1 | **code reviewer** | reviews security, performance, accessibility | `security-audit.md` |
| 1 | **bug finder** | reviews logic, edge cases, potential bugs | `bugs-report.md` |
| 1 | **auditor** | reviews code quality, best practices | `quality-report.md` |
| 2 | **unifier** | synthesizes all reviews into a single spec | `unified-spec.md` |
| 3 | **coder** | implements the complete website | `index.html`, `styles.css`, `script.js` |
| 4 | **review loop** | re-runs reviewers + coder (up to 2 iterations) | convergence check |

---

## project structure

```
├── src/                    # react frontend
│   ├── App.jsx             # main app with sse handling
│   ├── App.css             # amber terminal theme
│   ├── config.js           # agent definitions
│   └── components/
│       ├── AgentPanel.jsx    # agent status cards
│       ├── CodePreview.jsx   # iframe preview + page selector
│       ├── MetricsPanel.jsx  # terminal-style build metrics
│       ├── ProjectSelector.jsx # project dropdown + rename
│       └── FileTree.jsx      # file browser panel
├── server/                 # node.js backend
│   ├── index.js            # express server + agent pipeline
│   └── skills/             # agent system prompts
│       ├── agent-design-planner.md
│       ├── agent-designer.md
│       ├── agent-security.md    # code reviewer
│       ├── agent-debug.md       # bug finder
│       ├── agent-auditor.md     # quality auditor
│       ├── agent-unifier.md
│       └── agent-coder.md
├── generated/              # built websites (gitignored)
├── package.json
└── vite.config.js
```

---

## built for track 1 — multiverse agents

siteforge runs **6 specialized ai agents in a coordinated pipeline** on gemma 4 31b via cerebras:

- **multi-agent collaboration**: design planner → 4 parallel reviewers → unifier → coder → review loop. each agent has a distinct role, tool access, and output format.
- **multimodal intelligence**: design agents receive **full-page screenshots** (base64 jpeg) of the rendered website and identify visual problems — broken layouts, color issues, missing images — before writing their reviews.
- **cerebras speed in action**: the metrics panel shows real-time tok/s (1000-1500 tok/s on gemma 4 31b) with side-by-side gpu baseline comparison. a build that would take 2+ minutes on gpu finishes in 30-45 seconds.

---

## team

built by [kjhq](https://github.com/kjhq) for the cerebras x google deepmind gemma 4 hackathon.

---

## license

mit

---

<div align="center">

built by [kjhq](https://kjhq.dev) · [@kjhqdev](https://x.com/kjhqdev)

</div>
