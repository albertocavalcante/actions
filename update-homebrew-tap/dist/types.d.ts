export interface AssetInfo {
    url: string;
    sha256?: string;
    filename?: string;
}
export interface Assets {
    [platform: string]: AssetInfo;
}
export interface FormulaContext {
    name: string;
    version: string;
    versionClean: string;
    description: string;
    homepage: string;
    license: string;
    binaryName: string;
    privateRepo: boolean;
    assets: Assets;
    darwinArm64?: AssetInfo;
    darwinX64?: AssetInfo;
    darwinAmd64?: AssetInfo;
    linuxArm64?: AssetInfo;
    linuxX64?: AssetInfo;
    linuxAmd64?: AssetInfo;
    macosAssets: {
        platform: string;
        asset: AssetInfo;
    }[];
    linuxAssets: {
        platform: string;
        asset: AssetInfo;
    }[];
}
export declare const PLATFORM_ALIASES: Record<string, string>;
export declare function normalizePlatform(platform: string): string;
