import { Zap, Clock, Hash, Terminal, Activity } from "lucide-react"

const GPU_BASELINE_TPS = 126

function asciiBar(ratio, maxLen = 20) {
  const filled = Math.round(Math.min(ratio, 1) * maxLen)
  return "\u2588".repeat(filled) + "\u2591".repeat(maxLen - filled)
}

function formatMs(ms) {
  if (!ms && ms !== 0) return "?"
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTokens(n) {
  if (!n && n !== 0) return "0"
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function StatLine({ label, value, accent }) {
  return (
    <div className="m-stat-line">
      <span className="m-stat-label">{label}</span>
      <span className="m-stat-dots" />
      <span className="m-stat-value" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  )
}

function AgentTimingBar({ label, emoji, color, wallMs, active }) {
  const maxMs = 30000
  const ratio = wallMs ? Math.min(wallMs / maxMs, 1) : 0
  return (
    <div className={`m-agent-bar ${active ? "active" : ""}`}>
      <span className="m-agent-bar-name">{emoji} {label}</span>
      <span className="m-agent-bar-ascii" style={{ color }}>{asciiBar(ratio, 16)}</span>
      <span className="m-agent-bar-time">{wallMs ? formatMs(wallMs) : active ? "_" : "---"}</span>
    </div>
  )
}

export default function MetricsPanel({ agentStats, liveTokens, liveTime, buildPhase, loading, finalStats }) {
  const hasData = Object.keys(agentStats).length > 0 || loading

  const totalInput = Object.values(agentStats).reduce((s, a) => s + (a.inputTokens || 0), 0)
  const totalOutput = Object.values(agentStats).reduce((s, a) => s + (a.outputTokens || 0), 0)
  const totalTokens = totalInput + totalOutput
  const finalWallMs = finalStats?.wall_ms || 0
  const wallMs = finalWallMs > 0 ? finalWallMs : 0
  const cerebrasTps = finalStats?.cerebras_tps || 0
  const speedup = cerebrasTps > 0 ? +(cerebrasTps / GPU_BASELINE_TPS).toFixed(1) : 0
  const totalToolCalls = Object.values(agentStats).reduce((s, a) => s + (a.toolCalls || 0), 0)
  const avgTtft = Object.values(agentStats).filter(a => a.ttftMs).reduce((s, a, _, arr) => s + a.ttftMs / arr.length, 0) || null

  const agentOrder = [
    { name: "Design Planner", label: "Design Planner", emoji: "\u270F\uFE0F", color: "#8b5cf6" },
    { name: "Designer", label: "Designer", emoji: "\u{1F3A8}", color: "#a855f7" },
    { name: "Security", label: "Code Reviewer", emoji: "\u{1F512}", color: "#ef4444" },
    { name: "Debug", label: "Bug Finder", emoji: "\u{1F41B}", color: "#f59e0b" },
    { name: "Auditor", label: "Auditor", emoji: "\u{1F4CB}", color: "#3b82f6" },
    { name: "Unifier", label: "Unifier", emoji: "\u{1F517}", color: "#06b6d4" },
    { name: "Coder", label: "Coder", emoji: "\u{1F4BB}", color: "#22c55e" },
  ]

  const cerebrasRatio = cerebrasTps > 0 ? Math.min(cerebrasTps / GPU_BASELINE_TPS, 1) : 0
  const gpuRatio = GPU_BASELINE_TPS > 0 ? Math.min(GPU_BASELINE_TPS / Math.max(cerebrasTps, GPU_BASELINE_TPS), 1) : 0

  const stats = finalStats || {}
  const fileCount = stats.fileCount || 0
  const files = stats.files || []

  if (!hasData) return null

  return (
    <div className="metrics-panel">
      <div className="m-header">
        <Terminal size={14} />
        <span>METRICS</span>
        {loading && <span className="m-live-dot" />}
      </div>

      {/* Live speed comparison */}
      <div className="m-section">
        <div className="m-speed-row">
          <div className="m-speed-label">
            <Zap size={12} />
            <span>CEREBRAS</span>
          </div>
          <div className="m-speed-bar-wrap">
            <div className="m-speed-bar cerebras" style={{ width: `${cerebrasRatio * 100}%` }} />
          </div>
          <span className="m-speed-val">{cerebrasTps > 0 ? `${cerebrasTps} tok/s` : "---"}</span>
        </div>
        <div className="m-speed-row">
          <div className="m-speed-label">
            <Activity size={12} />
            <span>GPU BASE</span>
          </div>
          <div className="m-speed-bar-wrap">
            <div className="m-speed-bar gpu" style={{ width: `${gpuRatio * 100}%` }} />
          </div>
          <span className="m-speed-val">{GPU_BASELINE_TPS} tok/s</span>
        </div>
        {speedup > 0 && (
          <div className="m-speedup">{speedup}x FASTER</div>
        )}
      </div>

      {/* Token breakdown */}
      <div className="m-section">
        <div className="m-section-title">TOKENS</div>
        <StatLine label="input" value={formatTokens(totalInput || liveTokens.input)} />
        <StatLine label="output" value={formatTokens(totalOutput || liveTokens.output)} accent="#22c55e" />
        <StatLine label="total" value={formatTokens(totalTokens)} accent="#f59e0b" />
      </div>

      {/* Timing */}
      <div className="m-section">
        <div className="m-section-title">TIMING</div>
        <StatLine label="wall" value={wallMs > 0 ? `${(wallMs / 1000).toFixed(1)}s` : "---"} accent="#6366f1" />
        <StatLine label="ttft" value={avgTtft ? formatMs(avgTtft) : "---"} />
        <StatLine label="tool calls" value={String(totalToolCalls || "---")} />
        {buildPhase && <StatLine label="phase" value={buildPhase} accent="#06b6d4" />}
      </div>

      {/* Per-agent timing bars */}
      <div className="m-section">
        <div className="m-section-title">AGENTS</div>
        {agentOrder.map(a => {
          const s = agentStats[a.name]
          const isActive = loading && s && !s.wallMs
          return (
            <AgentTimingBar
              key={a.name}
              label={a.label}
              emoji={a.emoji}
              color={a.color}
              wallMs={s?.wallMs}
              active={isActive}
            />
          )
        })}
      </div>

      {/* Files */}
      {fileCount > 0 && (
        <div className="m-section">
          <div className="m-section-title">OUTPUT</div>
          <div className="m-files">
            {files.map(f => (
              <div key={f.path} className="m-file">
                <Hash size={10} />
                <span>{f.path}</span>
                <span className="m-file-size">{Math.round(f.size / 1024 * 10) / 10}kb</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
