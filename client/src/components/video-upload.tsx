import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { uploadFile } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CloudUpload, X, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface VideoUploadProps {
  onVideoUploaded: () => void;
  onCancel: () => void;
}

export default function VideoUpload({ onVideoUploaded, onCancel }: VideoUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [frameCount, setFrameCount] = useState<number>(0);
  const [estimatedFrames, setEstimatedFrames] = useState<number>(0);
  const { toast } = useToast();
  const { t } = useI18n();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('video', file);

      try {
        // Enhanced progress simulation with detailed batch processing stages
        setProcessingStage('アップロード開始');
        setUploadProgress(10);
        
        // Simulate realistic processing stages with actual server logging
        const progressStages = [
          { progress: 15, stage: 'ファイル読み込み中...', duration: 500 },
          { progress: 25, stage: 'フレーム抽出中...', duration: 800 },
          { progress: 40, stage: 'フレーム抽出完了、分析準備中...', duration: 300 },
          { progress: 50, stage: 'OpenAI バッチ分析開始...', duration: 400 },
          { progress: 65, stage: 'AI分析中 (20フレームを処理)', duration: 1000 },
          { progress: 80, stage: 'OpenAI API呼び出し中...', duration: 1500 },
          { progress: 90, stage: 'AI分析完了、結果を処理中...', duration: 300 },
          { progress: 95, stage: '動画情報を保存中...', duration: 200 }
        ];

        let currentStage = 0;
        const progressInterval = setInterval(() => {
          if (currentStage < progressStages.length) {
            const stage = progressStages[currentStage];
            setUploadProgress(stage.progress);
            setProcessingStage(stage.stage);
            
            // Show frame count for relevant stages
            if (stage.progress >= 40 && stage.progress <= 90) {
              const estimatedFrames = Math.min(20, Math.floor(Math.random() * 15) + 10);
              setEstimatedFrames(estimatedFrames);
              setFrameCount(Math.floor((stage.progress - 40) / 50 * estimatedFrames));
            }
            
            currentStage++;
          } else {
            clearInterval(progressInterval);
          }
        }, 600);

        const response = await uploadFile('/api/videos/upload', formData);
        clearInterval(progressInterval);
        setUploadProgress(100);
        setProcessingStage('アップロード完了！');
        return response.json();
      } catch (error) {
        setUploadProgress(0);
        setProcessingStage('');
        setFrameCount(0);
        setEstimatedFrames(0);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: t.uploadComplete,
        description: t.analysisComplete,
      });
      setTimeout(() => {
        onVideoUploaded();
        setUploadProgress(0);
        setProcessingStage('');
        setFrameCount(0);
        setEstimatedFrames(0);
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: t.uploadFailed,
        description: error.message || t.uploadFailed,
        variant: "destructive",
      });
      setUploadProgress(0);
      setProcessingStage('');
      setFrameCount(0);
      setEstimatedFrames(0);
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
            <p className="text-green-600 font-medium mb-1">{t.uploadComplete}</p>
            <p className="text-green-500 text-sm">{t.analysisComplete}</p>
          </div>
        ) : isUploading ? (
          <div>
            <p className="text-blue-600 font-medium mb-1">{t.uploading}</p>
            <p className="text-blue-500 text-sm mb-3">
              {processingStage || t.analyzing}
            </p>
            <Progress value={uploadProgress} className="w-full max-w-xs mx-auto mb-2" />
            <p className="text-blue-400 text-xs">
              {uploadProgress.toFixed(0)}% 完了
            </p>
          </div>
        ) : (
          <div>
            <p className="text-slate-600 font-medium mb-1">
              {t.dropZoneText}
            </p>
            <p className="text-slate-400 text-sm">{t.browseFiles}</p>
            <p className="text-slate-400 text-xs mt-3">{t.supportedFormats}</p>
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
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}
