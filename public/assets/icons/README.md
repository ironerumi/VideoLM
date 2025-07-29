# Custom Icons

This folder contains custom icons for the VideoLM application.

## App Icon

To replace the default app icon:

1. **Upload your custom icon** to this folder with one of these exact names:
   - `app-icon.svg` (recommended - scalable vector format)
   - `app-icon.png` (good quality bitmap)
   - `app-icon.jpg` or `app-icon.jpeg` (compressed format)

2. **Icon Requirements**:
   - Recommended size: 32x32px or larger (will be automatically resized to 32x32px)
   - Square aspect ratio works best
   - Clear, simple design that works at small sizes

3. **The application will automatically detect and use your custom icon** - no restart required!

## Current Setup

- `datarobot_favicon.png` - DataRobot favicon (source file)
- `app-icon.png` - Active app icon (currently using DataRobot favicon)
- Favicon configured in HTML to use DataRobot favicon

## Default Fallback

If no custom icon is found, the application uses a gradient background with video symbol.

## Testing Your Icon

1. Upload your icon file as `app-icon.svg` (or .png/.jpg)
2. Refresh the page
3. Your custom icon should appear in the top-left header

## Current Status

- Default icon: ✅ Gradient background with video symbol
- Custom icon detection: ✅ Ready for your upload
- Supported formats: SVG, PNG, JPG/JPEG