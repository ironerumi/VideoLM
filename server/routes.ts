import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { VideoService } from "./services/video-service";
import { AnalysisService } from "./services/analysis-service";
import multer from 'multer';
import path from 'path';
import fs from 'fs';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
  sessionId: string;
}

export async function registerRoutes(app: Express): Promise<Server> {

  const videoStorage = multer.diskStorage({
    destination: (req: MulterRequest, file, cb) => {
      const sessionDir = path.join(process.cwd(), 'uploads', req.sessionId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
      cb(null, sessionDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const ext = path.extname(originalname);
      const name = path.basename(originalname, ext);
      const finalFilename = `${timestamp}-${name}${ext}`;
      cb(null, finalFilename);
    },
  });

  const upload = multer({ storage: videoStorage, limits: { fileSize: 100 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i;
    if (!allowedTypes.test(file.originalname)) {
      return cb(new Error('Invalid file type. Only video files are allowed.'));
    }
    cb(null, true);
  }});

  app.get("/api/videos", async (req: MulterRequest, res) => {
    try {
      const videos = await VideoService.getVideosBySessionId(req.sessionId);
      res.json(videos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.post("/api/videos/upload", upload.single('video'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }
      const userLanguage = req.headers['x-user-language'] as string || 'en';
      const result = await VideoService.handleUpload(req.file, req.sessionId, userLanguage);
      res.json(result);
    } catch (error) {
      console.error("💥 Upload error:", error);
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  app.get("/api/videos/:id/status", async (req: MulterRequest, res) => {
    try {
      const status = await VideoService.getVideoStatus(req.params.id, req.sessionId);
      res.json(status);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.get("/api/videos/:id", async (req: MulterRequest, res) => {
    try {
      const video = await VideoService.getVideoDetails(req.params.id, req.sessionId);
      res.json(video);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.get("/api/videos/:id/analysis", async (req: MulterRequest, res) => {
    try {
      await VideoService.getVideoDetails(req.params.id, req.sessionId);
      const analysis = await AnalysisService.getAnalysis(req.params.id);
      res.json(analysis);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.get("/api/videos/:id/frames", async (req: MulterRequest, res) => {
    try {
      const framesList = await VideoService.getVideoFrames(req.params.id, req.sessionId);
      res.json(framesList);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.get("/api/videos/:id/file", async (req: MulterRequest, res) => {
    try {
      const video = await VideoService.getVideoDetails(req.params.id, req.sessionId);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.sendFile(video.filePath);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.get("/api/videos/:id/frames/:frameName", async (req: MulterRequest, res) => {
    try {
      const framePath = await VideoService.getFrame(req.params.id, req.params.frameName, req.sessionId, req.query.session as string);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.sendFile(framePath);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/videos/:id", async (req: MulterRequest, res) => {
    try {
      await VideoService.deleteVideo(req.params.id, req.sessionId);
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.get("/api/videos/:id/chat", async (req: MulterRequest, res) => {
    try {
      const messages = await VideoService.getChatMessages(req.params.id, req.sessionId);
      res.json(messages);
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.delete("/api/videos/:id/chat", async (req: MulterRequest, res) => {
    try {
      await VideoService.deleteChatMessages(req.params.id, req.sessionId);
      res.json({ success: true, message: "Chat history cleared" });
    } catch (error) {
      res.status(404).json({ message: (error as Error).message });
    }
  });

  app.post("/api/videos/:id/chat", async (req: MulterRequest, res) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      const userLanguage = req.headers['x-user-language'] as string || 'en';
      const chatMessage = await VideoService.handleChatMessage(req.params.id, req.sessionId, message, userLanguage);
      res.json(chatMessage);
    } catch (error) {
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  app.post("/api/videos/summary", async (req: MulterRequest, res) => {
    try {
      const { videoIds } = req.body;
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ message: "Video IDs array is required" });
      }
      const userLanguage = req.headers['x-user-language'] as string || 'en';
      const summary = await VideoService.generateSummary(videoIds, req.sessionId, userLanguage);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/reset", async (req: MulterRequest, res) => {
    try {
      await VideoService.resetSession(req.sessionId);
      res.json({ message: "All data has been reset successfully" });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
