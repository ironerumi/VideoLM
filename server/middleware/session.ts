import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import fs from 'fs';
import path from 'path';

declare global {
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

// Clean up empty session directories
async function cleanupEmptySessions() {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) return;

    const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
    let cleanedUp = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sessionDir = path.join(uploadsDir, entry.name);
        try {
          const files = fs.readdirSync(sessionDir);
          // If directory is empty, remove it
          if (files.length === 0) {
            fs.rmdirSync(sessionDir);
            cleanedUp++;
          }
        } catch (error) {
          // Directory might not exist or be inaccessible, skip it
        }
      }
    }

    if (cleanedUp > 0) {
      console.log(`Cleaned up ${cleanedUp} empty session directories`);
    }
  } catch (error) {
    console.warn('Failed to cleanup empty sessions:', error);
  }
}

// Run cleanup on startup
cleanupEmptySessions();

export async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Set UTF-8 encoding headers for JSON responses only
  if (req.path.startsWith('/api/') && !req.path.includes('/videos/') && !req.path.includes('/file/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  
  let sessionId = req.headers['x-session-id'] as string;
  
  // For video file requests, also check query parameter since HTML video elements can't send custom headers
  if (!sessionId && req.path.includes('/file') && req.query.session) {
    sessionId = req.query.session as string;
  }
  
  if (!sessionId) {
    // Create new session if none exists
    const session = await storage.createSession();
    sessionId = session.id;
    res.setHeader('X-Session-Id', sessionId);
  } else {
    // Update session access time
    const existingSession = await storage.getSession(sessionId);
    if (existingSession) {
      await storage.updateSessionAccess(sessionId);
    } else {
      // Session doesn't exist, create new one
      const session = await storage.createSession();
      sessionId = session.id;
      res.setHeader('X-Session-Id', sessionId);
    }
  }
  
  req.sessionId = sessionId;
  next();
}