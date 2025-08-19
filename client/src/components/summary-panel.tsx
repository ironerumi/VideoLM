import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText, Clock, PanelRightClose, ChevronDown, ChevronRight } from "lucide-react";
import type { Video, ChatMessage } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { sessionManager } from "@/lib/session";

// Utility function to parse timestamps from text
const parseTimestampFromText = (text: string): { timestamp: number; start: number; end: number } | null => {
  const match = text.match(/\[(\d{2}):(\d{2})\]/);
  if (match) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const timestamp = minutes * 60 + seconds;
    return {
      timestamp,
      start: match.index!,
      end: match.index! + match[0].length
    };
  }
  return null;
};

// Component for rendering text with clickable timestamps
interface ClickableTextProps {
  text: string;
  onTimestampClick?: (timestamp: number) => void;
  className?: string;
  testId?: string;
}

function ClickableText({ text, onTimestampClick, className, testId }: ClickableTextProps) {
  const timestampInfo = parseTimestampFromText(text);
  
  if (!timestampInfo || !onTimestampClick) {
    return <p className={className} data-testid={testId}>{text}</p>;
  }
  
  const { timestamp, start, end } = timestampInfo;
  const beforeTimestamp = text.slice(0, start);
  const timestampText = text.slice(start, end);
  const afterTimestamp = text.slice(end);
  
  return (
    <p className={className} data-testid={testId}>
      {beforeTimestamp}
      <button
        onClick={() => onTimestampClick(timestamp)}
        className="text-indigo-600 hover:text-indigo-800 underline cursor-pointer font-medium transition-colors"
      >
        {timestampText}
      </button>
      {afterTimestamp}
    </p>
  );
}

interface SummaryPanelProps {
  selectedVideoIds: string[];
  currentVideoId: string | null;
  onCollapse?: () => void;
  onFrameClick?: (frameTime: number) => void;
}

interface CollapsibleSectionProps {
  id: string;
  title: string;
  subtitle: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  maxHeight?: number;
  testId?: string;
}

