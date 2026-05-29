import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stitch } from "@google/stitch-sdk";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const metadataPath = join(rootDir, "design", "stitch", "screens.json");
const outputDir = join(rootDir, "design", "stitch", "downloads");

const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
const project = stitch.project(metadata.project.id);

function ensureDir(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function download(url, outputPath) {
  ensureDir(dirname(outputPath));
  execFileSync("curl.exe", ["-L", url, "-o", outputPath], { stdio: "inherit" });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

ensureDir(outputDir);

const manifest = {
  project: metadata.project,
  downloadedAt: new Date().toISOString(),
  screens: []
};

for (const screenInfo of metadata.screens) {
  console.log(`Fetching Stitch screen: ${screenInfo.title}`);
  const screen = await project.getScreen(screenInfo.id);
  const htmlUrl = await screen.getHtml();
  const imageUrl = await screen.getImage();

  const screenDir = join(outputDir, screenInfo.slug);
  const htmlPath = join(screenDir, `${screenInfo.slug}.html`);
  const imagePath = join(screenDir, `${screenInfo.slug}.png`);

  console.log(`  HTML: ${htmlUrl}`);
  download(htmlUrl, htmlPath);

  console.log(`  Image: ${imageUrl}`);
  download(imageUrl, imagePath);

  manifest.screens.push({
    ...screenInfo,
    htmlUrl,
    imageUrl,
    htmlPath: htmlPath.replace(rootDir, "."),
    imagePath: imagePath.replace(rootDir, ".")
  });
}

writeJson(join(outputDir, "manifest.json"), manifest);
console.log(`Done. Manifest written to ${join(outputDir, "manifest.json")}`);
