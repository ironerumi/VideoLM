import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface FrameExtractionOptions {
  videoPath: string;
  outputDir: string;
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

interface FrameCandidate {
  timestamp: number;
  score: number;
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
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
 * Get ALL scene change scores using a low threshold
 * We'll filter adaptively based on score distribution later
 */
async function getAllFrameScores(videoPath: string): Promise<FrameCandidate[]> {
  return new Promise((resolve, reject) => {
    // Use very low threshold to capture ALL potential scene changes
    // We'll select the best ones adaptively based on distribution
    const args = [
      '-nostats',
      '-i', videoPath,
      '-vf', `select='gte(scene,0.01)',metadata=print`,
      '-an', '-f', 'null', '-'
    ];

    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';  // Metadata goes to stderr, not stdout!

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      const candidates: FrameCandidate[] = [];
      
      // Parse metadata from stderr
      const lines = stderr.split('\n');
      let currentTimestamp: number | null = null;
      
      for (const line of lines) {
        // Get timestamp
        const timeMatch = line.match(/pts_time:(\d+\.?\d*)/);  
        if (timeMatch) {
          currentTimestamp = parseFloat(timeMatch[1]);
        }
        
        // Get score - it comes on the next line after timestamp
        const scoreMatch = line.match(/lavfi\.scene_score=(\d+\.?\d*)/);
        if (scoreMatch && currentTimestamp !== null) {
          const score = parseFloat(scoreMatch[1]);
          // Store ALL scores, we'll filter adaptively later
          candidates.push({
            timestamp: currentTimestamp,
            score: score
          });
          currentTimestamp = null;
        }
      }
      
      resolve(candidates);
    });

    ffmpeg.on('error', reject);
  });
}

/**
 * Adaptively select frames to maximize coverage up to maxFrames
 * Uses dynamic threshold based on score distribution
 */
function selectFramesAdaptively(candidates: FrameCandidate[], maxFrames: number): number[] {
  if (candidates.length === 0) {
    return [];
  }

  // Sort by score descending
  const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
  
  // Calculate dynamic threshold
  let threshold: number;
  
  if (sortedCandidates.length <= maxFrames) {
    // If we have fewer candidates than max, take them all (with min threshold)
    threshold = 0.01;
    console.log(`Using all ${sortedCandidates.length} candidates (below max ${maxFrames})`);
  } else {
    // Dynamic threshold selection:
    // 1. If we have way too many frames, use top percentile
    // 2. Otherwise use statistical approach
    
    if (sortedCandidates.length > maxFrames * 3) {
      // Way too many - use percentile approach
      // Take top N*1.5 to allow for temporal filtering
      const targetIndex = Math.floor(maxFrames * 1.5);
      threshold = sortedCandidates[Math.min(targetIndex, sortedCandidates.length - 1)].score;
      console.log(`Percentile threshold: ${threshold.toFixed(4)} (top ${targetIndex} of ${sortedCandidates.length})`);
    } else {
      // Use mean - 0.5*stddev for moderate filtering
      const scores = sortedCandidates.map(c => c.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
      const stdDev = Math.sqrt(variance);
      threshold = Math.max(0.01, mean - 0.5 * stdDev);
      console.log(`Statistical threshold: ${threshold.toFixed(4)} (mean=${mean.toFixed(4)}, std=${stdDev.toFixed(4)})`);
    }
  }
  
  // Filter by adaptive threshold
  const significantCandidates = sortedCandidates.filter(c => c.score >= threshold);
  console.log(`${significantCandidates.length} frames pass threshold ${threshold.toFixed(4)}`);
  
  // Select frames with temporal spacing
  const selectedTimestamps: number[] = [];
  const selectedTimes: Set<number> = new Set();
  const minTimeDiff = 0.5; // Min 0.5 seconds between frames

  for (const candidate of significantCandidates) {
    if (selectedTimestamps.length >= maxFrames) {
      break;
    }

    // Check temporal spacing
    let isTooClose = false;
    for (const time of selectedTimes) {
      if (Math.abs(candidate.timestamp - time) < minTimeDiff) {
        isTooClose = true;
        break;
      }
    }

    if (!isTooClose) {
      selectedTimestamps.push(candidate.timestamp);
      selectedTimes.add(candidate.timestamp);
    }
  }

  // Ensure we have good coverage:
  // If we have very few frames, lower threshold and try again
  if (selectedTimestamps.length < Math.min(10, maxFrames / 10) && candidates.length > selectedTimestamps.length) {
    console.log(`Only ${selectedTimestamps.length} frames selected, relaxing constraints...`);
    // Take top N frames with just temporal spacing
    selectedTimestamps.length = 0;
    selectedTimes.clear();
    
    for (const candidate of sortedCandidates) {
      if (selectedTimestamps.length >= maxFrames) {
        break;
      }
      
      let isTooClose = false;
      for (const time of selectedTimes) {
        if (Math.abs(candidate.timestamp - time) < minTimeDiff) {
          isTooClose = true;
          break;
        }
      }
      
      if (!isTooClose) {
        selectedTimestamps.push(candidate.timestamp);
        selectedTimes.add(candidate.timestamp);
      }
    }
  }

  return selectedTimestamps.sort((a, b) => a - b);
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
      '-ss', timestamp.toString(),
      '-i', videoPath,
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

    // Get ALL scene changes with low threshold
    console.log(`Analyzing scene changes...`);
    const candidates = await getAllFrameScores(videoPath);
    console.log(`Found ${candidates.length} total scene changes.`);

    // Adaptively select best frames based on score distribution
    const selectedTimestamps = selectFramesAdaptively(candidates, maxFrames);
    console.log(`Adaptively selected ${selectedTimestamps.length} frames for extraction.`);

    const frames: ExtractedFrame[] = [];
    let frameNumber = 0;

    for (const timestamp of selectedTimestamps) {
      const frameFileName = `frame_${frameNumber.toString().padStart(3, '0')}_${timestamp.toFixed(1)}s.jpg`;
      const framePath = path.join(outputDir, frameFileName);
      
      const success = await extractFrameAtTime(videoPath, timestamp, framePath);
      
      if (success) {
        frames.push({
          frameNumber: frameNumber,
          timestamp: timestamp,
          filePath: framePath,
          fileName: frameFileName
        });
      }
      
      frameNumber++;
    }

    // If no frames were extracted, extract at least one frame from the beginning
    if (frames.length === 0 && duration > 0) {
        const frameFileName = `frame_000_0.1s.jpg`;
        const framePath = path.join(outputDir, frameFileName);
        const success = await extractFrameAtTime(videoPath, 0.1, framePath);
        if (success) {
            frames.push({
                frameNumber: 0,
                timestamp: 0.1,
                filePath: framePath,
                fileName: frameFileName
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
