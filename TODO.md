# VoCode — TODO & Ideas

## Priority

- [x] Get Cerebras API key working
- [ ] Test the 5-agent pipeline end-to-end
- [ ] Record demo video (60s max)

## Core Features

- [ ] **Mobile showcase side-by-side** — Show generated site on a phone mockup next to the desktop preview so users see responsive behavior in real-time.
- [ ] **Refactor agent prompts & skills** — Audit and rewrite all 5 agent system prompts for consistency, reliability, and better structured output adherence. Extract reusable skill definitions.
- [ ] **Cursor-based element targeting** — Track mouse position on the preview iframe. User says "check my cursor" or "cursor here" → system reads the element under cursor → passes that context to agents so changes target the right component. Could highlight the element on hover to show user what's selected.
- [ ] **Incremental updates** — Don't regenerate everything. Track what changed in user's request, only modify relevant parts.
- [ ] **History / undo** — Keep a list of previous versions. User can say "go back" or click to restore.
- [ ] **Multi-turn memory** — Remember context across requests so "make it bigger" refers to the last thing discussed.

## Demo Polish

- [ ] **Live latency meter** — Real-time TTFT and tok/s display for Cerebras vs simulated GPU side-by-side
- [ ] **Agent thinking bubbles** — Show what each agent is actually outputting, not just status
- [ ] **Cursor-over-frame highlight** — When user hovers over preview, visually highlight the element + show tag/class/id for debugging
- [ ] **Screenshot export** — One-click save of the generated site as a screenshot for X post

## People's Choice

- [ ] **X post with demo video** — Tag @Cerebras @googlegemma
- [ ] **GitHub repo** — Clean README, screenshot, demo.gif

## Stretch

- [ ] **User can draw on preview** — Circle an area, agents modify just that region
- [ ] **Deploy generated site** — One-click deploy to Vercel/Railway from within app
- [ ] **Code panel** — Show actual HTML/CSS/JS alongside the preview, editable
