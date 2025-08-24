import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoProcessor } from '../video-processor';
import { JobManager } from '../job-manager';
import { storage } from '../../storage';
import { analyzeVideoFrames, analyzeKeyFrames, transcribeFrameBatch } from '../openai';
import { AnalysisService } from '../analysis-service';
import { extractVideoFrames } from '../../utils/frame-extractor';
import fs from 'fs';

// Mock all dependencies
vi.mock('../job-manager');
vi.mock('../../storage');
vi.mock('../openai');
vi.mock('../analysis-service');
vi.mock('../../utils/frame-extractor');
vi.mock('fs');

describe('VideoProcessor with Frame Importance', () => {
  let processor: VideoProcessor;
  let mockJobManager: any;

  beforeEach(() => {
    mockJobManager = {
      updateJobProgress: vi.fn().mockResolvedValue(undefined),
      completeJob: vi.fn().mockResolvedValue(undefined),
      failJob: vi.fn().mockResolvedValue(undefined),
    };
    
    // Mock JobManager constructor to return our mock instance
    vi.mocked(JobManager).mockImplementation(() => mockJobManager as any);
    
    // Create processor after mocking
    processor = new VideoProcessor();
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('processVideo with frame importance scoring', () => {
    it('should use high-score frames for summary/key points and all frames for transcription', async () => {
      const videoId = 'test-video-123';
      const jobId = 'job-456';
      
      // Mock video data
      const mockVideo = {
        id: videoId,
        originalName: 'test-video.mp4',
        filePath: '/tmp/uploads/test-video.mp4',
      };
      
      // Mock frames with varying importance scores
      const mockFrames = [
        { frameNumber: 0, timestamp: 0.1, filePath: '/tmp/frame_000.jpg', fileName: 'frame_000.jpg', score: 0.95 },
        { frameNumber: 1, timestamp: 1.0, filePath: '/tmp/frame_001.jpg', fileName: 'frame_001.jpg', score: 0.15 },
        { frameNumber: 2, timestamp: 2.0, filePath: '/tmp/frame_002.jpg', fileName: 'frame_002.jpg', score: 0.85 },
        { frameNumber: 3, timestamp: 3.0, filePath: '/tmp/frame_003.jpg', fileName: 'frame_003.jpg', score: 0.25 },
        { frameNumber: 4, timestamp: 4.0, filePath: '/tmp/frame_004.jpg', fileName: 'frame_004.jpg', score: 0.75 },
        { frameNumber: 5, timestamp: 5.0, filePath: '/tmp/frame_005.jpg', fileName: 'frame_005.jpg', score: 0.10 },
        { frameNumber: 6, timestamp: 6.0, filePath: '/tmp/frame_006.jpg', fileName: 'frame_006.jpg', score: 0.65 },
        { frameNumber: 7, timestamp: 7.0, filePath: '/tmp/frame_007.jpg', fileName: 'frame_007.jpg', score: 0.20 },
        { frameNumber: 8, timestamp: 8.0, filePath: '/tmp/frame_008.jpg', fileName: 'frame_008.jpg', score: 0.55 },
        { frameNumber: 9, timestamp: 9.0, filePath: '/tmp/frame_009.jpg', fileName: 'frame_009.jpg', score: 0.30 },
        { frameNumber: 10, timestamp: 10.0, filePath: '/tmp/frame_010.jpg', fileName: 'frame_010.jpg', score: 0.90 },
        { frameNumber: 11, timestamp: 11.0, filePath: '/tmp/frame_011.jpg', fileName: 'frame_011.jpg', score: 0.45 },
      ];
      
      // Setup mocks
      (storage.getVideo as any).mockResolvedValue(mockVideo);
      
      (extractVideoFrames as any).mockResolvedValue({
        success: true,
        frames: mockFrames,
        totalFrames: mockFrames.length,
        duration: 12.0,
      });
      
      (fs.readFileSync as any).mockReturnValue(Buffer.from('fake-base64-data'));
      
      // Mock OpenAI responses for the new split functions
      const mockKeyFrameAnalysis = {
        summary: 'Video summary from important frames',
        keyPoints: ['Key point 1', 'Key point 2'],
        topics: ['Topic A', 'Topic B'],
        sentiment: 'positive',
        visualElements: ['Element 1', 'Element 2'],
      };
      
      const mockTranscriptionBatch = {
        transcription: ['[00:00] Frame desc', '[00:01] Frame desc'],
      };
      
      (analyzeKeyFrames as any).mockResolvedValue(mockKeyFrameAnalysis);
      (transcribeFrameBatch as any).mockResolvedValue(mockTranscriptionBatch);
      
      (AnalysisService.saveAnalysis as any).mockResolvedValue(undefined);
      (storage.updateVideo as any).mockResolvedValue(undefined);
      
      // Execute
      await processor.processVideo(videoId, jobId, 'en');
      
      // Verify frame selection logic with new split functions
      const keyFrameCallArgs = (analyzeKeyFrames as any).mock.calls;
      const transcribeCallArgs = (transcribeFrameBatch as any).mock.calls;
      
      // analyzeKeyFrames should be called once with top 10 frames by score
      expect(keyFrameCallArgs).toHaveLength(1);
      expect(keyFrameCallArgs[0][0]).toHaveLength(10); // Top 10 important frames
      
      // Check that frames are sorted by timestamp (chronological) in key frame analysis
      const keyFrameTimestamps = keyFrameCallArgs[0][0].map((f: any) => f.timestamp);
      const sortedTimestamps = [...keyFrameTimestamps].sort((a, b) => a - b);
      expect(keyFrameTimestamps).toEqual(sortedTimestamps);
      
      // transcribeFrameBatch calls should cover all frames
      let totalTranscriptionFrames = 0;
      for (const call of transcribeCallArgs) {
        totalTranscriptionFrames += call[0].length; // First arg is frame data
      }
      expect(totalTranscriptionFrames).toBe(mockFrames.length);
      
      // Verify analysis was saved with correct structure
      expect(AnalysisService.saveAnalysis).toHaveBeenCalledWith(
        videoId,
        expect.objectContaining({
          summary: mockKeyFrameAnalysis.summary,
          keyPoints: mockKeyFrameAnalysis.keyPoints,
          topics: expect.arrayContaining(mockKeyFrameAnalysis.topics),
          sentiment: mockKeyFrameAnalysis.sentiment,
          visualElements: mockKeyFrameAnalysis.visualElements,
          transcription: expect.any(Array), // Should have all transcriptions
        })
      );
      
      // Verify job was completed successfully
      expect(mockJobManager.completeJob).toHaveBeenCalledWith(jobId);
      expect(mockJobManager.failJob).not.toHaveBeenCalled();
    });

    it('should handle videos with fewer than 10 frames', async () => {
      const videoId = 'test-video-small';
      const jobId = 'job-small';
      
      const mockVideo = {
        id: videoId,
        originalName: 'small-video.mp4',
        filePath: '/tmp/uploads/small-video.mp4',
      };
      
      // Only 5 frames
      const mockFrames = [
        { frameNumber: 0, timestamp: 0.1, filePath: '/tmp/frame_000.jpg', fileName: 'frame_000.jpg', score: 0.95 },
        { frameNumber: 1, timestamp: 1.0, filePath: '/tmp/frame_001.jpg', fileName: 'frame_001.jpg', score: 0.15 },
        { frameNumber: 2, timestamp: 2.0, filePath: '/tmp/frame_002.jpg', fileName: 'frame_002.jpg', score: 0.85 },
        { frameNumber: 3, timestamp: 3.0, filePath: '/tmp/frame_003.jpg', fileName: 'frame_003.jpg', score: 0.25 },
        { frameNumber: 4, timestamp: 4.0, filePath: '/tmp/frame_004.jpg', fileName: 'frame_004.jpg', score: 0.75 },
      ];
      
      (storage.getVideo as any).mockResolvedValue(mockVideo);
      
      (extractVideoFrames as any).mockResolvedValue({
        success: true,
        frames: mockFrames,
        totalFrames: mockFrames.length,
        duration: 5.0,
      });
      
      (fs.readFileSync as any).mockReturnValue(Buffer.from('fake-base64-data'));
      
      (analyzeKeyFrames as any).mockResolvedValue({
        summary: 'Small video summary',
        keyPoints: ['Point 1'],
        topics: ['Topic'],
        sentiment: 'neutral',
        visualElements: ['Element'],
      });
      
      (transcribeFrameBatch as any).mockResolvedValue({
        transcription: ['[00:00] Desc'],
      });
      
      (AnalysisService.saveAnalysis as any).mockResolvedValue(undefined);
      (storage.updateVideo as any).mockResolvedValue(undefined);
      
      await processor.processVideo(videoId, jobId, 'en');
      
      // Should use all 5 frames for important frame analysis
      const keyFrameCallArgs = (analyzeKeyFrames as any).mock.calls;
      expect(keyFrameCallArgs[0][0]).toHaveLength(5);
      
      expect(mockJobManager.completeJob).toHaveBeenCalledWith(jobId);
    });

    it('should maintain chronological order in important frames', async () => {
      const videoId = 'test-video-order';
      const jobId = 'job-order';
      
      const mockVideo = {
        id: videoId,
        originalName: 'order-video.mp4',
        filePath: '/tmp/uploads/order-video.mp4',
      };
      
      // Frames with scores that would change order
      const mockFrames = Array.from({ length: 15 }, (_, i) => ({
        frameNumber: i,
        timestamp: i * 1.0,
        filePath: `/tmp/frame_${i.toString().padStart(3, '0')}.jpg`,
        fileName: `frame_${i.toString().padStart(3, '0')}.jpg`,
        score: Math.random(), // Random scores
      }));
      
      (storage.getVideo as any).mockResolvedValue(mockVideo);
      (extractVideoFrames as any).mockResolvedValue({
        success: true,
        frames: mockFrames,
        totalFrames: mockFrames.length,
        duration: 15.0,
      });
      
      (fs.readFileSync as any).mockReturnValue(Buffer.from('fake-base64-data'));
      
      (analyzeKeyFrames as any).mockResolvedValue({
        summary: 'Summary',
        keyPoints: [],
        topics: [],
        sentiment: 'neutral',
        visualElements: [],
      });
      
      (transcribeFrameBatch as any).mockResolvedValue({
        transcription: [],
      });
      
      (AnalysisService.saveAnalysis as any).mockResolvedValue(undefined);
      (storage.updateVideo as any).mockResolvedValue(undefined);
      
      await processor.processVideo(videoId, jobId, 'en');
      
      // Get the frames sent to analyzeKeyFrames call
      const keyFrameCallArgs = (analyzeKeyFrames as any).mock.calls;
      const importantFrames = keyFrameCallArgs[0][0];
      
      // Verify they are in chronological order
      for (let i = 1; i < importantFrames.length; i++) {
        expect(importantFrames[i].timestamp).toBeGreaterThan(importantFrames[i - 1].timestamp);
      }
      
      expect(mockJobManager.completeJob).toHaveBeenCalledWith(jobId);
    });
  });
});
