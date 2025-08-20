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
  filePath: text("file_path").notNull(),
  size: integer("size").notNull(),
  duration: integer("duration"),
  format: text("format").notNull(),
  uploadedAt: integer("uploaded_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch() * 1000)`),
  processingStatus: text("processing_status").default('pending'),
  jobId: text("job_id"),
  summary: text("summary"),
  sentiment: text("sentiment"),
});

export const videoKeyPoints = sqliteTable("video_key_points", {
  id: text("id").primaryKey(),
  videoId: text("video_id").references(() => videos.id).notNull(),
  text: text("text").notNull(),
});

export const videoTopics = sqliteTable("video_topics", {
  id: text("id").primaryKey(),
  videoId: text("video_id").references(() => videos.id).notNull(),
  text: text("text").notNull(),
});

export const videoVisualElements = sqliteTable("video_visual_elements", {
  id: text("id").primaryKey(),
  videoId: text("video_id").references(() => videos.id).notNull(),
  text: text("text").notNull(),
});

export const videoTranscriptions = sqliteTable("video_transcriptions", {
  id: text("id").primaryKey(),
  videoId: text("video_id").references(() => videos.id).notNull(),
  timestamp: integer("timestamp").notNull(),
  text: text("text").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => sessions.id).notNull(),
  videoId: text("video_id").references(() => videos.id),
  message: text("message").notNull(),
  rephrasedQuestion: text("rephrased_question"),
  response: text("response").notNull(),
  relevantFrame: text("relevant_frame"),
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
  status: text("status").notNull().default('pending'),
  progress: integer("progress").notNull().default(0),
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
}).extend({
  duration: z.number().nullable().optional(),
  processingStatus: z.string().nullable().optional(),
  jobId: z.string().nullable().optional()
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
}).extend({
  status: z.string().default('pending'),
  progress: z.number().default(0),
  currentStage: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional()
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
