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

function releaseClosed() {
  console.log('=== release:closed pre-flight checks ===');

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

  // 3. Determine target version and versionCode
  const pkgPath = path.resolve(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const argCode = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  const versionCode = argCode || parseInt(pkg.versionCode, 10);
  const version = pkg.version;

  if (!version || !versionCode) {
    console.error('\nerror: missing version or versionCode.');
    process.exit(1);
  }

  console.log(`target release to promote: version ${version} (versionCode: ${versionCode})`);

  // 4. Check corresponding internal release tag
  const internalTagName = `v${version}+${versionCode}`;
  const internalTagExists = execSync(`git tag -l "${internalTagName}"`, { encoding: 'utf8' }).trim();
  if (!internalTagExists) {
    console.warn(`\nwarning: internal tag "${internalTagName}" was not found locally or on remote.`);
    console.warn('ensure this version has already been released to the internal track first.');
  }

  // 5. Verify closed tag does not already exist
  const closedTagName = `v${version}+${versionCode}-closed`;
  const existingClosedTag = execSync(`git tag -l "${closedTagName}"`, { encoding: 'utf8' }).trim();
  if (existingClosedTag.length > 0) {
    console.error(`\nerror: git tag "${closedTagName}" already exists.`);
    process.exit(1);
  }

  // 6. Run validations
  run('node scripts/validate_changelog.js --for-release', 'validating changelog for release');
  run('npx tsc --noEmit', 'type checking');
  run('npm run lint', 'running linter');
  run('npm test -- --ci', 'running automated tests');

  // 7. Create annotated closed release tag
  run(
    `git tag -a "${closedTagName}" -m "promote ${internalTagName} to closed track"`,
    `creating git tag "${closedTagName}"`,
  );

  // 8. Push tag with rollback on failure
  console.log(`\n> pushing git tag "${closedTagName}" to origin...`);
  try {
    execSync(`git push origin "${closedTagName}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`\nerror: pushing tag "${closedTagName}" failed. deleting local tag...`);
    try {
      execSync(`git tag -d "${closedTagName}"`, { stdio: 'inherit' });
    } catch {
      // ignore
    }
    process.exit(1);
  }

  console.log(`\nsuccessfully tagged and pushed "${closedTagName}".`);
  console.log('github actions workflow will trigger promotion to the closed testing track.');
}

releaseClosed();

