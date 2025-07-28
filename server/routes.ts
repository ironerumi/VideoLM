import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { videoUpload, generateThumbnails, getVideoMetadata, extractVideoFrame } from "./services/video";
import { analyzeVideoFrame, chatWithVideo, generateVideoSummary, type VideoAnalysis } from "./services/openai";
import { insertVideoSchema, insertChatMessageSchema } from "@shared/schema";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all videos
  app.get("/api/videos", async (req, res) => {
    try {
      const videos = await storage.getAllVideos();
      res.json(videos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  // Upload video
  app.post("/api/videos/upload", videoUpload.single('video'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const metadata = getVideoMetadata(req.file.buffer, req.file.originalname);
      const thumbnails = await generateThumbnails(req.file.buffer);
      
      // Extract a frame for AI analysis
      const frameBase64 = await extractVideoFrame(req.file.buffer);
      const analysis = await analyzeVideoFrame(frameBase64);

      const videoData = {
        filename: req.file.filename || `${Date.now()}-${req.file.originalname}`,
        originalName: req.file.originalname,
        size: metadata.size,
        duration: metadata.duration,
        format: metadata.format,
        analysis,
        thumbnails,
      };

      const validation = insertVideoSchema.safeParse(videoData);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid video data", errors: validation.error.errors });
      }

      const video = await storage.createVideo(validation.data);
      res.json(video);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  // Get video by ID
  app.get("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  // Delete video
  app.delete("/api/videos/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteVideo(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Video not found" });
      }
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  // Get chat messages for a video
  app.get("/api/videos/:id/chat", async (req, res) => {
    try {
      const messages = await storage.getChatMessagesByVideoId(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // Send chat message
  app.post("/api/videos/:id/chat", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
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
  app.post("/api/videos/summary", async (req, res) => {
    try {
      const { videoIds } = req.body;
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ message: "Video IDs array is required" });
      }

      const videos = await Promise.all(
        videoIds.map(id => storage.getVideo(id))
      );

      const validVideos = videos.filter((v): v is NonNullable<typeof v> => v !== undefined && v.analysis !== null);
      if (validVideos.length === 0) {
        return res.status(400).json({ message: "No analyzed videos found" });
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
