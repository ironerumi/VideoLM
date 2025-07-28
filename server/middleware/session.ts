import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

declare global {
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

export async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  // Set UTF-8 encoding headers
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  let sessionId = req.headers['x-session-id'] as string;
  
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