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

interface QAInterfaceProps {
  videoId: string | null;
  selectedVideoCount: number;
  onFrameClick?: (frameTime: number) => void;
}

export default function QAInterface({ videoId, selectedVideoCount, onFrameClick }: QAInterfaceProps) {
  const [message, setMessage] = useState("");
  const [currentQA, setCurrentQA] = useState<ChatMessage | null>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
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
      setIsWaitingForResponse(false);
    },
    onError: () => {
      setIsWaitingForResponse(false);
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const response = await apiRequest('DELETE', `/api/videos/${videoId}/chat`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos", videoId, "chat"] });
      setCurrentQA(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !videoId) return;
    
    // Clear the current Q&A when asking a new question
    setCurrentQA(null);
    setIsWaitingForResponse(true);
    
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

  // Get the latest Q&A pair (most recent message)
  useEffect(() => {
    if (chatHistory.length > 0 && !isWaitingForResponse) {
      const latestMessage = chatHistory[chatHistory.length - 1];
      setCurrentQA(latestMessage);
    }
  }, [chatHistory, isWaitingForResponse]);

  // Parse frames from relevantFrame field
  const parseFrames = (relevantFrame: string | null) => {
    if (!relevantFrame) return [];
    
    try {
      // Handle both string and array formats
      if (relevantFrame.startsWith('[')) {
        return JSON.parse(relevantFrame);
      } else {
        return [relevantFrame];
      }
    } catch {
      return relevantFrame ? [relevantFrame] : [];
    }
  };

  // Sort frames chronologically by extracting timestamp
  const sortFramesChronologically = (frames: string[]) => {
    return frames.sort((a, b) => {
      const timeA = extractTimestamp(a);
      const timeB = extractTimestamp(b);
      return timeA - timeB;
    });
  };

  const extractTimestamp = (frameName: string) => {
    const match = frameName.match(/frame_(\d+)_(\d+)s/);
    return match ? parseInt(match[2]) : 0;
  };

  const handleFrameClick = (frameName: string) => {
    const timestamp = extractTimestamp(frameName);
    if (onFrameClick && timestamp > 0) {
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
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">{t.qaInterface}</h3>
        <p className="text-sm text-slate-600">{t.askAboutSelectedVideo}</p>
      </div>
      
      {/* Q&A Display Area */}
      <div className="flex-1 overflow-hidden min-h-0">
        <ScrollArea className="h-full" ref={scrollRef}>
          {!videoId ? (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center">
                <Bot className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">{t.noVideoSelectedChat}</h3>
                <p className="text-slate-500">{t.selectVideoToChat}</p>
              </div>
            </div>
          ) : currentQA ? (
            // Display the latest Q&A in three sections
            <div className="p-6 space-y-6">
              {/* Section 1: Rephrased Question */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  {t.rephrasedQuestion}
                </h4>
                <div className="text-slate-800 bg-white rounded-md p-3 border">
                  {currentQA.rephrasedQuestion || currentQA.message}
                </div>
              </div>

              {/* Section 2: Bot Response */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center">
                  <Bot className="h-4 w-4 mr-2" />
                  {t.botResponse}
                </h4>
                <div className="text-slate-800 bg-white rounded-md p-3 border">
                  {currentQA.response}
                </div>
              </div>

              {/* Section 3: Related Frames */}
              {currentQA.relevantFrame && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-amber-700 mb-3 flex items-center">
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21,15 16,10 5,21"/>
                    </svg>
                    {t.relatedFrames}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {sortFramesChronologically(parseFrames(currentQA.relevantFrame)).map((frameName, index) => (
                      <button
                        key={index}
                        onClick={() => handleFrameClick(frameName)}
                        className="group relative overflow-hidden rounded-lg border-2 border-transparent hover:border-blue-500 transition-all duration-200"
                        data-testid={`frame-thumbnail-${index}`}
                      >
                        <img
                          src={`/api/videos/${videoId}/frames/${frameName}?session=${sessionManager.getSessionId()}`}
                          alt={`Frame at ${extractTimestamp(frameName)}s`}
                          className="w-16 h-12 object-cover rounded-md"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                          <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {extractTimestamp(frameName)}s
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isWaitingForResponse ? (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Analyzing video and generating response...</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-6">
              <div className="text-center">
                <Bot className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">{t.aiAnalysisReady}</h3>
                <p className="text-slate-500">{t.aiReadyDescription}</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>



      {/* Input Section */}
      <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
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