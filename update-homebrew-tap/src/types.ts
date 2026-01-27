export interface AssetInfo {
  url: string;
  sha256?: string;
  filename?: string;
}

export interface Assets {
  [platform: string]: AssetInfo;
}

export interface FormulaContext {
  // Core
  name: string;
  version: string;
  versionClean: string;

  // Metadata
  description: string;
  homepage: string;
  license: string;
  binaryName: string;

  // Private repo flag (for GitHubPrivateRepositoryReleaseDownloadStrategy)
  privateRepo: boolean;

  // Assets by platform
  assets: Assets;

  // Convenience accessors
  darwinArm64?: AssetInfo;
  darwinX64?: AssetInfo;
  darwinAmd64?: AssetInfo;
  linuxArm64?: AssetInfo;
  linuxX64?: AssetInfo;
  linuxAmd64?: AssetInfo;

  // Grouped
  macosAssets: { platform: string; asset: AssetInfo }[];
  linuxAssets: { platform: string; asset: AssetInfo }[];
}

// Platform name normalization
export const PLATFORM_ALIASES: Record<string, string> = {
  "darwin-aarch64": "darwin-arm64",
  "darwin-x86_64": "darwin-x64",
  "darwin-amd64": "darwin-x64",
  "macos-arm64": "darwin-arm64",
  "macos-x64": "darwin-x64",
  "macos-amd64": "darwin-x64",
  "linux-aarch64": "linux-arm64",
  "linux-x86_64": "linux-x64",
  "linux-amd64": "linux-x64",
};

export function normalizePlatform(platform: string): string {
  return PLATFORM_ALIASES[platform.toLowerCase()] || platform.toLowerCase();
}
