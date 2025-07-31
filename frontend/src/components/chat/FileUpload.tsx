import { useRef } from "react";
import { Paperclip } from "lucide-react";
import {
  validateFile,
  createProcessedFile,
  type ProcessedFile,
} from "../../utils/fileUtils";
import { uploadFile } from "../../utils/uploadApi";

interface FileUploadProps {
  onFilesProcessed: (files: ProcessedFile[]) => void;
  disabled?: boolean;
  sessionId: string | null;
  workingDirectory?: string;
}

export function FileUpload({
  onFilesProcessed,
  disabled,
  sessionId,
  workingDirectory,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: ProcessedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = validateFile(file);

      if (!validation.valid) {
        newFiles.push({
          filename: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          error: validation.error || "Unknown error",
        });
        continue;
      }

      // If we have a sessionId, upload immediately
      if (sessionId) {
        const uploadResult = await uploadFile(
          file,
          sessionId,
          workingDirectory,
        );

        if (uploadResult.success && uploadResult.filePath) {
          newFiles.push({
            ...createProcessedFile(file),
            filePath: uploadResult.filePath,
          });
        } else {
          newFiles.push({
            ...createProcessedFile(file),
            error: uploadResult.error || "Upload failed",
          });
        }
      } else {
        // No sessionId yet, just store the file info
        // The actual file will be uploaded when the first message is sent
        newFiles.push({
          ...createProcessedFile(file),
          // Store the actual File object temporarily
          _tempFile: file,
        } as ProcessedFile & { _tempFile?: File });
      }
    }

    onFilesProcessed(newFiles);

    // Clear the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />

      {/* Upload button only */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Attach files"
        type="button"
      >
        <Paperclip className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>
    </>
  );
}
