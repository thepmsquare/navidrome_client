# design system notes: navidrome client

personal notes and implementation rules for tokens, typography, component patterns, and visual hierarchy across the navidrome client. every pattern, token choice, and layout decision here builds strictly on top of **material you expressive** (material 3 expressive foundation via dynamic theming and rnp v5), tempered with deliberate visual restraint.

---

## aesthetic identity: "grooved"

- **aesthetic name**: **"grooved"** — personal music reference evoking vinyl grooves, analog warmth, and tactile precision.
- **visual character**: warm neutrals with strong primary accents, clear geometric structure, and generous breathing room.
- **tone**: **warm utilitarian** — personal, intimate, and curated rather than cold, clinical, or enterprise.
- **foundation**: **material you expressive** layered with intentional restraint — rich dynamic color harmonies and micro-interactions, but disciplined in layout density and visual hierarchy.

---

## 1. core principles & self-reminders

1. **material you expressive baseline**: every layout decision, color mapping, and elevation tier builds on top of dynamic material you expressive primitives (`react-native-paper` v5 + `@pchmn/expo-material3-theme`).
2. **lowercase copy rule**: keep all self-authored, user-facing application copy in lowercase (headings, labels, placeholders, hints, error banners). data directly sourced from apis or raw user inputs remains untransformed.
3. **token discipline**: never use arbitrary percentages (`"2.5%"`, `"4%"`) or magic numbers for padding, margins, or gaps. import tokens strictly from `spacing.ts`.
4. **single primary cta**: enforce at most one `mode="contained"` action per viewport to avoid competing visual weight.
5. **contained section headers**: always anchor card and section titles inside their container `<Surface>`, never floating uncontained above.

---

## 2. spacing tokens (`utils/spacing.ts`)

standard 8dp-based material you spacing grid:

| token         | value  | context                                                                       |
| ------------- | ------ | ----------------------------------------------------------------------------- |
| `spacing.xs`  | `4dp`  | micro-gaps: badge padding, tight title-to-subtitle spacing, icon-to-text      |
| `spacing.sm`  | `8dp`  | compact gaps: list item internal gap, inline button spacing                   |
| `spacing.md`  | `16dp` | standard margin & padding: screen horizontal padding, card padding, form gaps |
| `spacing.lg`  | `24dp` | structural gaps: vertical separation between distinct cards/sections          |
| `spacing.xl`  | `32dp` | large layout spacing: section groupings on tablet / wide viewports            |
| `spacing.xxl` | `48dp` | touch target floor (48x48dp minimum) and hero spacing                         |

```typescript
import { spacing } from "@/utils/spacing";

// standard screen scroll container setup
scrollContent: {
  paddingHorizontal: spacing.md,  // 16dp
  paddingVertical: spacing.lg,    // 24dp
  gap: spacing.lg,                // 24dp between top-level sections
}

```

---

## 3. typography hierarchy

leverage react native paper `<Text variant="...">` directly to inherit material you type scales; avoid manual `fontSize` overrides.

| variant          | role                        | typical styling & color         | usage pattern                    |
| ---------------- | --------------------------- | ------------------------------- | -------------------------------- |
| `headlineMedium` | page header                 | `theme.colors.onSurface`        | `home`, `settings`, app title    |
| `headlineSmall`  | metric / count values       | `theme.colors.onSurface`        | `142` (songs count)              |
| `titleMedium`    | card / section header       | `theme.colors.onSurface`        | `connection`, `actions`, `data`  |
| `titleSmall`     | card subtitle / subheader   | `theme.colors.onSurfaceVariant` | app subtitle below branding      |
| `bodyMedium`     | general body / description  | `theme.colors.onSurfaceVariant` | explainer text, status text      |
| `bodySmall`      | secondary status / metadata | `theme.colors.onSurfaceVariant` | sync cache timestamp, server url |
| `labelLarge`     | field key in key-value row  | `theme.colors.onSurfaceVariant` | `username`, `server`, `version`  |

---

## 4. surfaces & cards

organize related controls and views into distinct material you expressive containers.

### specs

- **border radius**: `16dp` (material 3 medium shape)
- **padding**: `spacing.md` (`16dp`) uniform on all sides
- **elevation levels**:
- `1`: standard content blocks and secondary information cards (`home`, `settings`, `aboutCard`)
- `2`: primary interactive form cards (`connect` input form)

- **internal spacing**: `spacing.sm + spacing.xs` (`12dp`) or `spacing.md` (`16dp`)
- **header placement**: place `<Text variant="titleMedium">` inside `<Surface>` as the first child

### standard pattern

```tsx
<Surface elevation={1} style={styles.sectionCard}>
  <Text variant="titleMedium">section title</Text>

  {/* card content */}
</Surface>
```

---

## 5. button hierarchy & semantic roles

map action importance directly to material you expressive button variants:

| variant                 | mode                       | usage context                                                    | personal rule                                                                                                                                 |
| ----------------------- | -------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **primary cta**         | `contained`                | decisive primary action                                          | cap at **1** per visible screen section (e.g., `connect`, `login`).                                                                           |
| **prominent secondary** | `contained-tonal`          | secondary action requiring prominence without stealing cta focus | use for complementary actions like `try demo`, `play test sound`.                                                                             |
| **standard secondary**  | `outlined`                 | utility, configuration, or alternative paths                     | use for `import profile`, `sync`, `force sync`, `export profile`.                                                                             |
| **subtle / inline**     | `text`                     | reversible steps, dismiss, cancel                                | use for `change server url`, `cancel`.                                                                                                        |
| **destructive action**  | `outlined` + `error` color | teardown, cache clear, sign out                                  | default to `mode="outlined"` with `textColor={theme.colors.error}` and matching border. keep contained red strictly for confirmation dialogs. |

---

## 6. navigation & app bars

- **nested navigation**: stick to `<Appbar.Header>` for sub-screens instead of hacking custom back rows:

```tsx
<Appbar.Header>
  <Appbar.BackAction
    onPress={() => router.back()}
    accessibilityLabel="go back"
  />
  <Appbar.Content title="learn more" />
</Appbar.Header>
```

- **accessibility floors**: enforce the minimum **48x48dp** touch target across all custom touchable areas and buttons.

---

## 7. forms & inputs

- **input styling**: stick to `mode="outlined"` across text inputs.
- **iconography**: pair fields with contextual leading icons (`server`, `account`, `lock`) and functional trailing actions (`close-circle-outline` for clear, `content-paste` for clipboard paste, `eye` / `eye-off` for password toggles).
- **state handling**: disable primary actions until required fields validate; render activity spinners inside buttons using the `loading` prop rather than overlaying custom spinners.
- **progressive disclosure**: focus only on active fields in multi-stage flows (e.g., server ping validation before displaying credentials), hiding unneeded onboarding controls.
