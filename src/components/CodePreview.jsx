import { useRef, useEffect, useState } from "react"
import { MousePointer, X, Smartphone, Monitor, Eye, Pointer, FileText, ChevronDown } from "lucide-react"

export default function CodePreview({ projectId, previewVersion, onElementSelect, selectedElement, pages, currentPage, onPageChange }) {
  const iframeRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(null)
  const [mobileView, setMobileView] = useState(false)
  const [inspectMode, setInspectMode] = useState(true)
  const [pageMenuOpen, setPageMenuOpen] = useState(false)

  const htmlPages = pages?.filter(p => p.path.endsWith(".html")) || []
  const hasMultiplePages = htmlPages.length > 1
  const activePage = currentPage || "index.html"

  useEffect(() => {
    if (!projectId || !iframeRef.current) return
    const pagePath = activePage === "index.html" ? "" : activePage
    iframeRef.current.src = `/preview/${projectId}/${pagePath}?v=${previewVersion}`
  }, [projectId, previewVersion, activePage])

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "hover" && inspectMode) {
        setHovered(e.data)
      } else if (e.data?.type === "select" && inspectMode) {
        setHovered(null)
        onElementSelect?.(e.data)
      } else if (e.data?.type === "inspect-off") {
        setHovered(null)
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [onElementSelect, inspectMode])

  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "setInspectMode", inspect: inspectMode }, "*")
    }
  }, [inspectMode])

  const handleIframeLoad = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "setInspectMode", inspect: inspectMode }, "*")
    }
  }

  const el = selectedElement || hovered
  const hasSelection = !!selectedElement

  const toggleInspect = () => {
    setInspectMode(!inspectMode)
    setHovered(null)
  }

  return (
    <div className="code-preview">
      <div className="preview-header">
        <h3>Live Preview</h3>
        <div className="preview-controls">
          {projectId && hasMultiplePages && (
            <div className="page-selector">
              <button
                className="page-selector-trigger"
                onClick={() => setPageMenuOpen(!pageMenuOpen)}
              >
                <FileText size={12} />
                <span>{activePage.replace(".html", "")}</span>
                <ChevronDown size={12} className={pageMenuOpen ? "open" : ""} />
              </button>
              {pageMenuOpen && (
                <div className="page-selector-dropdown">
                  {htmlPages.map(p => (
                    <button
                      key={p.path}
                      className={`page-selector-item ${p.path === activePage ? "active" : ""}`}
                      onClick={() => {
                        onPageChange?.(p.path)
                        setPageMenuOpen(false)
                      }}
                    >
                      <FileText size={12} />
                      <span>{p.path.replace(".html", "")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {projectId && (
            <>
              <button
                className={`preview-toggle ${inspectMode ? "active" : ""}`}
                onClick={toggleInspect}
                title={inspectMode ? "Interact with page" : "Inspect elements"}
              >
                {inspectMode ? <Pointer size={14} /> : <Eye size={14} />}
              </button>
              <button
                className={`preview-toggle ${mobileView ? "active" : ""}`}
                onClick={() => setMobileView(!mobileView)}
                title={mobileView ? "Desktop view" : "Mobile view"}
              >
                {mobileView ? <Monitor size={14} /> : <Smartphone size={14} />}
              </button>
            </>
          )}
        </div>
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
              onLoad={handleIframeLoad}
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
