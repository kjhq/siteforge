import { useState, useRef, useEffect } from "react"
import AgentPanel from "./components/AgentPanel"
import CodePreview from "./components/CodePreview"
import MetricsPanel from "./components/MetricsPanel"
import ProjectSelector from "./components/ProjectSelector"
import ChangelogPanel from "./components/ChangelogPanel"
import FileTree from "./components/FileTree"
import { AlertTriangle } from "lucide-react"

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
  const [selectedElement, setSelectedElement] = useState(null)
  const [currentProject, setCurrentProject] = useState(null)
  const [previewProjectId, setPreviewProjectId] = useState(null)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [buildPhase, setBuildPhase] = useState(null)
  const [liveTokens, setLiveTokens] = useState({ input: 0, output: 0 })
  const [agentStats, setAgentStats] = useState({})
  const [liveTime, setLiveTime] = useState(0)
  const [projects, setProjects] = useState([])
  const [changelog, setChangelog] = useState([])
  const [pages, setPages] = useState([])
  const [currentPage, setCurrentPage] = useState(null)

  const currentProjectRef = useRef(null)
  const abortRef = useRef(null)
  const timerRef = useRef(null)

  const updateStatus = (id, status) => {
    setAgentStatuses((prev) => ({ ...prev, [id]: status }))
  }

  const handleGenerate = async (text) => {
    if (!text.trim()) return
    setLoading(true)
    setError("")
    setLiveTokens({ input: 0, output: 0 })
    setAgentStats({})
    setBuildPhase(null)
    setLiveTime(0)
    if (!currentProjectRef.current) setPreviewProjectId(null)
    setAgentStatuses({})
    setChangelog([])
    setPages([])
    setCurrentPage(null)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setLiveTime(p => +(p + 0.1).toFixed(1)), 100)

    const abortCtrl = new AbortController()
    abortRef.current = abortCtrl

    try {
      const body = { prompt: text }
      if (currentProjectRef.current) {
        body.existingProjectId = currentProjectRef.current.id
      }
      if (selectedElement) {
        body.selectedElement = {
          tag: selectedElement.tag,
          id: selectedElement.id || null,
          classes: selectedElement.classes || [],
          text: selectedElement.text || "",
        }
      }

      const resp = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!resp.ok) throw new Error(`Server error ${resp.status}`)
      const { projectId } = await resp.json()
      if (!projectId) throw new Error("No project ID returned")

      if (!currentProjectRef.current) {
        const project = { id: projectId, name: text.slice(0, 40), files: [] }
        setCurrentProject(project)
        currentProjectRef.current = project
      }

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
              } else if (eventType.startsWith("agent:") && eventType.endsWith(":stats")) {
                const name = data.shortName || eventType.split(":")[1]
                setAgentStats(prev => ({ ...prev, [name]: data }))
              } else if (eventType.startsWith("agent:") && eventType.endsWith(":delta")) {
                setLiveTokens(prev => ({ ...prev, output: prev.output + 1 }))
              } else if (eventType === "build:phase") {
                setBuildPhase(data.phase)
              } else if (eventType === "build:preview") {
                setPreviewProjectId(projectId)
                setPreviewVersion(v => v + 1)
                if (data.pages) setPages(data.pages)
              } else if (eventType === "build:converged") {
                // Loop converged
              } else if (eventType === "build:changelog") {
                setChangelog(prev => {
                  const existing = prev.find(r => r.round === data.round)
                  if (existing) {
                    return prev.map(r => r.round === data.round ? { ...r, entries: data.entries } : r)
                  }
                  return [...prev, { round: data.round, entries: data.entries }]
                })
              } else if (eventType === "build:error") {
                setError(data.error || "Build failed")
                setLoading(false)
              } else if (eventType === "build:complete") {
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
                setLoading(false)
                const resultResp = await fetch(`/api/build/${projectId}/result`)
                if (resultResp.ok) {
                  const res = await resultResp.json()
                  if (res.ok) {
                    setResult({
                      fullHtml: res.fullHtml || "",
                      project: currentProjectRef.current,
                      files: res.files || [],
                      pages: res.pages || [],
                      stats: res.stats,
                    })
                    if (res.pages) setPages(res.pages)
                    setLiveTokens({
                      input: res.stats?.input_tokens || 0,
                      output: res.stats?.completion_tokens || 0,
                    })
                    // Add new project to list if it's a new build
                    if (!currentProjectRef.current || currentProjectRef.current.id !== projectId) {
                      const newProject = { id: projectId, name: text.slice(0, 40), created: Date.now() }
                      setProjects(prev => [newProject, ...prev])
                    }
                  }
                }
              }
            } catch {}
          }
        }
      }

      readLoop().catch(() => {})
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "Pipeline failed")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
    return () => {
      abortRef.current?.abort()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const fetchProjects = async () => {
    try {
      const resp = await fetch("/api/projects")
      if (resp.ok) {
        const data = await resp.json()
        if (data.ok) setProjects(data.projects)
      }
    } catch {}
  }

  const handleProjectSelect = async (projectId) => {
    if (projectId === null) {
      // New project
      setCurrentProject(null)
      currentProjectRef.current = null
      setPreviewProjectId(null)
      setSelectedElement(null)
      setResult(null)
      setPendingText("")
      setPages([])
      setCurrentPage(null)
      return
    }

    // Load existing project
    try {
      const resp = await fetch(`/api/projects/${projectId}`)
      if (resp.ok) {
        const data = await resp.json()
        if (data.ok) {
          const project = { id: data.projectId, name: data.name, files: data.files }
          setCurrentProject(project)
          currentProjectRef.current = project
          setPreviewProjectId(projectId)
          setPreviewVersion(v => v + 1)
          setSelectedElement(null)
          setResult(null)
          setPendingText("")
        }
      }
    } catch {}
  }

  const handleRename = (projectId, newName) => {
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, name: newName } : p
    ))
    if (currentProject?.id === projectId) {
      setCurrentProject(prev => ({ ...prev, name: newName }))
      currentProjectRef.current = { ...currentProjectRef.current, name: newName }
    }
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
      <div className="app-layout">
        <div className="sidebar-left">
          <ProjectSelector
            projects={projects}
            currentProjectId={currentProject?.id}
            onSelect={handleProjectSelect}
            onRename={handleRename}
          />

          {selectedElement && (
            <div className="element-label">{selectedLabel}</div>
          )}

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

          <AgentPanel agentStatuses={agentStatuses} timing={result?.stats?.wall_ms ? (result.stats.wall_ms / 1000).toFixed(1) : liveTime > 0 ? liveTime.toFixed(1) : null} />

          {error && (
            <div className="error-banner">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
        </div>

        <CodePreview
          projectId={previewProjectId}
          previewVersion={previewVersion}
          onElementSelect={handleElementSelect}
          selectedElement={selectedElement}
          pages={pages}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />

        <div className="sidebar-right">
          <FileTree
            projectId={previewProjectId}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
          <MetricsPanel
            agentStats={agentStats}
            liveTokens={liveTokens}
            liveTime={liveTime}
            buildPhase={buildPhase}
            loading={loading}
            finalStats={result?.stats}
          />
          <ChangelogPanel changelog={changelog} />
        </div>
      </div>
    </div>
  )
}
