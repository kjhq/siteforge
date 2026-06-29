import { useRef, useEffect, useState } from "react"

export default function CodePreview({ code }) {
  const iframeRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!code || !iframeRef.current) return
    const blob = new Blob([code], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    iframeRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [code])

  const copyCode = () => {
    navigator.clipboard.writeText(code || "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
      <div className="preview-frame">
        {code ? (
          <iframe ref={iframeRef} title="preview" sandbox="allow-scripts" />
        ) : (
          <div className="empty-state">
            <span className="empty-icon">🎤</span>
            <p>Say something to start building...</p>
          </div>
        )}
      </div>
    </div>
  )
}
