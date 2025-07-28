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
  // In a real implementation, you would use FFmpeg to extract thumbnails
  // For now, return mock thumbnail data
  return Promise.resolve([
    'thumbnail1.jpg',
    'thumbnail2.jpg', 
    'thumbnail3.jpg',
    'thumbnail4.jpg',
    'thumbnail5.jpg'
  ]);
}

export function getVideoMetadata(videoBuffer: Buffer, filename: string): {
  duration: number;
  format: string;
  size: number;
} {
  // In a real implementation, you would use FFmpeg to extract metadata
  // For now, return mock metadata
  const ext = path.extname(filename).toLowerCase().slice(1);
  
  return {
    duration: Math.floor(Math.random() * 300) + 60, // Random duration between 1-6 minutes
    format: ext.toUpperCase(),
    size: videoBuffer.length,
  };
}

export function extractVideoFrame(videoBuffer: Buffer, timeOffset: number = 0): Promise<string> {
  // In a real implementation, you would use FFmpeg to extract a frame at the specified time
  // For now, return a base64 encoded placeholder
  const placeholder = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  return Promise.resolve(placeholder.toString('base64'));
}
