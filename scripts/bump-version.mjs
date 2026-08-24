#!/usr/bin/env node
/**
 * Bump the app version for a store build.
 *
 *   node scripts/bump-version.mjs patch      1.1.0 -> 1.1.1, versionCode +1
 *   node scripts/bump-version.mjs minor      1.1.0 -> 1.2.0, versionCode +1
 *   node scripts/bump-version.mjs major      1.1.0 -> 2.0.0, versionCode +1
 *   node scripts/bump-version.mjs build      versionName unchanged, versionCode +1
 *   node scripts/bump-version.mjs --sync     align iOS to the current version, no bump
 *   node scripts/bump-version.mjs --check    report only, change nothing
 *
 * Four files have to move together or the build is wrong in a way nobody
 * notices until Play rejects the upload:
 *
 *   package.json            version          (the source of truth)
 *   package-lock.json       version x2       (npm rewrites it on the next install
 *                                             otherwise, as drift in an unrelated diff)
 *   android/app/build.gradle versionName     (must equal it — guardrail:version-parity)
 *   android/app/build.gradle versionCode     (must be strictly greater than the
 *                                             last upload, forever, per Play)
 *
 * iOS reads MARKETING_VERSION / CURRENT_PROJECT_VERSION from the Xcode project,
 * so those are updated too when the project file is present. That half cannot be
 * verified from Windows, so it is reported rather than assumed.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const GRADLE = 'android/app/build.gradle';
const PKG = 'package.json';
const PBXPROJ = 'ios/App/App.xcodeproj/project.pbxproj';
const LOCK = 'package-lock.json';

const mode = process.argv[2] ?? '--check';
const check = mode === '--check';

const pkg = JSON.parse(readFileSync(PKG, 'utf8'));
const gradle = readFileSync(GRADLE, 'utf8');

const codeMatch = gradle.match(/versionCode\s+(\d+)/);
const nameMatch = gradle.match(/versionName\s+"([^"]+)"/);
if (!codeMatch || !nameMatch) {
  console.error(`could not find versionCode/versionName in ${GRADLE}`);
  process.exit(1);
}

const current = { name: pkg.version, gradleName: nameMatch[1], code: Number(codeMatch[1]) };

const bumpName = (version, part) => {
  const [major, minor, patch] = version.split('.').map(Number);
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  if (part === 'patch') return `${major}.${minor}.${patch + 1}`;
  return version;
};

if (check) {
  const lockVersion = JSON.parse(readFileSync(LOCK, 'utf8')).version;
  const parity = current.name === current.gradleName && current.name === lockVersion;
  console.log(`package.json      ${current.name}`);
  console.log(`package-lock.json ${lockVersion}  ${lockVersion === current.name ? 'OK' : 'MISMATCH'}`);
  console.log(`android versionName ${current.gradleName}  ${parity ? 'OK' : 'MISMATCH'}`);
  console.log(`android versionCode ${current.code}`);
  if (existsSync(PBXPROJ)) {
    const pbx = readFileSync(PBXPROJ, 'utf8');
    const mv = [...new Set([...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((m) => m[1].trim()))];
    const cpv = [...new Set([...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1].trim()))];
    console.log(`ios MARKETING_VERSION ${mv.join(', ') || '(unset)'}`);
    console.log(`ios CURRENT_PROJECT_VERSION ${cpv.join(', ') || '(unset)'}`);
  }
  process.exit(parity ? 0 : 1);
}

const sync = mode === '--sync';

if (!sync && !['major', 'minor', 'patch', 'build'].includes(mode)) {
  console.error(`unknown mode "${mode}" — expected major, minor, patch, build, --sync or --check`);
  process.exit(1);
}

// --sync repairs drift without cutting a release: iOS had fallen behind to
// 1.0.0 / 1 while Android was at 1.1.0 / 3, and bumping is the wrong remedy for
// that because it would burn a version number to fix a bookkeeping error.
const nextName = sync ? current.name : bumpName(current.name, mode);
const nextCode = sync ? current.code : current.code + 1;

pkg.version = nextName;
writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n');

// The lock file carries the root version twice, and npm rewrites both on the
// next install whether or not anyone asked. Left alone, the bump shows up later
// as two unexplained lines in someone else's dependency PR. Rewriting the parsed
// object is safe here: npm already writes 2-space JSON, so this round-trips
// byte-identically, and a blind string replace would risk matching a dependency
// that happens to share the version.
const lock = JSON.parse(readFileSync(LOCK, 'utf8'));
lock.version = nextName;
if (lock.packages?.['']) lock.packages[''].version = nextName;
writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');

writeFileSync(
  GRADLE,
  gradle
    .replace(/versionCode\s+\d+/, `versionCode ${nextCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${nextName}"`),
);

let iosNote = 'ios: project file not present, skipped';
if (existsSync(PBXPROJ)) {
  const pbx = readFileSync(PBXPROJ, 'utf8');
  writeFileSync(
    PBXPROJ,
    pbx
      .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${nextName};`)
      .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${nextCode};`),
  );
  iosNote = `ios: MARKETING_VERSION ${nextName}, CURRENT_PROJECT_VERSION ${nextCode} (unverified — needs a Mac to build)`;
}

console.log(`versionName ${current.name} -> ${nextName}`);
console.log(`versionCode ${current.code} -> ${nextCode}`);
console.log(iosNote);
console.log('\nnext: npm run build:mobile, then a signed bundleRelease');
