# Stitch login template migration

## Scope

The Stitch HTML/Tailwind mockup was translated to Expo React Native. The login
request, validation, credential storage, error handling, and navigation remain
unchanged.

## Mapping

| Template | React Native implementation | Status |
| --- | --- | --- |
| Ocean mesh and ambient light | Background image, translucent overlay, and positioned ambient glows | Native approximation |
| Brand bar | `AuthScreen` header using the login experience's AEPV.ia.finance identity, without a placeholder icon | Implemented |
| Glass login card | `AuthScreen` translucent layered surface with border highlights, depth, and compact layout | Native approximation |
| Email/password controls | Existing `GlassField`/`GlassTextInput` components; shared behavior is unchanged | Implemented |
| `push_401` logo | `OceanicLogoLoader` with a breathing slime body, connected puddle, and rising native `Animated` blobs | Native approximation |
| Gooey submit control | `LiquidButton` with drifting droplets, touch-position ripple, press feedback, and loading state | Native approximation |
| Trust footer | Protected-connection indicator in `LoginScreen` | Implemented |

## Decisions and omissions

- Native components replace HTML, Tailwind, CSS filters, and DOM event handlers.
- Real-time background blur was removed and remains omitted: there is no
  `expo-blur` dependency or runtime usage. The image overlay, ambient glows,
  and translucent glass card provide the visual approximation without extra
  GPU cost or platform complexity.
- Platform fonts remain in use; no font or gradient dependency was added.
- React Native has no portable SVG gooey filter equivalent, so layered droplets
  approximate the metaball effect without adding a rendering dependency.
- Biometric access is intentionally omitted because the app has no real
  biometric authentication flow. A decorative or non-functional action would
  be misleading.
- The login uses AEPV.ia.finance consistently in its header, wide-screen panel,
  animated-mark label, and assertions.
- The duplicated `Acesso seguro` header and card tags were removed from login;
  the protected-connection footer remains the single trust indicator.
- The login heading and supporting copy sit beside the slime, outside the form
  card. Other auth screens retain the shared component defaults.

## Animation and accessibility

- Continuous animation stops when the operating system requests reduced motion.
- The submit button exposes disabled and busy states and keeps a 52 px touch target.
- Inputs, links, password visibility, security state, and the animated mark have
  explicit accessibility labels.
- Compact screens reduce padding while the `ScrollView` keeps all controls
  reachable with the keyboard open.


## Dashboard application shell (Phase 1)

- `AppShell` now supplies the dashboard header, profile entry point, four-item
  footer (`Dashboard`, `Planejamentos`, `PrevisÃ£o ML`, `DecisÃµes`), and the
  reusable quick-actions FAB. The notification icon is intentionally absent.
- The FAB exposes only direct links to existing functional screens: expense,
  income, account, transfer, debt, debt payment, goal, budget, category,
  alert, and reports. It does not duplicate footer destinations.
- `/decisoes` deliberately has visual-only copy. It provides no recommendation,
  data, or automatic action until that feature is implemented.

## Validation

```bash
cd frontend
npm test -- --runInBand src/modules/auth/__tests__/login.test.tsx
npm test -- --runInBand src/modules/dashboard/__tests__/dashboard.test.tsx src/modules/transacoes/__tests__/transacoes-form.test.tsx
npm run typecheck
npx eslint src/shared/ui/AppShell.tsx src/shared/ui/QuickActionsMenu.tsx src/modules/dashboard/screens/DashboardScreen.tsx src/modules/transacoes/screens/TransacaoFormScreen.tsx app/decisoes.tsx
npm run export:web -- --output-dir <temporary-directory>
```
