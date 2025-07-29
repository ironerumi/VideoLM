import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import VideoSourcePanel from "@/components/video-source-panel";
import VideoPlayer from "@/components/video-player";
import SummaryPanel from "@/components/summary-panel";
import QAInterface from "@/components/qa-interface";
import SettingsModal from "@/components/settings-modal";
import AppIcon from "@/components/app-icon";
import { Settings, User, ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import type { Video } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [seekToTime, setSeekToTime] = useState<number | undefined>(undefined);
  const { t } = useI18n();

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

  const handleDataReset = () => {
    // Clear all local state when data is reset
    setSelectedVideoIds([]);
    setCurrentVideoId(null);
    setSeekToTime(undefined);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 flex-shrink-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AppIcon className="w-8 h-8" size={32} />
            <div>
              <h1 className="text-xl font-semibold text-slate-800">{t.videoLM}</h1>
              <p className="text-xs text-slate-500 -mt-1">{t.tagline}</p>
            </div>
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

      {/* Main Content - Resizable Panels */}
      <div className="flex-1 overflow-hidden relative">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - Video Sources */}
          {!leftPanelCollapsed && (
            <>
              <Panel 
                id="left-panel"
                order={1}
                defaultSize={25} 
                minSize={15} 
                maxSize={40} 
                className="min-w-64"
              >
                <VideoSourcePanel
                  videos={videos}
                  selectedVideoIds={selectedVideoIds}
                  onVideoSelect={handleVideoSelect}
                  onVideoPlay={handleVideoPlay}
                  onVideoUploaded={refetchVideos}
                  onCollapse={() => setLeftPanelCollapsed(true)}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-slate-300 transition-colors data-[resize-handle-active]:bg-slate-400" />
            </>
          )}

          {/* Center Panel - Video Player and Chat */}
          <Panel 
            id="center-panel"
            order={2}
            defaultSize={leftPanelCollapsed ? (rightPanelCollapsed ? 100 : 75) : (rightPanelCollapsed ? 75 : 50)} 
            minSize={30}
          >
            <PanelGroup direction="vertical" className="h-full">
              {/* Video Player */}
              <Panel 
                id="video-panel"
                order={1}
                defaultSize={60} 
                minSize={30} 
                maxSize={80}
              >
                <VideoPlayer
                  video={currentVideo}
                  videos={videos}
                  onVideoSelect={setCurrentVideoId}
                  seekToTime={seekToTime}
                />
              </Panel>
              
              {/* Vertical Resize Handle */}
              <PanelResizeHandle className="h-1 bg-slate-200 hover:bg-slate-300 transition-colors data-[resize-handle-active]:bg-slate-400" />
              
              {/* Chat Interface */}
              <Panel 
                id="chat-panel"
                order={2}
                defaultSize={40} 
                minSize={20} 
                maxSize={70}
              >
                <QAInterface
                  videoId={currentVideoId}
                  selectedVideoCount={selectedVideoIds.length}
                  onFrameClick={handleFrameClick}
                />
              </Panel>
            </PanelGroup>
          </Panel>

          {/* Right Panel - Summary */}
          {!rightPanelCollapsed && (
            <>
              <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-slate-300 transition-colors data-[resize-handle-active]:bg-slate-400" />
              <Panel 
                id="right-panel"
                order={3}
                defaultSize={25} 
                minSize={15} 
                maxSize={40} 
                className="min-w-64"
              >
                <SummaryPanel
                  selectedVideoIds={selectedVideoIds}
                  currentVideoId={currentVideoId}
                  onCollapse={() => setRightPanelCollapsed(true)}
                  onFrameClick={handleFrameClick}
                />
              </Panel>
            </>
          )}
        </PanelGroup>

        {/* Panel Toggle Buttons - Always visible when panels are collapsed */}
        {leftPanelCollapsed && (
          <Button
            onClick={() => setLeftPanelCollapsed(false)}
            variant="ghost"
            size="sm"
            className="absolute left-2 top-4 z-50 bg-white/90 backdrop-blur-sm hover:bg-white shadow-md border border-slate-200"
            data-testid="button-expand-left-panel"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        {rightPanelCollapsed && (
          <Button
            onClick={() => setRightPanelCollapsed(false)}
            variant="ghost"
            size="sm"
            className="absolute right-2 top-4 z-50 bg-white/90 backdrop-blur-sm hover:bg-white shadow-md border border-slate-200"
            data-testid="button-expand-right-panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen}
        onDataReset={handleDataReset}
      />
    </div>
  );
}
