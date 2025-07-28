import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { videoUpload, generateThumbnails, getVideoMetadata, extractVideoFrame } from "./services/video";
import { analyzeVideoFrame, chatWithVideo, generateVideoSummary, type VideoAnalysis } from "./services/openai";
import { insertVideoSchema, insertChatMessageSchema } from "@shared/schema";
import { decodeFilename, encodeFilename, fixJapaneseEncoding } from "./utils/encoding";
import multer from 'multer';
import path from 'path';
import fs from 'fs';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
  sessionId: string;
}

// Configure multer to save files to session-specific directories
const sessionVideoUpload = multer({
  storage: multer.diskStorage({
    destination: async (req: MulterRequest, file, cb) => {
      const sessionDir = path.join(process.cwd(), 'uploads', req.sessionId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      cb(null, sessionDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      // Fix Japanese encoding and ensure proper UTF-8
      const decodedName = fixJapaneseEncoding(decodeFilename(file.originalname));
      const name = path.basename(decodedName, ext);
      cb(null, `${timestamp}-${encodeFilename(name)}${ext}`);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get videos for current session
  app.get("/api/videos", async (req: MulterRequest, res) => {
    try {
      const videos = await storage.getVideosBySessionId(req.sessionId);
      res.json(videos);
    } catch (error) {
      console.error('Error fetching videos:', error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  // Upload video
  app.post("/api/videos/upload", sessionVideoUpload.single('video'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }

      // Read the uploaded file for processing
      const fileBuffer = fs.readFileSync(req.file.path);
      const metadata = getVideoMetadata(fileBuffer, req.file.originalname);
      const thumbnails = await generateThumbnails(fileBuffer);
      
      // Extract a frame for AI analysis
      const frameBase64 = await extractVideoFrame(fileBuffer);
      const analysis = await analyzeVideoFrame(frameBase64);

      const videoData = {
        sessionId: req.sessionId,
        filename: req.file.filename,
        originalName: fixJapaneseEncoding(decodeFilename(req.file.originalname)),
        filePath: req.file.path,
        size: req.file.size,
        duration: metadata.duration,
        format: path.extname(req.file.originalname).slice(1),
        analysis,
        thumbnails,
      };

      const validation = insertVideoSchema.safeParse(videoData);
      if (!validation.success) {
        // Clean up uploaded file if validation fails
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Invalid video data", errors: validation.error.errors });
      }

      const video = await storage.createVideo(validation.data);
      res.json(video);
    } catch (error) {
      console.error("Upload error:", error);
      // Clean up uploaded file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  // Serve video files
  app.get("/api/videos/:id/file", async (req: MulterRequest, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video || video.sessionId !== req.sessionId) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      if (!fs.existsSync(video.filePath)) {
        return res.status(404).json({ message: "Video file not found" });
      }
      
      const stat = fs.statSync(video.filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(video.filePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(video.filePath).pipe(res);
      }
    } catch (error) {
      console.error('Error serving video file:', error);
      res.status(500).json({ message: "Failed to serve video file" });
    }
  });

  // Get video by ID
  app.get("/api/videos/:id", async (req: MulterRequest, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video || video.sessionId !== req.sessionId) {
        return res.status(404).json({ message: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  // Delete video
  app.delete("/api/videos/:id", async (req: MulterRequest, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video || video.sessionId !== req.sessionId) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Delete the file from filesystem
      if (fs.existsSync(video.filePath)) {
        fs.unlinkSync(video.filePath);
      }
      
      const deleted = await storage.deleteVideo(req.params.id);
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  // Get chat messages for a video
  app.get("/api/videos/:id/chat", async (req: MulterRequest, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video || video.sessionId !== req.sessionId) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      const messages = await storage.getChatMessagesByVideoId(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // Send chat message
  app.post("/api/videos/:id/chat", async (req: MulterRequest, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video || video.sessionId !== req.sessionId) {
        return res.status(404).json({ message: "Video not found" });
      }

      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Get chat history
      const chatHistory = await storage.getChatMessagesByVideoId(req.params.id);
      
      // Generate AI response
      const defaultAnalysis: VideoAnalysis = { summary: "", keyPoints: [], topics: [], sentiment: "neutral", visualElements: [] };
      const response = await chatWithVideo(
        message, 
        (video.analysis as VideoAnalysis) || defaultAnalysis,
        chatHistory.map(m => ({ message: m.message, response: m.response }))
      );

      const chatData = {
        sessionId: req.sessionId,
        videoId: req.params.id,
        message,
        response,
      };

      const validation = insertChatMessageSchema.safeParse(chatData);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid chat data", errors: validation.error.errors });
      }

      const chatMessage = await storage.createChatMessage(validation.data);
      res.json(chatMessage);
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Generate summary for selected videos
  app.post("/api/videos/summary", async (req: MulterRequest, res) => {
    try {
      const { videoIds } = req.body;
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ message: "Video IDs array is required" });
      }

      const videos = await Promise.all(
        videoIds.map(id => storage.getVideo(id))
      );

      // Filter videos to only include those belonging to current session
      const validVideos = videos.filter((v): v is NonNullable<typeof v> => 
        v !== undefined && v.sessionId === req.sessionId && v.analysis !== null
      );
      if (validVideos.length === 0) {
        return res.status(400).json({ message: "No analyzed videos found for your session" });
      }

      const analyses = validVideos.map(v => v.analysis as VideoAnalysis);
      const summary = await generateVideoSummary(analyses);

      res.json({ summary, videoCount: validVideos.length });
    } catch (error) {
      console.error("Summary error:", error);
      res.status(500).json({ message: "Failed to generate summary" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
