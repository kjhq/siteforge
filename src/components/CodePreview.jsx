import { useRef, useEffect, useState } from "react"
import { MousePointer, X } from "lucide-react"

const INJECTION = `<script>
(function(){var p=null;document.addEventListener('mouseover',function(e){var c=e.target;if(c===p)return;p=c;var r=c.getBoundingClientRect();parent.postMessage({type:'hover',tag:c.tagName.toLowerCase(),id:c.id||null,classes:Array.from(c.classList||[]),text:(c.textContent||'').trim().slice(0,80),rect:{top:r.top,left:r.left,width:r.width,height:r.height}},'*')},true);document.addEventListener('click',function(e){var el=e.target;var r=el.getBoundingClientRect();var cs={};try{var s=getComputedStyle(el);cs.color=s.color;cs.fontSize=s.fontSize}catch{}parent.postMessage({type:'select',tag:el.tagName.toLowerCase(),id:el.id||null,classes:Array.from(el.classList||[]),text:(el.textContent||'').trim().slice(0,80),rect:{top:r.top,left:r.left,width:r.width,height:r.height},styles:cs},'*');e.preventDefault();e.stopPropagation()},true)})()
</script>`

export default function CodePreview({ code, onElementSelect, selectedElement }) {
  const iframeRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    if (!code || !iframeRef.current) return
    const html = code.replace("</body>", INJECTION + "\n</body>")
    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    iframeRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [code])

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

  const copyCode = () => {
    navigator.clipboard.writeText(code || "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const clearSelection = (e) => {
    e.stopPropagation()
    onElementSelect?.(null)
  }

  const el = selectedElement || hovered
  const hasSelection = !!selectedElement

  return (
    <div className="code-preview">
      <div className="preview-header">
        <h3>Live Preview</h3>
        {code && (
          <button className="copy-btn" onClick={copyCode}>
            {copied ? "Copied!" : "Copy Code"}
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
            <button className="element-bar-clear" onClick={clearSelection} title="Clear selection">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="preview-frame">
        {code ? (
          <iframe
            ref={iframeRef}
            title="preview"
            sandbox="allow-scripts"
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
