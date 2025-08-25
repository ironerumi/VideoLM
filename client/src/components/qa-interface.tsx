import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { sessionManager } from "@/lib/session";

interface QAInterfaceProps {
  videoId: string | null;
  selectedVideoCount: number;
  onFrameClick?: (frameTime: number) => void;
}

export default function QAInterface({ videoId, selectedVideoCount, onFrameClick }: QAInterfaceProps) {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data: chatHistory = [] } = useQuery<ChatMessage[]>({
    queryKey: ["api/videos", videoId, "chat"],
    enabled: !!videoId,
    refetchOnWindowFocus: false,
  });

  // Extract timestamp from frame name
  const extractTimestamp = (frameName: string) => {
    const match = frameName.match(/frame_\d+_(\d+(\.\d+)?)s/);
    return match ? parseFloat(match[1]) : 0;
  };

  // Derive current Q&A from latest message
  const currentQA = useMemo(() => {
    if (chatHistory.length === 0) return null;
    return [...chatHistory].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  }, [chatHistory]);

  // Memoized frame parsing and sorting
  const parseFrames = useMemo(() => (relevantFrame: string | null | string[]) => {
    if (!relevantFrame) return [];
    if (Array.isArray(relevantFrame)) return relevantFrame;
    try {
      return relevantFrame.startsWith('[') ? JSON.parse(relevantFrame) : [relevantFrame];
    } catch {
      return relevantFrame ? [relevantFrame] : [];
    }
  }, []);

  const sortedFrames = useMemo(() => {
    if (!currentQA?.relevantFrame) return [];
    const frames = parseFrames(currentQA.relevantFrame);
    return frames.sort((a: string, b: string) => {
      const timeA = extractTimestamp(a);
      const timeB = extractTimestamp(b);
      return timeA - timeB;
    });
  }, [currentQA?.relevantFrame, parseFrames]);

  const chatMutation = useMutation({
    mutationFn: async ({ message, videoId }: { message: string; videoId: string }) => {
      const response = await apiRequest('POST', `api/videos/${videoId}/chat`, { message });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api/videos", videoId, "chat"] });
      setMessage("");
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest('DELETE', `api/videos/${videoId}/chat`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api/videos", videoId, "chat"] });
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
  const isWaitingForResponse = chatMutation.isPending;

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };


  const handleFrameClick = (frameName: string) => {
    const timestamp = extractTimestamp(frameName);
    if (onFrameClick && timestamp >= 0) {
      onFrameClick(timestamp);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Q&A Display Area */}
      <div className="flex-1 overflow-hidden min-h-0">
        <ScrollArea className="h-full w-full" ref={scrollRef}>
          {!videoId ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center">
                <Bot className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-slate-700 mb-1">{t.noVideoSelectedChat}</h3>
                <p className="text-xs text-slate-500">{t.selectVideoToChat}</p>
              </div>
            </div>
          ) : currentQA ? (
            <div className="p-3 space-y-2 relative">
              {/* Question */}
              <div className="bg-slate-50 rounded p-2">
                <div className="text-slate-800 bg-white rounded p-2 border relative pl-6 text-sm">
                  <User className="h-3 w-3 absolute top-2 left-2 text-slate-500" />
                  {currentQA.rephrasedQuestion || currentQA.message}
                </div>
              </div>

              {/* Response */}
              <div className="bg-blue-50 rounded p-2">
                <div className="text-slate-800 bg-white rounded p-2 border relative pl-6 text-sm">
                  <Bot className="h-3 w-3 absolute top-2 left-2 text-slate-500" />
                  {currentQA.response}
                </div>
              </div>

              {/* Frames */}
              {currentQA.relevantFrame && (
                <div className="bg-amber-50 rounded p-2">
                  <div className="relative pl-4">
                    <svg className="h-3 w-3 absolute top-0.5 left-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21,15 16,10 5,21"/>
                    </svg>
                    <div className="flex flex-wrap gap-1">
                      {sortedFrames.map((frameName: string, index: number) => (
                        <button
                          key={index}
                          onClick={() => handleFrameClick(frameName)}
                          className="group relative overflow-hidden rounded border border-transparent hover:border-blue-500 transition-all duration-200"
                          data-testid={`frame-thumbnail-${index}`}
                        >
                          <img
                            src={`api/videos/${videoId}/frames/${frameName}?session=${sessionManager.getSessionId()}`}
                            alt={`Frame at ${extractTimestamp(frameName)}s`}
                            className="w-12 h-9 object-cover rounded-sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const parent = target.parentElement;
                              if (parent) {
                                parent.style.display = 'none';
                              }
                            }}
                          />
                          <div className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1 rounded-tl">
                            {Math.floor(extractTimestamp(frameName))}s
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Loading overlay for subsequent questions */}
              {isWaitingForResponse && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-slate-600 text-sm">Analyzing video...</p>
                  </div>
                </div>
              )}
            </div>
          ) : isWaitingForResponse ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-slate-600 text-sm">Analyzing video...</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center">
                <Bot className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-slate-700 mb-1">{t.aiAnalysisReady}</h3>
                <p className="text-xs text-slate-500">{t.aiReadyDescription}</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>



      {/* Input Section */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
        {!videoId ? (
          <div className="text-center text-slate-500">
            <p>{t.selectVideoFirst}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.askVideoQuestion}
              disabled={isLoading}
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button
              type="submit"
              disabled={!message.trim() || isLoading}
              className="px-4"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}