import * as core from "@actions/core";
import * as glob from "@actions/glob";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

type HashAlgorithm = "sha256" | "sha512" | "md5";

interface ChecksumResult {
  [key: string]: string;
}

/**
 * Compute hash of a file
 */
async function hashFile(filepath: string, algorithm: HashAlgorithm): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filepath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Compute hash of a buffer
 */
function hashBuffer(buffer: Buffer, algorithm: HashAlgorithm): string {
  return crypto.createHash(algorithm).update(buffer).digest("hex");
}

/**
 * Read existing .sha256 file
 */
async function readSha256File(filepath: string): Promise<string | undefined> {
  const sha256Path = `${filepath}.sha256`;

  try {
    const content = await fs.promises.readFile(sha256Path, "utf-8");
    const match = content.trim().match(/^([a-f0-9]{64})/i);
    return match?.[1]?.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Download a URL and return the buffer
 */
async function downloadUrl(url: string): Promise<Buffer> {
  core.debug(`Downloading ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Fetch SHA256 from a .sha256 URL
 */
async function fetchSha256FromUrl(url: string): Promise<string | undefined> {
  const sha256Url = `${url}.sha256`;

  try {
    core.debug(`Fetching SHA256 from ${sha256Url}`);
    const response = await fetch(sha256Url);

    if (!response.ok) {
      return undefined;
    }

    const content = await response.text();
    const match = content.trim().match(/^([a-f0-9]{64})/i);
    return match?.[1]?.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Process local files
 */
async function processFiles(
  patterns: string,
  algorithm: HashAlgorithm,
  readSha256Files: boolean,
): Promise<ChecksumResult> {
  const result: ChecksumResult = {};
  const globber = await glob.create(patterns, { followSymbolicLinks: false });
  const files = await globber.glob();

  for (const filepath of files) {
    // Skip .sha256 files themselves
    if (filepath.endsWith(".sha256")) continue;

    const filename = path.basename(filepath);

    // Try to read existing .sha256 file first
    if (readSha256Files) {
      const existingHash = await readSha256File(filepath);
      if (existingHash) {
        core.info(`Read existing checksum for ${filename}`);
        result[filename] = existingHash;
        continue;
      }
    }

    // Compute hash
    core.info(`Computing ${algorithm} for ${filename}...`);
    const hash = await hashFile(filepath, algorithm);
    result[filename] = hash;
  }

  return result;
}

/**
 * Process URL array
 */
async function processUrls(
  urls: string[],
  algorithm: HashAlgorithm,
  readSha256Files: boolean,
): Promise<ChecksumResult> {
  const result: ChecksumResult = {};

  for (const url of urls) {
    const filename = path.basename(new URL(url).pathname);

    // Try to fetch existing .sha256 file first
    if (readSha256Files) {
      const existingHash = await fetchSha256FromUrl(url);
      if (existingHash) {
        core.info(`Fetched existing checksum for ${filename}`);
        result[filename] = existingHash;
        continue;
      }
    }

    // Download and compute hash
    core.info(`Downloading and computing ${algorithm} for ${filename}...`);
    const buffer = await downloadUrl(url);
    const hash = hashBuffer(buffer, algorithm);
    result[filename] = hash;
  }

  return result;
}

/**
 * Process URL map (identifier -> URL)
 */
async function processUrlMap(
  urlMap: Record<string, string>,
  algorithm: HashAlgorithm,
  readSha256Files: boolean,
): Promise<ChecksumResult> {
  const result: ChecksumResult = {};

  for (const [identifier, url] of Object.entries(urlMap)) {
    // Try to fetch existing .sha256 file first
    if (readSha256Files) {
      const existingHash = await fetchSha256FromUrl(url);
      if (existingHash) {
        core.info(`Fetched existing checksum for ${identifier}`);
        result[identifier] = existingHash;
        continue;
      }
    }

    // Download and compute hash
    core.info(`Downloading and computing ${algorithm} for ${identifier}...`);
    const buffer = await downloadUrl(url);
    const hash = hashBuffer(buffer, algorithm);
    result[identifier] = hash;
  }

  return result;
}

/**
 * Main action
 */
async function run(): Promise<void> {
  try {
    const filesPattern = core.getInput("files");
    const urlsJson = core.getInput("urls");
    const urlMapJson = core.getInput("url-map");
    const readSha256Files = core.getInput("read-sha256-files") !== "false";
    const algorithm = (core.getInput("algorithm") || "sha256") as HashAlgorithm;

    if (!filesPattern && !urlsJson && !urlMapJson) {
      throw new Error("At least one of 'files', 'urls', or 'url-map' must be provided");
    }

    const checksums: ChecksumResult = {};

    // Process local files
    if (filesPattern) {
      core.info("Processing local files...");
      const fileChecksums = await processFiles(filesPattern, algorithm, readSha256Files);
      Object.assign(checksums, fileChecksums);
    }

    // Process URL array
    if (urlsJson) {
      core.info("Processing URLs...");
      let urls: string[];
      try {
        urls = JSON.parse(urlsJson);
      } catch {
        throw new Error(`Invalid urls JSON: ${urlsJson}`);
      }
      const urlChecksums = await processUrls(urls, algorithm, readSha256Files);
      Object.assign(checksums, urlChecksums);
    }

    // Process URL map
    if (urlMapJson) {
      core.info("Processing URL map...");
      let urlMap: Record<string, string>;
      try {
        urlMap = JSON.parse(urlMapJson);
      } catch {
        throw new Error(`Invalid url-map JSON: ${urlMapJson}`);
      }
      const mapChecksums = await processUrlMap(urlMap, algorithm, readSha256Files);
      Object.assign(checksums, mapChecksums);
    }

    // Generate outputs
    core.setOutput("checksums", JSON.stringify(checksums));

    // Write checksums file
    const outputPath = path.join(process.cwd(), "checksums.json");
    await fs.promises.writeFile(outputPath, JSON.stringify(checksums, null, 2));
    core.setOutput("checksums-file", outputPath);

    // Generate list format (compatible with shasum output)
    const checksumsList = Object.entries(checksums)
      .map(([name, hash]) => `${hash}  ${name}`)
      .join("\n");
    core.setOutput("checksums-list", checksumsList);

    core.info(`Computed ${Object.keys(checksums).length} checksums`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
