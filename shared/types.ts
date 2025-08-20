// Extended types for frame extraction
export interface ExtractedFrame {
  frameNumber: number;
  timestamp: number;
  filePath: string;
  fileName: string;
}

export interface VideoThumbnails {
  frames?: ExtractedFrame[];
  [key: string]: any; // Allow for existing thumbnail data
}

// Extend the Video type to include proper thumbnails typing
export interface VideoWithFrames {
  id: string;
  sessionId: string;
  filename: string;
  originalName: string;
  filePath: string;
  size: number;
  duration: number | null;
  format: string;
  uploadedAt: Date;
  processingStatus?: string | null;
  jobId?: string | null;
  summary?: string | null;
  sentiment?: string | null;
  thumbnails?: VideoThumbnails;
}