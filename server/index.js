import express from "express"
import cors from "cors"
import path from "path"
import { EventEmitter } from "events"
import { fileURLToPath } from "url"
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from "fs"
import { loadSkills, formatSkillInvocation } from "@earendil-works/pi-agent-core"
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node"
import { createModels, createProvider, envApiKeyAuth, Type } from "@earendil-works/pi-ai"
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const GENERATED_DIR = path.resolve(ROOT, "generated")
const SKILLS_DIR = "server/skills"

try {
  const envPath = path.resolve(ROOT, ".env")
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf-8").split("\n")
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith("#") || !t.includes("=")) continue
      const i = t.indexOf("=")
      const k = t.slice(0, i).trim()
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "")
      if (!process.env[k]) process.env[k] = v
    }
  }
} catch {}

const GPU_BASELINE = { tps: 126, provider: "ModelRun" }

// ── Pi Model Setup ──────────────────────────────────────────────
const models = createModels()
models.setProvider(createProvider({
  id: "cerebras",
  name: "Cerebras",
  baseUrl: "https://api.cerebras.ai/v1",
  auth: { apiKey: envApiKeyAuth("Cerebras API key", ["VITE_CEREBRAS_API_KEY"]) },
  models: [{
    id: "gemma-4-31b",
    name: "Gemma 4 31B",
    api: "openai-completions",
    provider: "cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 65536,
    maxTokens: 16384,
  }],
  api: openAICompletionsApi(),
}))
const MODEL = models.getModel("cerebras", "gemma-4-31b")

// ── Express Setup ────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use("/generated", express.static(GENERATED_DIR))
mkdirSync(GENERATED_DIR, { recursive: true })

let projectIdCounter = 0
function createProjectDir() {
  projectIdCounter++
  const projectId = `project-${Date.now()}-${projectIdCounter}`
  const dir = path.join(GENERATED_DIR, projectId)
  mkdirSync(dir, { recursive: true })
  return { projectId, dir }
}

// ── Build State ──────────────────────────────────────────────────
const builds = new Map()

function emit(buildId, type, data) {
  const b = builds.get(buildId)
  if (b) b.emitter.emit("event", { type, data })
}

// ── Skills Loader ──────────────────────────────────────────────
let _skillsCache = null
async function getSkills() {
  if (_skillsCache) return _skillsCache
  const env = new NodeExecutionEnv({ cwd: ROOT })
  const { skills } = await loadSkills(env, [SKILLS_DIR])
  _skillsCache = skills
  return skills
}

function getSkillPrompt(skills, name) {
  const skill = skills.find(s => s.name === name)
  return skill ? formatSkillInvocation(skill, "") : ""
}

// ── Tool Definitions ──────────────────────────────────────────
const PI_TOOLS = [{
  name: "read_file",
  description: "Read a file from the project directory.",
  parameters: Type.Object({
    path: Type.String({ description: "File path" }),
  }, { additionalProperties: false }),
}, {
  name: "write_file",
  description: "Create or overwrite a file. Use for writing code and reports.",
  parameters: Type.Object({
    path: Type.String({ description: "File path" }),
    content: Type.String({ description: "Full file content" }),
  }, { additionalProperties: false }),
}, {
  name: "list_dir",
  description: "List files in the project directory.",
  parameters: Type.Object({}, { additionalProperties: false }),
}]

// ── Agent Loop (pi-ai streaming + custom tool handling) ────────
async function piAgentComplete(model, messages, systemPrompt, tools, toolChoice, buildId, skillName) {
  // Pass messages through unchanged if they're in pi-ai format
  const convertedMessages = messages.map(m => {
    // Already in pi-ai format (toolResult)
    if (m.role === "toolResult") return m
    // Already in pi-ai format (assistant with content array)
    if (m.role === "assistant" && Array.isArray(m.content)) return m
    // User message with string content
    if (m.role === "user") return { role: "user", content: m.content, timestamp: Date.now() }
    // Fallback
    return { ...m, timestamp: Date.now() }
  })

  const context = {
    messages: convertedMessages,
    systemPrompt,
    ...(tools?.length ? { tools } : {}),
  }

  const options = {
    ...(toolChoice ? { toolChoice } : {}),
  }

  // Stream for frontend feedback, but use complete() for actual result
  const stream = model ? models.stream(model, context, options) : null
  if (!stream) throw new Error("Model not found")

  let fullText = ""
  const toolCalls = []

  for await (const event of stream) {
    switch (event.type) {
      case "text_delta":
        fullText += event.delta
        if (buildId) emit(buildId, `agent:${skillName}:delta`, { text: event.delta })
        break
      case "done":
        for (const c of (event.message?.content || [])) {
          if (c.type === "toolCall") {
            toolCalls.push({
              id: c.id,
              name: c.name,
              args: c.arguments || {},
            })
          }
        }
        break
    }
  }

  return { fullText, toolCalls }
}

