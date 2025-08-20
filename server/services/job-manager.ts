import { randomUUID } from "crypto";
import { storage } from "../storage";
import type { VideoJob, InsertVideoJob } from "@shared/schema";

export interface IJobManager {
  createJob(videoId: string, sessionId: string): Promise<string>;
  getJob(jobId: string): Promise<VideoJob | undefined>;
  updateJobProgress(jobId: string, progress: number, stage: string): Promise<void>;
  completeJob(jobId: string): Promise<void>;
  failJob(jobId: string, error: string): Promise<void>;
  getJobByVideoId(videoId: string): Promise<VideoJob | undefined>;
}

export class JobManager implements IJobManager {

  async createJob(videoId: string, sessionId: string): Promise<string> {
    const jobData: InsertVideoJob = {
      videoId,
      sessionId,
      status: 'pending',
      progress: 0,
      currentStage: 'Initializing...',
    };

    const job = await storage.createVideoJob(jobData);
    
    // Update video with job ID and status
    await storage.updateVideo(videoId, { 
      jobId: job.id,
      processingStatus: 'pending'
    });

    return job.id;
  }

  async getJob(jobId: string): Promise<VideoJob | undefined> {
    return await storage.getVideoJob(jobId);
  }

  async getJobByVideoId(videoId: string): Promise<VideoJob | undefined> {
    // This method would need to be added to storage interface if needed
    const video = await storage.getVideo(videoId);
    if (video?.jobId) {
      return await storage.getVideoJob(video.jobId);
    }
    return undefined;
  }

  async updateJobProgress(jobId: string, progress: number, stage: string): Promise<void> {
    await storage.updateVideoJobProgress(jobId, progress, stage);

    // Also update video processing status
    const job = await this.getJob(jobId);
    if (job) {
      await storage.updateVideo(job.videoId, { 
        processingStatus: progress < 100 ? 'processing' : 'processing' 
      });
    }
  }

  async completeJob(jobId: string): Promise<void> {
    await storage.updateVideoJobStatus(jobId, 'completed');

    // Update video processing status
    const job = await this.getJob(jobId);
    if (job) {
      await storage.updateVideo(job.videoId, { processingStatus: 'completed' });
    }
  }

  async failJob(jobId: string, error: string): Promise<void> {
    await storage.updateVideoJobStatus(jobId, 'failed', error);

    // Update video processing status
    const job = await this.getJob(jobId);
    if (job) {
      await storage.updateVideo(job.videoId, { processingStatus: 'failed' });
    }
  }

  async retryJob(jobId: string): Promise<void> {
    await storage.updateVideoJobStatus(jobId, 'pending');

    // Update video processing status
    const job = await this.getJob(jobId);
    if (job) {
      await storage.updateVideo(job.videoId, { processingStatus: 'pending' });
    }
  }
}