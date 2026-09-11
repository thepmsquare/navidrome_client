# design system notes: navidrome client

personal notes and implementation rules for tokens, typography, component patterns, and visual hierarchy across the navidrome client. every pattern, token choice, and layout decision here builds on top of **material 3 expressive**, tempered with deliberate visual restraint. reference links and a react-native-paper ↔ native-compose parity table are in section 13.

---

## aesthetic identity: "grooved"

- **aesthetic name**: **"grooved"** — personal music reference evoking vinyl grooves, analog warmth, and tactile precision.
- **visual character**: strong primary accents, clear geometric structure, generous breathing room. base hue is **fully dynamic** (see §5) — warmth comes from _how_ roles are used, not from a fixed palette.
- **tone**: **warm utilitarian** — personal, intimate, and curated rather than cold, clinical, or enterprise.
- **foundation**: **material 3 expressive** — dynamic color, physics-based motion, and expressive components where the library supports them, layered with disciplined layout density and visual hierarchy.

---

## 1. core principles & self-reminders

1. **material 3 expressive baseline**: every layout decision, color mapping, and elevation tier builds on top of dynamic material 3 primitives (`react-native-paper` v5 + `@pchmn/expo-material3-theme`).
2. **lowercase copy rule**: keep all self-authored, user-facing application copy in lowercase (headings, labels, placeholders, hints, error banners). data directly sourced from apis or raw user inputs remains untransformed.
3. **token discipline**: never use arbitrary percentages (`"2.5%"`, `"4%"`) or magic numbers for padding, margins, or gaps. import tokens strictly from `spacing.ts`.
4. **single primary cta**: enforce at most one `mode="contained"` action per viewport to avoid competing visual weight.
5. **contained section headers**: always anchor card and section titles inside their container `<Surface>`, never floating uncontained above.
6. **fully dynamic color, spec-driven roles**: never hardcode a hue. the seed color always comes from the device/user theme. where the M3 spec is explicit about which role a component uses, follow it. where the spec is silent about which role fits which _kind of content_, that's where "grooved" gets to have a personality — see §5.

---

## 2. spacing tokens (`utils/spacing.ts`)

standard 8dp-based material 3 spacing grid:

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

scrollContent: {
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.lg,
  gap: spacing.lg,
}
```

---

## 3. shape scale & shape morphing

the material 3 shape scale, from smallest to largest corner radius:

| token         | radius      |
| ------------- | ----------- |
| `none`        | `0dp`       |
| `extra-small` | `4dp`       |
| `small`       | `8dp`       |
| `medium`      | `12dp`      |
| `large`       | `16dp`      |
| `extra-large` | `28dp`      |
| `full`        | pill/circle |

- **card border radius**: `16dp` (material 3 **large** shape)
- **padding**: `spacing.md` (`16dp`) uniform on all sides
- **internal spacing**: `spacing.sm + spacing.xs` (`12dp`) or `spacing.md` (`16dp`)

material 3 expressive adds an expanded shape library (~35 shapes — squircles, scallops, bursts) with built-in animated morphing between shapes: a pressed button morphing squarer, a loading indicator continuously morphing between polygons. this is a Compose-only capability (`androidx.compose.material3` 1.4.0-alpha14+) with no `react-native-paper` equivalent, so it isn't used systemically here. if a single hero moment (e.g. the play/pause FAB) ever warrants it, the right approach is a small custom Kotlin native module (Expo Modules, same pattern as the existing `modules/audio-playback` plugin) that renders a real Compose component and exposes it as a native view to RN, rather than approximating shape morphing in RN/Reanimated.

---

## 4. typography hierarchy

leverage react native paper `<Text variant="...">` directly to inherit material 3 type scales; avoid manual `fontSize` overrides.

| variant         | role                        | typical styling & color         | usage pattern                      |
| --------------- | --------------------------- | ------------------------------- | ---------------------------------- |
| `titleLarge`    | page header                 | `theme.colors.onSurface`        | `home`, `settings`, app title      |
| `headlineSmall` | hero moment / metric values | `theme.colors.onSurface`        | home greeting, `142` (songs count) |
| `titleMedium`   | card / section header       | `theme.colors.onSurface`        | `connection`, `actions`, `data`    |
| `titleSmall`    | card subtitle / subheader   | `theme.colors.onSurfaceVariant` | app subtitle below branding        |
| `bodyMedium`    | general body / description  | `theme.colors.onSurfaceVariant` | explainer text, status text        |
| `bodySmall`     | secondary status / metadata | `theme.colors.onSurfaceVariant` | sync cache timestamp, server url   |
| `labelLarge`    | field key in key-value row  | `theme.colors.onSurfaceVariant` | `username`, `server`, `version`    |

page headers use `titleLarge` rather than a headline size — headline sizes are reserved for genuine hero moments (a home-screen greeting, an empty-state caption), not for a title that repeats at the top of every screen.

material 3 expressive adds "emphasized" variants across the type scale (variable-font-axis editorial emphasis) for louder hierarchy without changing the role size. `react-native-paper` v5 doesn't expose these yet, so there's no dedicated token for it here — on the rare occasion a line needs emphasis without a full size jump, bump `fontWeight` manually rather than switching variants.

---

## 5. color roles & dynamic theming

color is **fully dynamic** — the tonal palette is derived from the device/user seed (via `@pchmn/expo-material3-theme`), never a fixed hex. what's fixed is which role gets used for which kind of content. where the spec doesn't dictate usage, that's where "grooved" gets its personality.

| role pair                                                | usage                                                                                                                                                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primary` / `onPrimary`                                  | highest-emphasis actions only (contained buttons, FAB). reserved strictly for the one primary CTA per screen, per principle 4                                           |
| `primaryContainer` / `onPrimaryContainer`                | tonal/secondary-emphasis surfaces — contained-tonal buttons, selected chips                                                                                             |
| `secondary` / `secondaryContainer`                       | supporting UI — chips, low-emphasis selection                                                                                                                           |
| `tertiary` / `tertiaryContainer`                         | **"grooved's" accent role** — now-playing highlight, active track indicator, cache-progress fill. keeps `primary` uncluttered and gives playback state its own identity |
| `surface` + `surfaceContainer*` tiers (lowest → highest) | tonal depth without shadow. preferred over raw elevation/shadow wherever possible — concentric tonal layers read as "grooves," which fits the aesthetic name literally  |
| `outline` / `outlineVariant`                             | borders, dividers                                                                                                                                                       |
| `error` / `errorContainer`                               | destructive actions, validation                                                                                                                                         |

