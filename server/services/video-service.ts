import { storage } from '../storage';
import { insertVideoSchema, insertChatMessageSchema, type Video } from '@shared/schema';
import { JobManager } from './job-manager';
import { VideoProcessor } from './video-processor';
import { chatWithVideo, generateVideoSummary, type VideoAnalysis } from "./openai";
import { AnalysisService } from './analysis-service';
import path from 'path';
import fs from 'fs';

export class VideoService {

  public static async handleUpload(file: Express.Multer.File, sessionId: string, userLanguage: string) {
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    console.log('🚀 Quick upload started:', originalname);

    const videoData = {
      sessionId: sessionId,
      filename: file.filename,
      originalName: originalname,
      filePath: file.path,
      size: file.size,
      duration: 0,
      format: path.extname(originalname).slice(1),
      processingStatus: 'pending',
      jobId: null,
    };

    const validation = insertVideoSchema.safeParse(videoData);
    if (!validation.success) {
      fs.unlinkSync(file.path);
      console.error("❌ Video validation failed:", validation.error.errors);
      throw new Error('Invalid video data');
    }

    const video = await storage.createVideo(validation.data);

    const jobManager = new JobManager();
    const jobId = await jobManager.createJob(video.id, sessionId);

    await storage.updateVideo(video.id, { jobId });

    const videoProcessor = new VideoProcessor();
    videoProcessor.processVideo(video.id, jobId, userLanguage).catch(error => {
      console.error(`Background processing failed for video ${video.id}:`, error);
    });

    console.log(`✅ Quick upload completed! Video ID: ${video.id}, Job ID: ${jobId}`);
    return {
      videoId: video.id,
      jobId: jobId,
      status: 'pending',
      message: 'Upload successful, processing started'
    };
  }

  public static async getVideoStatus(videoId: string, sessionId: string) {
    const video = await this.getVideoDetails(videoId, sessionId);

    if (!video.jobId) {
      return {
        jobId: null,
        status: video.processingStatus || 'completed',
        progress: 100,
        currentStage: 'Complete',
        errorMessage: null,
        videoReady: true
      };
    }

    const jobManager = new JobManager();
    const job = await jobManager.getJob(video.jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      errorMessage: job.errorMessage,
      videoReady: job.status === 'completed'
    };
  }

  public static async getVideoDetails(videoId: string, sessionId: string): Promise<Video> {
    const video = await storage.getVideo(videoId);
    if (!video || video.sessionId !== sessionId) {
      throw new Error('Video not found');
    }
    return video;
  }

  public static async getVideosBySessionId(sessionId: string): Promise<Video[]> {
    return await storage.getVideosBySessionId(sessionId);
  }

  public static async getVideoFrames(videoId: string, sessionId: string) {
    const video = await this.getVideoDetails(videoId, sessionId);
    
    const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
    const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);
    
    if (!fs.existsSync(framesDir)) {
      return { frames: [] };
    }
    
    const frameFiles = fs.readdirSync(framesDir).filter(file => file.endsWith('.jpg'));
    
    const frames = frameFiles.map(fileName => {
      // Parse different filename patterns
      let frameNumber, timestamp;
      
      // Pattern 1: frame_000_first.jpg
      let match = fileName.match(/frame_(\d+)_first\.jpg/);
      if (match) {
        frameNumber = parseInt(match[1]);
        timestamp = 0.1; // First frame is at 0.1s
        return { frameNumber, timestamp, fileName, filePath: path.join(framesDir, fileName) };
      }
      
      // Pattern 2: frame_nnn_last.jpg  
      match = fileName.match(/frame_(\d+)_last\.jpg/);
      if (match) {
        frameNumber = parseInt(match[1]);
        // For last frame, we'll use a high timestamp that will be sorted last
        timestamp = 999999; // Will be corrected by video duration in frontend
        return { frameNumber, timestamp, fileName, filePath: path.join(framesDir, fileName) };
      }
      
      // Pattern 3: frame_001_2.0s.jpg (intermediate frames)
      match = fileName.match(/frame_(\d+)_(\d+(?:\.\d+)?)s\.jpg/);
      if (match) {
        frameNumber = parseInt(match[1]);
        timestamp = parseFloat(match[2]);
        return { frameNumber, timestamp, fileName, filePath: path.join(framesDir, fileName) };
      }
      
      return null;
    }).filter(frame => frame !== null)
      .sort((a, b) => a!.timestamp - b!.timestamp);
    
