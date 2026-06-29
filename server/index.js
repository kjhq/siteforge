import express from "express"
import cors from "cors"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const GENERATED_DIR = path.resolve(ROOT, "generated")

try {
  const envPath = path.resolve(ROOT, ".env")
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8")
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
      const eqIdx = trimmed.indexOf("=")
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "")
      if (!process.env[key]) process.env[key] = val
    }
  }
} catch {}

const CEREBRAS_API_KEY = process.env.VITE_CEREBRAS_API_KEY || ""
const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"

const app = express()
app.use(cors())
app.use(express.json({ limit: "50mb" }))
app.use("/generated", express.static(GENERATED_DIR))
fs.mkdirSync(GENERATED_DIR, { recursive: true })

let projectIdCounter = 0

function createProjectDir() {
  projectIdCounter++
  const projectId = `project-${Date.now()}-${projectIdCounter}`
  const dir = path.join(GENERATED_DIR, projectId)
  fs.mkdirSync(dir, { recursive: true })
  return { projectId, dir }
}

function getProjectDir(projectId) {
  const dir = path.join(GENERATED_DIR, projectId)
  return fs.existsSync(dir) ? dir : null
}

async function* streamCerebras(messages, systemPrompt, apiKey) {
  const body = JSON.stringify({
    model: "gemma-4-31b",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: 8192,
  })

  const resp = await fetch(CEREBRAS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  })

  if (!resp.ok) {
    const err = await resp.text().catch(() => "")
    if (resp.status === 429) throw new Error(`RATE_LIMITED: ${err.slice(0, 200)}`)
    throw new Error(`Cerebras ${resp.status}: ${err.slice(0, 200)}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let ttft = null
  const startTime = Date.now()
  let totalTokens = 0
  let finishReason = null
  let fullText = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith("data:")) continue
      const data = trimmed.slice(5).trim()
      if (data === "[DONE]") continue

      try {
        const chunk = JSON.parse(data)
        if (chunk.usage?.completion_tokens) {
          totalTokens = chunk.usage.completion_tokens
        }
        const choice = chunk.choices?.[0]
        if (choice?.finish_reason) finishReason = choice.finish_reason
        const delta = choice?.delta?.content
        if (delta) {
          if (!ttft) {
            ttft = Date.now() - startTime
            yield { type: "start", ttft, timestamp: Date.now() }
          }
          fullText += delta
          yield { type: "delta", text: delta, fullText, timestamp: Date.now() }
        }
      } catch {}
    }
  }

  const elapsed = Date.now() - startTime
  const decodeTime = ttft ? elapsed - ttft : elapsed
  const perCallTps = totalTokens > 0 && decodeTime > 0 ? Math.round(totalTokens / (decodeTime / 1000)) : 0

  yield {
    type: "done",
    fullText,
    stats: {
      per_call_tps: perCallTps,
      ttft_ms: ttft || 0,
      wall_ms: elapsed,
      completion_tokens: totalTokens,
      finish_reason: finishReason,
      model_speedup: perCallTps > 0 ? (perCallTps / 100).toFixed(1) : 0,
    },
  }
}

function extractHTML(text) {
  if (!text) return ""
  let cleaned = text.trim()
  if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```html/gi, "```")
    const parts = cleaned.split("```")
    for (let i = 1; i < parts.length; i += 2) {
      if (parts[i].includes("<")) return parts[i].trim()
    }
  }
  const start = cleaned.search(/<!doctype|<html|<head|<body|<div|<h1/i)
  if (start === -1) return cleaned
  return cleaned.slice(start)
}

function filesFromHTML(html, prompt) {
  const files = []
  const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "site"
  files.push({ path: `${slug}.html`, content: html })

  const cssMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/)
  if (cssMatch) {
    files.push({ path: "styles.css", content: cssMatch[1] })
  }
  const jsMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  if (jsMatch) {
    files.push({ path: "script.js", content: jsMatch[1] })
  }
  return files
}

const SYSTEM_PROMPT = `You are VoCode, a multi-agent website builder. Generate complete, working HTML/CSS/JS websites.

Rules:
- Output a SINGLE self-contained HTML document with inline CSS and JS
- Use semantic HTML5, modern CSS (flexbox, grid, animations), and clean JS
- Make responsive layouts that work on mobile and desktop
- Make it look professional and polished
- Include a <style> tag for all CSS
- Include a <script> tag for all JS if needed
- Output ONLY the HTML document — no markdown, no code fences, no extra text

When editing existing code, output the COMPLETE updated file — never a diff.`

