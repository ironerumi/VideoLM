import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, Maximize, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { VideoWithFrames } from "@shared/types";
import { useI18n } from "@/lib/i18n";

// Sizing constants for consistent spacing
const TIMELINE_PADDING = 'p-2';
const THUMBNAIL_HEIGHT = 'h-8';
const THUMBNAIL_WIDTH = 'w-18';
const THUMBNAIL_SPACING = 'space-x-2';
const FRAME_WIDTH_PX = 80; // 18*4 + 8px gap

interface VideoPlayerProps {
  video: VideoWithFrames | undefined;
  videos: VideoWithFrames[];
  onVideoSelect: (videoId: string) => void;
  seekToTime?: number;
}

// Frame thumbnail component with proper error handling
interface FrameThumbnailProps {
  src: string;
  alt: string;
  timestamp: number;
  index: number;
  isPastFrame: boolean;
}

function FrameThumbnail({ src, alt, timestamp, index, isPastFrame }: FrameThumbnailProps) {
  const [hasError, setHasError] = useState(false);

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

  if (hasError) {
    return (
      <div className={`w-full h-full bg-gradient-to-br ${getGradient(index)} flex items-center justify-center`}>
        <span className="text-white text-xs">{timestamp.toFixed(1)}s</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`w-full h-full object-cover transition-all duration-300 ${
        isPastFrame ? 'grayscale opacity-60' : ''
      }`}
      onError={() => {
        console.error(`Failed to load frame at ${timestamp}s`);
        setHasError(true);
      }}
    />
  );
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
      // Each frame uses FRAME_WIDTH_PX constant
      const scrollPosition = targetFrameIndex * FRAME_WIDTH_PX;
      
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
                <source src={`api/videos/${video.id}/file?session=${video.sessionId}`} type="video/mp4" />
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

        {/* Thumbnail Timeline */}
        <div className={`${TIMELINE_PADDING} bg-white border-t border-slate-100 flex-shrink-0 min-w-0`}>
          <div className="overflow-x-auto max-w-full" ref={timelineRef}>
            <div className={`flex ${THUMBNAIL_SPACING} pb-2 w-max`}>
            {video?.thumbnails?.frames && Array.isArray(video.thumbnails.frames) && video.thumbnails.frames.length > 0 ? (
              video.thumbnails.frames.map((frame: any, index: number) => {
                const frameProgress = actualDuration > 0 ? (frame.timestamp / actualDuration) * 100 : 0;
                const isActive = Math.abs(progress - frameProgress) < 5; // Active within 5% range
                const isPastFrame = currentTime > frame.timestamp; // Frame has been passed in timeline
                
                return (
                  <div
                    key={frame.frameNumber}
                    className={`flex-shrink-0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT} rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 overflow-hidden ${
                      isActive ? 'ring-2 ring-indigo-400' : 'hover:ring-2 hover:ring-indigo-300'
                    }`}
                    onClick={() => handleSeek([frameProgress])}
                    data-testid={`thumbnail-${index}`}
                  >
{/* Frame image with React error fallback */}
                    <FrameThumbnail
                      src={`api/videos/${video.id}/frames/${frame.fileName}?session=${video.sessionId}`}
                      alt={`Frame at ${frame.timestamp.toFixed(1)}s`}
                      timestamp={frame.timestamp}
                      index={index}
                      isPastFrame={isPastFrame}
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
