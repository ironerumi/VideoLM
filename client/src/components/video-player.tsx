import { useState, useRef } from "react";
import { Play, Pause, Volume2, Maximize, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Video } from "@shared/schema";

interface VideoPlayerProps {
  video: Video | undefined;
  videos: Video[];
  onVideoSelect: (videoId: string) => void;
}

export default function VideoPlayer({ video, videos, onVideoSelect }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current && video?.duration) {
      const time = (value[0] / 100) * video.duration;
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const getGradient = (index: number) => {
    const gradients = [
      'from-purple-400 to-blue-500',
      'from-blue-400 to-purple-500',
      'from-pink-400 to-purple-500',
      'from-purple-500 to-pink-400',
      'from-blue-500 to-indigo-500',
    ];
    return gradients[index % gradients.length];
  };

  const progress = video?.duration ? (currentTime / video.duration) * 100 : 0;

  return (
    <div className="p-8 h-full">
      <div className="bg-white rounded-2xl shadow-premium overflow-hidden h-full flex flex-col">
        {/* Video Display */}
        <div className="relative bg-black aspect-video flex-shrink-0">
          {video ? (
            <>
              {/* Abstract flowing background - matching the design */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-blue-500 to-pink-500 opacity-90"></div>
              <div 
                className="absolute inset-0" 
                style={{
                  background: `
                    radial-gradient(circle at 30% 70%, rgba(139, 92, 246, 0.8) 0%, transparent 50%), 
                    radial-gradient(circle at 70% 30%, rgba(99, 102, 241, 0.8) 0%, transparent 50%), 
                    radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.6) 0%, transparent 50%)
                  `
                }}
              ></div>
              
              {/* Hidden video element for functionality */}
              <video
                ref={videoRef}
                className="hidden"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => {
                  // Video duration is automatically set when metadata loads
                }}
                data-testid="video-element"
              />
              
              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  onClick={handlePlayPause}
                  className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-300 transform hover:scale-110 border-0"
                  data-testid="button-play-pause"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 text-white" />
                  ) : (
                    <Play className="w-8 h-8 text-white ml-1" />
                  )}
                </Button>
              </div>

              {/* Video Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                <div className="flex items-center space-x-4 text-white">
                  <Button
                    onClick={handlePlayPause}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-indigo-300 p-2"
                    data-testid="button-play-controls"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  
                  <div className="flex-1">
                    <Slider
                      value={[progress]}
                      onValueChange={handleSeek}
                      max={100}
                      step={0.1}
                      className="w-full mb-2"
                      data-testid="slider-progress"
                    />
                    <div className="flex justify-between text-xs text-white/80">
                      <span data-testid="text-current-time">{formatTime(currentTime)}</span>
                      <span data-testid="text-total-time">{video.duration ? formatTime(video.duration) : '0:00'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Volume2 className="w-4 h-4" />
                    <Slider
                      value={[volume * 100]}
                      onValueChange={handleVolumeChange}
                      max={100}
                      step={1}
                      className="w-20"
                      data-testid="slider-volume"
                    />
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-indigo-300 p-2"
                    data-testid="button-fullscreen"
                  >
                    <Maximize className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium">Select a video to play</p>
                <p className="text-slate-400 text-sm">Choose from your uploaded videos</p>
              </div>
            </div>
          )}
        </div>

        {/* Thumbnail Timeline */}
        <div className="p-6 bg-white border-t border-slate-100 flex-shrink-0">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Video Timeline</h4>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {video?.thumbnails && Array.isArray(video.thumbnails) ? (
              video.thumbnails.map((thumb, index) => (
                <div
                  key={index}
                  className={`flex-shrink-0 w-24 h-14 bg-gradient-to-br ${getGradient(index)} rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 ${
                    Math.floor(progress / 20) === index ? 'ring-2 ring-indigo-400' : 'hover:ring-2 hover:ring-indigo-300'
                  }`}
                  onClick={() => handleSeek([index * 20])}
                  data-testid={`thumbnail-${index}`}
                >
                  <div className="w-full h-full rounded-lg bg-black/10 flex items-center justify-center">
                    <span className="text-white text-xs font-medium">{index * 20}%</span>
                  </div>
                </div>
              ))
            ) : (
              // Placeholder thumbnails when no video is selected
              Array.from({ length: 5 }, (_, index) => (
                <div
                  key={index}
                  className={`flex-shrink-0 w-24 h-14 bg-gradient-to-br ${getGradient(index)} rounded-lg opacity-50`}
                  data-testid={`placeholder-thumbnail-${index}`}
                >
                  <div className="w-full h-full rounded-lg bg-black/10 flex items-center justify-center">
                    <span className="text-white text-xs opacity-60">{index + 1}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
