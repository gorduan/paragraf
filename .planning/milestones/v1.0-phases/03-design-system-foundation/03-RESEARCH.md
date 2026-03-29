# Phase 3: Design System Foundation - Research

**Researched:** 2026-03-27
**Domain:** TailwindCSS 4 design tokens, Radix UI headless primitives, component variant architecture
**Confidence:** HIGH

## Summary

Phase 3 establishes a design token system and reusable primitive components for the Paragraf v2 frontend. The existing codebase already uses TailwindCSS 4 with a `@theme` block containing a blue primary palette (9 steps). The task is to (1) expand this token system to cover spacing, typography, shadows, radii, semantic colors, and switch from blue to indigo, (2) build 7-8 primitive components using Radix UI for accessible headless behavior and `cva` for variant management, and (3) migrate SearchPage + Sidebar as proof of the new system.

TailwindCSS 4's `@theme` directive is the correct mechanism -- it generates utility classes from CSS variables, so `--spacing-lg: 24px` creates `p-lg`, `m-lg`, `gap-lg` etc. automatically. The existing `@custom-variant dark` pattern for dark mode is already in place and compatible. Radix UI Primitives are fully compatible with React 19 and provide the accessibility behavior (focus trap, keyboard nav, ARIA) that D-06 requires. The `cva` + `clsx` + `tailwind-merge` pattern is the established standard for variant-driven component APIs in the Tailwind ecosystem.

