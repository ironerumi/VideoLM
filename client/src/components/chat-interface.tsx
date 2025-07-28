import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage } from "@shared/schema";

interface ChatInterfaceProps {
  videoId: string | null;
  selectedVideoCount: number;
}

export default function ChatInterface({ videoId, selectedVideoCount }: ChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !videoId) return;
    
    chatMutation.mutate({ message: message.trim(), videoId });
  };

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
    <div className="px-8 pb-8">
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        {/* Chat History */}
        <ScrollArea className="h-64 p-6" ref={scrollRef}>
          {chatHistory.length === 0 && !videoId && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium mb-2">No video selected</p>
              <p className="text-slate-400 text-sm">Select a video to start chatting about its content</p>
            </div>
          )}

          {chatHistory.length === 0 && videoId && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-2">AI Analysis Ready</p>
                  <p className="text-sm text-white/90 leading-relaxed">
                    I've analyzed your video and I'm ready to answer questions about its content, 
                    visual elements, and any other aspects you'd like to explore. What would you like to know?
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {chatHistory.map((chat) => (
              <div key={chat.id} className="space-y-3">
                {/* User Message */}
                <div className="flex justify-end" data-testid={`user-message-${chat.id}`}>
                  <div className="bg-indigo-500 text-white rounded-xl rounded-br-sm px-4 py-2 max-w-xs lg:max-w-md">
                    <p className="text-sm japanese-filename">{chat.message}</p>
                    <p className="text-xs text-indigo-200 mt-1">
                      {formatTime(chat.timestamp)}
                    </p>
                  </div>
                </div>

                {/* AI Response */}
                <div className="flex justify-start" data-testid={`ai-response-${chat.id}`}>
                  <div className="flex items-start space-x-3 max-w-xs lg:max-w-md">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="bg-slate-100 text-slate-700 rounded-xl rounded-bl-sm px-4 py-2">
                      <p className="text-sm leading-relaxed japanese-filename">{chat.response}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatTime(chat.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

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

        {/* Chat Input */}
        <div className="p-6 border-t border-slate-100">
          <form onSubmit={handleSubmit} className="relative">
            <Input
              type="text"
              placeholder={videoId ? "Ask anything about the video..." : "Select a video to start chatting"}
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
                className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:hover:scale-100"
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
