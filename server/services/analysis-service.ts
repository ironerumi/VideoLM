import { db } from "../db";
import { videoKeyPoints, videoTopics, videoVisualElements, videoTranscriptions, videos } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { VideoAnalysis } from "./openai";

export interface VideoAnalysisData {
  summary: string | null;
  sentiment: string | null;
  keyPoints: string[];
  topics: string[];
  visualElements: string[];
  transcription: string[];
}

export class AnalysisService {
  static async getAnalysis(videoId: string): Promise<VideoAnalysisData> {
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
    if (!video) {
      throw new Error('Video not found');
    }

    const [keyPointsData, topicsData, visualElementsData, transcriptionsData] = await Promise.all([
      db.select().from(videoKeyPoints).where(eq(videoKeyPoints.videoId, videoId)),
      db.select().from(videoTopics).where(eq(videoTopics.videoId, videoId)),
      db.select().from(videoVisualElements).where(eq(videoVisualElements.videoId, videoId)),
      db.select().from(videoTranscriptions).where(eq(videoTranscriptions.videoId, videoId))
    ]);

    return {
      summary: video.summary,
      sentiment: video.sentiment,
      keyPoints: keyPointsData.map(p => p.text),
      topics: topicsData.map(t => t.text),
      visualElements: visualElementsData.map(v => v.text),
      transcription: transcriptionsData.map(t => `[${new Date(t.timestamp * 1000).toISOString().substr(14, 5)}] ${t.text}`)
    };
  }

  static async saveAnalysis(videoId: string, analysis: VideoAnalysis): Promise<void> {
    await Promise.all([
      db.insert(videoKeyPoints).values(analysis.keyPoints.map(text => ({ 
        id: randomUUID(), 
        videoId, 
        text 
      }))),
      db.insert(videoTopics).values(analysis.topics.map(text => ({ 
        id: randomUUID(), 
        videoId, 
        text 
      }))),
      db.insert(videoVisualElements).values(analysis.visualElements.map(text => ({ 
        id: randomUUID(), 
        videoId, 
        text 
      }))),
      db.insert(videoTranscriptions).values(analysis.transcription.map(line => {
        const match = line.match(/\[(\d{2}):(\d{2})\]\s*(.*)/);
        const timestamp = match ? parseInt(match[1]) * 60 + parseInt(match[2]) : 0;
        const text = match ? match[3] : line; // Extract text without timestamp
        return { 
          id: randomUUID(), 
          videoId, 
          timestamp, 
          text 
        };
      }))
    ]);

    await db.update(videos).set({
      summary: analysis.summary,
      sentiment: analysis.sentiment
    }).where(eq(videos.id, videoId));
  }
}