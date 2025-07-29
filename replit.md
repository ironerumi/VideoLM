# VideoLM - AI Video Analysis Platform

## Overview

VideoLM is a modern full-stack web application that combines video upload, AI-powered analysis, and conversational chat capabilities. The platform allows users to upload videos, receive AI-generated insights, and engage in contextual conversations about their video content. Built with a clean, responsive design using modern web technologies.

## User Preferences

Preferred communication style: Simple, everyday language.
Localization: Full support for English and Japanese with language switcher in settings.

## System Architecture

The application follows a monorepo structure with a clear separation between client and server code:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with custom design tokens and gradient themes
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **Database**: SQLite with Drizzle ORM
- **Database Provider**: better-sqlite3 with local file storage
- **File Upload**: Multer with session-based disk storage
- **Session Management**: Custom middleware for session tracking
- **File Serving**: Express static serving with session validation
- **Development**: TSX for TypeScript execution

### Data Storage Strategy
- **Session Management**: Each user gets a unique session ID stored in localStorage
- **File Storage**: Videos saved to session-specific folders in `uploads/{sessionId}/`
- **Database Schema**: SQLite with four main tables (sessions, videos, chatMessages, videoSessions)
- **Database File**: Local SQLite database stored as `database.sqlite` in project root
- **File Handling**: Videos stored as files on disk with metadata in database
- **Schema Management**: Custom table initialization with better-sqlite3
- **Session Security**: All video access restricted to session owner

## Key Components

### Video Management System
- **Upload Processing**: Handles video file validation with real FFmpeg-based metadata extraction
- **Frame Extraction**: Uses FFmpeg to extract frames at 1fps with configurable limits (100 frames max)
- **AI Analysis**: Integrates with OpenAI's GPT-4.1-mini model for real video frame analysis
- **Transcription Generation**: Analyzes ALL extracted frames to create detailed timestamped descriptions
- **Storage Interface**: Database storage with session-based file organization and security
- **Real-time Processing**: Actual video duration extraction and frame-by-frame analysis

### Chat System
- **Enhanced Chat Interface**: Redesigned with rephrased questions displayed at top and full-width answers below
- **Contextual Chat**: AI-powered conversations about specific videos using OpenAI API
- **Clickable Frame Thumbnails**: Chat responses include relevant frame thumbnails that seek video to specific moments
- **Message Persistence**: Chat history stored per video with timestamps and rephrased questions
- **Real-time UI**: Instant message display with loading states and proper state management

### UI Architecture
- **Responsive Design**: Mobile-first approach with custom breakpoints
- **Component Library**: Comprehensive set of reusable UI components
- **Theme System**: CSS custom properties for consistent design tokens
- **Interactive Elements**: Drag-and-drop upload, video player controls, real-time chat
- **Internationalization**: Full support for English and Japanese localization with language switcher
- **Localization System**: React Context-based i18n with localStorage persistence and comprehensive translations
- **Language Switching**: Settings modal includes language selector for runtime language changes
- **Viewport Optimization**: Full-height layout that fits within browser viewport without scrollbars

## Data Flow

1. **Session Initialization**:
   - Client requests include session ID header (X-Session-Id)
   - Server creates session record and unique folder if new
   - Session ID stored in client localStorage for persistence

2. **Video Upload Flow**:
   - Client uploads video via drag-and-drop or file picker
   - Server saves file to session-specific folder (uploads/{sessionId}/)
   - File validation and size limits (100MB)
   - Real FFmpeg-based frame extraction (1 frame per second)
   - Actual video duration calculation from FFmpeg
   - AI frame analysis using OpenAI Vision API on extracted frames
   - Database storage with real metadata and extracted frame references

2. **Chat Interaction Flow**:
   - User sends message about selected video
   - Server processes message with video context
   - OpenAI API generates contextual response
   - Message and response stored in database
   - Real-time UI updates via React Query

3. **Video Session Management**:
   - Users can select multiple videos for analysis
   - Session state maintained across interactions
   - Summary generation for multi-video analysis

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Query for frontend
- **Express.js**: Web server framework with middleware support
- **Database**: Drizzle ORM with PostgreSQL dialect, Neon serverless driver

### AI Integration
- **OpenAI API**: GPT-4.1-mini model for video analysis and enhanced chat responses
- **Vision Processing**: Base64 image analysis for all video frames with transcription generation
- **Transcription**: Sherlock Holmes-style scene descriptions with timestamps ([xx:xx] format)
- **Smart Responses**: AI generates rephrased questions and identifies relevant frames for chat responses
- **Frame Association**: Automatic linking of chat responses to specific video frames with clickable navigation

### UI/UX Libraries
- **Radix UI**: Accessible component primitives (40+ components)
- **Tailwind CSS**: Utility-first CSS framework with CJK character support
- **Lucide React**: Modern icon library
- **Embla Carousel**: Touch-friendly carousel component
- **Font Support**: Comprehensive Japanese/CJK character rendering with Hiragino Sans and Yu Gothic fonts

### Development Tools
- **Vite**: Fast build tool with HMR support
- **TypeScript**: Type safety across the entire stack
- **ESBuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with Express API proxy
- **Hot Module Replacement**: Real-time code updates during development
- **Environment Variables**: DATABASE_URL and OPENAI_API_KEY required

### Production Build Process
1. **Client Build**: Vite builds React app to `dist/public`
2. **Server Build**: ESBuild bundles Express server to `dist/index.js`
3. **Static Serving**: Express serves built client files in production
4. **Database**: Requires PostgreSQL database (Neon recommended)

### Configuration Requirements
- **Database**: PostgreSQL connection string in DATABASE_URL
- **AI Service**: OpenAI API key for video analysis features
- **File Storage**: In-memory processing (no persistent file storage needed)
- **Environment**: NODE_ENV for development/production switching

The application is designed for deployment on platforms like Replit, Vercel, or traditional VPS environments with PostgreSQL support.