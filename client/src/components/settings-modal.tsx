import { useState } from "react";
import { Trash2, AlertTriangle, X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataReset?: () => void;
}

export default function SettingsModal({ open, onOpenChange, onDataReset }: SettingsModalProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { language, setLanguage, t } = useI18n();

  const resetMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/reset'),
    onSuccess: () => {
      // Clear all cached queries and local state
      queryClient.clear();
      onDataReset?.();
      toast({
        title: t.resetComplete,
        description: t.resetSuccess,
      });
      setShowConfirmation(false);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: t.error,
        description: error instanceof Error ? error.message : t.resetFailed,
        variant: "destructive",
      });
    }
  });

  const handleReset = () => {
    resetMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{t.settings}</span>
          </DialogTitle>
          <DialogDescription>
            {t.settingsDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Language Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t.language}
            </h3>
            <p className="text-xs text-slate-600">{t.languageDescription}</p>
            <Select value={language} onValueChange={(value) => setLanguage(value as any)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t.english}</SelectItem>
                <SelectItem value="ja">{t.japanese}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900">{t.dataManagement}</h3>
            
            {!showConfirmation ? (
              <div className="flex items-start gap-3 p-3 border border-red-200 rounded-lg bg-red-50">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-800 font-medium">{t.resetAllData}</p>
                  <p className="text-xs text-red-700 mt-1">
                    {t.resetWarning}
                  </p>
                  <Button
                    onClick={() => setShowConfirmation(true)}
                    variant="outline"
                    size="sm"
                    className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                    data-testid="button-reset-data"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t.reset}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-3 border border-red-300 rounded-lg bg-red-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-semibold text-red-800">
                    {t.confirmTitle}
                  </p>
                </div>
                <p className="text-xs text-red-700">
                  {t.resetWarning}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleReset}
                    variant="destructive"
                    size="sm"
                    disabled={resetMutation.isPending}
                    data-testid="button-confirm-reset"
                  >
                    {resetMutation.isPending ? t.processing : t.confirmReset}
                  </Button>
                  <Button
                    onClick={() => setShowConfirmation(false)}
                    variant="outline"
                    size="sm"
                    data-testid="button-cancel-reset"
                  >
                    {t.cancel}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Future settings can be added here */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900">一般</h3>
            <p className="text-xs text-slate-500">
              今後のアップデートでより多くの設定が利用可能になります。
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            data-testid="button-close-settings"
          >
            {t.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}