    return { frames };
  }

  public static async getFrame(videoId: string, frameName: string, reqSessionId: string, querySessionId?: string) {
    const sessionId = reqSessionId || querySessionId;
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    const video = await this.getVideoDetails(videoId, sessionId);

    const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
    const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);
    let framePath = path.join(framesDir, frameName);

    if (!fs.existsSync(framePath)) {
      const frameNameParts = frameName.match(/^(frame_\d+_)(\d+)(s\.jpg)$/);
      if (frameNameParts) {
        const alternativeFrameName = `${frameNameParts[1]}${frameNameParts[2]}.0${frameNameParts[3]}`;
        const alternativeFramePath = path.join(framesDir, alternativeFrameName);
        if (fs.existsSync(alternativeFramePath)) {
          framePath = alternativeFramePath;
        }
      }
    }

    if (!framePath.startsWith(framesDir) || !fs.existsSync(framePath)) {
      throw new Error('Frame not found');
    }

    return framePath;
  }

  public static async deleteVideo(videoId: string, sessionId: string) {
    const video = await this.getVideoDetails(videoId, sessionId);

    if (video.jobId) {
      try {
        await storage.deleteVideoJob(video.jobId);
      } catch (error) {
        console.warn('Failed to delete video job:', error);
      }
    }

    if (fs.existsSync(video.filePath)) {
      fs.unlinkSync(video.filePath);
    }

    const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
    const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);
    if (fs.existsSync(framesDir)) {
      try {
        fs.rmSync(framesDir, { recursive: true, force: true });
      } catch (frameError) {
        console.warn('Failed to delete frames directory:', frameError);
      }
    }

    await storage.deleteChatMessagesByVideoId(videoId);
    await storage.deleteVideo(videoId);
  }

  public static async getChatMessages(videoId: string, sessionId: string) {
    await this.getVideoDetails(videoId, sessionId);
    return await storage.getChatMessagesByVideoId(videoId);
  }

  public static async deleteChatMessages(videoId: string, sessionId: string) {
    await this.getVideoDetails(videoId, sessionId);
    await storage.deleteChatMessagesByVideoId(videoId);
  }

  public static async handleChatMessage(videoId: string, sessionId: string, message: string, userLanguage: string) {
    const video = await this.getVideoDetails(videoId, sessionId);

    const chatHistory = await storage.getChatMessagesByVideoId(videoId);
    
    const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
    const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);
    let availableFrames: string[] = [];
    if (fs.existsSync(framesDir)) {
      availableFrames = fs.readdirSync(framesDir).filter(file => file.endsWith('.jpg'));
    }

    let analysisData: VideoAnalysis;
    try {
      const rawAnalysis = await AnalysisService.getAnalysis(videoId);
      analysisData = {
        summary: rawAnalysis.summary || "",
        keyPoints: rawAnalysis.keyPoints,
        topics: rawAnalysis.topics,
        sentiment: rawAnalysis.sentiment || "neutral",
        visualElements: rawAnalysis.visualElements,
        transcription: rawAnalysis.transcription
      };
    } catch (error) {
      analysisData = { summary: "", keyPoints: [], topics: [], sentiment: "neutral", visualElements: [], transcription: [] };
    }
    
    const aiResult = await chatWithVideo(
      message,
      analysisData,
      chatHistory.map(m => ({ message: m.message, response: m.response })),
      availableFrames,
      userLanguage
    );

    const chatData = {
      sessionId: sessionId,
      videoId: videoId,
      message,
      rephrasedQuestion: aiResult.rephrasedQuestion,
      response: aiResult.response,
      relevantFrame: aiResult.relevantFrame,
    };

    const validation = insertChatMessageSchema.safeParse(chatData);
    if (!validation.success) {
      throw new Error('Invalid chat data');
    }

    return await storage.createChatMessage(validation.data);
  }

  public static async generateSummary(videoIds: string[], sessionId: string, userLanguage: string) {
    const videos = await Promise.all(
      videoIds.map(id => this.getVideoDetails(id, sessionId).catch(() => null))
    );

    const validVideos = videos.filter((v): v is NonNullable<typeof v> => v !== null);

    if (validVideos.length === 0) {
      throw new Error('No videos found for your session');
    }

    const analyses = await Promise.all(
      validVideos.map(async (video) => {
        try {
          const rawAnalysis = await AnalysisService.getAnalysis(video.id);
          return {
            summary: rawAnalysis.summary || "",
            keyPoints: rawAnalysis.keyPoints,
            topics: rawAnalysis.topics,
            sentiment: rawAnalysis.sentiment || "neutral",
            visualElements: rawAnalysis.visualElements,
            transcription: rawAnalysis.transcription
          } as VideoAnalysis;
        } catch (error) {
          return null;
        }
      })
    );

    const validAnalyses = analyses.filter((a): a is VideoAnalysis => a !== null);
    
    if (validAnalyses.length === 0) {
      throw new Error('No analyzed videos found for your session');
    }

    const summary = await generateVideoSummary(validAnalyses, userLanguage);
    return { summary, videoCount: validAnalyses.length };
  }

  public static async resetSession(sessionId: string) {
    const videos = await storage.getVideosBySession(sessionId);
    for (const video of videos) {
      try {
        if (fs.existsSync(video.filePath)) {
          fs.unlinkSync(video.filePath);
        }
        const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
        const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);
        if (fs.existsSync(framesDir)) {
          fs.rmSync(framesDir, { recursive: true, force: true });
        }
      } catch (fileError) {
        console.warn(`Failed to delete files for video: ${video.id}`, fileError);
      }
    }
    const sessionDir = path.join(process.cwd(), 'uploads', sessionId);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (dirError) {
        console.warn(`Failed to delete session directory: ${sessionDir}`, dirError);
      }
    }
    await storage.clearSessionData(sessionId);
  }
}
