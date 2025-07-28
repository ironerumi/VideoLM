import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull(),
});

export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(), // path to stored video file
  size: integer("size").notNull(),
  duration: integer("duration"), // in seconds
  format: text("format").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  analysis: json("analysis"), // AI analysis results
  thumbnails: json("thumbnails"), // array of thumbnail URLs/data
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  videoId: varchar("video_id").references(() => videos.id),
  message: text("message").notNull(),
  response: text("response").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const videoSessions = pgTable("video_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  selectedVideoIds: json("selected_video_ids").$type<string[]>().notNull().default([]),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertVideoSession = z.infer<typeof insertVideoSessionSchema>;
export type VideoSession = typeof videoSessions.$inferSelect;
