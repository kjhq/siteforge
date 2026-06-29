import { useRef, useEffect, useState } from "react"
import { MousePointer, X, Smartphone, Monitor } from "lucide-react"

export default function CodePreview({ projectId, previewVersion, onElementSelect, selectedElement }) {
  const iframeRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(null)
  const [mobileView, setMobileView] = useState(false)

  useEffect(() => {
    if (!projectId || !iframeRef.current) return
    iframeRef.current.src = `/preview/${projectId}?v=${previewVersion}`
  }, [projectId, previewVersion])

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "hover") {
        setHovered(e.data)
      } else if (e.data?.type === "select") {
        setHovered(null)
        onElementSelect?.(e.data)
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [onElementSelect])

  const el = selectedElement || hovered
  const hasSelection = !!selectedElement

  return (
    <div className="code-preview">
      <div className="preview-header">
        <h3>Live Preview</h3>
        {projectId && (
          <button
            className={`preview-toggle ${mobileView ? "active" : ""}`}
            onClick={() => setMobileView(!mobileView)}
            title={mobileView ? "Desktop view" : "Mobile view"}
          >
            {mobileView ? <Monitor size={14} /> : <Smartphone size={14} />}
          </button>
        )}
      </div>

      {el && (
        <div className={`element-bar ${hasSelection ? "selected" : ""}`}>
          <MousePointer size={14} className="element-bar-icon" />
          <span className="element-bar-tag">{el.tag}</span>
          {el.id && <span className="element-bar-id">#{el.id}</span>}
          {el.classes?.length > 0 && <span className="element-bar-classes">.{el.classes.slice(0, 3).join(".")}</span>}
          <span className="element-bar-text">"{el.text}"</span>
          <span className="element-bar-status">{hasSelection ? "🔒 Selected" : "◌ Hover"}</span>
          {hasSelection && (
            <button className="element-bar-clear" onClick={(e) => { e.stopPropagation(); onElementSelect?.(null) }} title="Clear selection">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className={`preview-frame ${mobileView ? "mobile" : ""}`}>
        {projectId ? (
          <iframe
            ref={iframeRef}
            title="preview"
            sandbox="allow-scripts allow-same-origin"
            className={mobileView ? "iframe-mobile" : ""}
            style={{ outline: el ? (hasSelection ? "3px solid #6366f1" : "2px solid #22c55e") : "none" }}
          />
        ) : (
          <div className="empty-state">
            <span className="empty-icon">⌨️</span>
            <p>Describe a website to build...</p>
          </div>
        )}
      </div>
    </div>
  )
}
