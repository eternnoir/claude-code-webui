import React, { useState, useEffect } from "react";
import { Dialog } from "../common/Dialog";
import {
  FileIcon,
  FolderIcon,
  ImageIcon,
  FileTextIcon,
  DownloadIcon,
  ChevronRightIcon,
  HomeIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PDFPreview } from "./PDFPreview";
import type {
  FileInfo,
  FilesListResponse,
  FileContentResponse,
} from "@shared/types";

interface FileManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectEncodedName: string;
}

// Helper function to get icon for file type
function getFileIcon(file: FileInfo) {
  if (file.type === "directory") {
    return <FolderIcon className="h-5 w-5 text-blue-500" />;
  }

  const ext = file.extension?.toLowerCase() || "";

  // Image files
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"].includes(ext)) {
    return <ImageIcon className="h-5 w-5 text-green-500" />;
  }

  // PDF files
  if (ext === "pdf") {
    return <FileTextIcon className="h-5 w-5 text-red-500" />;
  }

  // Text/code files
  if (
    [
      "md",
      "txt",
      "json",
      "js",
      "ts",
      "jsx",
      "tsx",
      "html",
      "css",
      "xml",
      "yaml",
      "yml",
    ].includes(ext)
  ) {
    return <FileTextIcon className="h-5 w-5 text-blue-500" />;
  }

  return <FileIcon className="h-5 w-5 text-gray-500" />;
}

// Helper function to format file size
function formatFileSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

export function FileManagerDialog({
  isOpen,
  onClose,
  projectEncodedName,
}: FileManagerDialogProps) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<FileContentResponse | null>(
    null,
  );
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");

  // Load files when dialog opens or path changes
  useEffect(() => {
    if (isOpen) {
      loadFiles(currentPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectEncodedName, currentPath]);

  const loadFiles = async (path: string = "") => {
    setLoading(true);
    setError(null);

    try {
      const url = path
        ? `/api/projects/${projectEncodedName}/files?path=${encodeURIComponent(path)}`
        : `/api/projects/${projectEncodedName}/files`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to load files");
      }

      const data: FilesListResponse = await response.json();
      setFiles(data.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (file: FileInfo) => {
    if (file.type === "directory") {
      // Navigate into directory
      const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
      setCurrentPath(newPath);
      setSelectedFile(null);
      setFileContent(null);
      return;
    }

    setSelectedFile(file);
    setContentLoading(true);
    setContentError(null);
    setFileContent(null);

    try {
      const encodedPath = encodeURIComponent(file.path);
      const response = await fetch(
        `/api/projects/${projectEncodedName}/files/${encodedPath}`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load file content");
      }

      const data: FileContentResponse = await response.json();
      setFileContent(data);
    } catch (err) {
      setContentError(
        err instanceof Error ? err.message : "Failed to load file content",
      );
    } finally {
      setContentLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedFile) return;

    try {
      // Use the same encoding as in handleFileClick for consistency
      const encodedPath = encodeURIComponent(selectedFile.path);
      const downloadUrl = `/api/projects/${projectEncodedName}/files/${encodedPath}/download`;

      // Fetch the file as a blob
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();

      // Create a blob URL and download
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = selectedFile.name; // This will preserve the exact filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const renderFilePreview = () => {
    if (!selectedFile || !fileContent) return null;

    if (contentLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      );
    }

    if (contentError) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-red-500">{contentError}</div>
        </div>
      );
    }

    const ext = selectedFile.extension?.toLowerCase() || "";

    // Image preview
    if (
      fileContent.type.startsWith("image/") &&
      fileContent.encoding === "base64"
    ) {
      return (
        <div className="flex h-full items-center justify-center p-4">
          <img
            src={`data:${fileContent.type};base64,${fileContent.content}`}
            alt={selectedFile.name}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }

    // PDF preview
    if (
      ext === "pdf" &&
      fileContent.type === "application/pdf" &&
      fileContent.encoding === "base64"
    ) {
      return (
        <PDFPreview
          content={fileContent.content}
          fileName={selectedFile.name}
        />
      );
    }

    // Markdown preview
    if (ext === "md" && fileContent.encoding === "utf-8") {
      return (
        <div className="prose prose-sm max-w-none p-4 dark:prose-invert">
          <ReactMarkdown>{fileContent.content}</ReactMarkdown>
        </div>
      );
    }

    // Text preview
    if (fileContent.encoding === "utf-8") {
      return (
        <pre className="overflow-auto p-4 text-sm">
          <code>{fileContent.content}</code>
        </pre>
      );
    }

    // Binary files
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500">Cannot preview this file type</div>
      </div>
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="File Manager"
      size="full"
      className="h-[90vh] max-w-[95vw]"
    >
      <div className="flex h-full">
        {/* File list */}
        <div className="flex w-1/3 flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="p-4 pb-2">
            {/* Breadcrumb navigation */}
            <div className="mb-2 flex items-center text-sm">
              <button
                onClick={() => {
                  setCurrentPath("");
                  setSelectedFile(null);
                  setFileContent(null);
                }}
                className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <HomeIcon className="mr-1 h-4 w-4" />
                Root
              </button>
              {currentPath
                .split("/")
                .filter(Boolean)
                .map((segment, index, arr) => {
                  const path = arr.slice(0, index + 1).join("/");
                  return (
                    <React.Fragment key={path}>
                      <ChevronRightIcon className="mx-1 h-4 w-4 text-gray-400" />
                      <button
                        onClick={() => {
                          setCurrentPath(path);
                          setSelectedFile(null);
                          setFileContent(null);
                        }}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {segment}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Files
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pt-2">
            {loading && (
              <div className="text-sm text-gray-500">Loading files...</div>
            )}

            {error && <div className="text-sm text-red-500">{error}</div>}

            {!loading && !error && files.length === 0 && (
              <div className="text-sm text-gray-500">
                No files in data directory
              </div>
            )}

            <div className="space-y-1">
              {files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => handleFileClick(file)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedFile?.path === file.path
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                  disabled={false}
                >
                  {getFileIcon(file)}
                  <span className="flex-1 truncate">{file.name}</span>
                  {file.size !== undefined && (
                    <span className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* File preview */}
        <div className="flex flex-1 flex-col">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {selectedFile.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Download
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderFilePreview()}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              Select a file to preview
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
