import { env } from "@my-better-t-app/env/server"
import { db, chunks } from "@my-better-t-app/db"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { eq } from "drizzle-orm"

const app = new Hono()

app.use(logger())
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
)

app.get("/", (c) => {
  return c.text("OK")
})


app.post("/api/chunks/upload", async (c) => {
  try {
    const { chunkId, sessionId, index, size } = await c.req.json()

    await db.insert(chunks).values({
      id: chunkId,
      sessionId: sessionId ?? "default",
      index: String(index ?? 0),
      size: String(size ?? 0),
      acked: true,
    }).onConflictDoNothing()

    return c.json({ success: true, chunkId })
  } catch (error) {
    return c.json({ success: false, error: "Failed to store chunk" }, 500)
  }
})


app.get("/api/chunks/reconcile", async (c) => {
  try {
    const ackedChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.acked, true))

    return c.json({ success: true, chunks: ackedChunks })
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch chunks" }, 500)
  }
})


app.get("/api/stats", async (c) => {
  try {
    const allChunks = await db.select().from(chunks)
    const totalChunks = allChunks.length
    const ackedChunks = allChunks.filter((c) => c.acked).length
    const successRate = totalChunks === 0 ? 100 : Math.round((ackedChunks / totalChunks) * 100)
    const totalSize = allChunks.reduce((sum, c) => sum + Number(c.size), 0)

    return c.json({
      success: true,
      stats: {
        totalChunks,
        ackedChunks,
        successRate,
        totalSizeBytes: totalSize,
      },
    })
  } catch (error) {
    return c.json({ success: false, error: "Failed to fetch stats" }, 500)
  }
})

export default app