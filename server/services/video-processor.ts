import { JobManager } from "./job-manager";
import { storage } from "../storage";
import { analyzeVideoFrames, analyzeKeyFrames, transcribeFrameBatch, type VideoAnalysis, type KeyFrameAnalysis } from "./openai";
import { AnalysisService } from "./analysis-service";
import { extractVideoFrames } from "../utils/frame-extractor";
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
      
      const allFrames = frameExtractionResult.frames;
      
      // Select most important frames for high-level analysis (summary, key points, topics)
      // Sort by score descending and take top N frames
      const IMPORTANT_FRAME_COUNT = Math.min(10, allFrames.length);
      const importantFrames = [...allFrames]
        .sort((a, b) => b.score - a.score)
        .slice(0, IMPORTANT_FRAME_COUNT)
        .sort((a, b) => a.timestamp - b.timestamp); // Re-sort by timestamp for chronological order
      
      console.log(`Using ${importantFrames.length} most important frames (scores: ${importantFrames.map(f => f.score.toFixed(3)).join(', ')}) for high-level analysis`);
      console.log(`Using all ${allFrames.length} frames for transcription`);
      
      await this.jobManager.updateJobProgress(jobId, 60, `Analyzing ${allFrames.length} frames with AI...`);

      // Step 1: Analyze important frames for summary, key points, topics, visual elements
      const importantFrameData = importantFrames.map(frame => ({
        base64: fs.readFileSync(frame.filePath).toString('base64'),
        timestamp: frame.timestamp
      }));
      
      const highLevelAnalysis = await analyzeKeyFrames(importantFrameData, userLanguage);
      
      // Step 2: Process ALL frames in batches for complete transcription with context
      const batchSize = 35;
      let allTranscriptions: string[] = [];
      
      for (let i = 0; i < allFrames.length; i += batchSize) {
        const batch = allFrames.slice(i, i + batchSize);
        const frameData = batch.map(frame => ({
          base64: fs.readFileSync(frame.filePath).toString('base64'),
          timestamp: frame.timestamp
        }));

        const transcriptionBatch = await transcribeFrameBatch(frameData, highLevelAnalysis, userLanguage);
        allTranscriptions.push(...transcriptionBatch.transcription);
      }

      const analysis: VideoAnalysis = {
        summary: highLevelAnalysis.summary,
        keyPoints: highLevelAnalysis.keyPoints,
        topics: [...new Set(highLevelAnalysis.topics)],
        sentiment: highLevelAnalysis.sentiment || 'neutral',
        visualElements: highLevelAnalysis.visualElements,
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
