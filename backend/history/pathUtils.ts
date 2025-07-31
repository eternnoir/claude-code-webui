/**
 * Path utilities for conversation history functionality
 * Handles conversion between project paths and Claude history directory names
 */

import type { Runtime } from "../runtime/types.ts";

/**
 * Get the encoded directory name for a project path by checking what actually exists
 * Example: "/Users/sugyan/tmp/" → "-Users-sugyan-tmp"
 */
export async function getEncodedProjectName(
  projectPath: string,
  runtime: Runtime,
): Promise<string | null> {
  const homeDir = runtime.getHomeDir();
  if (!homeDir) {
    return null;
  }

  const projectsDir = `${homeDir}/.claude/projects`;

  try {
    // Read all directories in .claude/projects
    const entries = [];
    for await (const entry of runtime.readDir(projectsDir)) {
      if (entry.isDirectory) {
        entries.push(entry.name);
      }
    }

    // Convert project path to expected encoded format for comparison
    const normalizedPath = projectPath.replace(/\/$/, "");
    // Claude converts '/', '\', ':', and '.' to '-'
    const expectedEncoded = normalizedPath.replace(/[/\\:.]/g, "-");

    // Find exact match - if not found, return null
    if (entries.includes(expectedEncoded)) {
      return expectedEncoded;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate that an encoded project name is safe
 */
export function validateEncodedProjectName(encodedName: string): boolean {
  // Should not be empty
  if (!encodedName) {
    return false;
  }

  // Should not contain dangerous characters for directory names
  // deno-lint-ignore no-control-regex
  const dangerousChars = /[<>:"|?*\x00-\x1f\/\\]/;
  if (dangerousChars.test(encodedName)) {
    return false;
  }

  return true;
}

/**
 * Get the actual project path from an encoded name by checking Claude config
 * Example: "-Users-sugyan-tmp" → "/Users/sugyan/tmp"
 */
export async function getProjectPathFromEncodedName(
  encodedName: string,
  runtime: Runtime,
): Promise<string | null> {
  const homeDir = runtime.getHomeDir();
  if (!homeDir) {
    return null;
  }

  const claudeConfigPath = `${homeDir}/.claude.json`;

  try {
    const configContent = await runtime.readTextFile(claudeConfigPath);
    const config = JSON.parse(configContent);

    if (config.projects && typeof config.projects === "object") {
      // Check each project to find matching encoded name
      for (const [projectPath, _] of Object.entries(config.projects)) {
        const encoded = await getEncodedProjectName(projectPath, runtime);
        if (encoded === encodedName) {
          return projectPath;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
