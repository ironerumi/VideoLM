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
- **Current Database**: **In-memory storage** (no database file created)
- **Data Persistence**: Data is lost when server restarts (temporary storage only)
- **File Handling**: Videos stored as files on disk with metadata in memory
- **Session Security**: All video access restricted to session owner

### Available Database Implementations
The application supports three different storage approaches via TypeScript files:

1. **MemStorage** (`server/storage.ts`) - **Currently Active**
   - In-memory data storage for maximum performance
   - No persistence - data lost on server restart
   - Best for development and performance testing

2. **SQLite Storage** (`server/db.ts`)
   - Local SQLite database stored as `database.sqlite` in project root
   - Persistent storage with better-sqlite3
   - Custom table initialization with four main tables (sessions, videos, chatMessages, videoSessions)
   - Best for single-user applications requiring persistence

3. **PostgreSQL Storage** (`server/database-storage.ts`)
   - Cloud-hosted PostgreSQL database via Neon
   - Requires DATABASE_URL environment variable
   - Drizzle ORM with full schema management
   - Best for production multi-user deployments

### Switching Storage Implementations
To switch between storage types, modify the export in `server/storage.ts`:

```typescript
// Current: In-memory storage (active)
export const storage = new MemStorage();

// Option 1: SQLite storage (uncomment to use)
// import { DatabaseStorage } from './database-storage';
// export const storage = new DatabaseStorage();

// Option 2: PostgreSQL storage (requires DATABASE_URL)
// import { DatabaseStorage } from './database-storage';  
// export const storage = new DatabaseStorage();
```

**Note**: The PostgreSQL option also requires updating `server/database-storage.ts` to use the PostgreSQL schema instead of SQLite, and setting the `DATABASE_URL` environment variable.

## Key Components

### Video Management System
- **Upload Processing**: Handles video file validation with real FFmpeg-based metadata extraction
- **Frame Extraction**: Uses FFmpeg to extract frames at 1fps with configurable limits (100 frames max)
- **AI Analysis**: Integrates with OpenAI's GPT-4.1-mini model for real video frame analysis
- **Transcription Generation**: Analyzes ALL extracted frames to create detailed timestamped descriptions
- **Storage Interface**: Database storage with session-based file organization and security
- **Real-time Processing**: Actual video duration extraction and frame-by-frame analysis

### Resizable Panel System
- **Fully Adjustable Layout**: React Resizable Panels implementation with three-way split
- **Horizontal Resizers**: Between source panel and video area, video area and summary panel
- **Vertical Resizer**: Between video player and chat interface within center panel
- **Panel Collapse/Expand**: Toggle buttons for left and right panels with persistent unfold buttons
- **Responsive Constraints**: Minimum and maximum size limits for optimal usability
- **Panel Persistence**: Proper ID and order management to prevent layout issues

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
- **Database**: Currently in-memory storage (MemStorage), with optional SQLite/PostgreSQL support via Drizzle ORM

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
- **Environment Variables**: OPENAI_API_KEY required (DATABASE_URL only needed for PostgreSQL storage)

### Production Build Process
1. **Client Build**: Vite builds React app to `dist/public`
2. **Server Build**: ESBuild bundles Express server to `dist/index.js`
3. **Static Serving**: Express serves built client files in production
4. **Database**: Currently uses in-memory storage (data lost on restart)

### Configuration Requirements
- **AI Service**: OpenAI API key for video analysis features
- **Database**: Optional - DATABASE_URL only needed if using PostgreSQL storage
- **File Storage**: Videos stored in uploads/ directory, metadata in memory
- **Environment**: NODE_ENV for development/production switching

The application is designed for deployment on platforms like Replit, Vercel, or traditional VPS environments. Current in-memory storage makes it suitable for development and demo purposes.

## Recent Changes

### August 1, 2025 - Multi-Platform Hosting Compatibility
- **Issue**: Fixed asset and API path issues when deploying to hosting platforms that use URL redirection
- **Root Cause**: Some platforms serve apps from subdirectories (e.g., `/custom_applications/ID/`) but absolute paths (`/api/videos`) resolve to root domain
- **Solution**: Converted all absolute paths to relative paths for universal compatibility
- **Changes Made**:
  - **Vite Config**: Added `base: "./"` for relative asset paths in production builds
  - **API Calls**: Changed all `/api/videos` → `api/videos` in query keys and fetch calls  
  - **Assets**: Changed `/assets/icons/` → `./assets/icons/` for images and favicon
  - **Router**: Added empty path route (`""`) to handle trailing slash scenarios
- **Files Modified**: All client components, `vite.config.ts`, `client/index.html`
- **Compatibility**: Now works on both root domain hosting (Replit) and subdirectory hosting platforms

### July 29, 2025 - Custom App Icon System
- **Feature**: Added customizable app icon system with automatic detection
- **Location**: `public/assets/icons/` folder created for custom icons  
- **Component**: New `AppIcon` component with fallback to default gradient icon
- **Formats**: Supports SVG (preferred), PNG, JPG formats
- **Usage**: Upload `app-icon.svg/png/jpg` to replace default icon automatically
- **Enhancement**: Transparent batch progress indicators with detailed server logging

## Development Guidelines

### Path Convention Rules
**CRITICAL**: Always use relative paths for client-side assets and API calls to ensure compatibility across different hosting environments.

#### ✅ Correct Path Usage:
```typescript
// API calls - use relative paths
queryKey: ["api/videos"]
fetch("api/videos/123")
await apiRequest('POST', 'api/videos/upload', data)

// Assets - use relative paths with ./
src="./assets/icons/app-icon.svg"
href="./assets/icons/favicon.png"

// Routes - handle both absolute and empty paths
<Route path="/" component={Home} />
<Route path="" component={Home} />
```

#### ❌ Incorrect Path Usage:
```typescript
// Absolute paths break in subdirectory deployments
queryKey: ["/api/videos"]           // ❌ Resolves to root domain
fetch("/api/videos/123")            // ❌ Ignores base path
src="/assets/icons/app-icon.svg"    // ❌ Goes to root domain
```

#### Why This Matters:
- **Root Domain Hosting**: Serves from root (`/`) - both work but absolute paths are unnecessary
- **Subdirectory Hosting**: Serves from subdirectory (e.g., `/apps/ID/`) - absolute paths fail
- **Relative paths**: Adapt automatically to any hosting environment