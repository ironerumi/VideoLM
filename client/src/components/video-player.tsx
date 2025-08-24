import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, Maximize, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { VideoWithFrames } from "@shared/types";
import { useI18n } from "@/lib/i18n";

interface VideoPlayerProps {
  video: VideoWithFrames | undefined;
  videos: VideoWithFrames[];
  onVideoSelect: (videoId: string) => void;
  seekToTime?: number;
}

export default function VideoPlayer({ video, videos, onVideoSelect, seekToTime }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const pendingPlayRef = useRef<Promise<void> | null>(null);
  const { t } = useI18n();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    // Wait for any current play() to finish before issuing another play/pause
    if (pendingPlayRef.current) {
      try {
        await pendingPlayRef.current;
      } catch (e) {
        // Ignore; we only care that it's finished
      }
      pendingPlayRef.current = null;
    }

    if (isPlaying) {
      setIsPlaying(false);
      videoRef.current.pause();
    } else {
      setIsPlaying(true);
      try {
        // Store the play promise so we can sequence properly
        pendingPlayRef.current = videoRef.current.play();
        await pendingPlayRef.current;
      } catch (error) {
        console.warn('Play interrupted:', error);
        // Revert state on error
        setIsPlaying(false);
      } finally {
        pendingPlayRef.current = null;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      const duration = videoRef.current.duration || video?.duration || 0;
      if (duration > 0) {
        const time = (value[0] / 100) * duration;
        videoRef.current.currentTime = time;
        setCurrentTime(time);
      }
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

  // Handle seeking to specific time when requested
  useEffect(() => {
    if (seekToTime !== undefined && videoRef.current) {
      videoRef.current.currentTime = seekToTime;
      setCurrentTime(seekToTime);
      
      // Scroll timeline to show the selected frame as the first visible frame
      scrollTimelineToFrame(seekToTime);
    }
  }, [seekToTime]);

  // Reset video state when video changes
  useEffect(() => {
  if (videoRef.current) {
    videoRef.current.pause();
    videoRef.current.load(); // reloads new source
    videoRef.current.volume = volume;
    setIsPlaying(false);
    setCurrentTime(0);
  }
}, [video?.id]);


  // Function to scroll timeline to show specific frame as first visible
  const scrollTimelineToFrame = (targetTime: number) => {
    if (!timelineRef.current || !video?.thumbnails?.frames) return;
    
    // Find the frame that matches or is closest to the target time
    const frames = video.thumbnails.frames as any[];
    const targetFrameIndex = frames.findIndex(frame => Math.abs(frame.timestamp - targetTime) < 0.5);
    
    if (targetFrameIndex >= 0) {
      // Each frame is w-24 (96px) + space-x-2 (8px gap) = 104px per frame
      const frameWidth = 104;
      const scrollPosition = targetFrameIndex * frameWidth;
      
      // Smooth scroll to position
      timelineRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }
  };

  // Use actual video element duration when available, fallback to database duration
  const actualDuration = videoRef.current?.duration || video?.duration || 0;
  const progress = actualDuration > 0 ? (currentTime / actualDuration) * 100 : 0;

  return (
    <div className="p-8 h-full flex flex-col min-h-0 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-premium overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Video Display */}
        <div 
          className="relative bg-black flex-1 flex items-center justify-center min-h-0"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {video ? (
            <>
              {/* Actual video element */}
              <video
                // Use video ID as key to ensure re-render on video change
                key={video?.id}
                ref={videoRef}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => {
                  // Video duration is automatically set when metadata loads
                }}
                onError={(e) => {
                  console.error('Video loading error:', e);
                }}
                data-testid="video-element"
              >
                <source src={`/api/videos/${video.id}/file?session=${video.sessionId}`} type="video/mp4" />
                {t.browserNotSupported || 'Your browser does not support the video tag.'}
              </video>
              
              {/* Play Button Overlay */}
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                !isPlaying || isHovered ? 'opacity-100' : 'opacity-0'
              }`}>
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
                      <span data-testid="text-total-time">{formatTime(actualDuration)}</span>
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
                <p className="text-slate-500 font-medium">{t.noVideoSelected}</p>
                <p className="text-slate-400 text-sm">{t.selectToPlay}</p>
              </div>
            </div>
          )}
        </div>

        {/* Thumbnail Timeline - Real Extracted Frames */}
        <div className="p-6 bg-white border-t border-slate-100 flex-shrink-0 min-w-0">
          <div className="overflow-x-auto max-w-full" ref={timelineRef}>
            <div className="flex space-x-2 pb-2 w-max">
            {video?.thumbnails?.frames && Array.isArray(video.thumbnails.frames) && video.thumbnails.frames.length > 0 ? (
              video.thumbnails.frames.map((frame: any, index: number) => {
                const frameProgress = actualDuration > 0 ? (frame.timestamp / actualDuration) * 100 : 0;
                const isActive = Math.abs(progress - frameProgress) < 5; // Active within 5% range
                const isPastFrame = currentTime > frame.timestamp; // Frame has been passed in timeline
                
                return (
                  <div
                    key={frame.frameNumber}
                    className={`flex-shrink-0 w-24 h-14 rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 overflow-hidden ${
                      isActive ? 'ring-2 ring-indigo-400' : 'hover:ring-2 hover:ring-indigo-300'
                    }`}
                    onClick={() => handleSeek([frameProgress])}
                    data-testid={`thumbnail-${index}`}
                  >
                    <img
                      src={`api/videos/${video.id}/frames/${frame.fileName}?session=${video.sessionId}`}
                      alt={`Frame at ${frame.timestamp.toFixed(1)}s`}
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        isPastFrame ? 'grayscale opacity-60' : ''
                      }`}
                      onError={(e) => {
                        console.error(`Failed to load frame: ${frame.fileName}`);
                        // Fallback to gradient if frame loading fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          // Add gradient classes properly by splitting them
                          const gradientClasses = `bg-gradient-to-br ${getGradient(index)}`.split(' ');
                          parent.classList.add(...gradientClasses);
                          
                          // Create elements safely using DOM methods
                          const containerDiv = document.createElement('div');
                          containerDiv.className = 'w-full h-full flex items-center justify-center';
                          
                          const timestampSpan = document.createElement('span');
                          timestampSpan.className = 'text-white text-xs';
                          timestampSpan.textContent = `${frame.timestamp.toFixed(1)}s`;
                          
                          containerDiv.appendChild(timestampSpan);
                          parent.appendChild(containerDiv);
                        }
                      }}
                    />
                  </div>
                );
              })
            ) : (
              // Show message when no frames are available
              <div className="flex items-center justify-center w-full py-4">
                <span className="text-slate-500 text-sm">{t.frameNotExtracted}</span>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
