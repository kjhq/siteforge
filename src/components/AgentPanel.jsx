import { AGENTS } from "../config"

const STATUS_LABELS = {
  idle: "Standby",
  working: "Processing...",
  done: "Complete ✓",
  error: "Error ✗",
}

export default function AgentPanel({ agentStatuses, timing }) {
  return (
    <div className="agent-panel">
      <h3>Multi-Agent Pipeline</h3>
      <div className="agent-list">
        {AGENTS.map((agent) => {
          const status = agentStatuses[agent.id] || "idle"
          return (
            <div key={agent.id} className={`agent-card ${status}`}>
              <div className="agent-icon" style={{ background: agent.color + "22" }}>
                <span>{agent.emoji}</span>
              </div>
              <div className="agent-info">
                <div className="agent-name">{agent.label}</div>
                <div className="agent-status" style={{ color: agent.color }}>
                  {STATUS_LABELS[status]}
                </div>
              </div>
              <div className="agent-bar">
                <div
                  className="agent-bar-fill"
                  style={{
                    background: agent.color,
                    width: status === "done" ? "100%" : status === "working" ? "50%" : "0%",
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {timing && (
        <div className="timing-info">
          <span className="timing-label">Total time:</span>
          <span className="timing-value">{timing}s</span>
        </div>
      )}
    </div>
  )
}
