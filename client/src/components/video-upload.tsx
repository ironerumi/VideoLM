import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { uploadFile } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CloudUpload, X, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoUploadProps {
  onVideoUploaded: () => void;
  onCancel: () => void;
}

export default function VideoUpload({ onVideoUploaded, onCancel }: VideoUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      try {
        const response = await uploadFile('/api/videos/upload', formData);
        clearInterval(progressInterval);
        setUploadProgress(100);
        return response.json();
      } catch (error) {
        clearInterval(progressInterval);
        setUploadProgress(0);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Upload successful",
        description: "Your video has been uploaded and analyzed.",
      });
      setTimeout(() => {
        onVideoUploaded();
        setUploadProgress(0);
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload video. Please try again.",
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm']
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const isUploading = uploadMutation.isPending;
  const isCompleted = uploadProgress === 100;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
          isDragActive 
            ? 'border-indigo-400 bg-indigo-50/30' 
            : isUploading 
            ? 'border-blue-300 bg-blue-50/20' 
            : isCompleted
            ? 'border-green-300 bg-green-50/20'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
        }`}
        data-testid="video-upload-dropzone"
      >
        <input {...getInputProps()} data-testid="input-video-file" />
        
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
          {isCompleted ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : isUploading ? (
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <CloudUpload className={`w-6 h-6 transition-colors ${
              isDragActive ? 'text-indigo-500' : 'text-slate-400'
            }`} />
          )}
        </div>

        {isCompleted ? (
          <div>
            <p className="text-green-600 font-medium mb-1">Upload completed!</p>
            <p className="text-green-500 text-sm">Video analyzed and ready to use</p>
          </div>
        ) : isUploading ? (
          <div>
            <p className="text-blue-600 font-medium mb-1">Uploading and analyzing...</p>
            <p className="text-blue-500 text-sm mb-3">Please wait while we process your video</p>
            <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
          </div>
        ) : (
          <div>
            <p className="text-slate-600 font-medium mb-1">
              {isDragActive ? 'Drop your video here' : 'Drag & drop videos here'}
            </p>
            <p className="text-slate-400 text-sm">or click to browse</p>
            <p className="text-slate-400 text-xs mt-3">MP4, MOV, AVI up to 100MB</p>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isUploading}
          data-testid="button-cancel-upload"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
