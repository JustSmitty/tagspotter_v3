# Tag Spotter: "Digital Ephemera" Design Principles

This document serves as the authoritative guide for the **Digital Ephemera** UI. It ensures that all future features, components, and styling updates adhere to the vintage 1950s-60s American road trip aesthetic.

---

## 1. Vision & Core Aesthetic

**Concept:** The application should feel like a physical glovebox or scrapbook filled with souvenirs from a transcontinental road trip: postcards, matchbooks, stamped metal license plates, and faded maps.

### Core Pillars
*   **Physicality (The "Glovebox" Rule):** Every UI element should feel like a physical object. Use subtle inner shadows for stamped effects, drop shadows for layered cardstock, and grainy "paper" textures.
*   **Cohesive Diversity:** While the app container (navigation, background) is consistent, the collection items (licenses, badges) are unique. They should look like they came from different states and eras.
*   **Mid-Century Modernism:** Prioritize the "Golden Age of Travel" aesthetic. Use a mix of elegant high-contrast serifs and bold, functional geometric sans-serifs.

---

## 2. Visual Style Tokens

### Color Palette
The palette uses desaturated, "sun-faded" versions of classic Americana colors.

| Token | Role | Hex Code | Description |
| :--- | :--- | :--- | :--- |
| **Base/Background** | Paper | `#fdfae9` | Creamy Antique White / Aged Paper |
| **Primary Accent** | Rust | `#D9541C` | Interstate Rust / Burnt Orange |
| **Secondary Accent** | Forest | `#396754` | Forest Service Pine Green |
| **Highlight** | Neon | `#F1C40F` | Antique Gold / Neon Yellow |

### Typography
| Usage | Typeface | Style |
| :--- | :--- | :--- |
| **Headlines** | *Newsreader* | High Contrast Serif (Italic for emphasis) |
| **UI / Data** | *Work Sans* | Clean, geometric sans-serif for readability |
| **The Tag** | *Special Elite* | Stamped Typewriter / Die-cast Mono |

---

## 3. Component Hierarchy

### The "Motel Marquee" (Header)
The primary status indicator should mimic a mid-century neon sign.
*   **Typography:** Bold newsreader serifs.
*   **Interaction:** Pulsating "Vacancy" light (CSS `box-shadow` animation) triggered by user progress.
*   **Color:** Primary Rust or Deep Navy background.

### The "Stats Ribbon" (Metrics)
A utilitarian strip for detailed data.
*   **Texture:** Layered cardstock effect.
*   **Detail:** Vertical 1px dividers, label/value pairings, and high-contrast text.

### The "License Plate" (Grid Card)
*   **Materials:** 4px-8px rounded corners, stamped metal effect.
*   **Interaction:** Subtle `scale` on hover or click.
*   **Stamped Look:** 1px white inner stroke (top/left) + 1px dark inner stroke (bottom/right).
*   **Regional Variation:** Background and accent colors must shift based on the state's region.

---

## 4. Regional Design Patterns

Styles are driven by the `data-region` attribute on parent containers.

| Region | Primary Color | Background | Accent | Vibe |
| :--- | :--- | :--- | :--- | :--- |
| **Northeast** | Deep Navy | Ice Blue | Crimson | Classic, "Established" |
| **South** | Rust Orange | Parchment | Turquoise | Warm, "Sun-drenched" |
| **Midwest** | Pine Green | Harvest Sun | Gold | Sturdy, "Harvest" |
| **West** | Sunset Purple | Desert Sand | Burnt Red | Rugged, "High Desert" |

---

## 5. Interaction & Motion

*   **Global Navigation:** Situated in the footer. Icons must be iconic 1950s symbols (Map, Car, Diner, Bulb).
*   **Route Transitions:** Use the **"Paper-flip"** transition (`rotateY` + `scale`). It should feel like flipping through a heavy travel log or map.
*   **Micro-animations:** 
    *   **Pop:** Nav items should scale slightly (1.1x) when active.
    *   **Glow:** Neon elements (like "Vacancy") should have a soft, asynchronous pulse.
    *   **Stamped:** Buttons and cards should have a "pressed" state that increases the inner shadow depth.

---

> [!IMPORTANT]
> **Constraint:** Avoid using solid black (`#000000`) or pure white (`#FFFFFF`) for background elements. Use aged variants like `--app-bg-cream` or `--ion-color-dark`.

> [!TIP]
> **Utility Classes:**
> *   `.stamped-effect`: For metal-like surfaces.
> *   `.cardstock-layer`: For paper/cardboard surfaces.
> *   `.paper-texture`: To apply the global grain and line overlay.
