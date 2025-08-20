import { 
  type Session,
  type InsertSession,
  type Video, 
  type InsertVideo, 
  type ChatMessage, 
  type InsertChatMessage,
  type VideoSession,
  type InsertVideoSession,
  type VideoJob,
  type InsertVideoJob
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
  
  // Analysis data operations
  insertKeyPoints(points: { videoId: string, text: string }[]): Promise<void>;
  insertTopics(topics: { videoId: string, text: string }[]): Promise<void>;
  insertVisualElements(elements: { videoId: string, text: string }[]): Promise<void>;
  insertTranscriptions(transcriptions: { videoId: string, timestamp: number, text: string }[]): Promise<void>;

  // Chat operations
  getChatMessage(id: string): Promise<ChatMessage | undefined>;
  getChatMessagesByVideoId(videoId: string): Promise<ChatMessage[]>;
  getChatMessagesBySessionId(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  deleteChatMessagesByVideoId(videoId: string): Promise<void>;
  
  // Video Session operations
  getVideoSession(id: string): Promise<VideoSession | undefined>;
  createVideoSession(session: InsertVideoSession): Promise<VideoSession>;
  updateVideoSession(id: string, updates: Partial<VideoSession>): Promise<VideoSession | undefined>;
  
  // Video Job operations
  getVideoJob(id: string): Promise<VideoJob | undefined>;
  createVideoJob(job: InsertVideoJob): Promise<VideoJob>;
  updateVideoJobProgress(id: string, progress: number, stage: string): Promise<void>;
  updateVideoJobStatus(id: string, status: string, errorMessage?: string): Promise<void>;
  deleteVideoJob(id: string): Promise<boolean>;
  
  // Additional methods for reset functionality  
  getVideosBySession(sessionId: string): Promise<Video[]>;
  clearSessionData(sessionId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session>;
  private videos: Map<string, Video>;
  private chatMessages: Map<string, ChatMessage>;
  private videoSessions: Map<string, VideoSession>;
  private videoJobs: Map<string, VideoJob>;
  private videoKeyPoints: Map<string, { videoId: string, text: string }>;
  private videoTopics: Map<string, { videoId: string, text: string }>;
  private videoVisualElements: Map<string, { videoId: string, text: string }>;
  private videoTranscriptions: Map<string, { videoId: string, timestamp: number, text: string }>;
  private uploadsDir: string;

  constructor() {
    this.sessions = new Map();
    this.videos = new Map();
    this.chatMessages = new Map();
    this.videoSessions = new Map();
    this.videoJobs = new Map();
    this.videoKeyPoints = new Map();
    this.videoTopics = new Map();
    this.videoVisualElements = new Map();
    this.videoTranscriptions = new Map();
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
      id,
      sessionId: insertVideo.sessionId,
      filename: insertVideo.filename,
      originalName: insertVideo.originalName,
      filePath: insertVideo.filePath,
      size: insertVideo.size,
      duration: insertVideo.duration ?? null,
      format: insertVideo.format,
      uploadedAt: new Date(),
      processingStatus: insertVideo.processingStatus ?? 'pending',
      jobId: insertVideo.jobId ?? null,
      summary: null,
      sentiment: null
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

  async insertKeyPoints(points: { videoId: string, text: string }[]): Promise<void> {
    for (const point of points) {
      this.videoKeyPoints.set(randomUUID(), point);
    }
  }

  async insertTopics(topics: { videoId: string, text: string }[]): Promise<void> {
    for (const topic of topics) {
      this.videoTopics.set(randomUUID(), topic);
    }
  }

  async insertVisualElements(elements: { videoId: string, text: string }[]): Promise<void> {
    for (const element of elements) {
      this.videoVisualElements.set(randomUUID(), element);
    }
  }

  async insertTranscriptions(transcriptions: { videoId: string, timestamp: number, text: string }[]): Promise<void> {
    for (const transcription of transcriptions) {
      this.videoTranscriptions.set(randomUUID(), transcription);
    }
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
      id,
      sessionId: insertMessage.sessionId,
      videoId: insertMessage.videoId ?? null,
      message: insertMessage.message,
      rephrasedQuestion: insertMessage.rephrasedQuestion ?? null,
      response: insertMessage.response,
      relevantFrame: insertMessage.relevantFrame ?? null,
      timestamp: new Date()
    };
    this.chatMessages.set(id, message);
    return message;
  }

  async deleteChatMessagesByVideoId(videoId: string): Promise<void> {
    const messagesToDelete = Array.from(this.chatMessages.values())
      .filter(message => message.videoId === videoId);
    
    for (const message of messagesToDelete) {
      this.chatMessages.delete(message.id);
    }
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
      summary: insertSession.summary ?? null,
      selectedVideoIds: Array.isArray(insertSession.selectedVideoIds) 
        ? insertSession.selectedVideoIds 
        : []
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

  async getVideosBySession(sessionId: string): Promise<Video[]> {
    return Array.from(this.videos.values()).filter(video => video.sessionId === sessionId);
  }

  async getVideoJob(id: string): Promise<VideoJob | undefined> {
    return this.videoJobs.get(id);
  }

  async createVideoJob(insertJob: InsertVideoJob): Promise<VideoJob> {
    const id = randomUUID();
    const job: VideoJob = {
      id,
      videoId: insertJob.videoId,
      sessionId: insertJob.sessionId,
      status: insertJob.status ?? 'pending',
      progress: insertJob.progress ?? 0,
      currentStage: insertJob.currentStage ?? null,
      errorMessage: insertJob.errorMessage ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.videoJobs.set(id, job);
    return job;
  }

  async updateVideoJobProgress(id: string, progress: number, stage: string): Promise<void> {
    const job = this.videoJobs.get(id);
    if (job) {
      job.progress = Math.max(0, Math.min(100, progress));
      job.currentStage = stage;
      job.status = progress < 100 ? 'processing' : 'processing';
      job.updatedAt = new Date();
      this.videoJobs.set(id, job);
    }
  }

  async updateVideoJobStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    const job = this.videoJobs.get(id);
    if (job) {
      job.status = status;
      job.updatedAt = new Date();
      
      if (status === 'completed') {
        job.progress = 100;
        job.currentStage = 'Complete';
      } else if (status === 'failed') {
        job.currentStage = 'Failed';
        if (errorMessage) {
          job.errorMessage = errorMessage;
        }
      } else if (status === 'pending') {
        job.progress = 0;
        job.currentStage = 'Retrying...';
        job.errorMessage = null;
      }
      
      this.videoJobs.set(id, job);
    }
  }

  async deleteVideoJob(id: string): Promise<boolean> {
    return this.videoJobs.delete(id);
  }

  async clearSessionData(sessionId: string): Promise<void> {
    // Remove all videos for this session
    const videosToDelete = Array.from(this.videos.entries())
      .filter(([_, video]) => video.sessionId === sessionId)
      .map(([id, _]) => id);
    
    videosToDelete.forEach(id => this.videos.delete(id));
    
    // Remove all chat messages for this session
    const messagesToDelete = Array.from(this.chatMessages.entries())
      .filter(([_, message]) => message.sessionId === sessionId)
      .map(([id, _]) => id);
    
    messagesToDelete.forEach(id => this.chatMessages.delete(id));
    
    // Remove all video sessions for this session
    const sessionsToDelete = Array.from(this.videoSessions.entries())
      .filter(([_, videoSession]) => videoSession.sessionId === sessionId)
      .map(([id, _]) => id);
    
    sessionsToDelete.forEach(id => this.videoSessions.delete(id));

    // Remove all video jobs for this session
    const jobsToDelete = Array.from(this.videoJobs.entries())
      .filter(([_, job]) => job.sessionId === sessionId)
      .map(([id, _]) => id);
    
    jobsToDelete.forEach(id => this.videoJobs.delete(id));
    
    // Remove the session itself
    this.sessions.delete(sessionId);
  }
}

// Use SQLite DatabaseStorage for job tracking persistence
import { DatabaseStorage } from './database-storage';
export const storage = new DatabaseStorage();

// MemStorage option (data lost on restart)
// export const storage = new MemStorage();
