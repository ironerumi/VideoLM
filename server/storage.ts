import { 
  type Video, 
  type InsertVideo, 
  type ChatMessage, 
  type InsertChatMessage,
  type VideoSession,
  type InsertVideoSession 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Video operations
  getVideo(id: string): Promise<Video | undefined>;
  getAllVideos(): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, updates: Partial<Video>): Promise<Video | undefined>;
  deleteVideo(id: string): Promise<boolean>;
  
  // Chat operations
  getChatMessage(id: string): Promise<ChatMessage | undefined>;
  getChatMessagesByVideoId(videoId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Session operations
  getVideoSession(id: string): Promise<VideoSession | undefined>;
  createVideoSession(session: InsertVideoSession): Promise<VideoSession>;
  updateVideoSession(id: string, updates: Partial<VideoSession>): Promise<VideoSession | undefined>;
}

export class MemStorage implements IStorage {
  private videos: Map<string, Video>;
  private chatMessages: Map<string, ChatMessage>;
  private videoSessions: Map<string, VideoSession>;

  constructor() {
    this.videos = new Map();
    this.chatMessages = new Map();
    this.videoSessions = new Map();
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async getAllVideos(): Promise<Video[]> {
    return Array.from(this.videos.values()).sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const id = randomUUID();
    const video: Video = { 
      ...insertVideo, 
      id, 
      uploadedAt: new Date(),
      analysis: null,
      thumbnails: null,
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