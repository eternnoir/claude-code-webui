/**
 * File manager handlers
 * Provides APIs for listing and reading files in the data directory
 */

import type { Context } from "hono";
import type { Runtime, DirectoryEntry } from "../runtime/types.ts";
import type {
  FilesListResponse,
  FileContentResponse,
  FileInfo,
} from "../../shared/types.ts";
import { getProjectPathFromEncodedName } from "../history/pathUtils.ts";

// Helper function to get file extension
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.substring(lastDot + 1).toLowerCase();
}

// Helper function to determine MIME type from extension
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    // Text files
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    js: "application/javascript",
    ts: "application/typescript",
    jsx: "application/javascript",
    tsx: "application/typescript",
    html: "text/html",
    css: "text/css",
    xml: "application/xml",
    yaml: "text/yaml",
    yml: "text/yaml",
    toml: "text/toml",
    ini: "text/plain",
    log: "text/plain",

    // Images
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",

    // Documents
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    // Archives
    zip: "application/zip",
    tar: "application/x-tar",
    gz: "application/gzip",

    // Media
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    avi: "video/x-msvideo",
    mov: "video/quicktime",
  };

  return mimeTypes[extension] || "application/octet-stream";
}

// Check if file is text-based
function isTextFile(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript" ||
    mimeType === "application/xml"
  );
}

// Check if file is an image
function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

// Helper function to safely resolve paths and prevent directory traversal
function safeResolvePath(basePath: string, relativePath: string): string {
  // Remove any leading slashes
  const cleanPath = relativePath.replace(/^\/+/, "");

  // Split and filter out dangerous patterns
  const parts = cleanPath.split("/").filter((part) => {
    return part !== "" && part !== "." && part !== "..";
  });

  // Join with base path
  return basePath + "/" + parts.join("/");
}

/**
 * List files in the data directory
 */
export async function handleFilesList(
  c: Context,
  runtime: Runtime,
): Promise<Response> {
  try {
    const encodedProjectName = c.req.param("encodedProjectName");
    if (!encodedProjectName) {
      return c.json({ error: "Project name is required" }, 400);
    }

    // Get actual project path from encoded name
    const projectPath = await getProjectPathFromEncodedName(
      encodedProjectName,
      runtime,
    );
    if (!projectPath) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Get the path parameter from query string
    const pathParam = c.req.query("path") || "";

    // Prevent directory traversal attacks
    if (pathParam.includes("..") || pathParam.startsWith("/")) {
      return c.json({ error: "Access denied: Invalid path" }, 403);
    }

    // Use the project root path instead of data subdirectory
    const rootPath = projectPath;
    const targetPath = pathParam
      ? safeResolvePath(rootPath, pathParam)
      : rootPath;

    // Check if directory exists
    const directoryExists = await runtime.exists(targetPath);
    if (!directoryExists) {
      // Return empty list if directory doesn't exist
      const response: FilesListResponse = {
        files: [],
        currentPath: pathParam,
      };
      return c.json(response);
    }

    // Read directory contents
    const entries: DirectoryEntry[] = [];
    for await (const entry of runtime.readDir(targetPath)) {
      entries.push(entry);
    }

    // Convert to FileInfo array
    const files: FileInfo[] = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = `${targetPath}/${entry.name}`;
        const relativePath = pathParam
          ? `${pathParam}/${entry.name}`
          : entry.name;

        try {
          const stat = await runtime.stat(fullPath);
          const extension = entry.isFile
            ? getFileExtension(entry.name)
            : undefined;

          return {
            name: entry.name,
            path: relativePath,
            type: entry.isDirectory ? "directory" : "file",
            size: entry.isFile ? stat.size : undefined,
            modifiedTime: stat.mtime
              ? new Date(stat.mtime).toISOString()
              : undefined,
            extension,
          };
        } catch (error) {
          // If we can't stat the file, return basic info
          console.error(`Failed to stat ${fullPath}:`, error);
          return {
            name: entry.name,
            path: relativePath,
            type: entry.isDirectory ? "directory" : "file",
          };
        }
      }),
    );

    // Sort files: directories first, then by name
    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    const response: FilesListResponse = {
      files,
      currentPath: pathParam,
    };

    return c.json(response);
  } catch (error) {
    console.error("[Files List] Error:", error);
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to list files",
      },
      500,
    );
  }
}

/**
 * Get file content
 */
