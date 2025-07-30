import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { videoUpload, generateThumbnails, getVideoMetadata, extractVideoFrame } from "./services/video";
import { analyzeVideoFrame, analyzeVideoFrames, chatWithVideo, generateVideoSummary, type VideoAnalysis } from "./services/openai";
import { extractVideoFrames, type FrameExtractionResult } from "./utils/frame-extractor";
import { insertVideoSchema, insertChatMessageSchema } from "@shared/schema";
import multer from 'multer';
import Busboy from 'busboy';
import path from 'path';
import fs from 'fs';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
  sessionId: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Custom multer middleware with proper UTF-8 filename support using Busboy
  const customMulterMiddleware = (req: MulterRequest, res: Response, next: NextFunction) => {
    if (req.headers['content-type']?.startsWith('multipart/form-data')) {
      const busboy = Busboy({ 
        headers: req.headers,
        defParamCharset: 'utf8' // Key setting for UTF-8 support
      });
      
      let fileProcessed = false;
      
      busboy.on('file', (fieldname, file, info) => {
        const { filename, encoding, mimeType } = info;
        console.log('Properly decoded filename:', filename);
        
        // Validate file type
        const allowedTypes = /\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i;
        if (!allowedTypes.test(filename)) {
          file.resume(); // Drain the file stream
          res.status(400).json({ message: 'Invalid file type. Only video files are allowed.' });
          return;
        }
        
        // Handle file processing
        const timestamp = Date.now();
        const sessionDir = path.join(process.cwd(), 'uploads', req.sessionId);
        if (!fs.existsSync(sessionDir)) {
          fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        const ext = path.extname(filename);
        const name = path.basename(filename, ext);
        const finalFilename = `${timestamp}-${name}${ext}`;
        const filePath = path.join(sessionDir, finalFilename);
        
        const writeStream = fs.createWriteStream(filePath);
        let fileSize = 0;
        
        file.on('data', (data) => {
          fileSize += data.length;
          // Check file size limit (100MB)
          if (fileSize > 100 * 1024 * 1024) {
            writeStream.destroy();
            fs.unlinkSync(filePath);
            res.status(400).json({ message: 'File too large. Maximum size is 100MB.' });
            return;
          }
        });
        
        file.on('end', () => {
          writeStream.end();
          fileProcessed = true;
        });
        
        file.pipe(writeStream);
        
        req.file = {
          fieldname,
          originalname: filename,
          filename: finalFilename,
          path: filePath,
          size: fileSize,
          mimetype: mimeType
        } as Express.Multer.File;
      });
      
      busboy.on('finish', () => {
        if (fileProcessed) {
          next();
        }
      });
      
      busboy.on('error', (error) => {
        console.error('Busboy error:', error);
        res.status(400).json({ message: 'File upload error' });
      });
      
      req.pipe(busboy);
    } else {
      next();
    }
  };
  
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

  // Upload video with enhanced progress logging
  app.post("/api/videos/upload", customMulterMiddleware, async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }

      console.log('🚀 Upload started:', req.file.originalname);

      // Read the uploaded file for processing
      console.log('📁 Reading file and generating metadata...');
      const fileBuffer = fs.readFileSync(req.file.path);
      const metadata = getVideoMetadata(fileBuffer, req.file.originalname);
      const thumbnails = await generateThumbnails(fileBuffer);
      
      // Extract frames from video
      const videoNameWithoutExt = path.basename(req.file.originalname, path.extname(req.file.originalname));
      const framesDir = path.join(path.dirname(req.file.path), videoNameWithoutExt);
      
      console.log(`🎬 Extracting frames to: ${framesDir}`);
      console.log('⚙️ Frame extraction settings: 1fps, max 100 frames');
      
      let frameExtractionResult: FrameExtractionResult;
      try {
        frameExtractionResult = await extractVideoFrames({
          videoPath: req.file.path,
          outputDir: framesDir,
          framesPerSecond: 1,
          maxFrames: 100
        });
      } catch (error) {
        console.warn('⚠️ Frame extraction failed:', error);
        // Create fallback result with estimated duration
        const estimatedDuration = Math.min(Math.max(req.file.size / (1024 * 1024), 10), 300); // Estimate 10-300 seconds based on file size
        frameExtractionResult = {
          success: false,
          frames: [],
          totalFrames: 0,
          duration: estimatedDuration,
          error: 'FFmpeg not available'
        };
      }
      
      console.log(`✅ Frame extraction complete: ${frameExtractionResult.frames?.length || 0} frames extracted`);
      
      // Prepare frames for AI batch analysis 
      let analysis: VideoAnalysis;
      if (frameExtractionResult.success && frameExtractionResult.frames.length > 0) {
        // Analyze more frames for better transcription coverage (increased from 20 to 50)
        const maxFramesToAnalyze = Math.min(frameExtractionResult.frames.length, 50);
        const framesToAnalyze = frameExtractionResult.frames.slice(0, maxFramesToAnalyze);
        console.log(`🤖 AI Batch Analysis: Processing ${framesToAnalyze.length} frames (out of ${frameExtractionResult.frames.length} extracted)`);
        console.log(`📊 Timestamps: ${framesToAnalyze.map(f => `${Math.floor(f.timestamp/60)}:${String(Math.floor(f.timestamp%60)).padStart(2,'0')}`).join(', ')}`);
        
        const frameData = framesToAnalyze.map(frame => {
          const frameBuffer = fs.readFileSync(frame.filePath);
          return {
            base64: frameBuffer.toString('base64'),
            timestamp: frame.timestamp
          };
        });
        
        // Detect user's language preference from the request headers
        const userLanguage = req.headers['x-user-language'] as string || 'en';
        console.log(`🌐 Language preference: ${userLanguage}`);
        
        console.log(`🔄 Starting OpenAI batch processing...`);
        const startTime = Date.now();
        analysis = await analyzeVideoFrames(frameData, userLanguage);
        const processingTime = Date.now() - startTime;
        console.log(`✨ OpenAI analysis completed in ${processingTime}ms`);
        console.log(`📝 Generated transcription with ${analysis.transcription.length} entries`);
      } else {
        console.warn('⚠️ Frame extraction failed, creating text-only analysis');
        // Create a meaningful analysis without frames
        const userLanguage = req.headers['x-user-language'] as string || 'en';
        const filename = req.file.originalname;
        const fileSize = req.file.size;
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
      }

      // Reduce data size for storage optimization
      const optimizedAnalysis = {
        summary: analysis.summary,
        keyPoints: analysis.keyPoints.slice(0, 5), // Limit key points
        topics: analysis.topics.slice(0, 3), // Limit topics
        sentiment: analysis.sentiment,
        visualElements: analysis.visualElements.slice(0, 5), // Limit visual elements
        transcription: analysis.transcription.slice(0, 50) // Increased transcription entries for better coverage
      };

      const videoData = {
        sessionId: req.sessionId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        size: req.file.size,
        duration: frameExtractionResult.success ? Math.round(frameExtractionResult.duration) : Math.round(metadata.duration),
        format: path.extname(req.file.originalname).slice(1),
        analysis: optimizedAnalysis,
        thumbnails: {
          ...thumbnails,
          frames: frameExtractionResult.success ? frameExtractionResult.frames : [] // Store all extracted frames
        },
      };

      console.log('💾 Saving video data to storage...');
      console.log(`📊 Data sizes - Analysis: ${JSON.stringify(optimizedAnalysis).length} chars, Thumbnails: ${JSON.stringify(videoData.thumbnails).length} chars`);
      
      const validationStart = Date.now();
      const validation = insertVideoSchema.safeParse(videoData);
      const validationTime = Date.now() - validationStart;
      console.log(`✅ Schema validation completed in ${validationTime}ms`);
      
      if (!validation.success) {
        // Clean up uploaded file if validation fails
        fs.unlinkSync(req.file.path);
        console.error("❌ Video validation failed:", validation.error.errors);
        console.error("📋 Video data structure:", JSON.stringify(videoData, null, 2));
        return res.status(400).json({ message: "Invalid video data", errors: validation.error.errors });
      }

      const dbStart = Date.now();
      const video = await storage.createVideo(validation.data);
      const dbTime = Date.now() - dbStart;
      console.log(`💽 Storage operation completed in ${dbTime}ms`);
      console.log(`🎉 Upload completed successfully! Video ID: ${video.id}`);
      
      res.json(video);
    } catch (error) {
      console.error("💥 Upload error:", error);
      
      // Clean up uploaded file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  // Serve extracted frame files
  app.get("/api/videos/:id/frames/:frameName", async (req: MulterRequest, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      
      // For image requests, prioritize query parameter session over header
      let sessionId = req.query.session as string || req.sessionId;
      
      console.log('Frame request:', {
        videoId: req.params.id,
        frameName: req.params.frameName,
        videoFound: !!video,
        requestSessionId: sessionId,
        videoSessionId: video?.sessionId,
        sessionMatch: video?.sessionId === sessionId,
        querySession: req.query.session,
        headerSession: req.sessionId
      });
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Check if the video's session matches either the query parameter or current session
      const querySession = req.query.session as string;
      const isValidSession = video.sessionId === querySession || video.sessionId === req.sessionId;
      
      if (!isValidSession) {
        console.log('Session validation failed:', {
          videoSession: video.sessionId,
          querySession,
          requestSession: req.sessionId
        });
        return res.status(404).json({ message: "Video not found" });
      }
      
      const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
      const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);
      
      // Try to find the actual frame file - handle different timestamp formats
      let framePath = path.join(framesDir, req.params.frameName);
      
      // If exact match doesn't exist, try with .0 added for integer seconds
      if (!fs.existsSync(framePath)) {
        const frameNameParts = req.params.frameName.match(/^(frame_\d+_)(\d+)(s\.jpg)$/);
        if (frameNameParts) {
          const alternativeFrameName = `${frameNameParts[1]}${frameNameParts[2]}.0${frameNameParts[3]}`;
          const alternativeFramePath = path.join(framesDir, alternativeFrameName);
          if (fs.existsSync(alternativeFramePath)) {
            framePath = alternativeFramePath;
          }
        }
      }
      
      // Security check - ensure frame is within the session directory
      if (!framePath.startsWith(framesDir)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (!fs.existsSync(framePath)) {
        console.log('Frame file not found:', {
          requestedFrame: req.params.frameName,
          framePath,
          framesDir,
          dirExists: fs.existsSync(framesDir),
          dirContents: fs.existsSync(framesDir) ? fs.readdirSync(framesDir).slice(0, 5) : []
        });
        return res.status(404).json({ message: "Frame not found" });
      }
      
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.sendFile(framePath);
    } catch (error) {
      console.error('Error serving frame:', error);
      res.status(500).json({ message: "Failed to serve frame" });
    }
  });

  // Serve video files
  app.get("/api/videos/:id/file", async (req: MulterRequest, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      console.log('Video file request:', {
        videoId: req.params.id,
        videoFound: !!video,
        requestSessionId: req.sessionId,
        videoSessionId: video?.sessionId,
        sessionMatch: video?.sessionId === req.sessionId
      });
      
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
      
      // Delete chat messages for this video first
      await storage.deleteChatMessagesByVideoId(req.params.id);
      
      // Delete the video file from filesystem
      if (fs.existsSync(video.filePath)) {
        fs.unlinkSync(video.filePath);
      }
      
      // Delete extracted frames directory
      const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
      const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);
      if (fs.existsSync(framesDir)) {
        try {
          fs.rmSync(framesDir, { recursive: true, force: true });
        } catch (frameError) {
          console.warn('Failed to delete frames directory:', frameError);
        }
      }
      
      // Delete video record from storage
      const deleted = await storage.deleteVideo(req.params.id);
      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      console.error('Error deleting video:', error);
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

  // Delete all chat messages for a video
  app.delete("/api/videos/:id/chat", async (req: MulterRequest, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video || video.sessionId !== req.sessionId) {
        return res.status(404).json({ message: "Video not found" });
      }

      await storage.deleteChatMessagesByVideoId(req.params.id);
      res.json({ success: true, message: "Chat history cleared" });
    } catch (error) {
      console.error("Error clearing chat history:", error);
      res.status(500).json({ message: "Failed to clear chat history" });
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
      
      // Detect user's language preference from the request headers
      const userLanguage = req.headers['x-user-language'] as string || 'en';
      
      // Get available frames from the filesystem to constrain AI responses
      const videoNameWithoutExt = path.basename(video.originalName, path.extname(video.originalName));
      const framesDir = path.join(path.dirname(video.filePath), videoNameWithoutExt);
      let availableFrames: string[] = [];
      
      try {
        if (fs.existsSync(framesDir)) {
          const frameFiles = fs.readdirSync(framesDir);
          availableFrames = frameFiles.filter(file => file.endsWith('.jpg'));
          console.log('Available frames for AI:', availableFrames);
        }
      } catch (error) {
        console.warn('Could not read frames directory:', error);
      }
      
      // Generate AI response with rephrased question and relevant frame
      const defaultAnalysis: VideoAnalysis = { summary: "", keyPoints: [], topics: [], sentiment: "neutral", visualElements: [], transcription: [] };
      const aiResult = await chatWithVideo(
        message, 
        (video.analysis as VideoAnalysis) || defaultAnalysis,
        chatHistory.map(m => ({ message: m.message, response: m.response })),
        availableFrames,
        userLanguage
      );

      const chatData = {
        sessionId: req.sessionId,
        videoId: req.params.id,
        message,
        rephrasedQuestion: aiResult.rephrasedQuestion,
        response: aiResult.response,
        relevantFrame: aiResult.relevantFrame,
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

      // Detect user's language preference from the request headers
      const userLanguage = req.headers['x-user-language'] as string || 'en';
      
      const analyses = validVideos.map(v => v.analysis as VideoAnalysis);
      const summary = await generateVideoSummary(analyses, userLanguage);

      res.json({ summary, videoCount: validVideos.length });
    } catch (error) {
      console.error("Summary error:", error);
      res.status(500).json({ message: "Failed to generate summary" });
    }
  });

  // Reset all data for current session
  app.post("/api/reset", async (req: MulterRequest, res) => {
    try {
      const sessionId = req.sessionId;
      
      // Delete all videos and their files for this session
      const videos = await storage.getVideosBySession(sessionId);
      
      // Delete physical video files
      for (const video of videos) {
        try {
          if (fs.existsSync(video.filePath)) {
            fs.unlinkSync(video.filePath);
          }
        } catch (fileError) {
          console.warn(`Failed to delete video file: ${video.filePath}`, fileError);
        }
      }
      
      // Delete session directory if it exists
      const sessionDir = path.join(process.cwd(), 'uploads', sessionId);
      if (fs.existsSync(sessionDir)) {
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (dirError) {
          console.warn(`Failed to delete session directory: ${sessionDir}`, dirError);
        }
      }
      
      // Clear all session data from storage
      await storage.clearSessionData(sessionId);
      
      res.json({ message: "All data has been reset successfully" });
    } catch (error: any) {
      console.error("Error resetting data:", error);
      res.status(500).json({ message: error.message || "Failed to reset data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