---

## 6. surfaces & cards

organize related controls and views into distinct material 3 containers.

- **default**: filled card — flat, `elevation={0}`, background `surfaceContainerHighest`. used for `home`, `settings`, `aboutCard`, and most standard content blocks.
- **exception**: elevated card — `elevation={1}`, real shadow — reserved for a surface that needs to visually lift off a busy or scrolling background (e.g. a card overlapping album artwork).
- **border radius**: `16dp` (large shape, see §3)
- **padding**: `spacing.md` (`16dp`) uniform on all sides
- **header placement**: place `<Text variant="titleMedium">` inside `<Surface>` as the first child

tonal elevation behaves differently in dark theme than the naive "less shadow in the dark" intuition suggests: surfaces get progressively _lighter_ (a warmer/lighter tint) as elevation increases, rather than staying dark and relying purely on shadow. `@pchmn/expo-material3-theme` should generate the correct `surfaceContainer` tonal steps for dark mode automatically — worth a manual on-device check with a dark wallpaper to confirm the tiers actually shift rather than just inverting the light palette.

### standard pattern

```tsx
<Surface elevation={0} style={styles.sectionCard}>
  <Text variant="titleMedium">section title</Text>
  {/* card content */}
</Surface>
```

---

## 7. state layers

material 3 communicates interaction state via a translucent overlay of the _content's own color_ painted over the container, rather than a generic gray highlight.

| state   | opacity | notes                                                            |
| ------- | ------- | ---------------------------------------------------------------- |
| hover   | 8%      | mostly irrelevant on a touch-only Android app                    |
| focus   | 10%     | relevant for keyboard/D-pad/TV-remote navigation                 |
| pressed | 10%     | the one that matters most here — every tap should show this      |
| dragged | 16%     | relevant if any drag-to-reorder ships (e.g. playlist reordering) |

`react-native-paper`'s `Pressable`-backed components (`Button`, `Card`, `List.Item`) apply an Android ripple close to this by default. the thing worth verifying on-device is that the ripple/overlay color is the **on-color of that surface** (e.g. `onSurface` on a surface card, `onPrimary` on a primary button) rather than a flat default gray — that's what makes the state layer feel like "grooved" rather than generic Android chrome.

---

## 8. motion

- **physics-based springs are the primary motion model**, replacing duration + easing curves. spring stiffness/damping is tuned once per motion "theme" and applied broadly, rather than tuning a duration/easing pair per animation.
- **two motion schemes**:
  - **expressive** — visible overshoot/bounce. use for moments that should feel alive: the mini-player expanding to full player, a cache-complete confirmation, the queue reordering.
  - **standard** — calm, minimal overshoot. use for routine navigation: tab switches, list scrolling, opening settings.
- **screen-to-screen transitions**:
  - **shared axis** (X/Y/Z) — forward/back stack navigation with a clear directional relationship (`home → album → song`).
  - **container transform** — an element morphs directly into the next screen (mini-player bar morphing into the full-screen player; an album art thumbnail morphing into the full art view). this is the motion moment most worth prioritizing given how player-centric the app is.

`react-native-paper` only renders material 3 components — it has no opinion on motion, so this lives entirely at the app layer. exact spring constants aren't stably published outside the Compose source, so specific numbers aren't hardcoded here. in practice: use `react-native-reanimated`'s `withSpring` for the two schemes qualitatively — a bouncier, lower-damping config for "expressive" moments, a higher-damping/near-critical config for "standard" ones. the mini-player ↔ full-player transition is worth building as a proper shared-element/container-transform-style animation via Reanimated's shared transitions, since it's the single motion moment users will notice most. if a spring feel ever needs to match Android's native system UI exactly rather than just feeling close, that's a case for the custom-Kotlin-native-module route from §3, not something to chase in JS.

