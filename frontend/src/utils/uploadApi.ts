/**
 * File upload API utilities
 */

import type { UploadResponse } from "../../../shared/types";

/**
 * Upload a file to the server
 * @param file The file to upload
 * @param sessionId Current session ID
 * @param workingDirectory Optional working directory
 * @returns Upload response with file path or error
 */
export async function uploadFile(
  file: File,
  sessionId: string,
  workingDirectory?: string,
): Promise<UploadResponse> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", sessionId);
    if (workingDirectory) {
      formData.append("workingDirectory", workingDirectory);
    }

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const result: UploadResponse = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Upload failed: ${response.statusText}`);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
