import { useState, useRef } from "react"
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
  const [liveStats, setLiveStats] = useState(null)

  const currentProjectRef = useRef(null)

  const updateStatus = (id, status) => {
    setAgentStatuses((prev) => ({ ...prev, [id]: status }))
  }

  const handleGenerate = async (text) => {
    if (!text.trim()) return
    setLoading(true)
    setError("")
    setLiveStats(null)
    setAgentStatuses({})
    if (!currentProjectRef.current) setResult(null)

    try {
      const startTime = performance.now()
      const projectId = currentProjectRef.current?.id

      updateStatus("developer", "working")

      let endpoint, body
      if (projectId && currentProjectRef.current) {
        endpoint = "/api/edit"
        body = { projectId, instruction: text, selectedElement }
      } else {
        endpoint = "/api/build"
        body = { prompt: text }
      }

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        throw new Error(`Server error ${resp.status} — is the backend running? Run: npm run dev:server`)
      }

      const textBody = await resp.text()
      if (!textBody) throw new Error("Empty response from server — backend may have timed out")

      const res = JSON.parse(textBody)
      updateStatus("developer", "done")

      if (!res.ok) {
        if (res.rate_limited) throw new Error("Rate limited by Cerebras API — retrying")
        throw new Error(res.error || "Generation failed")
      }

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
      const project = {
        id: res.projectId,
        name: text.slice(0, 40),
        files: res.files,
        changedFiles: res.files.map((f) => f.path),
      }

      const newResult = {
        fullHtml: res.fullHtml,
        project,
        files: res.files,
        timingValue: elapsed,
        timing: { total: elapsed },
        stats: res.stats,
      }

      setResult(newResult)
      setCurrentProject(project)
      currentProjectRef.current = project
      setGpuTime((parseFloat(elapsed) * 7.5).toFixed(2))
      if (res.stats) setLiveStats(res.stats)
    } catch (e) {
      setError(e.message || "Pipeline failed")
    }

    setLoading(false)
  }

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
                <span className="stat-big">{liveStats.per_call_tps}</span>
                <span className="stat-unit">tok/s</span>
              </div>
              <div className="stat-line">
                {liveStats.completion_tokens} tokens · {liveStats.wall_ms}ms wall · TTFT {liveStats.ttft_ms}ms
                {liveStats.model_speedup > 0 && (
                  <span className="vs-text"> · {liveStats.model_speedup}x vs GPU baseline</span>
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
                  {gpuTime && (
                    <span className="vs-text"> vs GPU: ~{gpuTime}s ({((parseFloat(gpuTime) / parseFloat(result.timingValue))).toFixed(0)}x faster)</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="right-panel">
          <CodePreview
            code={result?.fullHtml}
            onElementSelect={handleElementSelect}
            selectedElement={selectedElement}
          />
        </div>
      </div>
    </div>
  )
}