app.post("/api/build", async (req, res) => {
  try {
    const { prompt } = req.body
    if (!prompt?.trim()) return res.json({ ok: false, error: "prompt required" })

    const { projectId, dir } = createProjectDir()

    const messages = [{ role: "user", content: `Build a website for: ${prompt}` }]

    let fullText = ""
    let stats = {}

    try {
      for await (const event of streamCerebras(messages, SYSTEM_PROMPT, CEREBRAS_API_KEY)) {
        if (event.type === "delta") fullText = event.fullText
        if (event.type === "done") stats = event.stats
      }
    } catch (err) {
      if (err.message.startsWith("RATE_LIMITED")) {
        return res.json({ ok: false, rate_limited: true, error: err.message })
      }
      throw err
    }

    const html = extractHTML(fullText)
    if (!html) {
      return res.json({ ok: false, error: "No HTML generated", raw: fullText.slice(0, 500) })
    }

    const files = filesFromHTML(html, prompt)
    for (const file of files) {
      const fullPath = path.join(dir, file.path)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, file.content, "utf-8")
    }

    console.log(`[VoCode] ${projectId}: ${files.length} files, ${stats.completion_tokens || 0} tokens, ${stats.wall_ms}ms wall, ${stats.per_call_tps}tps`)

    res.json({
      ok: true,
      projectId,
      files,
      fullHtml: html,
      stats,
    })
  } catch (err) {
    console.error("[VoCode] Build error:", err)
    res.json({ ok: false, error: err.message })
  }
})

app.post("/api/edit", async (req, res) => {
  try {
    const { projectId, instruction, selectedElement } = req.body
    if (!instruction?.trim()) return res.json({ ok: false, error: "instruction required" })

    const dir = getProjectDir(projectId)
    if (!dir) return res.json({ ok: false, error: `Project ${projectId} not found` })

    const existingFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".html"))
    let existingHtml = ""
    for (const f of existingFiles) {
      existingHtml += fs.readFileSync(path.join(dir, f), "utf-8") + "\n"
    }

    const elementContext = selectedElement
      ? `\nSelected element: ${selectedElement.tag}${selectedElement.id ? "#" + selectedElement.id : ""}${selectedElement.classes?.length ? "." + selectedElement.classes.slice(0, 3).join(".") : ""}\nElement text: "${selectedElement.text}"\n`
      : ""

    const messages = [{
      role: "user",
      content: `Current HTML:\n${existingHtml}\n\n---\n${elementContext}Apply this change: ${instruction}\n\nOutput the COMPLETE updated HTML document with the change applied. Preserve everything not mentioned.`,
    }]

    let fullText = ""
    let stats = {}

    try {
      for await (const event of streamCerebras(messages, SYSTEM_PROMPT, CEREBRAS_API_KEY)) {
        if (event.type === "delta") fullText = event.fullText
        if (event.type === "done") stats = event.stats
      }
    } catch (err) {
      if (err.message.startsWith("RATE_LIMITED")) {
        return res.json({ ok: false, rate_limited: true, error: err.message })
      }
      throw err
    }

    const html = extractHTML(fullText)
    if (!html) {
      return res.json({ ok: false, error: "No HTML generated", raw: fullText.slice(0, 500) })
    }

    const files = filesFromHTML(html, instruction)
    for (const file of files) {
      const fullPath = path.join(dir, file.path)
      fs.mkdirSync(path.dirname(fullPath), { recursive: true })
      fs.writeFileSync(fullPath, file.content, "utf-8")
    }

    res.json({
      ok: true,
      projectId,
      files,
      fullHtml: html,
      stats,
    })
  } catch (err) {
    console.error("[VoCode] Edit error:", err)
    res.json({ ok: false, error: err.message })
  }
})

app.get("/api/health", (req, res) => {
  res.json({ ok: true, model: "gemma-4-31b", provider: "cerebras" })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`⚡ VoCode Pi server on http://localhost:${PORT}`)
  console.log(`   Generated sites: ${GENERATED_DIR}`)
})
