import { CEREBRAS_API_KEY, CEREBRAS_API_URL, MODEL } from "../config"

const SYSTEM_PROMPTS = {
  architect: `You are a web architect. Given a user's request and any previous code, design or update the structure.
If previous code is provided, describe ONLY the changes needed — not the full architecture.
Output ONLY JSON: { "structure": "...", "components": [...], "layout": "...", "notes": "..." }`,

  developer: `You are a senior frontend developer. Given a user request, architecture plan, and any previous code, write or update complete HTML/CSS/JS.
If previous code is provided, you are editing it — output the FULL updated file with your changes applied, never a diff or partial snippet.
Output a SINGLE valid HTML file with inline CSS and JS. Use modern CSS (flexbox, grid, animations).
Output ONLY JSON: { "html": "...", "css": "...", "js": "..." }`,

  reviewer: `You are a code reviewer. Review the generated (or updated) code for bugs, logic errors, accessibility issues.
If previous code is provided, only review the changes — flag regressions from the old version.
Output ONLY JSON: { "critical": [...], "warnings": [...], "suggestions": [...], "approved": boolean }`,

  security: `You are a security auditor. Review code for XSS, injection, CSP issues, data exposure.
If previous code is provided, check that the changes didn't introduce new vulnerabilities.
Output ONLY JSON: { "vulnerabilities": [...], "risk_level": "low"|"medium"|"high", "passed": boolean }`,

  designer: `You are a UI/UX designer. Given the code and user request, suggest visual improvements.
If previous code is provided, suggest visual improvements on top of what already exists.
Output ONLY JSON: { "colors": {...}, "typography": "...", "improvements": [...], "meta_tags": "..." }`,
}

async function callAgent(agentId, userRequest, context = {}, retries = 1) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPTS[agentId] },
    ...(context.previousCode
      ? [{ role: "system", content: "Previous code exists. You are editing it — output the FULL updated file, never a diff." }]
      : []),
    { role: "user", content: JSON.stringify({ request: userRequest, ...context }) },
  ]

  const res = await fetch(CEREBRAS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: retries > 0 ? 0.3 : 0.1,
      max_tokens: retries > 0 ? 4096 : 2048,
      response_format: { type: "json_object" },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`Cerebras API ${res.status}: ${errText.slice(0, 300)}`)
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content || ""

  return extractJSON(raw, agentId, userRequest, context, retries)
}

function extractJSON(content, agentId, userRequest, context, retries) {
  if (!content || content === "{}") return {}

  // 1. Direct parse
  try {
    return JSON.parse(content)
  } catch {}

  // 2. Strip markdown code fences
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
  const cleaned = fenceMatch ? fenceMatch[1].trim() : content.trim()
  try {
    return JSON.parse(cleaned)
  } catch {}

  // 3. Find last complete JSON object (handles truncation mid-object)
  const braceMatch = cleaned.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0])
    } catch {
      let end = braceMatch[0].lastIndexOf("}")
      while (end > 0) {
        try {
          return JSON.parse(braceMatch[0].slice(0, end + 1))
        } catch {
          end = braceMatch[0].lastIndexOf("}", end - 1)
        }
      }
    }
  }

  // 4. Retry once with conservative params
  if (retries > 0) {
    return callAgent(agentId, userRequest, context, retries - 1)
  }

  console.warn(`[VoCode] Agent ${agentId} returned unparseable JSON after retries`)
  return {}
}

export async function runPipeline(userRequest, onAgentStatus, options = {}) {
  const results = {}
  const startTime = performance.now()
  const context = {
    ...(options.previousCode ? { previousCode: options.previousCode, previousRequest: options.previousRequest } : {}),
  }

  onAgentStatus("architect", "working")
  const architecture = await callAgent("architect", userRequest, { ...context })
  results.architect = architecture
  onAgentStatus("architect", "done")
  results.architecturePlan = architecture

  onAgentStatus("developer", "working")
  const code = await callAgent("developer", userRequest, { architecture, ...context })
  results.developer = code
  onAgentStatus("developer", "done")
  results.generatedCode = code

  const parallelStart = performance.now()

  const [review, security, design] = await Promise.all([
    (async () => {
      onAgentStatus("reviewer", "working")
      const r = await callAgent("reviewer", userRequest, { code, ...context })
      onAgentStatus("reviewer", "done")
      return r
    })(),
    (async () => {
      onAgentStatus("security", "working")
      const s = await callAgent("security", userRequest, { code, ...context })
      onAgentStatus("security", "done")
      return s
    })(),
    (async () => {
      onAgentStatus("designer", "working")
      const d = await callAgent("designer", userRequest, { code, architecture, ...context })
      onAgentStatus("designer", "done")
      return d
    })(),
  ])

  results.reviewer = review
  results.security = security
  results.designer = design

  const totalTime = ((performance.now() - startTime) / 1000).toFixed(2)

  let finalHtml = code.html || ""
  let finalCss = code.css || ""
  let finalJs = code.js || ""

  return {
    html: finalHtml,
    css: finalCss,
    js: finalJs,
    fullHtml: buildFullPage(finalHtml, finalCss, finalJs),
    agents: results,
    timing: {
      total: totalTime,
      architect: (parallelStart - startTime) / 1000,
      developer: (parallelStart - startTime) / 1000,
      reviewer: "parallel",
      security: "parallel",
      designer: "parallel",
    },
    approved: review?.approved !== false,
    riskLevel: security?.risk_level || "unknown",
    designSuggestions: design?.improvements || [],
  }
}

function buildFullPage(html, css, js) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css || "body{font-family:sans-serif;padding:20px}"}</style>
</head>
<body>
  ${html || "<h1>Site preview</h1><p>loading...</p>"}
  <script>${js || ""}</script>
</body>
</html>`
}