async function executeToolCall(tc, projectDir) {
  const name = tc.name
  const args = tc.args || {}
  // args may be string or object
  const parsedArgs = typeof args === "string" ? JSON.parse(args) : args

  switch (name) {
    case "read_file": {
      const fp = path.join(projectDir, parsedArgs.path || "")
      if (!existsSync(fp)) throw new Error(`File not found: ${parsedArgs.path}`)
      return readFileSync(fp, "utf-8")
    }
    case "write_file": {
      const fp = path.join(projectDir, parsedArgs.path || "")
      mkdirSync(path.dirname(fp), { recursive: true })
      writeFileSync(fp, parsedArgs.content || "", "utf-8")
      return `Written ${parsedArgs.path}`
    }
    case "list_dir": {
      const names = readdirSync(projectDir)
      return names.filter(n => !n.startsWith(".")).join("\n")
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

async function runAgent(skillName, buildId, prompt, projectDir) {
  const skills = await getSkills()
  const skillBlock = getSkillPrompt(skills, skillName)
  const agentName = skills.find(s => s.name === skillName)?.description?.split("—")[0]?.trim() || skillName

  const systemPrompt = `You are ${agentName}, part of an autonomous multi-agent website building system.

${skillBlock}

## Available Tools
- read_file: Read a file from the project directory
- write_file: Create or overwrite a file (use for writing code and reports)
- list_dir: List files in the project directory

## Rules
- Always output COMPLETE files — never partial content or diffs
- Use write_file to create code files and report files
- For code generation, create separate files: index.html, styles.css, script.js
- index.html must link to styles.css (<link>) and script.js (<script src>)
- Each file must be complete and working independently`

  const shortName = skillName.replace("agent-", "")
  const displayName = shortName.charAt(0).toUpperCase() + shortName.slice(1)
  emit(buildId, `agent:${skillName}:start`, { name: agentName, shortName: displayName })

  let messages = [{ role: "user", content: prompt }]
  let fullText = ""
  let totalStats = { wall_ms: 0, ttft_ms: 0, completion_tokens: 0 }

  while (true) {
    // First call forces tool use; subsequent calls let model decide
    const tc = messages.length === 1 ? "required" : "auto"
    console.log(`[Agent] ${skillName}: calling model (toolChoice=${tc}, messages=${messages.length})`)
    const result = await piAgentComplete(MODEL, messages, systemPrompt, PI_TOOLS, tc, buildId, skillName)

    fullText = result.fullText
    console.log(`[Agent] ${skillName}: got ${result.toolCalls?.length || 0} tool calls, text=${(fullText||'').slice(0,50)}`)

    if (!result.toolCalls || result.toolCalls.length === 0) break

    // Execute tool calls
    const toolResults = []
    for (const tc of result.toolCalls) {
      const argsStr = typeof tc.args === "object" ? JSON.stringify(tc.args) : String(tc.args || "")
      emit(buildId, `agent:${skillName}:tool_start`, { tool: tc.name, args: argsStr })
      let content = ""
      let isError = false
      console.log(`[Agent] ${skillName}: executing tool '${tc.name}' with args:`, JSON.stringify(tc.args))
      try {
        content = await executeToolCall(tc, projectDir)
        console.log(`[Agent] ${skillName}: tool result: "${content.slice(0, 100)}"`)
        emit(buildId, `agent:${skillName}:tool_end`, { tool: tc.name, ok: true })
      } catch (err) {
        content = `Error: ${err.message}`
        isError = true
        console.log(`[Agent] ${skillName}: tool error: ${err.message}`)
        emit(buildId, `agent:${skillName}:tool_end`, { tool: tc.name, ok: false })
      }
      toolResults.push({
        role: "toolResult",
        toolCallId: tc.id,
        toolName: tc.name,
        content: [{ type: "text", text: content }],
        isError,
        timestamp: Date.now(),
      })
    }

    // Build assistant message with tool calls embedded in content array
    const contentBlocks = []
    if (fullText) contentBlocks.push({ type: "text", text: fullText })
    for (const tc of result.toolCalls) {
      contentBlocks.push({ type: "toolCall", id: tc.id, name: tc.name, arguments: tc.args })
    }
    const assistantMsg = { role: "assistant", content: contentBlocks, timestamp: Date.now() }
    console.log(`[Agent] ${skillName}: ${result.toolCalls.length} tool calls`)
    messages = [...messages, assistantMsg, ...toolResults]
  }

  emit(buildId, `agent:${skillName}:end`, { name: agentName, shortName: displayName })
  return { text: fullText }
}

// ── Build Pipeline ────────────────────────────────────────────
async function runBuild(prompt, projectId, dir) {
  const build = builds.get(projectId)
  console.log(`[Build] Starting ${projectId}: "${prompt.slice(0, 50)}..."`)

  emit(projectId, "build:start", { projectId, prompt })

  // Phase 1: Parallel Review
  const reviewRoles = ["agent-designer", "agent-security", "agent-debug", "agent-auditor"]
  emit(projectId, "build:phase", { phase: "review", agents: reviewRoles })
  console.log(`[Build] Phase 1: Review`)

  await Promise.all(
    reviewRoles.map(role =>
      runAgent(role, projectId,
        `Review this build prompt and write a detailed report as a .md file using write_file:\n\nBUILD PROMPT: ${prompt}\n\nInclude findings, severity (P0/P1/P2), and suggestions. If nothing to flag, write "ALL CLEAR - no issues".`,
        dir
      ).then(r => console.log(`[Agent] ${role} done`))
    )
  )

  // Phase 2: Unify
  emit(projectId, "build:phase", { phase: "unify", agents: ["agent-unifier"] })
  console.log(`[Build] Phase 2: Unify`)

  await runAgent("agent-unifier", projectId,
    `Read all review .md files using read_file, then write a unified-spec.md using write_file that synthesizes all findings into an ordered build plan. Include priority, file, description, and approach for each change.`,
    dir
  )
  console.log(`[Agent] Unifier done`)

  // Phase 3: Code
  emit(projectId, "build:phase", { phase: "code", agents: ["agent-coder"] })
  console.log(`[Build] Phase 3: Code`)

  await runAgent("agent-coder", projectId,
    `Read unified-spec.md using read_file, then implement the website using write_file. Create separate files: index.html, styles.css, script.js. Each file must be COMPLETE and working. Use modern responsive design, semantic HTML, clean CSS, and proper JS. index.html must <link> to styles.css and <script src> to script.js.`,
    dir
  )
  console.log(`[Agent] Coder done`)

  // Phase 4: Review Loop
  const MAX_ITERATIONS = 2
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`[Build] Loop iteration ${iteration}`)
    emit(projectId, "build:phase", { phase: "review-loop", iteration })

    const beforeFiles = getFileNames(dir)

    await Promise.all(
      reviewRoles.map(role =>
        runAgent(role, projectId,
          `Read index.html, styles.css, script.js using read_file. Review for remaining issues. Update your review .md file using write_file. If all previous issues are fixed, write "ALL CLEAR - no issues remaining".`,
          dir
        )
      )
    )

    await runAgent("agent-unifier", projectId,
      `Read all updated review .md files using read_file. If all say "ALL CLEAR", write unified-spec.md with content "ALL CLEAR - NO CHANGES NEEDED". Otherwise write an updated spec with remaining fixes.`,
      dir
    )

    // Check for convergence
    const env = new NodeExecutionEnv({ cwd: dir })
    const spec = await env.readTextFile("unified-spec.md")
    if (spec.ok && spec.value.includes("NO CHANGES NEEDED")) {
      console.log(`[Build] Converged`)
      emit(projectId, "build:converged", { iteration })
      break
    }

    await runAgent("agent-coder", projectId,
      `Read unified-spec.md using read_file, then apply remaining fixes to the code files using write_file. Output COMPLETE updated files.`,
      dir
    )

    const afterFiles = getFileNames(dir)
    if (beforeFiles === afterFiles) {
      console.log(`[Build] Converged — no file changes`)
      emit(projectId, "build:converged", { iteration })
      break
    }
  }

  // Collect results
  const files = collectFiles(dir)
  const htmlFile = files.find(f => f.path.endsWith(".html"))
  const inlinedHtml = inlineAssets(htmlFile?.content || "", files)
  const stats = {
    gpu_baseline_tps: GPU_BASELINE.tps,
    gpu_baseline_provider: GPU_BASELINE.provider,
    completion_tokens: htmlFile ? Math.ceil(htmlFile.content.length / 4) : 0,
  }

  build.result = { files, fullHtml: inlinedHtml, stats }
  build.status = "complete"

  emit(projectId, "build:complete", { projectId, result: build.result })
  console.log(`[VoCode] ${projectId}: ${files.length} files`)
}

function getFileNames(dir) {
  try { return JSON.stringify(readdirSync(dir).filter(n => n.endsWith(".html") || n.endsWith(".css") || n.endsWith(".js")).sort()) } catch { return "" }
}

function collectFiles(dir) {
  try {
    const names = readdirSync(dir)
    const result = []
    for (const name of names) {
      const fp = path.join(dir, name)
      const st = statSync(fp)
      if (st.isFile() && !name.startsWith(".") && (name.endsWith(".html") || name.endsWith(".css") || name.endsWith(".js"))) {
        result.push({ path: name, content: readFileSync(fp, "utf-8") })
      }
    }
    return result
  } catch { return [] }
}

function inlineAssets(html, files) {
  if (!html) return ""
  const css = {}
  const js = {}
  for (const f of files) {
    if (f.path.endsWith(".css")) css[f.path] = f.content
    if (f.path.endsWith(".js")) js[f.path] = f.content
  }

  let result = html.replace(
    /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi,
    (match, href) => {
      if (href.startsWith("http") || href.startsWith("//")) return match
      const content = css[href]
      return content ? `<style>\n${content}\n</style>` : match
    }
  )

  result = result.replace(
    /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi,
    (match, src) => {
      if (src.startsWith("http") || src.startsWith("//")) return match
      const content = js[src]
      return content ? `<script>\n${content}\n</script>` : match
    }
  )

  return result
}

// ── API Endpoints ─────────────────────────────────────────────
app.post("/api/build", async (req, res) => {
  try {
    const { prompt } = req.body
    if (!prompt?.trim()) return res.json({ ok: false, error: "prompt required" })

    const { projectId, dir } = createProjectDir()
    const emitter = new EventEmitter()

    builds.set(projectId, { status: "running", emitter, dir, result: null })

    runBuild(prompt, projectId, dir).catch(err => {
      console.error(`[VoCode] Build ${projectId} failed:`, err)
      console.error(err.stack)
      emit(projectId, "build:error", { error: err.message })
      const b = builds.get(projectId)
      if (b) b.status = "error"
    })

    res.json({ ok: true, projectId })
  } catch (err) {
    console.error("[VoCode] POST /api/build error:", err)
    res.json({ ok: false, error: err.message })
  }
})

app.get("/api/build/:projectId/events", (req, res) => {
  const build = builds.get(req.params.projectId)
  if (!build) return res.status(404).end()

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })

  const handler = (event) => {
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
    } catch {}
  }

  build.emitter.on("event", handler)
  req.on("close", () => build.emitter.off("event", handler))
})

