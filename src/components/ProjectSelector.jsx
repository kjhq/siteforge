import { useState, useRef, useEffect } from "react"
import { Folder, ChevronDown, Plus, Pencil, Check, X } from "lucide-react"

function formatDate(ms) {
  const d = new Date(ms)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

export default function ProjectSelector({ projects, currentProjectId, onSelect, onRename }) {
  const [open, setOpen] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState("")
  const renameRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renamingId])

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
        setRenamingId(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const currentProject = projects.find(p => p.id === currentProjectId)

  const handleRenameStart = (e, project) => {
    e.stopPropagation()
    setRenamingId(project.id)
    setRenameValue(project.name)
    setOpen(true)
  }

  const handleRenameSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!renameValue.trim() || !renamingId) return

    const resp = await fetch(`/api/projects/${renamingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    if (resp.ok) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleRenameCancel = (e) => {
    e.stopPropagation()
    setRenamingId(null)
  }

  const handleSelect = (project) => {
    onSelect(project.id)
    setOpen(false)
    setRenamingId(null)
  }

  const handleNewProject = () => {
    onSelect(null)
    setOpen(false)
    setRenamingId(null)
  }

  return (
    <div className="project-selector" ref={dropdownRef}>
      <button className="project-selector-trigger" onClick={() => setOpen(!open)}>
        <Folder size={14} />
        <span className="project-selector-name">
          {currentProject?.name || "New Project"}
        </span>
        <ChevronDown size={14} className={`project-selector-chevron ${open ? "open" : ""}`} />
      </button>

      {open && (
        <div className="project-selector-dropdown">
          <button
            className={`project-selector-item new ${!currentProjectId ? "active" : ""}`}
            onClick={handleNewProject}
          >
            <Plus size={14} />
            <span>New Project</span>
          </button>

          {projects.length > 0 && <div className="project-selector-divider" />}

          {projects.map(p => (
            <div
              key={p.id}
              className={`project-selector-item ${p.id === currentProjectId ? "active" : ""}`}
              onClick={() => handleSelect(p)}
            >
              {renamingId === p.id ? (
                <form className="project-rename-form" onSubmit={handleRenameSubmit}>
                  <input
                    ref={renameRef}
                    className="project-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") handleRenameCancel(e)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button type="submit" className="project-rename-btn" onClick={handleRenameSubmit}>
                    <Check size={12} />
                  </button>
                  <button type="button" className="project-rename-btn cancel" onClick={handleRenameCancel}>
                    <X size={12} />
                  </button>
                </form>
              ) : (
                <>
                  <div className="project-item-info">
                    <span className="project-item-name">{p.name}</span>
                    <span className="project-item-date">{formatDate(p.created)}</span>
                  </div>
                  <button
                    className="project-rename-trigger"
                    onClick={(e) => handleRenameStart(e, p)}
                    title="Rename"
                  >
                    <Pencil size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
