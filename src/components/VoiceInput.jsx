import { useState, useRef, useCallback } from "react"
import { Mic, Loader2 } from "lucide-react"

export default function VoiceInput({ onTranscript }) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Use Chrome.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = "en-US"

    recognition.onresult = (e) => {
      const result = e.results[e.results.length - 1]
      if (result.isFinal) {
        const transcript = result[0].transcript.trim()
        if (transcript) {
          onTranscript(transcript)
        }
        recognition.stop()
      }
    }

    recognition.onerror = (e) => {
      console.warn("Voice input error:", e.error)
      if (e.error !== "no-speech" && e.error !== "aborted") {
        setListening(false)
      }
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [onTranscript])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return (
    <button
      onClick={listening ? stopListening : startListening}
      className={`voice-btn ${listening ? "listening" : ""}`}
    >
      {listening ? <><Loader2 className="icon spin" /> Listening...</> : <><Mic className="icon" /> Click & Speak</>}
    </button>
  )
}
