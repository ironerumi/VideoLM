import { useState } from "react";
import { Plus, Play, Upload, Film, PanelLeftClose } from "lucide-react";
import VideoUpload from "./video-upload";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { fixJapaneseDisplay } from "../utils/encoding";
import type { Video } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

interface VideoSourcePanelProps {
  videos: Video[];
  selectedVideoIds: string[];
  onVideoSelect: (videoId: string, selected: boolean) => void;
  onVideoPlay: (videoId: string) => void;
  onVideoUploaded: () => void;
  onCollapse?: () => void;
}

export default function VideoSourcePanel({
  videos,
  selectedVideoIds,
  onVideoSelect,
  onVideoPlay,
  onVideoUploaded,
  onCollapse,
}: VideoSourcePanelProps) {
  const [showUpload, setShowUpload] = useState(false);
  const { t } = useI18n();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGradient = (index: number) => {
    const gradients = [
      'from-purple-400 to-blue-500',
      'from-blue-400 to-purple-500',
      'from-pink-400 to-purple-500',
      'from-purple-500 to-pink-400',
      'from-blue-500 to-indigo-500',
      'from-indigo-500 to-purple-500',
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="w-80 bg-white border-r border-slate-200/60 flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{t.sources}</h2>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-soft"
              data-testid="button-add-source"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t.uploadTitle}
            </Button>
            {onCollapse && (
              <Button
                onClick={onCollapse}
                variant="ghost"
                size="sm"
                className="text-slate-500 hover:text-slate-700"
                data-testid="button-collapse-left-panel"
              >
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Area */}
      {showUpload && (
        <div className="p-6 border-b border-slate-100">
          <VideoUpload
            onVideoUploaded={() => {
              onVideoUploaded();
              setShowUpload(false);
            }}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* Videos List */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        {videos.length === 0 && !showUpload && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Film className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium mb-2">{t.noVideos}</p>
            <p className="text-slate-400 text-sm mb-4">{t.uploadFirst}</p>
            <Button
              onClick={() => setShowUpload(true)}
              variant="outline"
              size="sm"
              data-testid="button-upload-first"
            >
              <Upload className="w-4 h-4 mr-2" />
              {t.uploadTitle}
            </Button>
          </div>
        )}

        <div className="space-y-3 mt-6">
          {videos.map((video, index) => (
            <div
              key={video.id}
              className="bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors cursor-pointer group"
              data-testid={`video-item-${video.id}`}
            >
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={selectedVideoIds.includes(video.id)}
                  onCheckedChange={(checked) => 
                    onVideoSelect(video.id, checked as boolean)
                  }
                  className="w-4 h-4 text-indigo-500 rounded focus:ring-2 focus:ring-indigo-200"
                  data-testid={`checkbox-${video.id}`}
                />
                <div 
                  className={`w-12 h-8 bg-gradient-to-br ${getGradient(index)} rounded flex items-center justify-center cursor-pointer hover:scale-105 transition-transform`}
                  onClick={() => onVideoPlay(video.id)}
                  data-testid={`play-${video.id}`}
                >
                  <Play className="w-3 h-3 text-white fill-current" />
                </div>
                <div className="flex-1 min-w-0">
                  <p 
                    className="text-sm font-medium text-slate-700 truncate japanese-filename"
                    title={fixJapaneseDisplay(video.originalName)}
                    data-testid={`text-name-${video.id}`}
                  >
                    {fixJapaneseDisplay(video.originalName)}
                  </p>
                  <p 
                    className="text-xs text-slate-400"
                    data-testid={`text-duration-${video.id}`}
                  >
                    {video.duration ? formatDuration(video.duration) : 'Unknown'}
                  </p>
                </div>
                <div className={`w-2 h-2 rounded-full transition-opacity ${
                  selectedVideoIds.includes(video.id) 
                    ? 'bg-green-400 opacity-100' 
                    : 'bg-slate-300 opacity-0 group-hover:opacity-100'
                }`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
