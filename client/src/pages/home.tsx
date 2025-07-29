import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import VideoSourcePanel from "@/components/video-source-panel";
import VideoPlayer from "@/components/video-player";
import SummaryPanel from "@/components/summary-panel";
import ChatInterface from "@/components/chat-interface";
import SettingsModal from "@/components/settings-modal";
import { Settings, User, ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Video } from "@shared/schema";

export default function Home() {
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [seekToTime, setSeekToTime] = useState<number | undefined>(undefined);

  const { data: videos = [], refetch: refetchVideos } = useQuery<Video[]>({
    queryKey: ["/api/videos"],
  });

  const currentVideo = videos.find(v => v.id === currentVideoId);

  const handleVideoSelect = (videoId: string, selected: boolean) => {
    if (selected) {
      setSelectedVideoIds(prev => [...prev, videoId]);
      if (!currentVideoId) {
        setCurrentVideoId(videoId);
      }
    } else {
      setSelectedVideoIds(prev => prev.filter(id => id !== videoId));
      if (currentVideoId === videoId) {
        const remaining = selectedVideoIds.filter(id => id !== videoId);
        setCurrentVideoId(remaining.length > 0 ? remaining[0] : null);
      }
    }
  };

  const handleVideoPlay = (videoId: string) => {
    setCurrentVideoId(videoId);
    if (!selectedVideoIds.includes(videoId)) {
      setSelectedVideoIds(prev => [...prev, videoId]);
    }
  };

  const handleFrameClick = (frameTime: number) => {
    setSeekToTime(frameTime);
    // Reset after a short delay to allow the effect to trigger
    setTimeout(() => setSeekToTime(undefined), 100);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 flex-shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <i className="fas fa-video text-white text-sm"></i>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">VideoLM</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              className="text-slate-500 hover:text-slate-700 transition-colors"
              onClick={() => setSettingsOpen(true)}
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-slate-600" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex relative min-h-0">
        {/* Left Panel - Video Sources */}
        <div className={`transition-all duration-300 ease-in-out ${
          leftPanelCollapsed ? 'w-0' : 'w-80'
        } overflow-hidden`}>
          <VideoSourcePanel
            videos={videos}
            selectedVideoIds={selectedVideoIds}
            onVideoSelect={handleVideoSelect}
            onVideoPlay={handleVideoPlay}
            onVideoUploaded={refetchVideos}
            onCollapse={() => setLeftPanelCollapsed(true)}
          />
        </div>

        {/* Left Panel Toggle Button */}
        {leftPanelCollapsed && (
          <Button
            onClick={() => setLeftPanelCollapsed(false)}
            variant="ghost"
            size="sm"
            className="absolute left-2 top-4 z-10 bg-white/80 backdrop-blur-sm hover:bg-white/90 shadow-soft"
            data-testid="button-expand-left-panel"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        {/* Center Panel - Video Player */}
        <div className="flex-1 flex flex-col relative min-h-0">
          <div className="flex-1 min-h-0">
            <VideoPlayer
              video={currentVideo}
              videos={videos}
              onVideoSelect={setCurrentVideoId}
              seekToTime={seekToTime}
            />
          </div>
          
          {/* Chat Interface */}
          <div className="flex-shrink-0">
            <ChatInterface
              videoId={currentVideoId}
              selectedVideoCount={selectedVideoIds.length}
            />
          </div>
        </div>

        {/* Right Panel Toggle Button */}
        {rightPanelCollapsed && (
          <Button
            onClick={() => setRightPanelCollapsed(false)}
            variant="ghost"
            size="sm"
            className="absolute right-2 top-4 z-10 bg-white/80 backdrop-blur-sm hover:bg-white/90 shadow-soft"
            data-testid="button-expand-right-panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}

        {/* Right Panel - Summary */}
        <div className={`transition-all duration-300 ease-in-out ${
          rightPanelCollapsed ? 'w-0' : 'w-80'
        } overflow-hidden`}>
          <SummaryPanel
            selectedVideoIds={selectedVideoIds}
            currentVideoId={currentVideoId}
            onCollapse={() => setRightPanelCollapsed(true)}
            onFrameClick={handleFrameClick}
          />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen} 
      />
    </div>
  );
}
