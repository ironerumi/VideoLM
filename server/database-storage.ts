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
  type InsertVideoJob,
  sessions,
  videos,
  chatMessages,
  videoSessions,
  videoJobs,
  videoKeyPoints,
  videoTopics,
  videoVisualElements,
  videoTranscriptions
} from "@shared/schema";
import { db } from "./db";
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

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session || undefined;
  }

  async createSession(): Promise<Session> {
    const id = randomUUID();
    const session: Session = { id, createdAt: new Date(), lastAccessedAt: new Date() };
    await db.insert(sessions).values(session);
    return session;
  }

  async updateSessionAccess(id: string): Promise<void> {
    await db.update(sessions).set({ lastAccessedAt: new Date() }).where(eq(sessions.id, id));
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id)) as Video[];
    return video || undefined;
  }

  async getVideosBySessionId(sessionId: string): Promise<Video[]> {
    return await db.select().from(videos).where(eq(videos.sessionId, sessionId)).orderBy(desc(videos.uploadedAt)) as Video[];
  }

  async getVideosBySession(sessionId: string): Promise<Video[]> {
    return this.getVideosBySessionId(sessionId);
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
    if (typeof insertVideo.sessionId === "string") {
      this.ensureSessionDir(insertVideo.sessionId);
    }
    await db.insert(videos).values(video);
    return video;
  }

  async updateVideo(id: string, updates: Partial<Video>): Promise<Video | undefined> {
    await db.update(videos).set(updates).where(eq(videos.id, id));
    return this.getVideo(id);
  }

  async deleteVideo(id: string): Promise<boolean> {
    await db.delete(videoKeyPoints).where(eq(videoKeyPoints.videoId, id));
    await db.delete(videoTopics).where(eq(videoTopics.videoId, id));
    await db.delete(videoVisualElements).where(eq(videoVisualElements.videoId, id));
    await db.delete(videoTranscriptions).where(eq(videoTranscriptions.videoId, id));
    const result = await db.delete(videos).where(eq(videos.id, id));
    return result.changes > 0;
  }

  async insertKeyPoints(points: { videoId: string, text: string }[]) {
    if (points.length > 0) {
      const dataWithIds = points.map(p => ({ ...p, id: randomUUID() }));
      await db.insert(videoKeyPoints).values(dataWithIds);
    }
  }

  async insertTopics(topicsData: { videoId: string, text: string }[]) {
    if (topicsData.length > 0) {
      const dataWithIds = topicsData.map(t => ({ ...t, id: randomUUID() }));
      await db.insert(videoTopics).values(dataWithIds);
    }
  }

  async insertVisualElements(elements: { videoId: string, text: string }[]) {
    if (elements.length > 0) {
      const dataWithIds = elements.map(e => ({ ...e, id: randomUUID() }));
      await db.insert(videoVisualElements).values(dataWithIds);
    }
  }

  async insertTranscriptions(transcriptionsData: { videoId: string, timestamp: number, text: string }[]) {
    if (transcriptionsData.length > 0) {
      const dataWithIds = transcriptionsData.map(t => ({ ...t, id: randomUUID() }));
      await db.insert(videoTranscriptions).values(dataWithIds);
    }
  }

  async getChatMessage(id: string): Promise<ChatMessage | undefined> {
    const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    return message || undefined;
  }

  async getChatMessagesByVideoId(videoId: string): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages).where(eq(chatMessages.videoId, videoId)).orderBy(desc(chatMessages.timestamp));
  }

  async getChatMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(desc(chatMessages.timestamp));
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
    await db.insert(chatMessages).values(message);
    return message;
  }

  async deleteChatMessagesByVideoId(videoId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.videoId, videoId));
  }

  async getVideoSession(id: string): Promise<VideoSession | undefined> {
    const [session] = await db.select().from(videoSessions).where(eq(videoSessions.id, id));
    return session || undefined;
  }

  async createVideoSession(insertSession: InsertVideoSession): Promise<VideoSession> {
    const id = randomUUID();
    const session: VideoSession = { ...insertSession, id, createdAt: new Date(), summary: insertSession.summary ?? null, selectedVideoIds: Array.isArray(insertSession.selectedVideoIds) ? insertSession.selectedVideoIds : [] };
    await db.insert(videoSessions).values(session);
    return session;
  }

  async updateVideoSession(id: string, updates: Partial<VideoSession>): Promise<VideoSession | undefined> {
    await db.update(videoSessions).set(updates).where(eq(videoSessions.id, id));
    return this.getVideoSession(id);
  }

  async getVideoJob(id: string): Promise<VideoJob | undefined> {
    const [job] = await db.select().from(videoJobs).where(eq(videoJobs.id, id));
    return job || undefined;
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
    await db.insert(videoJobs).values(job);
    return job;
  }

  async updateVideoJobProgress(id: string, progress: number, stage: string): Promise<void> {
    await db.update(videoJobs).set({ progress: Math.max(0, Math.min(100, progress)), currentStage: stage, status: progress < 100 ? 'processing' : 'processing', updatedAt: new Date() }).where(eq(videoJobs.id, id));
  }

  async updateVideoJobStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    const updates: any = { status, updatedAt: new Date() };
    if (status === 'completed') {
      updates.progress = 100;
      updates.currentStage = 'Complete';
    } else if (status === 'failed') {
      updates.currentStage = 'Failed';
      if (errorMessage) {
        updates.errorMessage = errorMessage;
      }
    } else if (status === 'pending') {
      updates.progress = 0;
      updates.currentStage = 'Retrying...';
      updates.errorMessage = null;
    }
    await db.update(videoJobs).set(updates).where(eq(videoJobs.id, id));
  }

  async deleteVideoJob(id: string): Promise<boolean> {
    const result = await db.delete(videoJobs).where(eq(videoJobs.id, id));
    return result.changes > 0;
  }

  async clearSessionData(sessionId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    await db.delete(videoJobs).where(eq(videoJobs.sessionId, sessionId));
    await db.delete(videos).where(eq(videos.sessionId, sessionId));
    await db.delete(videoSessions).where(eq(videoSessions.sessionId, sessionId));
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
}
