import { useState } from "react";
import { Plus, Play, Upload, Film, PanelLeftClose, Trash2 } from "lucide-react";
import VideoUpload from "./video-upload";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fixJapaneseDisplay } from "../utils/encoding";
import type { Video } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

interface VideoSourcePanelProps {
  videos: Video[];
  selectedVideoIds: string[];
  onVideoSelect: (videoId: string, selected: boolean) => void;
  onVideoPlay: (videoId: string) => void;
  onVideoUploaded: () => void;
  onVideoDelete: (videoId: string) => void;
  onCollapse?: () => void;
}

export default function VideoSourcePanel({
  videos,
  selectedVideoIds,
  onVideoSelect,
  onVideoPlay,
  onVideoUploaded,
  onVideoDelete,
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
    <div className="w-full bg-white border-r border-slate-200/60 flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{t.sources}</h2>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-soft"
              data-testid="button-add-source"
            >
              <Plus className="w-4 h-4 mr-1" />
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
            showCancel={true}
          />
        </div>
      )}

      {/* Videos List */}
      <div className="flex-1 px-6 pb-6 overflow-y-auto">
        {videos.length === 0 && !showUpload && (
          <div className="py-6">
            <VideoUpload
              onVideoUploaded={onVideoUploaded}
              onCancel={() => {}}
              showCancel={false}
            />
          </div>
        )}

        <RadioGroup 
          value={selectedVideoIds[0] || ""} 
          onValueChange={(value) => onVideoSelect(value, true)}
          className="space-y-3 mt-6"
        >
          {videos.map((video, index) => (
            <div
              key={video.id}
              className={`bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors group border-2 ${
                selectedVideoIds.includes(video.id) ? 'border-indigo-200 bg-indigo-50' : 'border-transparent'
              }`}
              data-testid={`video-item-${video.id}`}
            >
              <div className="grid grid-cols-[auto_auto_1fr_auto] gap-3 items-center min-w-0">
                <RadioGroupItem
                  value={video.id}
                  className="w-4 h-4 text-indigo-500"
                  data-testid={`radio-${video.id}`}
                />
                <div 
                  className={`w-10 sm:w-12 h-8 bg-gradient-to-br ${getGradient(index)} rounded flex items-center justify-center cursor-pointer hover:scale-105 transition-transform flex-shrink-0`}
                  onClick={() => onVideoPlay(video.id)}
                  data-testid={`play-${video.id}`}
                >
                  <Play className="w-3 h-3 text-white fill-current" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p 
                    className="text-sm font-medium text-slate-700 truncate japanese-filename"
                    title={fixJapaneseDisplay(video.originalName)}
                    data-testid={`text-name-${video.id}`}
                  >
                    {fixJapaneseDisplay(video.originalName)}
                  </p>
                  <p 
                    className="text-xs text-slate-400 truncate"
                    data-testid={`text-duration-${video.id}`}
                  >
                    {video.duration ? formatDuration(video.duration) : 'Unknown'}
                  </p>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVideoDelete(video.id);
                  }}
                  variant="ghost"
                  size="sm"
                  className="opacity-60 group-hover:opacity-100 hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0 w-8 h-8 p-0"
                  data-testid={`button-delete-${video.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
