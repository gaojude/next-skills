import { detectExistingInstallation, needsUpdate } from "./detect.js";
import { getOwnPackageVersion } from "../version/meta.js";

export interface SyncCheckResult {
  needsSync: boolean;
  reason?: string;
  currentLibVersion?: string;
  currentSkillVersion?: string;
}

/**
 * Check if the installed skill needs to be synced with the current versions.
 */
export function checkSyncStatus(
  cwd: string,
  newLibVersion: string
): SyncCheckResult {
  const installation = detectExistingInstallation(cwd);

  if (!installation.installed || !installation.meta) {
    return {
      needsSync: true,
      reason: "Skill not installed",
    };
  }

  const newSkillVersion = getOwnPackageVersion();
  const updateCheck = needsUpdate(
    installation.meta,
    newLibVersion,
    newSkillVersion
  );

  return {
    needsSync: updateCheck.needsUpdate,
    reason: updateCheck.reason,
    currentLibVersion: installation.meta.libVersion,
    currentSkillVersion: installation.meta.skillVersion,
  };
}
