# SiteForge

**Multi-Agent AI Website Builder — Powered by Gemma 4 on Cerebras**

Describe a website. SiteForge plans, reviews, codes, and iterates — 6 specialized AI agents working in parallel to build production-ready websites at 1000+ tok/s inference speed.

---

## Demo

[![SiteForge Demo](https://img.shields.io/badge/Watch_Demo-60s-red)]()

*Coming soon — record a 60s screen capture and replace the link above.*

---

## How It Works

```
You write a prompt
        │
        ▼
  ┌─────────────┐
  │ Design      │ Plans color palette, typography, layout, site structure
  │ Planner     │ 
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────────────┐
  │  Designer  │  Code Reviewer │ Bug Finder │ Auditor │
  │    🎨      │      🔒       │    🐛     │   📋   │
  └─────────────┴───────┬───────────────────────┘
                        │  (all 4 run in parallel)
                        ▼
                  ┌──────────┐
                  │ Unifier  │ Merges findings → unified spec
                  └────┬─────┘
                       │
                       ▼
                  ┌──────────┐
                  │  Coder   │ Writes complete HTML/CSS/JS
                  └────┬─────┘
                       │
                       ▼
                  Live Preview
                       │
                       ▼
              Review Loop (up to 2 iterations)
              → Preview stays live the whole time
```

**Every build**: 6 agents, ~30-45 seconds wall time on Gemma 4 31B via Cerebras.

**Every edit**: Coder applies change instantly → preview updates → reviewers check in background.

---

## Features

- **⚡ Cerebras Speed** — Gemma 4 31B at 1000+ tok/s. Builds that take minutes on GPU finish in seconds.
- **🎨 Multi-Agent Pipeline** — 6 specialized agents (Design Planner, Designer, Code Reviewer, Bug Finder, Auditor, Unifier) review every build before coding begins.
- **📸 Visual Review** — Design agents receive full-page screenshots of the rendered site and point out visual problems before you see them.
- **🔍 Element Inspector** — Click any element in the live preview to select it for targeted editing. Toggle to interact mode to use buttons/links normally.
- **📱 Mobile Preview** — Toggle a phone-shaped viewport (iPhone 16 Pro, 430px) to verify responsive design.
- **📄 Multi-page Support** — Build sites with multiple pages (index.html, about.html, contact.html) with automatic navigation links. File tree shows all pages.
- **✏️ Instant Edits** — Type a change like "make the hero text blue" — coder applies it immediately, reviewers verify in background.
- **📊 Live Metrics** — Terminal-style dashboard showing tok/s, wall time, token breakdown, and per-agent timing bars.
- **💾 Project Persistence** — All projects saved. Rename, switch between them, pick up where you left off.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Inference** | Gemma 4 31B on Cerebras API |
| **Agent Framework** | Custom streaming loop over `@earendil-works/pi-ai` |
| **Frontend** | React 19 + Vite 8 |
| **Backend** | Node.js + Express 5 |
| **Screenshots** | Puppeteer (full-page JPEG at 70% quality) |
| **Streaming** | SSE (Server-Sent Events) for real-time agent status |
| **Styling** | CSS custom properties, amber terminal theme, JetBrains Mono |

---

## Quick Start

### Prerequisites
- Node.js v20+
- A Cerebras API key with Gemma 4 access

### Setup

```bash
git clone <this-repo>
cd siteforge

# Install dependencies
npm install
cd server && npm install && cd ..

# Create .env file in the project root
echo 'CEREBRAS_API_KEY=your-key-here' > .env

# Start both servers
npm run dev
```

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001

### Production Build

```bash
npm run build        # Build frontend to dist/
node server/index.js # Serve API + built frontend
```

---

## Architecture

```
browser:5173 ──Vite proxy──▶ server:3001 ──SSE stream──▶ Cerebras API (Gemma 4 31B)
                  │
                  ├── /api/build         POST — start a new build or edit
                  ├── /api/build/:id/events  GET — SSE event stream
                  ├── /api/build/:id/result  GET — final result JSON
                  ├── /api/projects          GET — list all projects
                  ├── /api/projects/:id      GET/PATCH — project details / rename
                  └── /preview/:projectId/{*page}  GET — serves generated sites
```

**SSE Events**: `agent:*:start`, `agent:*:delta`, `agent:*:end`, `agent:*:stats`, `build:phase`, `build:preview`, `build:complete`

---

## Agent Pipeline Details

| # | Agent | Role | Output |
|---|-------|------|--------|
| 0 | **Design Planner** | Creates opinionated visual direction | `design-plan.md` |
| 1 | **Designer** | Reviews layout, color, typography, responsive | `design-review.md` |
| 1 | **Code Reviewer** | Reviews security, performance, accessibility | `security-audit.md` |
| 1 | **Bug Finder** | Reviews logic, edge cases, potential bugs | `bugs-report.md` |
| 1 | **Auditor** | Reviews code quality, best practices | `quality-report.md` |
| 2 | **Unifier** | Synthesizes all reviews into a single spec | `unified-spec.md` |
| 3 | **Coder** | Implements the complete website | `index.html`, `styles.css`, `script.js` |
| 4 | **Review Loop** | Re-runs reviewers + coder (up to 2 iterations) | Convergence check |

---

## Project Structure

```
├── src/                    # React frontend
│   ├── App.jsx             # Main app with SSE handling
│   ├── App.css             # Amber terminal theme
│   ├── config.js           # Agent definitions
│   └── components/
│       ├── AgentPanel.jsx    # Agent status cards
│       ├── CodePreview.jsx   # Iframe preview + page selector
│       ├── MetricsPanel.jsx  # Terminal-style build metrics
│       ├── ProjectSelector.jsx # Project dropdown + rename
│       └── FileTree.jsx      # File browser panel
├── server/                 # Node.js backend
│   ├── index.js            # Express server + agent pipeline
│   └── skills/             # Agent system prompts
│       ├── agent-design-planner.md
│       ├── agent-designer.md
│       ├── agent-security.md    # Code Reviewer
│       ├── agent-debug.md       # Bug Finder
│       ├── agent-auditor.md     # Quality Auditor
│       ├── agent-unifier.md
│       └── agent-coder.md
├── generated/              # Built websites (gitignored)
├── package.json
└── vite.config.js
```

---

## Built for Track 1 — Multiverse Agents

SiteForge runs **6 specialized AI agents in a coordinated pipeline** on Gemma 4 31B via Cerebras:

- **Multi-agent collaboration**: Design Planner → 4 parallel reviewers → Unifier → Coder → Review Loop. Each agent has a distinct role, tool access, and output format.
- **Multimodal intelligence**: Design agents receive **full-page screenshots** (base64 JPEG) of the rendered website and identify visual problems — broken layouts, color issues, missing images — before writing their reviews.
- **Cerebras speed in action**: The metrics panel shows real-time tok/s (1000-1500 tok/s on Gemma 4 31B) with side-by-side GPU baseline comparison. A build that would take 2+ minutes on GPU finishes in 30-45 seconds.

---

## Team

Built by [kjhq](https://github.com/kjhq) for the Cerebras x Google DeepMind Gemma 4 Hackathon.

---

## License

MIT
