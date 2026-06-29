export const CEREBRAS_API_KEY = import.meta.env.VITE_CEREBRAS_API_KEY || ""
export const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"
export const MODEL = "gemma-4-31b"

export const AGENTS = [
  { id: "developer", label: "Developer", color: "#22c55e", emoji: "💻" },
]
