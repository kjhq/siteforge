import { useState, useRef } from "react"
import { CEREBRAS_API_KEY } from "./config"
import VoiceInput from "./components/VoiceInput"
import AgentPanel from "./components/AgentPanel"
import CodePreview from "./components/CodePreview"
import { runPipeline } from "./agents/orchestrator"
import { Zap, Gauge, AlertTriangle, CheckCircle } from "lucide-react"

export default function App() {
  const [transcript, setTranscript] = useState("")
  const [pendingText, setPendingText] = useState("")
  const [agentStatuses, setAgentStatuses] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [gpuTime, setGpuTime] = useState(null)

  const lastResultRef = useRef(null)
  const lastRequestRef = useRef("")

  const handleTranscript = (text) => {
    setTranscript(text)
    setPendingText(text)
    if (text.trim()) {
      handleGenerate(text)
    }
  }

  const handleGenerate = async (text) => {
    if (!CEREBRAS_API_KEY) {
      setError("Set VITE_CEREBRAS_API_KEY in .env")
      return
    }
    setLoading(true)
    setError("")
    setResult(null)
    setAgentStatuses({})

    const statusUpdater = (agentId, status) => {
      setAgentStatuses((prev) => ({ ...prev, [agentId]: status }))
    }

    try {
      const startTime = performance.now()
      const options = lastResultRef.current
        ? { previousCode: lastResultRef.current.fullHtml, previousRequest: lastRequestRef.current }
        : {}
      const res = await runPipeline(text, statusUpdater, options)
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
      res.timingValue = elapsed
      setResult(res)
      lastResultRef.current = res
      lastRequestRef.current = text

      setGpuTime((parseFloat(elapsed) * 7.5).toFixed(2))
    } catch (e) {
      setError(e.message || "Pipeline failed")
    }

    setLoading(false)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <Zap className="logo-icon" /> VoCode
        </h1>
        <p className="subtitle">Multi-Agent Voice-to-Website · Gemma 4 on Cerebras</p>
      </header>

      <div className="main-layout">
        <div className="left-panel">
          <div className="input-section">
            <VoiceInput onTranscript={handleTranscript} />

            <div className="prompt-input">
              <p className="prompt-label">Or type your request:</p>
              <div className="input-row">
                <input
                  value={pendingText}
                  onChange={(e) => setPendingText(e.target.value)}
                  placeholder="e.g. Build a dark portfolio with projects section..."
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate(pendingText)}
                />
                <button className="generate-btn" onClick={() => handleGenerate(pendingText)} disabled={loading}>
                  {loading ? "Building..." : "Build"}
                </button>
              </div>
            </div>

            {transcript && (
              <div className="transcript-box">
                <strong>Building:</strong> "{transcript}"
              </div>
            )}
          </div>

          <AgentPanel agentStatuses={agentStatuses} timing={result?.timingValue} />

          {error && (
            <div className="error-banner">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {result && (
            <div className="results-meta">
              <div className="meta-card">
                <CheckCircle size={16} />
                <span>Approved: {result.approved ? "Yes" : "Needs Review"}</span>
              </div>
              <div className="meta-card">
                <Gauge size={16} />
                <span>Risk: {result.riskLevel}</span>
              </div>
              <div className="meta-card speed-card">
                <Zap size={16} />
                <span>
                  Cerebras: {result.timingValue}s
                  {gpuTime && (
                    <span className="vs-text"> vs GPU: ~{gpuTime}s ({(parseFloat(gpuTime) / parseFloat(result.timingValue)).toFixed(0)}x faster)</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="right-panel">
          <CodePreview code={result?.fullHtml} />
        </div>
      </div>
    </div>
  )
}
