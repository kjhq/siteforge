import { useState, useEffect } from "react"
import { FileText, FileCode, File, ChevronDown, ChevronRight } from "lucide-react"

function getFileIcon(name) {
  if (name.endsWith(".html")) return <FileText size={13} className="file-icon html" />
  if (name.endsWith(".css")) return <FileCode size={13} className="file-icon css" />
  if (name.endsWith(".js")) return <File size={13} className="file-icon js" />
  if (name.endsWith(".md")) return <FileText size={13} className="file-icon md" />
  return <File size={13} className="file-icon" />
}

export default function FileTree({ projectId, currentPage, onPageChange }) {
  const [files, setFiles] = useState([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!projectId) { setFiles([]); return }
    const fetchFiles = async () => {
      try {
        const resp = await fetch(`/api/projects/${projectId}`)
        if (resp.ok) {
          const data = await resp.json()
          if (data.ok) setFiles(data.files || [])
        }
      } catch {}
    }
    fetchFiles()
  }, [projectId])

  if (!projectId || files.length === 0) return null

  return (
    <div className="file-tree">
      <button className="file-tree-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>Files</span>
        <span className="file-tree-count">{files.length}</span>
      </button>
      {open && (
        <div className="file-tree-list">
          {files.map(name => (
            <button
              key={name}
              className={`file-tree-item ${name === currentPage ? "active" : ""}`}
              onClick={() => {
                if (name.endsWith(".html")) onPageChange?.(name)
              }}
            >
              {getFileIcon(name)}
              <span className="file-tree-name">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
