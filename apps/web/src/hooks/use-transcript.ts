import { useCallback, useState } from "react"
import type { WavChunk } from "./use-recorder"

const DEEPGRAM_KEY = process.env.NEXT_PUBLIC_DEEPGRAM_KEY ?? ""

export function useTranscript() {
  const [transcript, setTranscript] = useState<string>("")
  const [transcribing, setTranscribing] = useState(false)

  const generateTranscript = useCallback(async (chunks: WavChunk[]) => {
    if (chunks.length === 0) return
    setTranscribing(true)
    setTranscript("")

    try {
      const parts: string[] = []

      for (const chunk of chunks) {
        const arrayBuffer = await chunk.blob.arrayBuffer()

        const res = await fetch(
          "https://api.deepgram.com/v1/listen?model=nova-2&language=en",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${DEEPGRAM_KEY}`,
              "Content-Type": "audio/wav",
            },
            body: arrayBuffer,
          }
        )

        const data = await res.json()
        const text =
          data?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ""
        if (text) parts.push(text)
      }

      setTranscript(parts.join(" "))
    } catch (e) {
      console.error("Transcription failed", e)
      setTranscript("Transcription failed. Please try again.")
    } finally {
      setTranscribing(false)
    }
  }, [])

  const downloadTranscript = useCallback((text: string) => {
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transcript-${new Date().toISOString().slice(0, 19)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return { transcript, transcribing, generateTranscript, downloadTranscript }
}