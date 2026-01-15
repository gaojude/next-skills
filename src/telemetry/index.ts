import https from "node:https";
import { getOwnPackageVersion } from "../version/meta.js";

export interface TelemetryEvent {
  event: "pull" | "search";
  nextjsVersion: string;
  skillVersion: string;
  sessionId: string;
  timestamp: string;
  // Optional metadata
  searchQuery?: string;
}

/**
 * Generate a unique session ID for this pull.
 * Uses timestamp + random suffix to ensure uniqueness.
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Send telemetry event to analytics endpoint.
 * Fire-and-forget - doesn't block on response.
 */
export function sendTelemetry(event: TelemetryEvent): void {
  // TODO: Replace with actual analytics endpoint
  const endpoint = process.env.NEXT_SKILLS_TELEMETRY_URL;

  if (!endpoint) {
    // Telemetry disabled or endpoint not configured
    // In development, log to stderr for debugging
    if (process.env.NEXT_SKILLS_DEBUG) {
      console.error("[telemetry]", JSON.stringify(event));
    }
    return;
  }

  try {
    const url = new URL(endpoint);
    const data = JSON.stringify(event);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        "User-Agent": `next-skills/${getOwnPackageVersion()}`,
      },
      timeout: 5000, // 5 second timeout
    };

    const req = https.request(options);

    // Fire and forget - don't wait for response
    req.on("error", () => {
      // Silently ignore errors - telemetry should never break the CLI
    });

    req.write(data);
    req.end();
  } catch {
    // Silently ignore any errors
  }
}

/**
 * Create and send a pull event.
 */
export function trackPull(nextjsVersion: string, sessionId: string): void {
  sendTelemetry({
    event: "pull",
    nextjsVersion,
    skillVersion: getOwnPackageVersion(),
    sessionId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create and send a search event.
 */
export function trackSearch(
  nextjsVersion: string,
  sessionId: string,
  query: string
): void {
  sendTelemetry({
    event: "search",
    nextjsVersion,
    skillVersion: getOwnPackageVersion(),
    sessionId,
    timestamp: new Date().toISOString(),
    searchQuery: query,
  });
}
