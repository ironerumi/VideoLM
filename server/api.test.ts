import { describe, it, expect, beforeAll, vi } from 'vitest';
import supertest from 'supertest';
import { app } from './index'; // Assuming your express app is exported from index
import fs from 'fs';
import path from 'path';
import { VideoAnalysis } from './services/openai';

// Mock the OpenAI service
vi.mock('./services/openai', () => ({
  analyzeVideoFrames: vi.fn().mockResolvedValue({
    summary: 'This is a mock summary.',
    keyPoints: ['Mock point 1', 'Mock point 2'],
    topics: ['Mock topic 1', 'Mock topic 2'],
    sentiment: 'neutral',
    visualElements: ['Mock element 1'],
    transcription: ['[00:00] Mock transcription']
  } as VideoAnalysis),
  chatWithVideo: vi.fn().mockResolvedValue({
    rephrasedQuestion: 'This is a mock rephrased question.',
    response: 'This is a mock AI response.',
    relevantFrame: 'frame_001_1.2s.jpg'
  }),
}));

const request = supertest(app);

// Utility to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('VideoLM API E2E Test', () => {
  const testVideoPath = '/Users/yifu.gu/Documents/GitHub/VideoLM/オープニング (Prologue) ⧸ FINAL FANTASY IV ⧸ 植松伸夫 (Nobuo Uematsu)_lowest.mp4';
  let videoId: string;
  let jobId: string;
  let sessionId: string;

  beforeAll(() => {
    // Ensure the test video file exists
    expect(fs.existsSync(testVideoPath)).toBe(true);
  });

  it('should cover the full video lifecycle: upload, process, query, chat, and delete', async () => {
    // 1. Upload the video
    const uploadResponse = await request
      .post('/api/videos/upload')
      .attach('video', testVideoPath)
      .expect(200);

    expect(uploadResponse.body).toHaveProperty('videoId');
    expect(uploadResponse.body).toHaveProperty('jobId');
    videoId = uploadResponse.body.videoId;
    jobId = uploadResponse.body.jobId;
    sessionId = uploadResponse.headers['x-session-id']; // Capture the session ID
    expect(sessionId).toBeDefined();
    console.log(`Video uploaded. Video ID: ${videoId}, Job ID: ${jobId}, Session ID: ${sessionId}`);

    // 2. Poll for processing status
    let status = '';
    let attempts = 0;
    await delay(500); // Give the server a moment to create the job

    while (status !== 'completed' && attempts < 30) {
      const statusResponse = await request
        .get(`/api/videos/${videoId}/status`)
        .set('X-Session-Id', sessionId); // Use the captured session ID
      
      if (statusResponse.status === 200) {
        status = statusResponse.body.status;
        console.log(`Polling... status: ${status}, progress: ${statusResponse.body.progress}%`);
        if (status === 'failed') {
          throw new Error(`Processing failed: ${statusResponse.body.errorMessage}`);
        }
      } else if (statusResponse.status === 404) {
        console.log('Polling... job not found yet, retrying.');
      } else {
        throw new Error(`Unexpected status code: ${statusResponse.status}`);
      }

      if (status !== 'completed') {
        await delay(1000); // Wait 1 second between polls
      }
      attempts++;
    }
    expect(status).toBe('completed');
    console.log('Video processing complete.');

    // 3. Get video details and verify analysis
    const detailsResponse = await request
      .get(`/api/videos/${videoId}`)
      .set('X-Session-Id', sessionId)
      .expect(200);
    expect(detailsResponse.body.id).toBe(videoId);
    expect(detailsResponse.body.processingStatus).toBe('completed');
    expect(detailsResponse.body.analysis).not.toBeNull();
    expect(detailsResponse.body.analysis.summary).toBe('This is a mock summary.');
    console.log('Verified video details and analysis.');

    // 4. Test the chat endpoint
    const chatResponse = await request
      .post(`/api/videos/${videoId}/chat`)
      .set('X-Session-Id', sessionId)
      .send({ message: 'What is this video about?' })
      .expect(200);
    expect(chatResponse.body.response).toBe('This is a mock AI response.');
    console.log('Verified chat functionality.');

    // 5. Delete the video
    const deleteResponse = await request
      .delete(`/api/videos/${videoId}`)
      .set('X-Session-Id', sessionId)
      .expect(200);
    expect(deleteResponse.body.message).toBe('Video deleted successfully');
    console.log('Verified video deletion.');

    // 6. Verify the video is gone
    await request
      .get(`/api/videos/${videoId}`)
      .set('X-Session-Id', sessionId)
      .expect(404);
    console.log('Verified video is no longer accessible.');
  }, 45000); // Increase timeout for this long-running test

  it('should list the uploaded video in the /api/videos endpoint', async () => {
    // 1. Upload a video and wait for it to complete
    const uploadResponse = await request
      .post('/api/videos/upload')
      .attach('video', testVideoPath)
      .expect(200);
    
    const newVideoId = uploadResponse.body.videoId;
    const newSessionId = uploadResponse.headers['x-session-id'];
    expect(newVideoId).toBeDefined();
    expect(newSessionId).toBeDefined();

    let status = '';
    let attempts = 0;
    while (status !== 'completed' && attempts < 30) {
      const statusResponse = await request
        .get(`/api/videos/${newVideoId}/status`)
        .set('X-Session-Id', newSessionId);
      if (statusResponse.status === 200) {
        status = statusResponse.body.status;
      }
      if (status !== 'completed') {
        await delay(1000);
      }
      attempts++;
    }
    expect(status).toBe('completed');

    // 2. Fetch the list of videos
    const videosResponse = await request
      .get('/api/videos')
      .set('X-Session-Id', newSessionId)
      .expect(200);

    // 3. Verify the new video is in the list
    expect(Array.isArray(videosResponse.body)).toBe(true);
    const uploadedVideo = videosResponse.body.find(v => v.id === newVideoId);
    expect(uploadedVideo).toBeDefined();
    expect(uploadedVideo.originalName).toContain('オープニング');
  }, 45000);
});
