import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface FrameExtractionOptions {
  videoPath: string;
  outputDir: string;
  framesPerSecond?: number; // Default 1 frame per second
  maxFrames?: number; // Hard limit of 100 frames
}

export interface ExtractedFrame {
  frameNumber: number;
  timestamp: number; // in seconds
  filePath: string;
  fileName: string;
}

export interface FrameExtractionResult {
  success: boolean;
  frames: ExtractedFrame[];
  totalFrames: number;
  duration: number;
  error?: string;
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // Check if ffprobe is available
    const { spawn: spawnSync } = require('child_process');
    try {
      const testProbe = spawnSync('which', ['ffprobe']);
      testProbe.on('error', (error: any) => {
        if (error.code === 'ENOENT') {
          reject(new Error('ffprobe is not installed or not found in PATH. Please ensure FFmpeg is properly installed.'));
          return;
        }
      });
    } catch (error) {
      // Continue with original logic if 'which' command fails
    }

    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      videoPath
    ]);

    let output = '';
    let error = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      error += data.toString();
    });

    ffprobe.on('error', (error: any) => {
      if (error.code === 'ENOENT') {
        reject(new Error('ffprobe is not installed or not found in PATH. Please ensure FFmpeg is properly installed.'));
        return;
      }
      reject(error);
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${error}`));
        return;
      }

      const duration = parseFloat(output.trim());
      if (isNaN(duration)) {
        reject(new Error('Could not parse video duration'));
        return;
      }

      resolve(duration);
    });
  });
}

/**
 * Extract frame at specific timestamp
 */
async function extractFrameAtTime(
  videoPath: string, 
  timestamp: number, 
  outputPath: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', timestamp.toString(),
      '-vframes', '1',
      '-q:v', '2', // High quality
      '-y', // Overwrite output file
      outputPath
    ]);

    let error = '';

    ffmpeg.stderr.on('data', (data) => {
      error += data.toString();
    });

    ffmpeg.on('error', (error: any) => {
      if (error.code === 'ENOENT') {
        console.error('ffmpeg is not installed or not found in PATH. Please ensure FFmpeg is properly installed.');
        resolve(false);
        return;
      }
      console.error('ffmpeg error:', error);
      resolve(false);
    });

    ffmpeg.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Extract frames from video with configurable granularity
 */
export async function extractVideoFrames(options: FrameExtractionOptions): Promise<FrameExtractionResult> {
  const {
    videoPath,
    outputDir,
    framesPerSecond = 1,
    maxFrames = 100
  } = options;

  try {
    // Check if required tools are available
    const toolsAvailable = await checkFFmpegTools();
    if (!toolsAvailable) {
      return {
        success: false,
        frames: [],
        totalFrames: 0,
        duration: 0,
        error: 'FFmpeg tools (ffmpeg/ffprobe) are not available. Please ensure FFmpeg is properly installed.'
      };
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Get video duration
    const duration = await getVideoDuration(videoPath);
    console.log(`Video duration: ${duration} seconds`);

    // Calculate frame extraction strategy
    const interval = 1 / framesPerSecond; // seconds between frames
    const totalPossibleFrames = Math.floor(duration * framesPerSecond) + 2; // +2 for first and last
    
    // Determine actual extraction strategy
    let extractionInterval = interval;
    let estimatedFrames = totalPossibleFrames;

    // If we would exceed max frames, adjust the interval
    if (totalPossibleFrames > maxFrames) {
      // Adjust interval to fit within maxFrames (excluding first and last frame)
      extractionInterval = duration / (maxFrames - 2);
      estimatedFrames = maxFrames;
    }

    console.log(`Extracting ~${estimatedFrames} frames at ${extractionInterval.toFixed(2)}s intervals`);

    const frames: ExtractedFrame[] = [];
    let frameNumber = 0;

    // Extract first frame (at 0.1s to avoid black frames)
    const firstFramePath = path.join(outputDir, 'frame_000_first.jpg');
    const firstFrameSuccess = await extractFrameAtTime(videoPath, 0.1, firstFramePath);
    
    if (firstFrameSuccess) {
      frames.push({
        frameNumber: frameNumber++,
        timestamp: 0.1,
        filePath: firstFramePath,
        fileName: 'frame_000_first.jpg'
      });
    }

    // Extract intermediate frames
    let currentTime = extractionInterval;
    while (currentTime < duration - extractionInterval && frames.length < maxFrames - 1) {
      const frameFileName = `frame_${frameNumber.toString().padStart(3, '0')}_${currentTime.toFixed(1)}s.jpg`;
      const framePath = path.join(outputDir, frameFileName);
      
      const success = await extractFrameAtTime(videoPath, currentTime, framePath);
      
      if (success) {
        frames.push({
          frameNumber: frameNumber,
          timestamp: currentTime,
          filePath: framePath,
          fileName: frameFileName
        });
      }
      
      frameNumber++;
      currentTime += extractionInterval;
    }

    // Extract last frame
    if (frames.length < maxFrames && duration > 1) {
      const lastFrameTime = Math.max(duration - 0.5, duration * 0.95); // 0.5s before end or 95% through
      const lastFramePath = path.join(outputDir, `frame_${frameNumber.toString().padStart(3, '0')}_last.jpg`);
      const lastFrameSuccess = await extractFrameAtTime(videoPath, lastFrameTime, lastFramePath);
      
      if (lastFrameSuccess) {
        frames.push({
          frameNumber: frameNumber,
          timestamp: lastFrameTime,
          filePath: lastFramePath,
          fileName: `frame_${frameNumber.toString().padStart(3, '0')}_last.jpg`
        });
      }
    }

    console.log(`Successfully extracted ${frames.length} frames`);

    return {
      success: true,
      frames,
      totalFrames: frames.length,
      duration,
    };

  } catch (error) {
    console.error('Frame extraction failed:', error);
    return {
      success: false,
      frames: [],
      totalFrames: 0,
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if FFmpeg tools are available
 */
async function checkFFmpegTools(): Promise<boolean> {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    
    // Check ffprobe
    const testProbe = spawn('ffprobe', ['-version']);
    
    testProbe.on('error', (error: any) => {
      if (error.code === 'ENOENT') {
        console.error('ffprobe not found. FFmpeg tools are not available.');
        resolve(false);
        return;
      }
    });
    
    testProbe.on('close', (code) => {
      if (code === 0) {
        // ffprobe is available, now check ffmpeg
        const testMpeg = spawn('ffmpeg', ['-version']);
        
        testMpeg.on('error', (error: any) => {
          if (error.code === 'ENOENT') {
            console.error('ffmpeg not found. FFmpeg tools are not available.');
            resolve(false);
            return;
          }
        });
        
        testMpeg.on('close', (code) => {
          resolve(code === 0);
        });
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Clean up extracted frames
 */
export function cleanupFrames(outputDir: string): void {
  try {
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      for (const file of files) {
        if (file.startsWith('frame_') && file.endsWith('.jpg')) {
          fs.unlinkSync(path.join(outputDir, file));
        }
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup frames:', error);
  }
}