import { useState, useEffect } from 'react';

interface AppIconProps {
  className?: string;
  size?: number;
}

export default function AppIcon({ className = "w-8 h-8", size = 32 }: AppIconProps) {
  const [customIcon, setCustomIcon] = useState<string | null>(null);
  const [iconLoaded, setIconLoaded] = useState(false);

  useEffect(() => {
    // Check for custom icons in order of preference
    const checkCustomIcon = async () => {
      const iconFormats = ['svg', 'png', 'jpg', 'jpeg'];
      
      for (const format of iconFormats) {
        try {
          const iconPath = `/assets/icons/app-icon.${format}`;
          const response = await fetch(iconPath, { method: 'HEAD' });
          if (response.ok) {
            setCustomIcon(iconPath);
            setIconLoaded(true);
            return;
          }
        } catch (error) {
          // Continue to next format
        }
      }
      
      // No custom icon found, use default
      setIconLoaded(true);
    };

    checkCustomIcon();
  }, []);

  if (!iconLoaded) {
    // Loading state - show a subtle placeholder
    return (
      <div className={`${className} bg-slate-200 rounded-lg animate-pulse`} />
    );
  }

  if (customIcon) {
    // Custom icon found
    return (
      <div className={`${className} rounded-lg overflow-hidden flex items-center justify-center`}>
        <img 
          src={customIcon} 
          alt="VideoLM"
          className="w-full h-full object-cover"
          style={{ width: size, height: size }}
        />
      </div>
    );
  }

  // Default gradient icon with video symbol
  return (
    <div className={`${className} bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center`}>
      <i className="fas fa-video text-white text-sm"></i>
    </div>
  );
}