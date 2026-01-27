import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs";
import Handlebars from "handlebars";
import { AssetInfo, Assets, FormulaContext, normalizePlatform } from "./types";

// Register Handlebars helpers
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("neq", (a, b) => a !== b);
Handlebars.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
Handlebars.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
Handlebars.registerHelper("if_eq", function (this: unknown, a, b, options) {
  return a === b
    ? (options as Handlebars.HelperOptions).fn(this)
    : (options as Handlebars.HelperOptions).inverse(this);
});

/**
 * Fetch SHA256 from a .sha256 URL or compute from binary
 */
async function fetchSha256(url: string): Promise<string | undefined> {
  const sha256Url = `${url}.sha256`;

  try {
    core.debug(`Fetching SHA256 from ${sha256Url}`);
    const response = await fetch(sha256Url);

    if (!response.ok) {
      core.debug(`SHA256 file not found at ${sha256Url}, status: ${response.status}`);
      return undefined;
    }

    const content = await response.text();
    // SHA256 file format: "hash  filename" or just "hash"
    const match = content.trim().match(/^([a-f0-9]{64})/i);

    if (match) {
      core.debug(`Found SHA256: ${match[1]}`);
      return match[1].toLowerCase();
    }

    core.warning(`Invalid SHA256 format in ${sha256Url}: ${content}`);
    return undefined;
  } catch (error) {
    core.debug(`Failed to fetch SHA256: ${error}`);
    return undefined;
  }
}

/**
 * Process assets: normalize platforms and fetch missing SHA256s
 */
async function processAssets(rawAssets: Assets): Promise<Assets> {
  const assets: Assets = {};

  for (const [platform, info] of Object.entries(rawAssets)) {
    const normalizedPlatform = normalizePlatform(platform);
    let sha256 = info.sha256;

    if (!sha256 && info.url) {
      core.info(`Fetching SHA256 for ${normalizedPlatform}...`);
      sha256 = await fetchSha256(info.url);

      if (!sha256) {
        core.warning(`Could not fetch SHA256 for ${normalizedPlatform}, formula may be incomplete`);
      }
    }

    assets[normalizedPlatform] = {
      ...info,
      sha256,
    };
  }

  return assets;
}

/**
 * Build the formula context for template rendering
 */
function buildContext(
  name: string,
  version: string,
  assets: Assets,
  description: string,
  homepage: string,
  license: string,
  binaryName: string,
  privateRepo: boolean,
): FormulaContext {
  const versionClean = version.replace(/^v/, "");

  const macosAssets: { platform: string; asset: AssetInfo }[] = [];
  const linuxAssets: { platform: string; asset: AssetInfo }[] = [];

  for (const [platform, asset] of Object.entries(assets)) {
    if (platform.startsWith("darwin-") || platform.startsWith("macos-")) {
      macosAssets.push({ platform, asset });
    } else if (platform.startsWith("linux-")) {
      linuxAssets.push({ platform, asset });
    }
  }

  return {
    name,
    version: versionClean,
    versionClean,
    description,
    homepage,
    license,
    binaryName: binaryName || name,
    privateRepo,
    assets,
    darwinArm64: assets["darwin-arm64"],
    darwinX64: assets["darwin-x64"],
    darwinAmd64: assets["darwin-x64"], // alias
    linuxArm64: assets["linux-arm64"],
    linuxX64: assets["linux-x64"],
    linuxAmd64: assets["linux-x64"], // alias
    macosAssets,
    linuxAssets,
  };
}

/**
 * Default formula template for multi-platform binaries
 * Supports both public and private GitHub repositories
 */
const DEFAULT_TEMPLATE = `class {{capitalize name}} < Formula
  desc "{{description}}"
  homepage "{{homepage}}"
  version "{{version}}"
  license "{{license}}"
{{#if privateRepo}}

  # Private repository - requires HOMEBREW_GITHUB_API_TOKEN environment variable
  # Set it with: export HOMEBREW_GITHUB_API_TOKEN="your_github_token"
{{/if}}

  {{#if darwinArm64}}
  on_macos do
    if Hardware::CPU.arm?
      url "{{darwinArm64.url}}"{{#if privateRepo}},
          using: GitHubPrivateRepositoryReleaseDownloadStrategy{{/if}}
      sha256 "{{darwinArm64.sha256}}"
    {{#if darwinX64}}
    else
      url "{{darwinX64.url}}"{{#if privateRepo}},
          using: GitHubPrivateRepositoryReleaseDownloadStrategy{{/if}}
      sha256 "{{darwinX64.sha256}}"
    {{/if}}
    end
  end
  {{/if}}

  {{#if linuxX64}}
  on_linux do
    {{#if linuxArm64}}
    if Hardware::CPU.arm?
      url "{{linuxArm64.url}}"{{#if privateRepo}},
          using: GitHubPrivateRepositoryReleaseDownloadStrategy{{/if}}
      sha256 "{{linuxArm64.sha256}}"
    else
      url "{{linuxX64.url}}"{{#if privateRepo}},
          using: GitHubPrivateRepositoryReleaseDownloadStrategy{{/if}}
      sha256 "{{linuxX64.sha256}}"
    end
    {{else}}
    url "{{linuxX64.url}}"{{#if privateRepo}},
        using: GitHubPrivateRepositoryReleaseDownloadStrategy{{/if}}
    sha256 "{{linuxX64.sha256}}"
    {{/if}}
  end
  {{/if}}

  def install
    bin.install "{{binaryName}}"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/{{binaryName}} --version", 2)
  end
end
`;