export async function handleFileContent(
  c: Context,
  runtime: Runtime,
): Promise<Response> {
  try {
    const encodedProjectName = c.req.param("encodedProjectName");
    const pathParam = c.req.param("path"); // Path parameter for the file path

    console.log("[File Content] encodedProjectName:", encodedProjectName);
    console.log("[File Content] pathParam:", pathParam);
    console.log("[File Content] full path:", c.req.path);

    if (!encodedProjectName || !pathParam) {
      return c.json({ error: "Project name and file path are required" }, 400);
    }

    // Get actual project path from encoded name
    const projectPath = await getProjectPathFromEncodedName(
      encodedProjectName,
      runtime,
    );
    if (!projectPath) {
      return c.json({ error: "Project not found" }, 404);
    }

    // The path comes already decoded from the URL, no need to decode again
    const filePath = pathParam;

    // Prevent directory traversal attacks
    if (filePath.includes("..") || filePath.startsWith("/")) {
      return c.json({ error: "Access denied: Invalid file path" }, 403);
    }

    // Resolve the full path safely
    const fullPath = safeResolvePath(projectPath, filePath);

    // Check if file exists
    const exists = await runtime.exists(fullPath);
    if (!exists) {
      return c.json({ error: "File not found" }, 404);
    }

    // Get file stats
    const stat = await runtime.stat(fullPath);
    if (stat.isDirectory) {
      return c.json({ error: "Cannot read directory content" }, 400);
    }

    // Check file size (limit to 10MB for safety)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (stat.size > maxSize) {
      return c.json({ error: "File too large to preview" }, 413);
    }

    // Determine MIME type
    const extension = getFileExtension(filePath);
    const mimeType = getMimeType(extension);
    const isText = isTextFile(mimeType);
    const isImage = isImageFile(mimeType);

    let content: string;
    let encoding: "utf-8" | "base64";

    if (isText) {
      // Read as text
      content = await runtime.readTextFile(fullPath);
      encoding = "utf-8";
    } else if (isImage || stat.size <= 1024 * 1024) {
      // Images or small binary files (< 1MB)
      // Read as binary and encode to base64
      const buffer = await runtime.readBinaryFile(fullPath);
      content = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      encoding = "base64";
    } else {
      // Large binary files - don't read content
      return c.json({ error: "File type not supported for preview" }, 415);
    }

    const response: FileContentResponse = {
      content,
      type: mimeType,
      encoding,
      size: stat.size,
    };

    return c.json(response);
  } catch (error) {
    console.error("[File Content] Error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to read file" },
      500,
    );
  }
}

/**
 * Download file
 */
export async function handleFileDownload(
  c: Context,
  runtime: Runtime,
): Promise<Response> {
  try {
    const encodedProjectName = c.req.param("encodedProjectName");
    let pathParam = c.req.param("path"); // Path parameter for the file path

    console.log("[File Download] Request path:", c.req.path);
    console.log("[File Download] Path param:", pathParam);

    if (!encodedProjectName || !pathParam) {
      return c.json({ error: "Project name and file path are required" }, 400);
    }

    // Remove the "/download" suffix from the path
    if (pathParam.endsWith("/download")) {
      pathParam = pathParam.slice(0, -9); // Remove "/download"
    }

    // Get actual project path from encoded name
    const projectPath = await getProjectPathFromEncodedName(
      encodedProjectName,
      runtime,
    );
    if (!projectPath) {
      return c.json({ error: "Project not found" }, 404);
    }

    // The path comes already decoded from the URL
    const filePath = pathParam;

    // Prevent directory traversal attacks
    if (filePath.includes("..") || filePath.startsWith("/")) {
      return c.json({ error: "Access denied: Invalid file path" }, 403);
    }

    // Resolve the full path safely
    const fullPath = safeResolvePath(projectPath, filePath);

    // Check if file exists
    const exists = await runtime.exists(fullPath);
    if (!exists) {
      return c.json({ error: "File not found" }, 404);
    }

    // Get file stats
    const stat = await runtime.stat(fullPath);
    if (stat.isDirectory) {
      return c.json({ error: "Cannot download directory" }, 400);
    }

    // Read file as binary
    const buffer = await runtime.readBinaryFile(fullPath);

    // Get filename from path
    const filename = filePath.split("/").pop() || "download";

    // Determine MIME type
    const extension = getFileExtension(filename);
    const mimeType = getMimeType(extension);

    // Properly encode filename for Content-Disposition header
    // For better browser compatibility, provide both filename and filename* parameters
    const hasNonAscii = /[^\x20-\x7E]/.test(filename);

    let contentDisposition: string;
    if (hasNonAscii) {
      // For non-ASCII filenames, encode properly for RFC 6266
      // Use percent-encoding for the filename* parameter
      const utf8Filename = encodeURIComponent(filename);

      // Also provide a ASCII-safe fallback filename
      const asciiFilename = filename
        .replace(/[^\x20-\x7E]/g, "_")
        .replace(/["\\]/g, "_"); // Also escape quotes and backslashes

      // Use both parameters for maximum compatibility
      contentDisposition = `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`;
    } else {
      // For ASCII filenames, escape quotes and backslashes
      const safeFilename = filename.replace(/["\\]/g, "\\$&");
      contentDisposition = `attachment; filename="${safeFilename}"`;
    }

    // Return file with appropriate headers
    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": contentDisposition,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[File Download] Error:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to download file",
      },
      500,
    );
  }
}
