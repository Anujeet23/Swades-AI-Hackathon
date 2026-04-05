"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Mic,
  Pause,
  Play,
  Square,
  Trash2,
  Check,
  Loader2,
  FileText,
} from "lucide-react";

import { Button } from "@my-better-t-app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@my-better-t-app/ui/components/card";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { useRecorder, type WavChunk } from "@/hooks/use-recorder";
import { useChunkUpload } from "@/hooks/use-chunk-upload";
import { useTranscript } from "@/hooks/use-transcript";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

function formatDuration(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

function ChunkRow({ chunk, index }: { chunk: WavChunk; index: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      el.currentTime = 0;
      setPlaying(false);
    } else {
      el.play();
      setPlaying(true);
    }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = chunk.url;
    a.download = `chunk-${index + 1}.wav`;
    a.click();
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-sm border border-border/50 bg-muted/30 px-3 py-2">
      <audio
        ref={audioRef}
        src={chunk.url}
        onEnded={() => setPlaying(false)}
        preload="none"
      />
      <span className="text-xs font-medium text-muted-foreground tabular-nums">
        #{index + 1}
      </span>
      <span className="text-xs tabular-nums">
        {formatDuration(chunk.duration)}
      </span>
      <span className="text-[10px] text-muted-foreground">16kHz PCM</span>

      <div className="flex items-center gap-1">
        {chunk.uploading && (
          <span className="flex items-center gap-1 text-[10px] text-yellow-500">
            <Loader2 className="size-3 animate-spin" /> Uploading
          </span>
        )}
        {chunk.uploaded && (
          <span className="flex items-center gap-1 text-[10px] text-green-500">
            <Check className="size-3" /> Uploaded
          </span>
        )}
        {chunk.uploaded === false && !chunk.uploading && (
          <span className="flex items-center gap-1 text-[10px] text-red-500">
            Failed
          </span>
        )}
      </div>

      <div className="ml-auto flex gap-1">
        <Button variant="ghost" size="icon-xs" onClick={toggle}>
          {playing ? (
            <Square className="size-3" />
          ) : (
            <Play className="size-3" />
          )}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={download}>
          <Download className="size-3" />
        </Button>
      </div>
    </div>
  );
}

export default function RecorderPage() {
  const [deviceId] = useState<string | undefined>();
  const {
    status,
    start,
    stop,
    pause,
    resume,
    chunks,
    elapsed,
    stream,
    clearChunks,
  } = useRecorder({ chunkDuration: 5, deviceId });
  const { processChunk } = useChunkUpload();
  const { transcript, transcribing, generateTranscript, downloadTranscript } =
    useTranscript();

  const [enrichedChunks, setEnrichedChunks] = useState<WavChunk[]>([]);
  const processedIds = useRef<Set<string>>(new Set());
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    setEnrichedChunks(
      chunks.map((c) => {
        const existing = enrichedChunks.find((e) => e.id === c.id);
        return existing ?? c;
      }),
    );
  }, [chunks]);

  useEffect(() => {
    for (const chunk of enrichedChunks) {
      if (
        !processedIds.current.has(chunk.id) &&
        !chunk.uploading &&
        chunk.uploaded === undefined
      ) {
        processedIds.current.add(chunk.id);
        const index = enrichedChunks.indexOf(chunk);
        processChunk(chunk, index, (id, update) => {
          setEnrichedChunks((prev) =>
            prev.map((c) => (c.id === id ? { ...c, ...update } : c)),
          );
        });
      }
    }
  }, [enrichedChunks, processChunk]);

  // Reconciliation on page load
  useEffect(() => {
    const reconcile = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/chunks/reconcile`);
        const data = await res.json();
        const ackedIds: string[] = data.chunks.map((c: { id: string }) => c.id);
        const root = await navigator.storage.getDirectory();
        for await (const [name] of root as unknown as AsyncIterable<
          [string, FileSystemHandle]
        >) {
          if (!name.endsWith(".wav")) continue;
          const chunkId = name.replace("chunk-", "").replace(".wav", "");
          if (!ackedIds.includes(chunkId)) {
            const fileHandle = await root.getFileHandle(name);
            const file = await fileHandle.getFile();
            await fetch(`${SERVER_URL}/api/chunks/upload`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chunkId,
                sessionId: "session-1",
                index: 0,
                size: file.size,
              }),
            });
          }
        }
      } catch (e) {
        console.error("Reconciliation failed", e);
      }
    };
    reconcile();
  }, []);

  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isActive = isRecording || isPaused;

  const handlePrimary = useCallback(() => {
    if (isActive) {
      stop();
      setShowTranscript(false);
    } else {
      start();
      setShowTranscript(false);
    }
  }, [isActive, stop, start]);

  const handleClear = () => {
    clearChunks();
    setEnrichedChunks([]);
    processedIds.current.clear();
    setShowTranscript(false);
  };

  const handleGenerateTranscript = async () => {
    setShowTranscript(true);
    await generateTranscript(enrichedChunks);
  };

  return (
    <div className="container mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Recorder</CardTitle>
          <CardDescription>
            16 kHz / 16-bit PCM WAV — chunked every 5 s
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-sm border border-border/50 bg-muted/20 text-foreground">
            <LiveWaveform
              active={isRecording}
              processing={isPaused}
              stream={stream}
              height={80}
              barWidth={3}
              barGap={1}
              barRadius={2}
              sensitivity={1.8}
              smoothingTimeConstant={0.85}
              fadeEdges
              fadeWidth={32}
              mode="static"
            />
          </div>

          <div className="text-center font-mono text-3xl tabular-nums tracking-tight">
            {formatTime(elapsed)}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button
              size="lg"
              variant={isActive ? "destructive" : "default"}
              className="gap-2 px-5"
              onClick={handlePrimary}
              disabled={status === "requesting"}
            >
              {isActive ? (
                <>
                  <Square className="size-4" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="size-4" />
                  {status === "requesting" ? "Requesting..." : "Record"}
                </>
              )}
            </Button>

            {isActive && (
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={isPaused ? resume : pause}
              >
                {isPaused ? (
                  <>
                    <Play className="size-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="size-4" />
                    Pause
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {enrichedChunks.length > 0 && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Chunks</CardTitle>
            <CardDescription>{enrichedChunks.length} recorded</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {enrichedChunks.map((chunk, i) => (
              <ChunkRow key={chunk.id} chunk={chunk} index={i} />
            ))}
            <div className="mt-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive"
                onClick={handleClear}
              >
                <Trash2 className="size-3" />
                Clear all
              </Button>

              {/* Transcript button — only show when not recording */}
              {status === "idle" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleGenerateTranscript}
                  disabled={transcribing}
                >
                  {transcribing ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <FileText className="size-3" />
                      Generate Transcript
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {showTranscript && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>Full session transcript</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {transcribing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Transcribing all chunks...
              </div>
            ) : (
              <>
                <p className="rounded-sm border border-border/50 bg-muted/20 p-3 text-sm leading-relaxed">
                  {transcript || "No speech detected."}
                </p>
                {transcript && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 self-end"
                    onClick={() => downloadTranscript(transcript)}
                  >
                    <Download className="size-3" />
                    Download .txt
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
