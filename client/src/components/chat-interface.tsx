import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { sessionManager } from "@/lib/session";

interface ChatInterfaceProps {
  videoId: string | null;
  selectedVideoCount: number;
  onFrameClick?: (frameTime: number) => void;
}

export default function ChatInterface({ videoId, selectedVideoCount, onFrameClick }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data: chatHistory = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/videos", videoId, "chat"],
    enabled: !!videoId,
  });

  const chatMutation = useMutation({
    mutationFn: async ({ message, videoId }: { message: string; videoId: string }) => {
      const response = await apiRequest('POST', `/api/videos/${videoId}/chat`, { message });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", videoId, "chat"] });
      setMessage("");
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest('DELETE', `/api/videos/${videoId}/chat`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", videoId, "chat"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !videoId) return;
    
    chatMutation.mutate({ message: message.trim(), videoId });
  };

  const clearChatHistory = () => {
    if (!videoId) return;
    clearChatMutation.mutate(videoId);
  };

  const isLoading = chatMutation.isPending || clearChatMutation.isPending;

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">{t.chatInterface}</h3>
        <p className="text-sm text-slate-600">{t.askAboutSelectedVideo}</p>
      </div>
      
      {/* Chat History */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
          <h4 className="text-sm font-medium text-slate-700">{t.chatHistory}</h4>
          <button
            onClick={clearChatHistory}
            disabled={chatHistory.length === 0 || isLoading}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent rounded-md transition-colors duration-200 border border-slate-300 hover:border-red-300 disabled:border-slate-200"
            data-testid="button-clear-chat"
            title={chatHistory.length === 0 ? "No chat history to clear" : "Clear chat history"}
          >
            {t.clearHistory}
          </button>
        </div>
        <ScrollArea className="h-full p-6" ref={scrollRef}>
          {chatHistory.length === 0 && !videoId && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium mb-2">{t.noVideoSelectedChat}</p>
              <p className="text-slate-400 text-sm">{t.selectVideoToChat}</p>
            </div>
          )}

          {chatHistory.length === 0 && videoId && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-2">{t.aiAnalysisReady}</p>
                  <p className="text-sm text-white/90 leading-relaxed">
                    {t.aiReadyDescription}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Show only the latest interaction in Q&A format */}
          {chatHistory.length > 0 && (() => {
            const latestChat = chatHistory[chatHistory.length - 1];
            const rephrasedQuestion = (latestChat as any).rephrasedQuestion || latestChat.message;
            const relevantFrame = (latestChat as any).relevantFrame;
            
            // Extract multiple timestamps from response text
            const extractTimestampsFromResponse = (response: string): number[] => {
              const timestampRegex = /(\d{1,2}):(\d{2})/g;
              const timestamps: number[] = [];
              let match;
              
              while ((match = timestampRegex.exec(response)) !== null) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const totalSeconds = minutes * 60 + seconds;
                timestamps.push(totalSeconds);
              }
              
              return [...new Set(timestamps)]; // Remove duplicates
            };
            
            // Extract frame timestamp from filename if available
            const getFrameTimeFromFilename = (filename: string | null) => {
              if (!filename) return null;
              const match = filename.match(/frame_\d+_(\d+(\.\d+)?)s/);
              return match ? parseFloat(match[1]) : null;
            };
            
            const frameTime = getFrameTimeFromFilename(relevantFrame);
            const mentionedTimestamps = extractTimestampsFromResponse(latestChat.response);

            return (
              <div className="space-y-6" data-testid={`qa-latest-${latestChat.id}`}>
                {/* Question */}
                <div className="border-b border-slate-200 pb-4">
                  <h2 className="text-lg font-semibold text-slate-800 leading-relaxed">
                    {rephrasedQuestion}
                  </h2>
                  <p className="text-xs text-slate-500 mt-2">
                    {formatTime(latestChat.timestamp)}
                  </p>
                </div>

                {/* Answer */}
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-lg p-4 w-full">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 leading-relaxed japanese-filename">
                          {latestChat.response}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Frame Thumbnails - Show primary frame and additional mentioned timestamps */}
                  <div className="flex flex-col space-y-3 pt-2">
                    {/* Primary relevant frame */}
                    {relevantFrame && videoId && (
                      <div className="flex justify-center">
                        <button
                          onClick={() => frameTime && onFrameClick?.(frameTime)}
                          className="relative group"
                          data-testid={`frame-thumbnail-primary-${latestChat.id}`}
                        >
                          <img
                            src={`/api/videos/${videoId}/frames/${relevantFrame}?session=${sessionManager.getSessionId()}`}
                            alt="Primary relevant frame"
                            className="w-32 h-24 object-cover rounded-lg shadow-sm group-hover:shadow-md transition-all duration-200 group-hover:scale-105"
                            onError={(e) => {
                              console.error('Frame image failed to load:', relevantFrame);
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-all duration-200 flex items-center justify-center">
                            <div className="w-8 h-8 bg-white/0 group-hover:bg-white/90 rounded-full flex items-center justify-center transition-all duration-200">
                              <svg className="w-3 h-3 text-transparent group-hover:text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                          <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            Primary
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Additional timestamp frames */}
                    {mentionedTimestamps.length > 1 && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 text-center">Referenced moments:</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {mentionedTimestamps.slice(0, 6).map((timestamp, index) => {
                            const frameNumber = String(Math.floor(timestamp)).padStart(3, '0');
                            const frameName = `frame_${frameNumber}_${timestamp}s.jpg`;
                            
                            return (
                              <button
                                key={`${timestamp}-${index}`}
                                onClick={() => onFrameClick?.(timestamp)}
                                className="relative group"
                                data-testid={`frame-thumbnail-${timestamp}-${latestChat.id}`}
                              >
                                <img
                                  src={`/api/videos/${videoId}/frames/${frameName}?session=${sessionManager.getSessionId()}`}
                                  alt={`Frame at ${Math.floor(timestamp / 60)}:${String(timestamp % 60).padStart(2, '0')}`}
                                  className="w-20 h-15 object-cover rounded shadow-sm group-hover:shadow-md transition-all duration-200 group-hover:scale-105"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded transition-all duration-200 flex items-center justify-center">
                                  <div className="w-6 h-6 bg-white/0 group-hover:bg-white/90 rounded-full flex items-center justify-center transition-all duration-200">
                                    <svg className="w-2 h-2 text-transparent group-hover:text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z"/>
                                    </svg>
                                  </div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 rounded-b text-center">
                                  {Math.floor(timestamp / 60)}:{String(timestamp % 60).padStart(2, '0')}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {chatMutation.isPending && (
            <div className="flex justify-start mt-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-slate-600" />
                </div>
                <div className="bg-slate-100 text-slate-700 rounded-xl rounded-bl-sm px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Input - Fixed at bottom */}
      <div className="flex-shrink-0 p-6 border-t border-slate-100 bg-white">
        <form onSubmit={handleSubmit} className="relative">
          <Input
            type="text"
            placeholder={videoId ? t.askAnything : t.selectVideoToChat}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!videoId || chatMutation.isPending}
            className="w-full bg-slate-50 border-0 rounded-xl px-6 py-4 pr-24 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:bg-white transition-all duration-200"
            data-testid="input-chat-message"
          />
          
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
            {selectedVideoCount > 0 && (
              <span className="text-xs text-slate-400" data-testid="text-source-count">
                {selectedVideoCount} source{selectedVideoCount !== 1 ? 's' : ''}
              </span>
            )}
            <Button
              type="submit"
              disabled={!message.trim() || !videoId || chatMutation.isPending}
              className="bg-blue-400 hover:bg-blue-500 disabled:bg-slate-300 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
