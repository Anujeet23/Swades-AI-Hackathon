import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core"

export const chunks = pgTable("chunks", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  index: text("index").notNull(),
  size: text("size").notNull(),
  acked: boolean("acked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})