export const CEREBRAS_API_KEY = import.meta.env.VITE_CEREBRAS_API_KEY || ""
export const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"
export const MODEL = "gemma-4-31b"

export const AGENTS = [
  { id: "Designer", label: "Design Reviewer", color: "#a855f7", emoji: "🎨" },
  { id: "Security", label: "Security Auditor", color: "#ef4444", emoji: "🔒" },
  { id: "Debug", label: "Bug Finder", color: "#f59e0b", emoji: "🐛" },
  { id: "Auditor", label: "Code Auditor", color: "#3b82f6", emoji: "📋" },
  { id: "Unifier", label: "Spec Unifier", color: "#06b6d4", emoji: "🔗" },
  { id: "Coder", label: "Code Generator", color: "#22c55e", emoji: "💻" },
]