---

## 9. button hierarchy & semantic roles

map action importance directly to material 3 button variants:

| variant                 | mode                       | usage context                                                    | personal rule                                                                                                                                 |
| ----------------------- | -------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **primary cta**         | `contained`                | decisive primary action                                          | cap at **1** per visible screen section (e.g., `connect`, `login`).                                                                           |
| **prominent secondary** | `contained-tonal`          | secondary action requiring prominence without stealing cta focus | use for complementary actions like `try demo`, `play test sound`.                                                                             |
| **standard secondary**  | `outlined`                 | utility, configuration, or alternative paths                     | use for `import profile`, `sync`, `force sync`, `export profile`.                                                                             |
| **subtle / inline**     | `text`                     | reversible steps, dismiss, cancel                                | use for `change server url`, `cancel`.                                                                                                        |
| **destructive action**  | `outlined` + `error` color | teardown, cache clear, sign out                                  | default to `mode="outlined"` with `textColor={theme.colors.error}` and matching border. keep contained red strictly for confirmation dialogs. |

this table covers what `react-native-paper` v5 ships out of the box. expressive-only additions (split buttons, button groups, toggle button groups) aren't part of it — see the parity table in §13 before reaching for them.

---

## 10. navigation & app bars

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
- material 3 expressive's new toolbars (`DockedToolbar`, `FloatingToolbar`) are the native replacement for the older `BottomAppBar` pattern. `react-native-paper`'s `Appbar` still follows the earlier pattern, which is fine for now — worth revisiting only if a floating contextual toolbar (e.g. multi-select actions on a playlist) becomes genuinely useful.

---

## 11. forms & inputs

- **input styling**: stick to `mode="outlined"` across text inputs.
- **iconography**: pair fields with contextual leading icons (`server`, `account`, `lock`) and functional trailing actions (`close-circle-outline` for clear, `content-paste` for clipboard paste, `eye` / `eye-off` for password toggles).
- **state handling**: disable primary actions until required fields validate; render activity spinners inside buttons using the `loading` prop rather than overlaying custom spinners.
- **progressive disclosure**: focus only on active fields in multi-stage flows (e.g., server ping validation before displaying credentials), hiding unneeded onboarding controls.

---

## 12. reference & rnp ↔ native parity

**reference links** — pull current values from these directly rather than trusting a snapshot in this doc, since the spec and component library both continue to evolve:

- [m3.material.io](https://m3.material.io) — primary spec: color, type, shape, motion, component anatomy.
- [`androidx.compose.material3` package reference](https://developer.android.com/reference/kotlin/androidx/compose/material3/package-summary) — the actual Kotlin/Compose component list, kept current by Google.
- [material-3-expressive-catalog](https://github.com/meticha/material-3-expressive-catalog) — a maintained demo app with source, useful for a visual gut-check before deciding whether something is worth a native bridge.

**parity table** — what `react-native-paper` v5 covers vs. what's expressive-only and would need a custom Kotlin native module (same pattern as the existing `modules/audio-playback` plugin):

| component                              | react-native-paper v5 |                        native compose (m3 expressive)                        | notes                                                                                    |
| -------------------------------------- | :-------------------: | :--------------------------------------------------------------------------: | ---------------------------------------------------------------------------------------- |
| button (contained/outlined/tonal/text) |          ✅           |                                      ✅                                      | parity                                                                                   |
| card (filled/elevated/outlined)        | ✅ (`elevation` prop) |                                      ✅                                      | parity — override RNP's default to filled, see §6                                        |
| text input (outlined)                  |          ✅           |                                      ✅                                      | parity                                                                                   |
| app bar / toolbar                      | ✅ (`Appbar.Header`)  |                 ~ (`DockedToolbar` replaces `BottomAppBar`)                  | RNP follows the pre-expressive app bar pattern; floating/docked toolbars are native-only |
| FAB                                    |          ✅           |                                ✅ + FAB menu                                 | plain FAB has parity; FAB menu is native-only                                            |
| loading indicator                      |  ✅ (basic spinner)   |             ✅ `LoadingIndicator` / `ContainedLoadingIndicator`              | native version has morphing-polygon shapes; RNP's is a plain pre-expressive spinner      |
| split button                           |          ❌           |                            ✅ `SplitButtonLayout`                            | native-only — would need a custom Kotlin module                                          |
| button group                           |          ❌           |                               ✅ `ButtonGroup`                               | native-only                                                                              |
| floating/docked toolbar                |          ❌           | ✅ `VerticalFloatingToolbar` / `HorizontalFloatingToolbar` / `DockedToolbar` | native-only                                                                              |
| shape morphing                         |          ❌           |               ✅ (built into buttons, FAB, loading indicator)                | native-only, systemic — see §3                                                           |

anything marked native-only is a candidate for the custom-Kotlin-native-module route, not a gap to fake in RN. worth prioritizing by actual player-app impact — the loading indicator and a floating toolbar for multi-select are more likely to matter here than split buttons or button groups.