// Register capitalize helper
Handlebars.registerHelper("capitalize", (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

interface CommitterInfo {
  name: string;
  email: string;
}

/**
 * Update the formula in the tap repository
 */
async function updateTapRepo(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  branch: string,
  formulaPath: string,
  content: string,
  commitMessage: string,
  committer: CommitterInfo,
): Promise<{ sha: string; url: string }> {
  // Get current file SHA if it exists (needed for update)
  let existingSha: string | undefined;

  try {
    const { data: existingFile } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: formulaPath,
      ref: branch,
    });

    if (!Array.isArray(existingFile) && existingFile.type === "file") {
      existingSha = existingFile.sha;
      core.info(`Found existing formula at ${formulaPath}`);
    }
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      core.info(`Creating new formula at ${formulaPath}`);
    } else {
      throw error;
    }
  }

  // Create or update the file
  const { data: result } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: formulaPath,
    message: commitMessage,
    content: Buffer.from(content).toString("base64"),
    branch,
    sha: existingSha,
    committer,
    author: committer,
  });

  return {
    sha: result.commit.sha || "",
    url: result.commit.html_url || "",
  };
}

/**
 * Main action
 */
async function run(): Promise<void> {
  try {
    // Parse inputs
    const tapRepo = core.getInput("tap-repo", { required: true });
    const formulaName = core.getInput("formula-name", { required: true });
    const version = core.getInput("version", { required: true });
    const templatePath = core.getInput("template");
    const templateInline = core.getInput("template-inline");
    const assetsJson = core.getInput("assets", { required: true });
    const githubToken = core.getInput("github-token", { required: true });
    const commitMessageInput = core.getInput("commit-message");
    const branch = core.getInput("branch") || "main";
    const formulaPathInput = core.getInput("formula-path");
    const dryRun = core.getInput("dry-run") === "true";

    // Metadata inputs
    const description = core.getInput("description") || `${formulaName} binary`;
    const homepage = core.getInput("homepage") || "";
    const license = core.getInput("license") || "MIT";
    const binaryName = core.getInput("binary-name") || formulaName;
    const privateRepo = core.getInput("private-repo") === "true";

    // Git committer configuration
    const gitUserName = core.getInput("git-user-name") || "github-actions[bot]";
    const gitUserEmail =
      core.getInput("git-user-email") || "41898282+github-actions[bot]@users.noreply.github.com";
    const committer: CommitterInfo = { name: gitUserName, email: gitUserEmail };

    // Parse tap repo
    const [tapOwner, tapRepoName] = tapRepo.split("/");
    if (!tapOwner || !tapRepoName) {
      throw new Error(`Invalid tap-repo format: ${tapRepo}. Expected: owner/repo`);
    }

    // Parse assets
    let rawAssets: Assets;
    try {
      rawAssets = JSON.parse(assetsJson);
    } catch {
      throw new Error(`Invalid assets JSON: ${assetsJson}`);
    }

    core.info(`Processing ${Object.keys(rawAssets).length} platform assets...`);
    const assets = await processAssets(rawAssets);

    // Build context
    const context = buildContext(
      formulaName,
      version,
      assets,
      description,
      homepage,
      license,
      binaryName,
      privateRepo,
    );

    if (privateRepo) {
      core.info("Private repository mode - formula will use GitHubPrivateRepositoryReleaseDownloadStrategy");
    }

    // Load template
    let templateSource: string;
    if (templatePath) {
      templateSource = await fs.promises.readFile(templatePath, "utf-8");
      core.info(`Using template from ${templatePath}`);
    } else if (templateInline) {
      templateSource = templateInline;
      core.info("Using inline template");
    } else {
      templateSource = DEFAULT_TEMPLATE;
      core.info("Using default template");
    }

    // Render formula
    const template = Handlebars.compile(templateSource);
    const formulaContent = template(context);

    // Determine formula path
    const formulaPath = formulaPathInput || `Formula/${formulaName}.rb`;
    const commitMessage =
      commitMessageInput || `Update ${formulaName} to ${version.replace(/^v/, "")}`;

    core.info(`Generated formula for ${formulaName} ${version}`);
    core.debug(`Formula content:\n${formulaContent}`);

    // Set outputs
    core.setOutput("formula-content", formulaContent);
    core.setOutput("formula-path", formulaPath);

    if (dryRun) {
      core.info("Dry run mode - not committing changes");
      core.info(`\n--- Generated Formula ---\n${formulaContent}\n---`);
      return;
    }

    // Update tap repository
    const octokit = github.getOctokit(githubToken);

    core.info(`Updating ${tapOwner}/${tapRepoName}:${branch}/${formulaPath}...`);
    core.info(`Committer: ${committer.name} <${committer.email}>`);
    const { sha, url } = await updateTapRepo(
      octokit,
      tapOwner,
      tapRepoName,
      branch,
      formulaPath,
      formulaContent,
      commitMessage,
      committer,
    );

    core.setOutput("commit-sha", sha);
    core.setOutput("commit-url", url);

    core.info(`Successfully updated formula!`);
    core.info(`Commit: ${url}`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
