#!/bin/bash

# Check for required arguments
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <video_path> <threshold>"
    exit 1
fi

VIDEO_PATH=$1
THRESHOLD=$2

echo "Analyzing video: $VIDEO_PATH"
echo "---------------------------------"

# Get video duration
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VIDEO_PATH")
echo "Video Duration: ${DURATION}s"

# Get total frames
TOTAL_FRAMES=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of default=noprint_wrappers=1:nokey=1 "$VIDEO_PATH")
echo "Total Frames in Video: $TOTAL_FRAMES"

# Run ffmpeg and count the number of selected frames
echo "Estimating frames with threshold: $THRESHOLD"
EXTRACTED_FRAMES=$(ffmpeg -nostats -i "$VIDEO_PATH" -vf "select='gt(scene,$THRESHOLD)',metadata=print" -an -f null - 2>&1 | grep -c "pts_time")
echo "Estimated Extracted Frames: $EXTRACTED_FRAMES"

# Calculate equivalent FPS
if (( $(echo "$DURATION > 0" | bc -l) )); then
    EQUIVALENT_FPS=$(echo "scale=2; $EXTRACTED_FRAMES / $DURATION" | bc)
    echo "Equivalent FPS: $EQUIVALENT_FPS frames/second"
else
    echo "Equivalent FPS: N/A (duration is zero)"
fi

echo "---------------------------------"