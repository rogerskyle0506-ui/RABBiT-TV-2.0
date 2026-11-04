// scripts/bump-version.js
import fs from 'fs';
import path from 'path';

const packagePath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Default starting 4-part version if none exists
let currentVersion = pkg.version || '2.2.5.0';
let parts = currentVersion.split('.').map(Number);

// Ensure we have 4 components: [major, minor, patch, build]
if (parts.length === 3) {
  parts.push(0);
} else if (parts.length < 3) {
  while (parts.length < 4) parts.push(0);
}

// Check for terminal override argument (e.g., "npm run bump 2.3.0.0")
const argVersion = process.argv[2];
let newVersion = "";

if (argVersion) {
  newVersion = argVersion;
} else {
  // Increment build (4th) component
  parts[3] += 1;

  // Overflow rule: when build hits 10 (>9), reset build to 0 and increment patch (3rd) component
  if (parts[3] > 9) {
    parts[3] = 0;
    parts[2] += 1;
    if (parts[2] > 9) {
      parts[2] = 0;
      parts[1] += 1;
    }
  }
  newVersion = parts.join('.');
}

// 1. Update package.json
pkg.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`🚀 Version bumped to: ${newVersion}`);

// 2. Update capacitor.config.json
const capConfigPath = path.resolve('capacitor.config.json');
if (fs.existsSync(capConfigPath)) {
  const capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));
  capConfig.version = newVersion;
  fs.writeFileSync(capConfigPath, JSON.stringify(capConfig, null, 2) + '\n');
}

// 3. Automatically generate updates/nightly_manifest.json for the updater
const updatesDir = path.resolve('updates');
if (!fs.existsSync(updatesDir)) {
  fs.mkdirSync(updatesDir, { recursive: true });
}

// Calculate numeric versionCode for comparisons
const finalParts = newVersion.split('.').map(Number);
const versionCode = finalParts[0] * 1000000 + finalParts[1] * 10000 + finalParts[2] * 100 + finalParts[3];

const nightlyManifest = {
  versionCode: versionCode,
  versionName: newVersion,
  apkUrl: `https://raw.githubusercontent.com/rogerskyle0506-ui/RABBiT-TV-2.0/main/updates/rabbittv${newVersion}.apk`,
  releaseNotes: `Automated nightly build v${newVersion} compiled and verified via GitHub Actions.`
};

fs.writeFileSync(
  path.join(updatesDir, 'nightly_manifest.json'),
  JSON.stringify(nightlyManifest, null, 2) + '\n'
);
console.log(`📝 Generated updates/nightly_manifest.json for version ${newVersion}`);
