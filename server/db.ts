import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import path from 'path';

// Create SQLite database in the project root
const dbPath = path.join(process.cwd(), 'database.sqlite');
const sqlite = new Database(dbPath);

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

// Initialize database tables if they don't exist
const initializeTables = () => {
  try {
    // Check if sessions table exists
    const tablesExist = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get();
    
    if (!tablesExist) {
      // Create tables
      sqlite.exec(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          last_accessed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );

        CREATE TABLE videos (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id),
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          size INTEGER NOT NULL,
          duration INTEGER,
          format TEXT NOT NULL,
          uploaded_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          analysis TEXT,
          thumbnails TEXT,
          processing_status TEXT DEFAULT 'pending',
          job_id TEXT
        );

        CREATE TABLE chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id),
          video_id TEXT REFERENCES videos(id),
          message TEXT NOT NULL,
          rephrased_question TEXT,
          response TEXT NOT NULL,
          relevant_frame TEXT,
          timestamp INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );

        CREATE TABLE video_sessions (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES sessions(id),
          selected_video_ids TEXT NOT NULL DEFAULT '[]',
          summary TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );

        CREATE TABLE video_jobs (
          id TEXT PRIMARY KEY,
          video_id TEXT NOT NULL REFERENCES videos(id),
          session_id TEXT NOT NULL REFERENCES sessions(id),
          status TEXT NOT NULL DEFAULT 'pending',
          progress INTEGER NOT NULL DEFAULT 0,
          current_stage TEXT,
          error_message TEXT,
          created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        );
      `);
      console.log('✓ SQLite database tables created successfully');
    }
  } catch (error) {
    console.error('Error initializing database tables:', error);
  }
};

// Initialize tables on startup
initializeTables();

export const db = drizzle(sqlite, { schema });
export { sqlite };