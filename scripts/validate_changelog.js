const fs = require('fs');
const path = require('path');

function validateChangelog(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`error: changelog file not found at "${filePath}"`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  const errors = [];
  const isForRelease = process.argv.includes('--for-release');

  // 1. Line 1 check
  if (lines[0] !== '# changelog') {
    errors.push(`line 1 must be exactly "# changelog", found "${lines[0]}"`);
  }

  const H2_REGEX = /^## (unreleased|\d+\.\d+\.\d+\+\d+)$/;
  const H3_USER = '### user release notes';
  const H3_INTERNAL = '### internal notes';
  const ALLOWED_H3 = [H3_USER, H3_INTERNAL];

  let currentH2 = null;
  let currentH3 = null;
  let h3Seen = [];
  let userNotesBuffer = '';
  let sectionIndex = 0;

  function checkUserNotesLength(h2Title, notesText) {
    const trimmedNotes = notesText.trim();
    if (trimmedNotes.length === 0) {
      errors.push(`section "${h2Title}" user release notes must not be empty`);
      return;
    }
    const len = trimmedNotes.length;
    const MAX_LEN = 490;
    if (len > MAX_LEN) {
      errors.push(`section "${h2Title}" user release notes exceeds ${MAX_LEN} characters (${len} chars)`);
    }
  }

  function validateSectionEnd() {
    if (!currentH2) return;

    if (!h3Seen.includes(H3_USER)) {
      errors.push(`section "${currentH2}" is missing required subsection "${H3_USER}"`);
    }

    if (currentH3 === H3_USER) {
      checkUserNotesLength(currentH2, userNotesBuffer);
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (!trimmed) continue;

    if (trimmed.startsWith('#')) {
      if (trimmed.startsWith('####')) {
        errors.push(`line ${lineNum}: heading level 4+ is not allowed: "${trimmed}"`);
      } else if (trimmed.startsWith('### ')) {
        if (!currentH2) {
          errors.push(`line ${lineNum}: h3 found before any h2 section: "${trimmed}"`);
          continue;
        }

        if (!ALLOWED_H3.includes(trimmed)) {
          errors.push(`line ${lineNum}: invalid h3 "${trimmed}". must be "${H3_USER}" or "${H3_INTERNAL}"`);
        }

        if (h3Seen.includes(trimmed)) {
          errors.push(`line ${lineNum}: duplicate h3 "${trimmed}" in section "${currentH2}"`);
        }

        if (trimmed === H3_USER && h3Seen.includes(H3_INTERNAL)) {
          errors.push(`line ${lineNum}: "${H3_USER}" must appear before "${H3_INTERNAL}" in section "${currentH2}"`);
        }

        if (currentH3 === H3_USER) {
          checkUserNotesLength(currentH2, userNotesBuffer);
        }

        currentH3 = trimmed;
        h3Seen.push(trimmed);
        if (currentH3 === H3_USER) {
          userNotesBuffer = '';
        }
      } else if (trimmed.startsWith('## ')) {
        validateSectionEnd();

        sectionIndex++;
        if (isForRelease && trimmed.toLowerCase().includes('unreleased')) {
          errors.push(`line ${lineNum}: "unreleased" section is not allowed in release mode: "${trimmed}"`);
        }

        if (isForRelease && sectionIndex === 1) {
          const pkgPath = path.resolve(__dirname, '../package.json');
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          const expectedH2 = `## ${pkg.version}+${pkg.versionCode}`;
          if (trimmed !== expectedH2) {
            errors.push(`top changelog section "${trimmed}" does not match package.json "${expectedH2}"`);
          }
        }

        if (!H2_REGEX.test(trimmed)) {
          errors.push(`line ${lineNum}: invalid h2 "${trimmed}". must be "## unreleased" or match format "## X.Y.Z+B"`);
        }

        currentH2 = trimmed;
        currentH3 = null;
        h3Seen = [];
        userNotesBuffer = '';
      } else {
        errors.push(`line ${lineNum}: unexpected heading "${trimmed}"`);
      }
    } else {
      // Content line
      if (!currentH3) {
        errors.push(`line ${lineNum}: content found outside of an h3 subsection: "${trimmed}"`);
      }

      if (!/^\s*-\s+/.test(line)) {
        errors.push(`line ${lineNum}: content must be a bullet point starting with "- ": "${trimmed}"`);
      }

      if (currentH3 === H3_USER) {
        userNotesBuffer += (userNotesBuffer ? '\n' : '') + trimmed;
      }
    }
  }

  // Final section validation
  validateSectionEnd();

  if (errors.length > 0) {
    console.error('\nchangelog validation failed with errors:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(`changelog validated successfully (${sectionIndex} releases verified).`);
}

const changelogPath = path.resolve(__dirname, '../CHANGELOG.md');
validateChangelog(changelogPath);
