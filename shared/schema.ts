import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch() * 1000)`),
  lastAccessedAt: integer("last_accessed_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(), // path to stored video file
  size: integer("size").notNull(),
  duration: integer("duration"), // in seconds
  format: text("format").notNull(),
  uploadedAt: integer("uploaded_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch() * 1000)`),
  analysis: text("analysis", { mode: 'json' }), // AI analysis results as JSON
  thumbnails: text("thumbnails", { mode: 'json' }), // array of thumbnail URLs/data as JSON
  processingStatus: text("processing_status").default('pending'), // 'pending', 'processing', 'completed', 'failed'
  jobId: text("job_id").references(() => videoJobs.id),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id).notNull(),
  videoId: text("video_id").references(() => videos.id),
  message: text("message").notNull(),
  rephrasedQuestion: text("rephrased_question"), // LLM-rephrased full sentence question
  response: text("response").notNull(),
  relevantFrame: text("relevant_frame"), // frame filename/path if relevant
  timestamp: integer("timestamp", { mode: 'timestamp' }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const videoSessions = sqliteTable("video_sessions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id).notNull(),
  selectedVideoIds: text("selected_video_ids", { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  summary: text("summary"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const videoJobs = sqliteTable("video_jobs", {
  id: text("id").primaryKey(),
  videoId: text("video_id").references(() => videos.id).notNull(),
  sessionId: text("session_id").references(() => sessions.id).notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  progress: integer("progress").notNull().default(0), // 0-100
  currentStage: text("current_stage"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch() * 1000)`),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  lastAccessedAt: true,
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  uploadedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertVideoSessionSchema = createInsertSchema(videoSessions).omit({
  id: true,
  createdAt: true,
});

export const insertVideoJobSchema = createInsertSchema(videoJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertVideoSession = z.infer<typeof insertVideoSessionSchema>;
export type VideoSession = typeof videoSessions.$inferSelect;
export type InsertVideoJob = z.infer<typeof insertVideoJobSchema>;
export type VideoJob = typeof videoJobs.$inferSelect;