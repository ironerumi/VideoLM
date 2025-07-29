import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, Clock, Database, HardDrive, PanelRightClose } from "lucide-react";
import type { Video, ChatMessage } from "@shared/schema";

interface SummaryPanelProps {
  selectedVideoIds: string[];
  currentVideoId: string | null;
  onCollapse?: () => void;
}

export default function SummaryPanel({ selectedVideoIds, currentVideoId, onCollapse }: SummaryPanelProps) {
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

  return (
    <div className="w-80 bg-white border-l border-slate-200/60 flex flex-col h-full">
      {/* Summary Section */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Summary</h3>
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
          <div className="bg-slate-50 rounded-xl p-4">
            {/* Key Points Section */}
            <div className="space-y-3 mb-6">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Key Points</h4>
              {(currentVideo.analysis as any)?.keyPoints?.map((point: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    index % 4 === 0 ? 'bg-indigo-400' :
                    index % 4 === 1 ? 'bg-purple-400' :
                    index % 4 === 2 ? 'bg-pink-400' : 'bg-blue-400'
                  }`}></div>
                  <span className="text-sm text-slate-600" data-testid={`key-point-${index}`}>
                    {point}
                  </span>
                </div>
              ))}
            </div>

            {/* Transcription Section */}
            {(currentVideo.analysis as any)?.transcription?.length > 0 && (
              <div className="space-y-3 mb-6">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Transcription</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {(currentVideo.analysis as any).transcription.map((line: string, index: number) => (
                    <div key={index} className="text-sm text-slate-600 leading-relaxed" data-testid={`transcription-line-${index}`}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {currentVideo && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex justify-between text-xs text-slate-500 mb-2">
                  <span>Duration</span>
                  <span data-testid="text-video-duration">
                    {currentVideo.duration ? formatDuration(currentVideo.duration) : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mb-2">
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
        ) : selectedVideoIds.length > 0 ? (
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium mb-2">Generate Summary</p>
            <p className="text-slate-400 text-sm mb-3">
              Create a comprehensive summary of your {selectedVideoIds.length} selected video{selectedVideoIds.length !== 1 ? 's' : ''}
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
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Create Summary
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-4 text-center">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium mb-2">No videos selected</p>
            <p className="text-slate-400 text-sm">Select videos to see their analysis summary</p>
          </div>
        )}
      </div>

      {/* Chat History */}
      <div className="flex-1 flex flex-col p-6 min-h-0">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex-shrink-0">Chat History</h3>
        
        {chatHistory.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium mb-2">No conversations yet</p>
            <p className="text-slate-400 text-sm">Start chatting to see your conversation history</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4">
              {chatHistory.slice(-6).map((chat) => (
                <div key={chat.id} className="space-y-2">
                  {/* User Message */}
                  <div className="flex justify-end" data-testid={`history-user-${chat.id}`}>
                    <div className="bg-indigo-500 text-white rounded-xl rounded-br-sm px-3 py-2 max-w-xs">
                      <p className="text-xs leading-relaxed">{chat.message}</p>
                      <p className="text-xs text-indigo-200 mt-1">
                        {formatTime(chat.timestamp)}
                      </p>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex justify-start" data-testid={`history-ai-${chat.id}`}>
                    <div className="bg-slate-100 text-slate-700 rounded-xl rounded-bl-sm px-3 py-2 max-w-xs">
                      <p className="text-xs leading-relaxed">
                        {chat.response.length > 100 
                          ? `${chat.response.substring(0, 100)}...` 
                          : chat.response
                        }
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatTime(chat.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
