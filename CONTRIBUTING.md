# contributing guidelines

## changelog specification

the project enforces a strict, machine-validated format for [CHANGELOG.md](./CHANGELOG.md). all pull requests modifying the changelog must adhere to this schema.

### structure rules

1. **document header**:
   - the first line must be exactly `# changelog`.
2. **version headings (`##`)**:
   - during development, changes must be documented under `## unreleased`.
   - finalized releases must follow the exact format `## <semver>+<version_code>` without spaces (e.g., `## 2.23.0+58`).
3. **subsection headings (`###`)**:
   - only two subsection headings are permitted:
     - `### user release notes` (mandatory for every section)
     - `### internal notes` (optional, for developer-facing/technical details)
   - when both are present, `### user release notes` must appear before `### internal notes`.
   - no other headings (such as `####` or alternative titles) are allowed.
4. **content rules**:
   - `### user release notes` must be strictly non-empty.
   - all entries must be bullet points starting with `- ` (nested sub-bullets indented with two spaces are permitted).
   - plain paragraphs outside bullet points are disallowed.
5. **character limit**:
   - the total content of `### user release notes` per release must not exceed **490 characters** (including spaces and newlines). this accommodates app store release note limits with a safety buffer.

---

### copy-pastable examples

#### 1. unreleased changes during development

```markdown
## unreleased

### user release notes

- add playlist cover caching.
- fix volume slider jump on drag release.

### internal notes

- migrate audio focus listeners to native module.
- add unit tests for playlist service.
```

#### 2. user-facing changes only

```markdown
## 2.23.0+58

### user release notes

- add random albums, newly added albums and recently released albums sections on homepage.
```

#### 3. both user-facing and internal changes

```markdown
## 2.23.0+58

### user release notes

- add random albums, newly added albums and recently released albums sections on homepage.

### internal notes

- ui tweaks.
```

---

### validation

validate your changes locally before submitting a pull request:

```bash
npm run lint:changelog
```

---

## release process

releases are a fully manually triggered process with no plans of automating the trigger.

releases are never triggered automatically on branch pushes or pull request merges. instead, an authorized maintainer manually triggers a release from the `main` branch using:

```bash
npm run release:internal
```

this script executes all automated quality gates (type checking, linting, tests, strict changelog validation with no unreleased sections allowed), tags the commit as `v<version>+<version_code>`, and pushes the tag to trigger deployment.
