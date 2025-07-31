/**
 * File upload handler
 * Saves uploaded files to a temporary directory in the working directory
 */

import type { Context } from "hono";
import type { Runtime } from "../runtime/types.ts";
import type { UploadResponse } from "../../shared/types.ts";

export async function handleUpload(
  c: Context,
  runtime: Runtime,
): Promise<Response> {
  try {
    // Get form data
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;
    const workingDirectory = formData.get("workingDirectory") as string | null;

    if (!file) {
      const response: UploadResponse = {
        success: false,
        error: "No file provided",
      };
      return c.json(response, 400);
    }

    if (!sessionId) {
      const response: UploadResponse = {
        success: false,
        error: "No session ID provided",
      };
      return c.json(response, 400);
    }

    // Use working directory or current directory
    const baseDir = workingDirectory || runtime.getCurrentWorkingDirectory();

    // Create temp directory structure
    const tempDir = `${baseDir}/.claude-temp`;
    const sessionDir = `${tempDir}/${sessionId}`;

    // Ensure directories exist
    try {
      await runtime.mkdir(tempDir);
    } catch (e) {
      // Directory might already exist
    }

    try {
      await runtime.mkdir(sessionDir);
    } catch (e) {
      // Directory might already exist
    }

    // Generate unique filename to avoid collisions
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}_${safeFileName}`;
    const filePath = `${sessionDir}/${fileName}`;

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const content = new Uint8Array(arrayBuffer);

    // Write file to disk
    await runtime.writeBinaryFile(filePath, content);

    // Return relative path from working directory
    const relativePath = filePath.startsWith(baseDir + "/")
      ? filePath.substring(baseDir.length + 1)
      : filePath;

    const response: UploadResponse = {
      success: true,
      filePath: relativePath,
    };

    return c.json(response);
  } catch (error) {
    console.error("[Upload] Error:", error);
    const response: UploadResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return c.json(response, 500);
  }
}
