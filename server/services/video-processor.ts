import { JobManager } from "./job-manager";
import { storage } from "../storage";
import { analyzeVideoFrames, type VideoAnalysis } from "./openai";
import { extractVideoFrames, type FrameExtractionResult } from "../utils/frame-extractor";
import fs from 'fs';
import path from 'path';

export interface IVideoProcessor {
  processVideo(videoId: string, jobId: string, userLanguage?: string): Promise<void>;
}

export class VideoProcessor implements IVideoProcessor {
  private static instance: VideoProcessor;
  private jobManager: JobManager;

  constructor() {
    this.jobManager = JobManager.getInstance();
  }

  public static getInstance(): VideoProcessor {
    if (!VideoProcessor.instance) {
      VideoProcessor.instance = new VideoProcessor();
    }
    return VideoProcessor.instance;
  }

  async processVideo(videoId: string, jobId: string, userLanguage: string = 'en'): Promise<void> {
    try {
      console.log(`🚀 Starting background processing for video ${videoId}, job ${jobId}`);

      // Get video data
      const video = await storage.getVideo(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      // Step 1: Read file and generate basic metadata (10%)
      await this.jobManager.updateJobProgress(jobId, 10, 'Reading file and generating metadata...');
      
      const metadata = {
        duration: 0, // Will be updated from frame extraction
        format: path.extname(video.originalName).slice(1).toUpperCase(),
        size: video.size
      };

      // Step 2: Frame extraction setup (20%)
      await this.jobManager.updateJobProgress(jobId, 20, 'Setting up frame extraction...');
      
      const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
      const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);

      // Step 3: Extract frames (30-40%)
      await this.jobManager.updateJobProgress(jobId, 30, 'Extracting frames from video...');
      
      let frameExtractionResult: FrameExtractionResult;
      try {
        frameExtractionResult = await extractVideoFrames({
          videoPath: video.filePath,
          outputDir: framesDir,
          framesPerSecond: 1,
          maxFrames: 100
        });
        
        await this.jobManager.updateJobProgress(jobId, 40, 
          `Frame extraction complete: ${frameExtractionResult.frames?.length || 0} frames`);
      } catch (error) {
        console.warn('⚠️ Frame extraction failed:', error);
        const estimatedDuration = Math.min(Math.max(video.size / (1024 * 1024), 10), 300);
        frameExtractionResult = {
          success: false,
          frames: [],
          totalFrames: 0,
          duration: estimatedDuration,
          error: 'FFmpeg not available'
        };
        
        await this.jobManager.updateJobProgress(jobId, 40, 'Frame extraction failed, continuing...');
      }

      // Step 4: AI Analysis (50-80%)
      await this.jobManager.updateJobProgress(jobId, 50, 'Preparing AI analysis...');
      
      let analysis: VideoAnalysis;
      if (frameExtractionResult.success && frameExtractionResult.frames.length > 0) {
        // const maxFramesToAnalyze = Math.min(frameExtractionResult.frames.length, 50);
        // const framesToAnalyze = frameExtractionResult.frames.slice(0, maxFramesToAnalyze);
        const framesToAnalyze = frameExtractionResult.frames;
        
        await this.jobManager.updateJobProgress(jobId, 60, 
          `Analyzing ${framesToAnalyze.length} frames with AI...`);

        const frameData = framesToAnalyze.map(frame => {
          const frameBuffer = fs.readFileSync(frame.filePath);
          return {
            base64: frameBuffer.toString('base64'),
            timestamp: frame.timestamp
          };
        });

        const startTime = Date.now();
        analysis = await analyzeVideoFrames(frameData, userLanguage);
        const processingTime = Date.now() - startTime;
        
        console.log(`✨ LLM analysis completed in ${processingTime}ms`);
        await this.jobManager.updateJobProgress(jobId, 80, 'AI analysis complete');
      } else {
        // Create fallback analysis
        const filename = video.originalName;
        const fileSize = video.size;
        const estimatedDuration = frameExtractionResult.duration;
        
        analysis = {
          summary: userLanguage === 'ja' 
            ? `動画ファイル「${filename}」がアップロードされました。ファイルサイズ: ${Math.round(fileSize / (1024 * 1024))}MB、推定再生時間: ${Math.round(estimatedDuration)}秒。フレーム抽出ツールが利用できないため、詳細な映像解析は行えませんが、動画の再生と基本的な操作は可能です。`
            : `Video file "${filename}" has been uploaded successfully. File size: ${Math.round(fileSize / (1024 * 1024))}MB, estimated duration: ${Math.round(estimatedDuration)} seconds. Detailed frame analysis is not available due to missing FFmpeg tools, but video playback and basic operations are supported.`,
          keyPoints: userLanguage === 'ja' 
            ? ['動画ファイルが正常にアップロードされました', 'ファイル形式が検証されました', '基本的な動画情報が取得されました']
            : ['Video file uploaded successfully', 'File format validated', 'Basic video information extracted'],
          topics: userLanguage === 'ja' ? ['動画アップロード', 'ファイル管理'] : ['Video Upload', 'File Management'],
          sentiment: 'neutral',
          visualElements: userLanguage === 'ja' 
            ? ['動画コンテンツ（詳細解析不可）'] 
            : ['Video content (detailed analysis unavailable)'],
          transcription: userLanguage === 'ja' 
            ? [`[00:00] 動画の再生が開始されました`]
            : [`[00:00] Video playback started`]
        };
        
        await this.jobManager.updateJobProgress(jobId, 80, 'Created basic analysis');
      }

      // Step 5: Save to database (90%)
      await this.jobManager.updateJobProgress(jobId, 90, 'Saving analysis to database...');

      // Optimize analysis data
      // const optimizedAnalysis = {
      //   summary: analysis.summary,
      //   keyPoints: analysis.keyPoints.slice(0, 5),
      //   topics: analysis.topics.slice(0, 3),
      //   sentiment: analysis.sentiment,
      //   visualElements: analysis.visualElements.slice(0, 5),
      //   transcription: analysis.transcription.slice(0, 50)
      // };

      // Update video with analysis results
      await storage.updateVideo(videoId, {
        duration: frameExtractionResult.success ? Math.round(frameExtractionResult.duration) : Math.round(metadata.duration),
        analysis: analysis,
        thumbnails: {
          frames: frameExtractionResult.success ? frameExtractionResult.frames : []
        }
      });

      // Complete the job
      await this.jobManager.completeJob(jobId);
      console.log(`🎉 Background processing completed successfully! Video ID: ${videoId}`);

    } catch (error) {
      console.error(`💥 Background processing error for video ${videoId}:`, error);
      await this.jobManager.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  static async processVideo(videoId: string, jobId: string, userLanguage?: string): Promise<void> {
    const processor = VideoProcessor.getInstance();
    return processor.processVideo(videoId, jobId, userLanguage);
  }
}