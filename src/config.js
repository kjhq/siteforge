export const CEREBRAS_API_KEY = import.meta.env.VITE_CEREBRAS_API_KEY || ""
export const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"
export const MODEL = "gemma-4-31b"

export const AGENTS = [
  { id: "Design Planner", label: "Design Planner", color: "#e6a050", emoji: "✏️" },
  { id: "Designer", label: "Design Reviewer", color: "#e08040", emoji: "🎨" },
  { id: "Security", label: "Code Reviewer", color: "#d06030", emoji: "🔒" },
  { id: "Debug", label: "Bug Finder", color: "#e0a030", emoji: "🐛" },
  { id: "Auditor", label: "Code Auditor", color: "#c08030", emoji: "📋" },
  { id: "Unifier", label: "Spec Unifier", color: "#d0a040", emoji: "🔗" },
  { id: "Coder", label: "Code Generator", color: "#b0c040", emoji: "💻" },
]
