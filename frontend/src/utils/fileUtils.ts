/**
 * File handling utilities for chat file uploads
 */

// Maximum file size
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface ProcessedFile {
  filename: string;
  size: number;
  mimeType: string;
  filePath?: string; // Path after upload
  error?: string;
  _tempFile?: File; // Temporary file object before upload
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Create a processed file object from a File
 */
export function createProcessedFile(file: File): ProcessedFile {
  return {
    filename: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

/**
 * Format processed file for inclusion in chat message
 */
export function formatFileForMessage(file: ProcessedFile): string {
  if (file.error) {
    return `\n\n[Error with file ${file.filename}]: ${file.error}\n`;
  }

  if (file.filePath) {
    return `\n\n[File uploaded: ${file.filename} (${formatFileSize(file.size)})]\nPath: ${file.filePath}\n`;
  }

  return `\n\n[File: ${file.filename} (${formatFileSize(file.size)})]\n`;
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`,
    };
  }

  return { valid: true };
}