**Primary recommendation:** Define all tokens in the existing `@theme` block using TailwindCSS 4 namespaced variables, build primitives with `cva` variant definitions, use individual `@radix-ui/react-*` packages (as specified in UI-SPEC), and create a `cn()` utility for className merging.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Vollstaendige Token-Palette: Semantic Colors (success/warning/error/info je 50-900), Spacing-Scale (4px-Basis), Typography-Scale (5-6 Stufen), Shadows (3 Stufen), Border-Radii (3 Stufen). Alles in TailwindCSS 4 `@theme` Block in `index.css`.
- **D-02:** Primary-Palette von Blau auf Indigo umstellen (500: #6366f1). Wirkt formeller und juristischer. Gesamte `--color-primary-*` Reihe anpassen.
- **D-03:** Dark Mode bleibt class-basiert (`@custom-variant dark`). Token-System definiert Light- und Dark-Varianten fuer alle semantischen Farben.
- **D-04:** Erweitertes Set mit 7-8 Primitives: Button, Card, Input, Badge, Dialog, Select/Dropdown, Tooltip, Tabs. Jede Komponente als eigene Datei in `src/components/ui/`.
- **D-05:** Alle Primitives mit Varianten-Support ueber Props (`variant`, `size`). Konsistente API: `<Button variant="primary" size="sm">`. 2-4 Varianten pro Primitive.
- **D-06:** Radix UI Primitives als Headless-Basis fuer Dialog, Select, Tooltip, Tabs. Radix liefert Accessibility-Verhalten (Fokus-Trap, Keyboard-Nav, ARIA), Styling komplett ueber Tailwind.
- **D-07:** SearchPage + Sidebar als Referenz-Migration in Phase 3. Restliche Pages migrieren in Phase 8-10.
- **D-08:** Bestehende Accessibility-Infrastruktur (skip-link, sr-only, focus-visible, reduced-motion, high-contrast) bleibt erhalten und wird in Token-System integriert.

### Claude's Discretion
- Genaue Indigo-Farbwerte (50-900) und Semantic Color Paletten
- Spacing-Scale Stufen und Naming
- Typography-Scale Stufen (font-size + line-height + weight Kombinationen)
- Shadow-Stufen (sm/md/lg oder aehnlich)
- Radix-Paketauswahl (welche `@radix-ui/*` Pakete konkret)
- Interne Implementierung der Varianten (className-Mapping, cva/clsx, oder plain objects)
- Ob ein `cn()` Utility-Helper fuer className-Merging sinnvoll ist

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Design-System mit konsistenten Tokens (Farben, Spacing, Typografie) via TailwindCSS 4 | TailwindCSS 4 `@theme` namespaced variables generate utility classes automatically. All token categories (color, spacing, text, shadow, radius) have verified namespaces. cva + cn() pattern for component variants. Radix UI for accessible headless primitives. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Branch policy:** All commits on branch `Docker-only`, never on main/master
- **Frontend stack:** React 19 + Vite 6 + TailwindCSS 4 (locked, no changes)
- **Component pattern:** Named exports (`export function ComponentName()`), no barrel files, direct imports
- **Props pattern:** Props interfaces defined directly above the component
- **Path alias:** `@/*` maps to `src/*`
- **Accessibility:** role, aria-*, focus-visible, reduced-motion, high-contrast -- all must be preserved
- **Naming:** PascalCase for components/pages, camelCase for utilities/hooks
- **No ESLint/Prettier:** Relies on TypeScript strict mode only
- **Icon library:** lucide-react ^0.460.0 (existing, no change)
- **Commit language:** Mix of English/German, prefix patterns: `fix:`, `Add`, `Fix`

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | ^4.0.0 | CSS framework with `@theme` design tokens | Already in project, v4 `@theme` is the token system |
| react | ^19.0.0 | UI framework | Already in project |
| lucide-react | ^0.460.0 | Icon library | Already in project |

### To Install
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dialog | 1.1.15 | Accessible modal/dialog with focus trap | D-06: Headless accessible primitives |
| @radix-ui/react-select | 2.2.6 | Accessible dropdown/select with keyboard nav | D-06: Headless accessible primitives |
| @radix-ui/react-tooltip | 1.2.8 | Delayed tooltip with accessible labeling | D-06: Headless accessible primitives |
| @radix-ui/react-tabs | 1.1.13 | Tab panel with keyboard arrow navigation | D-06: Headless accessible primitives |
| class-variance-authority | 0.7.1 | Component variant definitions (cva) | D-05: Variant-driven component API |
| clsx | 2.1.1 | Conditional className composition | Used with tailwind-merge in cn() |
| tailwind-merge | 3.5.0 | Smart Tailwind class merging (deduplication) | Prevents conflicting utility classes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Individual @radix-ui/* packages | Unified `radix-ui` v1.4.3 package | Unified package bundles all primitives (~larger install), but simplifies imports. UI-SPEC lists individual packages -- stick with individual for smaller bundle. |
| cva | tailwind-variants | Tailwind Variants has responsive variant support and "slots" for compound components, but cva is simpler, framework-agnostic, and the de facto standard for this pattern. |
| clsx + tailwind-merge | Just clsx alone | Without tailwind-merge, conflicting classes like `p-4 p-6` both apply. tailwind-merge deduplicates intelligently. Required for safe className overrides on primitives. |

**Installation:**
```bash
cd frontend && npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-tabs class-variance-authority clsx tailwind-merge
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── ui/                    # NEW: Primitive components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Dialog.tsx         # Radix-based
│   │   ├── Select.tsx         # Radix-based
│   │   ├── Tooltip.tsx        # Radix-based
│   │   └── Tabs.tsx           # Radix-based
│   ├── Sidebar.tsx            # Migration target
│   ├── SearchBar.tsx          # Uses Input primitive
│   ├── ResultCard.tsx         # Uses Card, Badge primitives
│   └── ...
├── lib/
│   ├── api.ts                 # Existing
│   └── utils.ts               # NEW: cn() helper
├── styles/
│   └── index.css              # Token expansion in @theme
└── pages/
    └── SearchPage.tsx          # Migration target
```

### Pattern 1: cn() Utility Helper
**What:** A small utility combining `clsx` and `tailwind-merge` for safe className composition
**When to use:** Every component that accepts className props or conditionally applies classes
**Example:**
```typescript
// frontend/src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Pattern 2: cva Component Variants
**What:** Define variant maps with `cva()`, use in components with typed props
**When to use:** Every primitive component with variant/size props
**Example:**
```typescript
// frontend/src/components/ui/Button.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base classes applied to all variants
  "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-primary-600 text-white hover:bg-primary-500 active:bg-primary-700",
        secondary: "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600",
        ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
        destructive: "bg-red-500 text-white hover:bg-red-600 active:bg-red-700",
      },
      size: {
        sm: "h-8 px-xs2 text-caption rounded-md",
        md: "h-10 px-md text-body rounded-md",
        lg: "h-12 px-lg text-subheading rounded-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
```

### Pattern 3: Radix UI + Tailwind Styling
**What:** Wrap Radix headless primitives with Tailwind styling, export as project primitives
**When to use:** Dialog, Select, Tooltip, Tabs
**Example:**
```typescript
// frontend/src/components/ui/Dialog.tsx
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({ children, ...props }: DialogPrimitive.DialogProps) {
  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>;
}

export function DialogTrigger({ className, ...props }: DialogPrimitive.DialogTriggerProps) {
  return <DialogPrimitive.Trigger className={cn(className)} {...props} />;
}

export function DialogContent({ className, children, ...props }: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 shadow-lg rounded-lg p-lg max-w-[480px] w-full",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <X size={16} aria-hidden="true" />
          <span className="sr-only">Schliessen</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
```

### Pattern 4: TailwindCSS 4 @theme Token Namespaces
**What:** Use correct CSS variable namespaces so Tailwind generates utility classes automatically
**When to use:** All token definitions in `index.css`
**Critical namespaces:**

| Token Type | CSS Variable Namespace | Generated Utility Example |
|------------|----------------------|--------------------------|
| Colors | `--color-*` | `bg-primary-500`, `text-error-700` |
| Spacing | `--spacing-*` | `p-lg`, `gap-md`, `m-xs` |
| Font sizes | `--text-*` | `text-body`, `text-heading` |
| Font sizes + line-height | `--text-*--line-height` | Paired with `text-body` |
| Font weights | `--font-weight-*` | `font-regular`, `font-semibold` |
| Shadows | `--shadow-*` | `shadow-sm`, `shadow-md` |
| Border radii | `--radius-*` | `rounded-sm`, `rounded-md` |

### Anti-Patterns to Avoid
- **Hardcoded values in components:** Never use `text-[14px]` or `p-[24px]` in primitives -- always use token-based utilities like `text-body` or `p-lg`.
- **Overriding Tailwind defaults without `--spacing` base:** TailwindCSS 4 uses `--spacing` as a multiplier for numeric utilities (`p-4` = `calc(var(--spacing) * 4)`). Setting `--spacing: 1px` would make `p-4` = `4px`. Keep the default `--spacing: 0.25rem` and use named tokens for the design system scale.
- **Dark mode CSS variables:** Do NOT try to define separate `--color-primary-500-dark` tokens. TailwindCSS 4 dark mode is class-based via `@custom-variant dark`. Use `dark:bg-primary-800` in component classes.
- **Barrel exports from ui/:** Per project conventions, no barrel files. Import directly: `import { Button } from "@/components/ui/Button"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal focus trap, Escape close, ARIA | Custom dialog with event listeners | @radix-ui/react-dialog | Focus trap edge cases (nested modals, scroll lock, portal), screen reader announcement |
| Select/dropdown keyboard nav | Custom dropdown with onKeyDown | @radix-ui/react-select | Arrow keys, type-ahead, scroll into view, ARIA listbox pattern |
| Tooltip positioning + delay | Custom tooltip with setTimeout | @radix-ui/react-tooltip | Collision detection, delay groups, accessible labeling |
| Tab keyboard navigation | Custom tabs with state | @radix-ui/react-tabs | Arrow key cycling, automatic/manual activation, ARIA tabpanel |
| Conditional className merging | String concatenation | clsx + tailwind-merge via cn() | Tailwind class deduplication (`p-4 p-6` resolves to `p-6`) |
| Variant-to-class mapping | Switch/if chains or plain objects | class-variance-authority (cva) | Type-safe variants, compound variants, defaultVariants, clean API |

**Key insight:** The 4 Radix components handle the most complex accessibility behaviors in the UI. Hand-rolling focus traps or keyboard navigation is the #1 source of accessibility bugs in React apps.

## Common Pitfalls

### Pitfall 1: TailwindCSS 4 @theme Namespace Confusion
**What goes wrong:** Defining tokens with wrong variable names (e.g., `--font-size-body` instead of `--text-body`) and wondering why no utility class is generated.
**Why it happens:** TailwindCSS 4 namespaces are specific: `--text-*` for font sizes, `--font-weight-*` for weights, `--leading-*` for line-heights, `--spacing-*` for spacing.
**How to avoid:** Always use the exact namespace from the TailwindCSS 4 docs. `--text-body: 14px` creates `text-body`. `--font-size-body: 14px` creates nothing.
**Warning signs:** Utility classes not being recognized, CSS showing `var(--font-size-body)` in browser but no Tailwind class.

### Pitfall 2: Overriding Existing Tailwind Spacing Scale
**What goes wrong:** Defining `--spacing-sm: 8px` replaces Tailwind's built-in `sm` spacing, breaking `p-sm` if it previously meant something else.
**Why it happens:** Custom `--spacing-*` tokens merge with (and override) Tailwind's default spacing.
**How to avoid:** The UI-SPEC tokens (xs, sm, md, lg, xl, 2xl, 3xl) are safe because they use names that align naturally. Be aware that numeric utilities like `p-4` still work via the base `--spacing` multiplier. The two systems coexist.
**Warning signs:** Existing pages using `p-4` or `m-2` breaking after token addition.

### Pitfall 3: Radix UI Data Attributes for Animations
**What goes wrong:** Adding CSS animations to Radix dialogs/tooltips but they don't trigger.
**Why it happens:** Radix uses `data-[state=open]` and `data-[state=closed]` attributes, not CSS pseudo-classes.
**How to avoid:** Use Tailwind's data attribute selectors: `data-[state=open]:animate-in`. Note the `prefers-reduced-motion` media query in `index.css` already disables animations -- this must be respected.
**Warning signs:** Dialog pops in without transition, but works when `prefers-reduced-motion` is off.

### Pitfall 4: tailwind-merge Configuration for Custom Tokens
**What goes wrong:** `tailwind-merge` doesn't know about custom tokens like `text-body` and treats it as a color class instead of font-size.
**Why it happens:** tailwind-merge has a default config that knows standard Tailwind classes but not custom ones.
**How to avoid:** For most cases the default config works because custom `--text-*` tokens generate utilities that follow the same naming pattern. Test merging: `cn("text-body", "text-heading")` should resolve to `text-heading`. If conflicts arise, configure `tailwind-merge` with `extendTailwindMerge()`.
**Warning signs:** Two conflicting custom classes both appearing in the output.

### Pitfall 5: High Contrast Mode Overrides
**What goes wrong:** The existing `@media (prefers-contrast: more)` block overrides `--color-primary-500` and `--color-primary-600`. After switching to indigo, these hardcoded blue values must be updated.
**Why it happens:** The high-contrast override still references the old blue values (#1d4ed8, #1e3a8a).
**How to avoid:** Update the high-contrast media query to use darker indigo values when changing the primary palette.
**Warning signs:** High contrast mode showing different blue hues instead of indigo.

### Pitfall 6: SearchBar Native Select vs Radix Select
**What goes wrong:** Trying to replace the native `<select>` in SearchBar with Radix Select during migration.
**Why it happens:** The SearchBar law filter uses `<select>` with `<optgroup>` for grouped laws. Radix Select supports groups but the migration adds complexity.
**How to avoid:** In Phase 3, the SearchBar migration should focus on the Input primitive for the search field and Button primitive for the CTA. The native `<select>` for law filtering can remain -- it's functional and accessible. Replace in a later phase if needed.
**Warning signs:** Over-scoping the migration and breaking the law filter dropdown.

## Code Examples

### Token Definition in @theme (verified pattern)
```css
/* frontend/src/styles/index.css */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* ── Primary: Indigo (D-02) ──────────────────────────── */
  --color-primary-50: #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-200: #c7d2fe;
  --color-primary-300: #a5b4fc;
  --color-primary-400: #818cf8;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  --color-primary-700: #4338ca;
  --color-primary-800: #3730a3;
  --color-primary-900: #312e81;

  /* ── Neutral: Slate ──────────────────────────────────── */
  --color-neutral-50: #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;
  --color-neutral-950: #020617;

  /* ── Semantic Colors ─────────────────────────────────── */
  --color-success-50: #f0fdf4;
  --color-success-100: #dcfce7;
  --color-success-500: #22c55e;
  --color-success-600: #16a34a;
  --color-success-900: #14532d;

  --color-warning-50: #fffbeb;
  --color-warning-100: #fef3c7;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  --color-warning-900: #78350f;

  --color-error-50: #fef2f2;
  --color-error-100: #fee2e2;
  --color-error-500: #ef4444;
  --color-error-600: #dc2626;
  --color-error-700: #b91c1c;
  --color-error-900: #7f1d1d;

  --color-info-50: #eef2ff;
  --color-info-100: #e0e7ff;
  --color-info-500: #6366f1;
  --color-info-600: #4f46e5;
  --color-info-900: #312e81;

  /* ── Spacing (4px base) ──────────────────────────────── */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-xs2: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  --spacing-3xl: 64px;

  /* ── Typography ──────────────────────────────────────── */
  --text-caption: 12px;
  --text-caption--line-height: 1.5;
  --text-body: 14px;
  --text-body--line-height: 1.5;
  --text-subheading: 16px;
  --text-subheading--line-height: 1.4;
  --text-heading: 20px;
  --text-heading--line-height: 1.3;
  --text-display: 28px;
  --text-display--line-height: 1.2;

  --font-weight-regular: 400;
  --font-weight-semibold: 600;

  /* ── Shadows ─────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

  /* ── Border Radii ────────────────────────────────────── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

### Badge Component with cva
```typescript
// frontend/src/components/ui/Badge.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center px-xs py-0.5 text-caption font-semibold rounded-sm",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
        primary: "bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
        success: "bg-success-50 text-success-700 dark:bg-success-900 dark:text-success-300",
        warning: "bg-warning-50 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
        error: "bg-error-50 text-error-700 dark:bg-error-900 dark:text-error-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

### Migration Example: ResultCard Badge Replacement
```typescript
// Before (inline Tailwind):
<span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded-full">
  {result.gesetz}
</span>

// After (primitive):
import { Badge } from "@/components/ui/Badge";
<Badge variant="primary">{result.gesetz}</Badge>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js (TW v3) | @theme in CSS (TW v4) | Jan 2025 | No JS config file needed, tokens are CSS-native |
| Individual Radix packages | Unified `radix-ui` package available | Feb 2026 | Simpler dependency management, but individual packages still work and are more granular |
| className string concatenation | cva + cn() pattern | 2023-present | Type-safe variants, consistent API, smart class merging |
| shadcn/ui copy-paste components | Direct Radix + cva (same pattern, no registry) | N/A | This project uses the same pattern without shadcn CLI scaffolding |

**Deprecated/outdated:**
- `tailwind.config.js` / `tailwind.config.ts`: Replaced by `@theme` in TailwindCSS 4. This project already uses `@theme`.
- `@apply` for component styles: Still works in TW4 but `cva` is preferred for variant-driven components.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently installed |
| Config file | none -- Wave 0 must set up |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01a | Design tokens generate valid Tailwind utilities | smoke | Visual inspection / build succeeds (`cd frontend && npm run build`) | N/A (build check) |
| UI-01b | Button renders all variants correctly | unit | `npx vitest run src/components/ui/Button.test.tsx` | Wave 0 |
| UI-01c | Card renders default and interactive variants | unit | `npx vitest run src/components/ui/Card.test.tsx` | Wave 0 |
| UI-01d | cn() merges classes correctly | unit | `npx vitest run src/lib/utils.test.ts` | Wave 0 |
| UI-01e | SearchPage migration preserves functionality | smoke | `cd frontend && npm run build` (no type errors) | N/A |
| UI-01f | Sidebar migration preserves accessibility | smoke | `cd frontend && npm run build` (no type errors) | N/A |

### Sampling Rate
- **Per task commit:** `cd frontend && npm run build` (type-check + bundle)
- **Per wave merge:** `cd frontend && npx vitest run` (if test infra set up)
- **Phase gate:** `npm run build` succeeds without errors + visual spot-check

### Wave 0 Gaps
- [ ] Install vitest + @testing-library/react + jsdom: `cd frontend && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- [ ] Create `frontend/vitest.config.ts` with jsdom environment
- [ ] `frontend/src/lib/utils.test.ts` -- covers cn() utility
- [ ] `frontend/src/components/ui/Button.test.tsx` -- covers variant rendering
- [ ] `frontend/src/components/ui/Badge.test.tsx` -- covers variant rendering

**Note:** STATE.md flags "Zero frontend tests -- Phase 3 should consider adding smoke tests before redesign." Setting up vitest in Wave 0 is recommended but the primary validation gate is `npm run build` succeeding (TypeScript strict mode catches type errors) and visual inspection.

## Open Questions

1. **tailwind-merge custom token awareness**
   - What we know: tailwind-merge v3.5.0 handles standard Tailwind classes. Custom tokens (`text-body`, `p-lg`) follow standard naming patterns and should work.
   - What's unclear: Whether edge cases exist where custom-named tokens confuse tailwind-merge's class group detection.
   - Recommendation: Test `cn("text-body", "text-heading")` early. If issues arise, use `extendTailwindMerge()` to register custom class groups.

2. **Numeric spacing utilities coexistence**
   - What we know: Defining `--spacing-md: 16px` creates `p-md`. The existing default `--spacing: 0.25rem` still powers `p-4` = 16px.
   - What's unclear: Whether both `p-md` and `p-4` resolving to 16px causes any issue with tailwind-merge.
   - Recommendation: Accept the overlap. Both work. `p-md` is semantically clearer for the design system. Let tailwind-merge handle deduplication.

3. **Dark mode shadow tokens**
   - What we know: UI-SPEC says dark mode shadows use `rgb(0 0 0 / 0.3)` base for visibility.
   - What's unclear: TailwindCSS 4 `@theme` does not support conditional token values (no `@theme dark {...}`). Shadows are static in the `@theme` block.
   - Recommendation: Use a single shadow definition that works in both modes (the standard values from UI-SPEC), or add dark mode shadow overrides via plain CSS (`:where(.dark, .dark *) { --shadow-md: ...; }`). The standard shadow values should be visible enough on dark backgrounds -- test and adjust if needed.

## Sources

### Primary (HIGH confidence)
- [TailwindCSS 4 Theme Variables docs](https://tailwindcss.com/docs/theme) -- @theme namespaces, variable naming, utility generation
- [TailwindCSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) -- Architecture changes, CSS-first config
- [cva.style docs](https://cva.style/docs) -- Variant definition API, React integration
- npm registry -- Package version verification (all 7 packages verified 2026-03-27)

### Secondary (MEDIUM confidence)
- [Radix UI Primitives releases](https://www.radix-ui.com/primitives/docs/overview/releases) -- React 19 compatibility confirmed
- [shadcn/ui changelog Feb 2026](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui) -- Unified radix-ui package reference

### Tertiary (LOW confidence)
- Dark mode shadow behavior in TailwindCSS 4 @theme -- Not verified in official docs, based on understanding of CSS variable scoping

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All packages verified in npm registry, TailwindCSS 4 @theme verified in official docs
- Architecture: HIGH -- cva + cn() + Radix is the established pattern (used by shadcn/ui, widely adopted)
- Pitfalls: HIGH -- Namespace confusion and high-contrast override are verified from reading existing code + docs
- Token definitions: HIGH -- UI-SPEC provides exact values, TailwindCSS 4 namespaces verified

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable ecosystem, all libraries are mature)
