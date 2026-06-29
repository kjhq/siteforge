export const CEREBRAS_API_KEY = import.meta.env.VITE_CEREBRAS_API_KEY || ""
export const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"
export const MODEL = "gemma-4-31b"

export const AGENTS = [
  { id: "architect", label: "Architect", color: "#6366f1", emoji: "🏗️" },
  { id: "developer", label: "Developer", color: "#22c55e", emoji: "💻" },
  { id: "reviewer", label: "Reviewer", color: "#f59e0b", emoji: "🔍" },
  { id: "security", label: "Security", color: "#ef4444", emoji: "🛡️" },
  { id: "designer", label: "Designer", color: "#ec4899", emoji: "🎨" },
]
