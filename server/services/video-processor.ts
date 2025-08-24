import { JobManager } from "./job-manager";
import { storage } from "../storage";
import { analyzeVideoFrames, type VideoAnalysis } from "./openai";
import { AnalysisService } from "./analysis-service";
import { extractVideoFrames, type FrameExtractionResult } from "../utils/frame-extractor";
import fs from 'fs';
import path from 'path';

export interface IVideoProcessor {
  processVideo(videoId: string, jobId: string, userLanguage?: string): Promise<void>;
}

export class VideoProcessor implements IVideoProcessor {
  private jobManager: JobManager;

  constructor() {
    this.jobManager = new JobManager();
  }

  async processVideo(videoId: string, jobId: string, userLanguage: string = 'en'): Promise<void> {
    try {
      console.log(`🚀 Starting background processing for video ${videoId}, job ${jobId}`);

      const video = await storage.getVideo(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      await this.jobManager.updateJobProgress(jobId, 10, 'Reading file and generating metadata...');
      
      const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
      const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);

      await this.jobManager.updateJobProgress(jobId, 30, 'Extracting frames from video...');
      
      const frameExtractionResult = await extractVideoFrames({
        videoPath: video.filePath,
        outputDir: framesDir,
        maxFrames: 100
      });
      
      if (!frameExtractionResult.success || frameExtractionResult.frames.length === 0) {
        throw new Error(`Frame extraction failed or produced no frames. Error: ${frameExtractionResult.error}`);
      }

      await this.jobManager.updateJobProgress(jobId, 40, `Frame extraction complete: ${frameExtractionResult.frames.length} frames`);

      await this.jobManager.updateJobProgress(jobId, 50, 'Preparing AI analysis...');
      
      const framesToAnalyze = frameExtractionResult.frames;
      await this.jobManager.updateJobProgress(jobId, 60, `Analyzing ${framesToAnalyze.length} frames with AI...`);

      const batchSize = 10;
      let allKeyPoints: string[] = [];
      let allTopics: string[] = [];
      let allVisualElements: string[] = [];
      let allTranscriptions: string[] = [];
      let summary = "";

      for (let i = 0; i < framesToAnalyze.length; i += batchSize) {
        const batch = framesToAnalyze.slice(i, i + batchSize);
        const frameData = batch.map(frame => ({
          base64: fs.readFileSync(frame.filePath).toString('base64'),
          timestamp: frame.timestamp
        }));

        const analysisBatch = await analyzeVideoFrames(frameData, userLanguage);
        
        if (i === 0) summary = analysisBatch.summary;
        allKeyPoints.push(...analysisBatch.keyPoints);
        allTopics.push(...analysisBatch.topics);
        allVisualElements.push(...analysisBatch.visualElements);
        allTranscriptions.push(...analysisBatch.transcription);
      }

      const analysis: VideoAnalysis = {
        summary,
        keyPoints: allKeyPoints,
        topics: [...new Set(allTopics)],
        sentiment: 'neutral',
        visualElements: allVisualElements,
        transcription: allTranscriptions
      };

      await this.jobManager.updateJobProgress(jobId, 80, 'AI analysis complete');

      await this.jobManager.updateJobProgress(jobId, 90, 'Saving analysis to database...');

      await AnalysisService.saveAnalysis(videoId, analysis);
      
      await storage.updateVideo(videoId, {
        duration: Math.round(frameExtractionResult.duration),
      });

      await this.jobManager.completeJob(jobId);
      console.log(`🎉 Background processing completed successfully! Video ID: ${videoId}`);

    } catch (error) {
      console.error(`💥 Background processing error for video ${videoId}:`, error);
      await this.jobManager.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}
