import { useCallback } from "react"
import type { WavChunk } from "./use-recorder"

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000"


async function saveToOPFS(chunk: WavChunk): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    const fileHandle = await root.getFileHandle(`chunk-${chunk.id}.wav`, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(chunk.blob)
    await writable.close()
  } catch (e) {
    console.error("OPFS save failed", e)
  }
}


async function deleteFromOPFS(chunkId: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(`chunk-${chunkId}.wav`)
  } catch (e) {
    console.error("OPFS delete failed", e)
  }
}


async function uploadChunk(chunk: WavChunk, index: number): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/chunks/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chunkId: chunk.id,
        sessionId: "session-1",
        index,
        size: chunk.blob.size,
      }),
    })
    const data = await res.json()
    return data.success === true
  } catch (e) {
    return false
  }
}

export function useChunkUpload() {
  const processChunk = useCallback(async (
    chunk: WavChunk,
    index: number,
    onUpdate: (id: string, update: Partial<WavChunk>) => void
  ) => {
    
    await saveToOPFS(chunk)

    
    onUpdate(chunk.id, { uploading: true })

    
    const success = await uploadChunk(chunk, index)

    if (success) {
      
      await deleteFromOPFS(chunk.id)
      onUpdate(chunk.id, { uploaded: true, uploading: false })
    } else {
      
      onUpdate(chunk.id, { uploaded: false, uploading: false })
    }
  }, [])

  return { processChunk }
}