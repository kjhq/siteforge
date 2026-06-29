import { useState, useRef, useEffect } from "react"
import AgentPanel from "./components/AgentPanel"
import CodePreview from "./components/CodePreview"
import { AlertTriangle, Folder, MousePointer, Zap } from "lucide-react"

function describeElement(el) {
  if (!el) return "No element selected"
  const classes = el.classes?.length ? `.${el.classes.slice(0, 3).join(".")}` : ""
  return `${el.tag}${el.id ? `#${el.id}` : ""}${classes}`
}

export default function App() {
  const [pendingText, setPendingText] = useState("")
  const [agentStatuses, setAgentStatuses] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [gpuTime, setGpuTime] = useState(null)
  const [selectedElement, setSelectedElement] = useState(null)
  const [currentProject, setCurrentProject] = useState(null)
  const [previewProjectId, setPreviewProjectId] = useState(null)
  const [liveStats, setLiveStats] = useState(null)

  const currentProjectRef = useRef(null)
  const abortRef = useRef(null)

  const updateStatus = (id, status) => {
    setAgentStatuses((prev) => ({ ...prev, [id]: status }))
  }

  const handleGenerate = async (text) => {
    if (!text.trim()) return
    setLoading(true)
    setError("")
    setLiveStats(null)
    setPreviewProjectId(null)
    setAgentStatuses({})
    if (!currentProjectRef.current) setResult(null)

    const abortCtrl = new AbortController()
    abortRef.current = abortCtrl

    try {
      const resp = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      })
      if (!resp.ok) throw new Error(`Server error ${resp.status}`)
      const { projectId } = await resp.json()
      if (!projectId) throw new Error("No project ID returned")

      const project = { id: projectId, name: text.slice(0, 40), files: [] }
      setCurrentProject(project)
      currentProjectRef.current = project

      // Connect to SSE
      const eventsUrl = `/api/build/${projectId}/events`
      const eventResp = await fetch(eventsUrl)
      if (!eventResp.ok) throw new Error("Failed to connect to event stream")

      const reader = eventResp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""

      const readLoop = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const parts = buf.split("\n\n")
          buf = parts.pop() || ""

          for (const block of parts) {
            const lines = block.split("\n")
            let eventType = ""
            let eventData = ""
            for (const l of lines) {
              if (l.startsWith("event: ")) eventType = l.slice(7)
              if (l.startsWith("data: ")) eventData = l.slice(6)
            }
            if (!eventType || !eventData) continue

            try {
              const data = JSON.parse(eventData)

              if (eventType.startsWith("agent:") && eventType.endsWith(":start")) {
                const name = data.shortName || data.name || eventType.split(":")[1]
                updateStatus(name, "working")
              } else if (eventType.startsWith("agent:") && eventType.endsWith(":end")) {
                const name = data.shortName || data.name || eventType.split(":")[1]
                updateStatus(name, "done")
              } else if (eventType === "build:phase") {
                // Update phase info
              } else if (eventType === "build:converged") {
                // Loop converged
              } else if (eventType === "build:error") {
                setError(data.error || "Build failed")
              } else if (eventType === "build:complete") {
                // Fetch final result
                const resultResp = await fetch(`/api/build/${projectId}/result`)
                if (resultResp.ok) {
                  const res = await resultResp.json()
                  if (res.ok) {
                    project.files = res.files || []
                    const htmlFile = res.files?.find(f => f.path.endsWith(".html"))
                    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)

                    setPreviewProjectId(project.id)
                    const newResult = {
                      fullHtml: res.fullHtml || htmlFile?.content || "",
                      project,
                      files: res.files || [],
                      timingValue: elapsed,
                      timing: { total: elapsed },
                      stats: res.stats,
                    }
                    setResult(newResult)
                    setLiveStats(res.stats)
                    const tokens = res.stats?.completion_tokens || 0
                    const gpuTps = res.stats?.gpu_baseline_tps || 100
                    setGpuTime(tokens > 0 ? (tokens / gpuTps).toFixed(2) : null)
                  }
                }
              }
            } catch {}
          }
        }
      }

      const startTime = performance.now()
      readLoop().catch(() => {})
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "Pipeline failed")
    }

    setLoading(false)
  }

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const handleElementSelect = (el) => {
    setSelectedElement(el)
  }

  const selectedLabel = describeElement(selectedElement)
  const modeLabel = currentProject ? (selectedElement ? "Apply Edit" : "Update") : "Build"
  const placeholder = currentProject
    ? "e.g. Make the selected text blue..."
    : "e.g. Build a dark portfolio with projects..."

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <Zap className="logo-icon" /> VoCode
        </h1>
        <p className="subtitle">Multi-Agent Website Builder · Gemma 4 on Cerebras</p>
      </header>

      <div className="main-layout">
        <div className="left-panel">
          <div className="input-section">
            <div className="edit-context-card">
              <div className="edit-context-row">
                <Folder size={15} />
                <span>{currentProject ? currentProject.id : "No project yet"}</span>
              </div>
              <div className="edit-context-row">
                <MousePointer size={15} />
                <span>{selectedLabel}</span>
              </div>
            </div>

            <div className="input-row">
              <input
                value={pendingText}
                onChange={(e) => setPendingText(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate(pendingText)}
              />
              <button className="generate-btn" onClick={() => handleGenerate(pendingText)} disabled={loading}>
                {loading ? "Working..." : modeLabel}
              </button>
            </div>
          </div>

          <AgentPanel agentStatuses={agentStatuses} timing={result?.timingValue} />

          {error && (
            <div className="error-banner">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {liveStats && result && (
            <div className="stats-panel">
              <div className="stat-hero">
                <span className="stat-big">{liveStats.completion_tokens ? `${liveStats.completion_tokens} tok` : "?"}</span>
              </div>
              <div className="stat-line">
                {liveStats.gpu_baseline_provider && liveStats.gpu_baseline_tps && (
                  <span className="vs-text">{liveStats.gpu_baseline_tps} tok/s · {liveStats.gpu_baseline_provider}</span>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="results-meta">
              <div className="meta-card">
                <Folder size={16} />
                <span>{result.files?.length || 0} files</span>
              </div>
              <div className="meta-card">
                <MousePointer size={16} />
                <span>Target: {selectedElement ? selectedLabel : "whole project"}</span>
              </div>
              <div className="meta-card speed-card">
                <Zap size={16} />
                <span>
                  Cerebras: {result.timingValue}s
                  {gpuTime && result?.stats?.gpu_baseline_provider && (
                    <span className="vs-text"> vs {result.stats.gpu_baseline_provider}: ~{gpuTime}s</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="right-panel">
          <CodePreview
            projectId={previewProjectId}
            onElementSelect={handleElementSelect}
            selectedElement={selectedElement}
          />
        </div>
      </div>
    </div>
  )
}