app.get("/api/build/:projectId/result", (req, res) => {
  const build = builds.get(req.params.projectId)
  if (!build) return res.json({ ok: false, error: "not found" })
  if (build.status === "error") return res.json({ ok: false, error: "build failed" })
  if (build.status !== "complete") return res.json({ ok: false, error: "still running" })

  res.json({
    ok: true,
    projectId: req.params.projectId,
    files: build.result.files,
    fullHtml: build.result.fullHtml,
    stats: build.result.stats,
  })
})

const INJECTION_SCRIPT = `<script>
(function(){var p=null;document.addEventListener('mouseover',function(e){var c=e.target;if(c===p)return;p=c;var r=c.getBoundingClientRect();parent.postMessage({type:'hover',tag:c.tagName.toLowerCase(),id:c.id||null,classes:Array.from(c.classList||[]),text:(c.textContent||'').trim().slice(0,80),rect:{top:r.top,left:r.left,width:r.width,height:r.height}},'*')},true);document.addEventListener('click',function(e){var el=e.target;var r=el.getBoundingClientRect();var cs={};try{var s=getComputedStyle(el);cs.color=s.color;cs.fontSize=s.fontSize}catch{}parent.postMessage({type:'select',tag:el.tagName.toLowerCase(),id:el.id||null,classes:Array.from(el.classList||[]),text:(el.textContent||'').trim().slice(0,80),rect:{top:r.top,left:r.left,width:r.width,height:r.height},styles:cs},'*');e.preventDefault();e.stopPropagation()},true)})()
</script>`

app.get("/preview/:projectId", (req, res) => {
  const dir = path.join(GENERATED_DIR, req.params.projectId)
  const indexPath = path.join(dir, "index.html")
  if (!existsSync(indexPath)) return res.status(404).send("Not found")

  let html = readFileSync(indexPath, "utf-8")
  html = html.replace("</body>", INJECTION_SCRIPT + "\n</body>")
  res.set("Content-Type", "text/html")
  res.send(html)
})

app.get("/preview/:projectId/:file", (req, res) => {
  const filePath = path.join(GENERATED_DIR, req.params.projectId, req.params.file)
  if (!existsSync(filePath)) return res.status(404).send("Not found")
  res.sendFile(filePath)
})

app.get("/api/health", (req, res) => {
  res.json({ ok: true, model: "gemma-4-31b", provider: "cerebras" })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`⚡ VoCode server on http://localhost:${PORT}`)
  console.log(`   Generated sites: ${GENERATED_DIR}`)
  console.log(`   GPU baseline: ${GPU_BASELINE.provider} @ ${GPU_BASELINE.tps} tok/s`)
})
