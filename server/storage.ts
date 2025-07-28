import { 
  type Session,
  type InsertSession,
  type Video, 
  type InsertVideo, 
  type ChatMessage, 
  type InsertChatMessage,
  type VideoSession,
  type InsertVideoSession 
} from "@shared/schema";
import { randomUUID } from "crypto";
import fs from 'fs';
import path from 'path';

export interface IStorage {
  // Session operations
  getSession(id: string): Promise<Session | undefined>;
  createSession(): Promise<Session>;
  updateSessionAccess(id: string): Promise<void>;
  
  // Video operations
  getVideo(id: string): Promise<Video | undefined>;
  getVideosBySessionId(sessionId: string): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, updates: Partial<Video>): Promise<Video | undefined>;
  deleteVideo(id: string): Promise<boolean>;
  
  // Chat operations
  getChatMessage(id: string): Promise<ChatMessage | undefined>;
  getChatMessagesByVideoId(videoId: string): Promise<ChatMessage[]>;
  getChatMessagesBySessionId(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Video Session operations
  getVideoSession(id: string): Promise<VideoSession | undefined>;
  createVideoSession(session: InsertVideoSession): Promise<VideoSession>;
  updateVideoSession(id: string, updates: Partial<VideoSession>): Promise<VideoSession | undefined>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private videos: Map<string, Video>;
  private chatMessages: Map<string, ChatMessage>;
  private videoSessions: Map<string, VideoSession>;
  private uploadsDir: string;

  constructor() {
    this.sessions = new Map();
    this.videos = new Map();
    this.chatMessages = new Map();
    this.videoSessions = new Map();
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

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async createSession(): Promise<Session> {
    const id = randomUUID();
    const session: Session = { 
      id,
      createdAt: new Date(),
      lastAccessedAt: new Date()
    };
    this.sessions.set(id, session);
    this.ensureSessionDir(id);
    return session;
  }

  async updateSessionAccess(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.lastAccessedAt = new Date();
      this.sessions.set(id, session);
    }
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async getVideosBySessionId(sessionId: string): Promise<Video[]> {
    return Array.from(this.videos.values())
      .filter(video => video.sessionId === sessionId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const id = randomUUID();
    const video: Video = { 
      ...insertVideo, 
      id, 
      uploadedAt: new Date(),
      analysis: insertVideo.analysis ?? null,
      thumbnails: insertVideo.thumbnails ?? null,
      duration: insertVideo.duration ?? null
    };
    this.videos.set(id, video);
    return video;
  }

  async updateVideo(id: string, updates: Partial<Video>): Promise<Video | undefined> {
    const video = this.videos.get(id);
    if (!video) return undefined;
    
    const updatedVideo = { ...video, ...updates };
    this.videos.set(id, updatedVideo);
    return updatedVideo;
  }

  async deleteVideo(id: string): Promise<boolean> {
    return this.videos.delete(id);
  }

  async getChatMessage(id: string): Promise<ChatMessage | undefined> {
    return this.chatMessages.get(id);
  }

  async getChatMessagesByVideoId(videoId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.videoId === videoId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getChatMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.sessionId === sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = { 
      ...insertMessage, 
      id, 
      timestamp: new Date(),
      videoId: insertMessage.videoId ?? null
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async getVideoSession(id: string): Promise<VideoSession | undefined> {
    return this.videoSessions.get(id);
  }

  async createVideoSession(insertSession: InsertVideoSession): Promise<VideoSession> {
    const id = randomUUID();
    const session: VideoSession = { 
      ...insertSession, 
      id, 
      createdAt: new Date(),
      summary: insertSession.summary ?? null
    };
    this.videoSessions.set(id, session);
    return session;
  }

  async updateVideoSession(id: string, updates: Partial<VideoSession>): Promise<VideoSession | undefined> {
    const session = this.videoSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.videoSessions.set(id, updatedSession);
    return updatedSession;
  }
}

export const storage = new MemStorage();