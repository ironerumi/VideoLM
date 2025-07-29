import { useState } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: () => apiRequest('/api/reset', 'POST'),
    onSuccess: () => {
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries();
      toast({
        title: "Reset Complete",
        description: "All videos and data have been cleared successfully.",
      });
      setShowConfirmation(false);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Failed to reset data",
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
            <span>Settings</span>
          </DialogTitle>
          <DialogDescription>
            Manage your VideoLM preferences and data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Reset Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900">Data Management</h3>
            
            {!showConfirmation ? (
              <div className="flex items-start gap-3 p-3 border border-red-200 rounded-lg bg-red-50">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-800 font-medium">Reset All Data</p>
                  <p className="text-xs text-red-700 mt-1">
                    This will permanently delete all uploaded videos, chat messages, and session data.
                  </p>
                  <Button
                    onClick={() => setShowConfirmation(true)}
                    variant="outline"
                    size="sm"
                    className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                    data-testid="button-reset-data"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Reset Data
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-3 border border-red-300 rounded-lg bg-red-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <p className="text-sm font-semibold text-red-800">
                    Are you absolutely sure?
                  </p>
                </div>
                <p className="text-xs text-red-700">
                  This action cannot be undone. All your videos, chat history, and session data will be permanently deleted.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleReset}
                    variant="destructive"
                    size="sm"
                    disabled={resetMutation.isPending}
                    data-testid="button-confirm-reset"
                  >
                    {resetMutation.isPending ? "Resetting..." : "Yes, Delete Everything"}
                  </Button>
                  <Button
                    onClick={() => setShowConfirmation(false)}
                    variant="outline"
                    size="sm"
                    data-testid="button-cancel-reset"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Future settings can be added here */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900">General</h3>
            <p className="text-xs text-slate-500">
              More settings will be available in future updates.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            data-testid="button-close-settings"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}