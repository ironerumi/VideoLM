# VideoLM - AI Video Analysis Platform

## Overview

VideoLM is a modern full-stack web application that combines video upload, AI-powered analysis, and conversational chat capabilities. The platform allows users to upload videos, receive AI-generated insights, and engage in contextual conversations about their video content. Built with a clean, responsive design using modern web technologies.

## User Preferences

Preferred communication style: Simple, everyday language.

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
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **File Upload**: Multer for multipart form handling
- **Development**: TSX for TypeScript execution

### Data Storage Strategy
- **Primary Storage**: PostgreSQL database with three main tables (videos, chatMessages, videoSessions)
- **In-Memory Fallback**: MemStorage class provides in-memory storage during development
- **File Handling**: Videos stored as binary data in memory during processing
- **Schema Management**: Drizzle Kit for database migrations and schema changes

## Key Components

### Video Management System
- **Upload Processing**: Handles video file validation, metadata extraction, and thumbnail generation
- **AI Analysis**: Integrates with OpenAI's GPT-4o model for video frame analysis
- **Storage Interface**: Abstracted storage layer supporting both database and in-memory implementations

### Chat System
- **Contextual Chat**: AI-powered conversations about specific videos using OpenAI API
- **Message Persistence**: Chat history stored per video with timestamps
- **Real-time UI**: Instant message display with loading states

### UI Architecture
- **Responsive Design**: Mobile-first approach with custom breakpoints
- **Component Library**: Comprehensive set of reusable UI components
- **Theme System**: CSS custom properties for consistent design tokens
- **Interactive Elements**: Drag-and-drop upload, video player controls, real-time chat

## Data Flow

1. **Video Upload Flow**:
   - Client uploads video via drag-and-drop or file picker
   - Server validates file type and size (100MB limit)
   - Metadata extraction and thumbnail generation
   - AI frame analysis using OpenAI Vision API
   - Database storage with analysis results

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
- **OpenAI API**: GPT-4o model for video analysis and chat responses
- **Vision Processing**: Base64 image analysis for video frame insights

### UI/UX Libraries
- **Radix UI**: Accessible component primitives (40+ components)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Modern icon library
- **Embla Carousel**: Touch-friendly carousel component

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