import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';

// Configure multer for video uploads
const storage = multer.memoryStorage();

export const videoUpload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  },
});

export function generateThumbnails(videoBuffer: Buffer): Promise<string[]> {
  // This function is deprecated - thumbnails are now generated via frame extraction
  // in the upload route using FFmpeg. This returns empty array to maintain compatibility
  return Promise.resolve([]);
}

export function getVideoMetadata(videoBuffer: Buffer, filename: string): {
  duration: number;
  format: string;
  size: number;
} {
  // This function provides fallback metadata - actual duration comes from FFmpeg frame extraction
  // The upload route now uses the real duration from frame extraction results
  const ext = path.extname(filename).toLowerCase().slice(1);
  
  return {
    duration: 0, // Placeholder - real duration comes from frame extraction
    format: ext.toUpperCase(),
    size: videoBuffer.length,
  };
}

export async function extractVideoFrame(videoBuffer: Buffer, timeOffset: number = 0): Promise<string> {
  // This function is deprecated - frame extraction now happens via FFmpeg in frame-extractor.ts
  // This is only used as a fallback if FFmpeg frame extraction fails
  throw new Error('Frame extraction fallback not implemented - use FFmpeg frame extraction instead');
}
