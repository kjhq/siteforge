import { ScrollText } from "lucide-react"

export default function ChangelogPanel({ changelog }) {
  if (!changelog || changelog.length === 0) return null

  return (
    <div className="changelog-panel">
      <div className="cl-header">
        <ScrollText size={14} />
        <span>CHANGELOG</span>
        <span className="cl-count">{changelog.reduce((s, r) => s + r.entries.length, 0)}</span>
      </div>
      <div className="cl-entries">
        {[...changelog].reverse().map((round) => (
          <div key={round.round} className="cl-round">
            <div className="cl-round-label">Round {round.round}</div>
            {round.entries.map((entry, i) => (
              <div key={i} className="cl-entry">{entry}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
