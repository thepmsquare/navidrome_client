const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, desc) {
  console.log(`\n> ${desc}...`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\nerror: ${desc} failed.`);
    process.exit(1);
  }
}

function releaseInternal() {
  console.log('=== release:internal pre-flight checks ===');

  // 1. Check clean working directory
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (status.length > 0) {
    console.error('\nerror: working tree has uncommitted or untracked changes.');
    console.error('please commit, stash, or clean your working tree before releasing.\n');
    console.error(status);
    process.exit(1);
  }

  // 2. Ensure release is from main branch and synced with origin/main
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  if (branch !== 'main') {
    console.error(`\nerror: must release from main branch (currently on "${branch}").`);
    process.exit(1);
  }

  run('git fetch origin main --tags', 'fetching origin main and tags');

  const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const remote = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim();
  if (head !== remote) {
    console.error('\nerror: local main differs from origin/main. push or pull first.');
    process.exit(1);
  }

  // 3. Read version and versionCode from package.json
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const { version, versionCode } = pkg;

  if (!version || !versionCode) {
    console.error('\nerror: package.json is missing "version" or "versionCode".');
    process.exit(1);
  }

  const tagName = `v${version}+${versionCode}`;
  console.log(`target release tag: ${tagName}`);

  // 4. Check if tag already exists (remote tags fetched in step 2)
  const existingTag = execSync(`git tag -l "${tagName}"`, { encoding: 'utf8' }).trim();
  if (existingTag.length > 0) {
    console.error(`\nerror: git tag "${tagName}" already exists.`);
    process.exit(1);
  }

  // 5. Run validations
  run('node scripts/validate_changelog.js --for-release', 'validating changelog for release');
  run('npx tsc --noEmit', 'type checking');
  run('npm run lint', 'running linter');
  run('npm test -- --ci', 'running automated tests');

  // 6. Verify Expo config resolves matching version and versionCode
  console.log('\n> verifying expo configuration...');
  try {
    const cfg = JSON.parse(execSync('npx expo config --json', { encoding: 'utf8' }));
    if (cfg.android?.versionCode !== versionCode || cfg.version !== version) {
      console.error(
        `\nerror: app.config.ts does not resolve to package.json version/versionCode.` +
        ` expected version=${version}, versionCode=${versionCode};` +
        ` got version=${cfg.version}, versionCode=${cfg.android?.versionCode}.`
      );
      process.exit(1);
    }
  } catch (err) {
    console.error('\nerror: failed to inspect expo configuration.');
    process.exit(1);
  }

  // 7. Create annotated tag
  run(`git tag -a "${tagName}" -m "release ${tagName}"`, `creating git tag "${tagName}"`);

  // 8. Push tag with rollback on failure
  console.log(`\n> pushing git tag "${tagName}" to origin...`);
  try {
    execSync(`git push origin "${tagName}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\nerror: pushing tag "${tagName}" failed. deleting local tag...`);
    try {
      execSync(`git tag -d "${tagName}"`, { stdio: 'inherit' });
    } catch {
      // ignore
    }
    process.exit(1);
  }

  console.log(`\nsuccessfully tagged and pushed "${tagName}".`);
  console.log('github actions workflow will trigger release to internal track.');
}

releaseInternal();
