import { 
  type Session,
  type InsertSession,
  type Video, 
  type InsertVideo, 
  type ChatMessage, 
  type InsertChatMessage,
  type VideoSession,
  type InsertVideoSession,
  sessions,
  videos,
  chatMessages,
  videoSessions
} from "@shared/schema";
import { db } from "./db";
// Note: Using Neon PostgreSQL database instead of SQLite
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import fs from 'fs';
import path from 'path';
import type { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadsDir();
  }

  private ensureUploadsDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  private ensureSessionDir(sessionId: string) {
    const sessionDir = path.join(this.uploadsDir, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  // Session operations
  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session || undefined;
  }

  async createSession(): Promise<Session> {
    const id = randomUUID();
    const session: Session = { 
      id,
      createdAt: new Date(),
      lastAccessedAt: new Date()
    };
    
    await db.insert(sessions).values(session);
    this.ensureSessionDir(id);
    return session;
  }

  async updateSessionAccess(id: string): Promise<void> {
    await db.update(sessions)
      .set({ lastAccessedAt: new Date() })
      .where(eq(sessions.id, id));
  }

  // Video operations
  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async getVideosBySessionId(sessionId: string): Promise<Video[]> {
    return await db.select()
      .from(videos)
      .where(eq(videos.sessionId, sessionId))
      .orderBy(desc(videos.uploadedAt));
  }

  async getVideosBySession(sessionId: string): Promise<Video[]> {
    return this.getVideosBySessionId(sessionId);
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const id = randomUUID();
    const video: Video = { 
      ...insertVideo, 
      id,
      uploadedAt: new Date(),
      duration: insertVideo.duration ?? null,
      analysis: insertVideo.analysis ?? null,
      thumbnails: insertVideo.thumbnails ?? null
    };
    
    await db.insert(videos).values(video);
    return video;
  }

  async updateVideo(id: string, updates: Partial<Video>): Promise<Video | undefined> {
    await db.update(videos)
      .set(updates)
      .where(eq(videos.id, id));
    
    return this.getVideo(id);
  }

  async deleteVideo(id: string): Promise<boolean> {
    const result = await db.delete(videos).where(eq(videos.id, id));
    return result.rowCount > 0;
  }

  // Chat operations
  async getChatMessage(id: string): Promise<ChatMessage | undefined> {
    const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    return message || undefined;
  }

  async getChatMessagesByVideoId(videoId: string): Promise<ChatMessage[]> {
    return await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.videoId, videoId))
      .orderBy(desc(chatMessages.timestamp));
  }

  async getChatMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
    return await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.timestamp));
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = { 
      ...insertMessage, 
      id, 
      timestamp: new Date(),
      videoId: insertMessage.videoId ?? null
    };
    
    await db.insert(chatMessages).values(message);
    return message;
  }

  // Video Session operations
  async getVideoSession(id: string): Promise<VideoSession | undefined> {
    const [session] = await db.select().from(videoSessions).where(eq(videoSessions.id, id));
    return session || undefined;
  }

  async createVideoSession(insertSession: InsertVideoSession): Promise<VideoSession> {
    const id = randomUUID();
    const session: VideoSession = { 
      ...insertSession, 
      id, 
      createdAt: new Date(),
      summary: insertSession.summary ?? null,
      selectedVideoIds: Array.isArray(insertSession.selectedVideoIds) 
        ? insertSession.selectedVideoIds 
        : []
    };
    
    await db.insert(videoSessions).values(session);
    return session;
  }

  async updateVideoSession(id: string, updates: Partial<VideoSession>): Promise<VideoSession | undefined> {
    await db.update(videoSessions)
      .set(updates)
      .where(eq(videoSessions.id, id));
    
    return this.getVideoSession(id);
  }

  // Reset functionality
  async clearSessionData(sessionId: string): Promise<void> {
    // Delete all data related to this session
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    await db.delete(videos).where(eq(videos.sessionId, sessionId));
    await db.delete(videoSessions).where(eq(videoSessions.sessionId, sessionId));
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
}