function CollapsibleSection({ 
  id, 
  title, 
  subtitle, 
  isExpanded, 
  onToggle, 
  children, 
  maxHeight,
  testId 
}: CollapsibleSectionProps) {
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        className="w-full py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        onClick={onToggle}
        data-testid={testId}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>{title}</span>
            <span className="text-xs font-normal text-slate-500">
              {subtitle}
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="pb-4">
          <ScrollArea 
            className="w-full" 
            style={{ height: maxHeight ? `${maxHeight}px` : '300px' }}
          >
            <div className="pr-4">
              {children}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export default function SummaryPanel({ selectedVideoIds, currentVideoId, onCollapse, onFrameClick }: SummaryPanelProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State for tracking expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['key-points', 'transcription', 'chat-history', 'metadata'])
  );
  
  // State for dynamic height calculation
  const [availableHeight, setAvailableHeight] = useState<number>(0);
  
  // Calculate available height for content
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const headerHeight = 80; // Approximate header height
        setAvailableHeight(containerHeight - headerHeight);
      }
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);
  
  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };
  
  // Calculate height for each expanded section
  const getContentHeight = (sectionId: string) => {
    if (!expandedSections.has(sectionId)) return 0;
    
    const expandedCount = expandedSections.size;
    if (expandedCount === 0) return 0;
    
    const headerHeight = 48; // Height of each section header
    const paddingHeight = 16; // Bottom padding for each section
    const totalHeadersHeight = 4 * headerHeight; // All 4 section headers
    const totalPaddingHeight = expandedCount * paddingHeight; // Padding for expanded sections
    const availableContentHeight = Math.max(150, availableHeight - totalHeadersHeight - totalPaddingHeight);
    
    return Math.max(120, Math.floor(availableContentHeight / expandedCount));
  };
  
  const { data: videos = [] } = useQuery<Video[]>({
    queryKey: ["api/videos"],
  });

  const { data: chatHistory = [] } = useQuery<ChatMessage[]>({
    queryKey: ["api/videos", currentVideoId, "chat"],
    enabled: !!currentVideoId,
  });

  const summaryMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      const response = await apiRequest('POST', 'api/videos/summary', { videoIds });
      return response.json();
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest('DELETE', `api/videos/${videoId}/chat`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api/videos", currentVideoId, "chat"] });
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


  return (
    <div className="w-full bg-white border-l border-slate-200/60 flex flex-col h-full" ref={containerRef}>
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
              <p className="text-sm text-slate-700 leading-relaxed mb-3 break-keep" data-testid="text-generated-summary">
                {summaryMutation.data.summary}
              </p>
              <div className="text-xs text-slate-500">
                Based on {summaryMutation.data.videoCount} video{summaryMutation.data.videoCount !== 1 ? 's' : ''}
              </div>
            </div>
          ) : currentVideo?.analysis ? (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Key Points Section */}
              <CollapsibleSection
                id="key-points"
                title={t.keyPoints}
                subtitle={`${(currentVideo.analysis as any)?.keyPoints?.length || 0} items`}
                isExpanded={expandedSections.has('key-points')}
                onToggle={() => toggleSection('key-points')}
                maxHeight={getContentHeight('key-points')}
                testId="button-toggle-key-points"
              >
                <div className="space-y-3 p-2">
                  {(currentVideo.analysis as any)?.keyPoints?.map((point: string, index: number) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        index % 4 === 0 ? 'bg-indigo-400' :
                        index % 4 === 1 ? 'bg-purple-400' :
                        index % 4 === 2 ? 'bg-pink-400' : 'bg-blue-400'
                      }`}></div>
                      <ClickableText
                        text={point}
                        onTimestampClick={onFrameClick}
                        className="text-sm text-slate-600 leading-relaxed break-keep"
                        testId={"key-point-" + index}
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Transcription Section */}
              {(currentVideo.analysis as any)?.transcription?.length > 0 && (
                <CollapsibleSection
                  id="transcription"
                  title={t.transcription}
                  subtitle={`${(currentVideo.analysis as any).transcription.length} entries`}
                  isExpanded={expandedSections.has('transcription')}
                  onToggle={() => toggleSection('transcription')}
                  maxHeight={getContentHeight('transcription')}
                  testId="button-toggle-transcription"
                >
                  <div className="space-y-3 p-2">
                    {(currentVideo.analysis as any).transcription.map((line: string, index: number) => (
                      <ClickableText
                        key={index}
                        text={line}
                        onTimestampClick={onFrameClick}
                        className="text-sm text-slate-600 leading-relaxed break-keep"
                        testId={"transcription-line-" + index}
                      />
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Chat History Section */}
              <CollapsibleSection
                id="chat-history"
                title={t.chatHistoryTab}
                subtitle={`${chatHistory.length} messages`}
                isExpanded={expandedSections.has('chat-history')}
                onToggle={() => toggleSection('chat-history')}
                maxHeight={getContentHeight('chat-history')}
              >
                {chatHistory.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Clock className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium mb-1">{t.noVideoSelectedChat}</p>
                    <p className="text-slate-400 text-xs">{t.selectVideoToChat}</p>
                  </div>
                ) : (
                  <div className="space-y-4 p-2">
                    <div className="flex justify-end">
                      <button
                        onClick={clearChatHistory}
                        disabled={clearChatMutation.isPending}
                        className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent rounded border border-slate-300 hover:border-red-300 disabled:border-slate-200 transition-colors duration-200"
                        data-testid="button-clear-chat"
                        title={chatHistory.length === 0 ? "No chat history to clear" : "Clear chat history"}
                      >
                        {t.clearHistory}
                      </button>
                    </div>
                    <div className="space-y-4">
                      {chatHistory.slice(-6).map((chat) => {
                        const getFrameTimeFromFilename = (filename: string | null) => {
                          if (!filename) return null;
                          const match = filename.match(/frame_\d+_(\d+(\.\d+)?)s/);
                          return match ? parseFloat(match[1]) : null;
                        };

                        const frameTime = getFrameTimeFromFilename((chat as any).relevantFrame);

                        return (
                          <div key={chat.id} className="space-y-2" data-testid={"chat-item-" + chat.id}>
                            <div className="border-b border-slate-100 pb-2">
                              <h5 className="text-sm font-medium text-slate-800 leading-relaxed">
                                {(chat as any).rephrasedQuestion || chat.message}
                              </h5>
                              <p className="text-xs text-slate-500 mt-1">
                                {formatTime(chat.timestamp)}
                              </p>
                            </div>
                            <div className="flex items-start space-x-3">
                              {(chat as any).relevantFrame && currentVideoId && (
                                <button
                                  onClick={() => frameTime && onFrameClick?.(frameTime)}
                                  className="flex-shrink-0 w-14 h-10 bg-slate-200 rounded-lg overflow-hidden hover:ring-2 hover:ring-indigo-300 transition-all duration-200 transform hover:scale-105"
                                  data-testid={"frame-thumbnail-" + chat.id}
                                >
                                  <img
                                    src={`api/videos/${currentVideoId}/frames/${(chat as any).relevantFrame}?session=${sessionManager.getSessionId()}`}
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
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 leading-relaxed break-keep">
                                  {chat.response}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CollapsibleSection>
              
              {/* Metadata Section */}
              {currentVideo && (
                <CollapsibleSection
                  id="metadata"
                  title="Metadata"
                  subtitle={`${currentVideo.format} • ${formatFileSize(currentVideo.size)}`}
                  isExpanded={expandedSections.has('metadata')}
                  onToggle={() => toggleSection('metadata')}
                  maxHeight={getContentHeight('metadata')}
                  testId="button-toggle-video-details"
                >
                  <div className="space-y-3 p-2">
                    <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-600">{t.duration}</span>
                      <span className="text-sm text-slate-800" data-testid="text-video-duration">
                        {currentVideo.duration ? formatDuration(currentVideo.duration) : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-600">{t.format}</span>
                      <span className="text-sm text-slate-800" data-testid="text-video-format">{currentVideo.format}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-sm font-medium text-slate-600">{t.fileSize}</span>
                      <span className="text-sm text-slate-800" data-testid="text-video-size">{formatFileSize(currentVideo.size)}</span>
                    </div>
                  </div>
                </CollapsibleSection>
              )}
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
    </div>
  );
}
