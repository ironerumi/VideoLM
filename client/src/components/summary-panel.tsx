import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, Clock, Database, HardDrive, PanelRightClose, GripHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import type { Video, ChatMessage } from "@shared/schema";
import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { sessionManager } from "@/lib/session";

interface SummaryPanelProps {
  selectedVideoIds: string[];
  currentVideoId: string | null;
  onCollapse?: () => void;
  onFrameClick?: (frameTime: number) => void;
}

export default function SummaryPanel({ selectedVideoIds, currentVideoId, onCollapse, onFrameClick }: SummaryPanelProps) {
  const [summaryHeight, setSummaryHeight] = useState(400); // Default height in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [isKeyPointsExpanded, setIsKeyPointsExpanded] = useState(true);
  const [isTranscriptionExpanded, setIsTranscriptionExpanded] = useState(true);
  const [isVideoDetailsExpanded, setIsVideoDetailsExpanded] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const queryClient = useQueryClient();
  
  const { data: videos = [] } = useQuery<Video[]>({
    queryKey: ["/api/videos"],
  });

  const { data: chatHistory = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/videos", currentVideoId, "chat"],
    enabled: !!currentVideoId,
  });

  const summaryMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      const response = await apiRequest('POST', '/api/videos/summary', { videoIds });
      return response.json();
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest('DELETE', `/api/videos/${videoId}/chat`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", currentVideoId, "chat"] });
    },
  });

  const clearChatHistory = () => {
    if (!currentVideoId) return;
    clearChatMutation.mutate(currentVideoId);
  };

  const currentVideo = videos.find(v => v.id === currentVideoId);
  const selectedVideos = videos.filter(v => selectedVideoIds.includes(v.id));

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleGenerateSummary = () => {
    if (selectedVideoIds.length > 0) {
      summaryMutation.mutate(selectedVideoIds);
    }
  };

  // Resizing functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newHeight = e.clientY - containerRect.top;
    const minHeight = 200; // Minimum summary height
    const maxHeight = containerRect.height - 200; // Leave at least 200px for chat
    
    setSummaryHeight(Math.min(Math.max(newHeight, minHeight), maxHeight));
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add event listeners for mouse move and up
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div ref={containerRef} className="w-full bg-white border-l border-slate-200/60 flex flex-col h-full">
      {/* Summary Section */}
      <div 
        className="border-b border-slate-100 overflow-hidden flex flex-col"
        style={{ height: `${summaryHeight}px` }}
      >
        <div className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{t.videoSummary}</h3>
            <div className="flex items-center space-x-2">
            {selectedVideoIds.length > 0 && (
              <Button
                onClick={handleGenerateSummary}
                disabled={summaryMutation.isPending}
                size="sm"
                variant="outline"
                className="text-xs"
                data-testid="button-generate-summary"
              >
                {summaryMutation.isPending ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
              </Button>
            )}
            {onCollapse && (
              <Button
                onClick={onCollapse}
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-slate-700"
                data-testid="button-collapse-right-panel"
              >
                <PanelRightClose className="w-4 h-4" />
              </Button>
            )}
            </div>
          </div>

          {summaryMutation.data ? (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-700 leading-relaxed mb-3" data-testid="text-generated-summary">
                {summaryMutation.data.summary}
              </p>
              <div className="text-xs text-slate-500">
                Based on {summaryMutation.data.videoCount} video{summaryMutation.data.videoCount !== 1 ? 's' : ''}
              </div>
            </div>
          ) : currentVideo?.analysis ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="bg-slate-50 rounded-xl p-4 flex-1 min-h-0 flex flex-col space-y-4">
                {/* Key Points Section */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setIsKeyPointsExpanded(!isKeyPointsExpanded)}
                    className="flex items-center justify-between w-full text-left hover:bg-slate-100 rounded-lg p-2 -m-2 transition-colors"
                    data-testid="button-toggle-key-points"
                  >
                    <h4 className="text-sm font-medium text-slate-700">Key Points</h4>
                    {isKeyPointsExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                  {isKeyPointsExpanded && (
                    <ScrollArea className="mt-3 max-h-48">
                      <div className="space-y-2 pr-2">
                        {(currentVideo.analysis as any)?.keyPoints?.map((point: string, index: number) => (
                          <div key={index} className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${
                              index % 4 === 0 ? 'bg-indigo-400' :
                              index % 4 === 1 ? 'bg-purple-400' :
                              index % 4 === 2 ? 'bg-pink-400' : 'bg-blue-400'
                            }`}></div>
                            <span className="text-sm text-slate-600" data-testid={\`key-point-${index}`}>
                              {point}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* Transcription Section */}
                {(currentVideo.analysis as any)?.transcription?.length > 0 && (
                  <div className="flex-1 min-h-0 flex flex-col border-t border-slate-200 pt-4">
                    <button
                      onClick={() => setIsTranscriptionExpanded(!isTranscriptionExpanded)}
                      className="flex items-center justify-between w-full text-left hover:bg-slate-100 rounded-lg p-2 -m-2 transition-colors flex-shrink-0"
                      data-testid="button-toggle-transcription"
                    >
                      <h4 className="text-sm font-medium text-slate-700">Transcription</h4>
                      {isTranscriptionExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    {isTranscriptionExpanded && (
                      <ScrollArea className="flex-1 min-h-0 mt-3">
                        <div className="space-y-2 pr-2">
                          {(currentVideo.analysis as any).transcription.map((line: string, index: number) => (
                            <div key={index} className="text-sm text-slate-600 leading-relaxed" data-testid={\`transcription-line-${index}`}>
                              {line}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}
                
                {/* Video Details Section */}
                {currentVideo && (
                  <div className="pt-4 border-t border-slate-200">
                    <button
                      onClick={() => setIsVideoDetailsExpanded(!isVideoDetailsExpanded)}
                      className="flex items-center justify-between w-full text-left hover:bg-slate-100 rounded-lg p-2 -m-2 transition-colors mb-3"
                      data-testid="button-toggle-video-details"
                    >
                      <h4 className="text-sm font-medium text-slate-700">Video Details</h4>
                      {isVideoDetailsExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    {isVideoDetailsExpanded && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Duration</span>
                          <span data-testid="text-video-duration">
                            {currentVideo.duration ? formatDuration(currentVideo.duration) : 'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Format</span>
                          <span data-testid="text-video-format">{currentVideo.format}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Size</span>
                          <span data-testid="text-video-size">{formatFileSize(currentVideo.size)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : selectedVideoIds.length > 0 ? (
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium mb-2">{t.generateSummary}</p>
              <p className="text-slate-400 text-sm mb-3">
                {selectedVideoIds.length} {t.selected} {t.videos}の包括的な要約を作成
              </p>
              <Button
                onClick={handleGenerateSummary}
                disabled={summaryMutation.isPending}
                size="sm"
                data-testid="button-create-summary"
              >
                {summaryMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t.generating}
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    {t.generateSummary}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium mb-2">{t.noVideos}</p>
              <p className="text-slate-400 text-sm">{t.selectVideo}</p>
            </div>
          )}
        </div>
        
        {/* Resizer */}
        <div 
          className={\`h-2 bg-slate-100 hover:bg-slate-200 cursor-row-resize flex items-center justify-center group transition-colors ${isResizing ? 'bg-slate-300' : ''}`}
          onMouseDown={handleMouseDown}
          data-testid="summary-resizer"
        >
          <GripHorizontal className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 flex flex-col p-6 min-h-0">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-800">{t.chatHistoryTab}</h3>
          <button
            onClick={clearChatHistory}
            disabled={chatHistory.length === 0 || clearChatMutation.isPending}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent rounded-md transition-colors duration-200 border border-slate-300 hover:border-red-300 disabled:border-slate-200"
            data-testid="button-clear-chat"
            title={chatHistory.length === 0 ? "No chat history to clear" : "Clear chat history"}
          >
            {t.clearHistory}
          </button>
        </div>
        
        {chatHistory.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium mb-2">{t.noVideoSelectedChat}</p>
            <p className="text-slate-400 text-sm">{t.selectVideoToChat}</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-6">
              {chatHistory.slice(-6).map((chat) => {
                // Extract frame timestamp from filename if available
                const getFrameTimeFromFilename = (filename: string | null) => {
                  if (!filename) return null;
                  const match = filename.match(/frame_\d+_(\d+(\.\d+)?)s/);
                  return match ? parseFloat(match[1]) : null;
                };

                const frameTime = getFrameTimeFromFilename((chat as any).relevantFrame);

                return (
                  <div key={chat.id} className="space-y-3" data-testid={\`chat-item-${chat.id}`}>
                    {/* Rephrased Question */}
                    <div className="border-b border-slate-100 pb-3">
                      <h4 className="text-sm font-medium text-slate-800 leading-relaxed">
                        {(chat as any).rephrasedQuestion || chat.message}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatTime(chat.timestamp)}
                      </p>
                    </div>

                    {/* AI Response with Frame Thumbnail */}
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        {/* Frame Thumbnail */}
                        {(chat as any).relevantFrame && currentVideoId && (
                          <button
                            onClick={() => frameTime && onFrameClick?.(frameTime)}
                            className="flex-shrink-0 w-16 h-12 bg-slate-200 rounded-lg overflow-hidden hover:ring-2 hover:ring-indigo-300 transition-all duration-200 transform hover:scale-105"
                            data-testid={\`frame-thumbnail-${chat.id}`}
                          >
                            <img
                              src={`/api/videos/${currentVideoId}/frames/${(chat as any).relevantFrame}?session=${sessionManager.getSessionId()}`}
                              alt="Relevant frame"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.style.display = 'none';
                                }
                              }}
                            />
                          </button>
                        )}

                        {/* Response Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {chat.response}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
