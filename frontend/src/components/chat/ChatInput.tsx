import React, { useRef, useEffect, useState } from "react";
import { StopIcon } from "@heroicons/react/24/solid";
import { UI_CONSTANTS, KEYBOARD_SHORTCUTS } from "../../utils/constants";
import { useEnterBehavior } from "../../hooks/useEnterBehavior";
import { EnterModeMenu } from "./EnterModeMenu";
import { PermissionInputPanel } from "./PermissionInputPanel";
import { FileUpload } from "./FileUpload";
import type { ProcessedFile } from "../../utils/fileUtils";
import { formatFileSize } from "../../utils/fileUtils";
import { X, FileText, Image, File } from "lucide-react";

interface PermissionData {
  patterns: string[];
  onAllow: () => void;
  onAllowPermanent: () => void;
  onDeny: () => void;
  getButtonClassName?: (
    buttonType: "allow" | "allowPermanent" | "deny",
    defaultClassName: string,
  ) => string;
  onSelectionChange?: (selection: "allow" | "allowPermanent" | "deny") => void;
  externalSelectedOption?: "allow" | "allowPermanent" | "deny" | null;
}

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  currentRequestId: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
  // Permission mode props
  showPermissions?: boolean;
  permissionData?: PermissionData;
  // File upload props
  onFilesChange?: (files: ProcessedFile[]) => void;
  files?: ProcessedFile[];
  sessionId?: string | null;
  workingDirectory?: string;
}

export function ChatInput({
  input,
  isLoading,
  currentRequestId,
  onInputChange,
  onSubmit,
  onAbort,
  showPermissions = false,
  permissionData,
  onFilesChange,
  files = [],
  sessionId,
  workingDirectory,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { enterBehavior } = useEnterBehavior();

  const removeFile = (index: number) => {
    if (onFilesChange) {
      const updatedFiles = files.filter((_, i) => i !== index);
      onFilesChange(updatedFiles);
    }
  };

  const clearAllFiles = () => {
    if (onFilesChange) {
      onFilesChange([]);
    }
  };

  const getFileIcon = (file: ProcessedFile) => {
    if (file.error) {
      return <X className="w-4 h-4" />;
    }
    const ext = file.filename.toLowerCase().split(".").pop() || "";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
      return <Image className="w-4 h-4" />;
    }
    if (
      [
        "txt",
        "md",
        "js",
        "ts",
        "jsx",
        "tsx",
        "py",
        "java",
        "cpp",
        "c",
        "h",
        "json",
        "xml",
        "yaml",
        "yml",
      ].includes(ext)
    ) {
      return <FileText className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const getFileColor = (file: ProcessedFile) => {
    if (file.error) {
      return "text-red-600 dark:text-red-400";
    }
    if (file.filePath) {
      return "text-green-600 dark:text-green-400";
    }
    return "text-gray-600 dark:text-gray-400";
  };

  // Focus input when not loading and not in permission mode
  useEffect(() => {
    if (!isLoading && !showPermissions && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, showPermissions]);

  // Handle ESC key for permission denial
  useEffect(() => {
    if (!showPermissions || !permissionData) return;

    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_SHORTCUTS.ABORT) {
        e.preventDefault();
        permissionData.onDeny();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => document.removeEventListener("keydown", handleEscKey);
  }, [showPermissions, permissionData]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const computedStyle = getComputedStyle(textarea);
      const maxHeight =
        parseInt(computedStyle.maxHeight, 10) ||
        UI_CONSTANTS.TEXTAREA_MAX_HEIGHT;
      const scrollHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === KEYBOARD_SHORTCUTS.SUBMIT && !isComposing) {
      if (enterBehavior === "newline") {
        handleNewlineModeKeyDown(e);
      } else {
        handleSendModeKeyDown(e);
      }
    }
  };

  const handleNewlineModeKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    // Newline mode: Enter adds newline, Shift+Enter sends
    if (e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    // Enter is handled naturally by textarea (adds newline)
  };

  const handleSendModeKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    // Send mode: Enter sends, Shift+Enter adds newline
    if (!e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    // Shift+Enter is handled naturally by textarea (adds newline)
  };
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    // Add small delay to handle race condition between composition and keydown events
    setTimeout(() => setIsComposing(false), 0);
  };

  // If we're in permission mode, show the permission panel instead
  if (showPermissions && permissionData) {
    return (
      <PermissionInputPanel
        patterns={permissionData.patterns}
        onAllow={permissionData.onAllow}
        onAllowPermanent={permissionData.onAllowPermanent}
        onDeny={permissionData.onDeny}
        getButtonClassName={permissionData.getButtonClassName}
        onSelectionChange={permissionData.onSelectionChange}
        externalSelectedOption={permissionData.externalSelectedOption}
      />
    );
  }

  return (
    <div className="flex-shrink-0">
      {/* Files display area */}
      {files.length > 0 && (
        <div className="mb-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {files.length} file{files.length > 1 ? "s" : ""} attached
            </span>
            <button
              onClick={clearAllFiles}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              type="button"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-1">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded"
              >
                <span className={getFileColor(file)}>{getFileIcon(file)}</span>
                <span className="text-sm flex-1 truncate">{file.filename}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(file.size)}
                </span>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  type="button"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={
              isLoading && currentRequestId
                ? "Processing..."
                : "Type message..."
            }
            rows={1}
            className={`w-full px-4 py-3 pl-12 pr-40 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm shadow-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none overflow-hidden min-h-[48px] max-h-[${UI_CONSTANTS.TEXTAREA_MAX_HEIGHT}px]`}
            disabled={isLoading}
          />
          {onFilesChange && (
            <div className="absolute left-2 bottom-3 z-10">
              <FileUpload
                onFilesProcessed={onFilesChange}
                disabled={isLoading}
                sessionId={sessionId || null}
                workingDirectory={workingDirectory}
              />
            </div>
          )}
          <div className="absolute right-2 bottom-3 flex gap-2">
            {isLoading && currentRequestId && (
              <button
                type="button"
                onClick={onAbort}
                className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                title="Stop (ESC)"
              >
                <StopIcon className="w-4 h-4" />
              </button>
            )}
            <EnterModeMenu />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 text-sm"
            >
              {isLoading ? "..." : "Send"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
