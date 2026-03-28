# 🚗 Tag Spotter: The Digital Ephemera

**Tag Spotter** is a premium mobile experience designed for the modern road-tripper with a vintage soul. It turns the classic license plate game into a physical, collectible digital scrapbook, complete with regional trivia and distance-based achievements.

---

## ✨ The "Digital Ephemera" Aesthetic

Our design philosophy is rooted in the **Golden Age of American Travel (1950s-60s)**. Every pixel is crafted to feel like a physical artifact found in a dusty glovebox:

*   **Physicality:** Stamped metal license plates, layered cardstock ribbons, and grainy paper textures.
*   **Cohesive Diversity:** A unique visual identity for every US region—from the "High Desert" West to the "Established" Northeast.
*   **Motel Modernism:** An iconic "Motel Marquee" header with a pulsating neon "Vacancy" glow that tracks your overall progress.

---

## 🛠 Features

### 📬 The Collection
Collect all 50 state license plates. Each plate is a unique piece of digital art, dynamically styled based on its geographic region.

### 🧠 Roadside Trivia
Test your knowledge of state capitals, birds, flowers, and nicknames to earn extra points and unlock rare souvenirs.

### 🗺️ The Atlas (Dashboard)
A centralized "Travel Log" to track your Coast-to-Coast progress, view your souvenir collection, and audit your total miles traveled.

### 🚀 Seamless Navigation
A global, tactile bottom navigation bar featuring iconic mid-century symbols for effortless browsing between the road and your collection.

---

## 💻 Technology Stack

*   **Framework:** [Ionic](https://ionicframework.com/) + [Angular](https://angular.io/) (Standalone Components)
*   **Native Engine:** [Capacitor](https://capacitorjs.com/)
*   **State Management:** Angular Signals & RxJS
*   **Styling:** Vanilla SCSS with a custom HSL-based design system.
*   **Typography:** Newsreader (Serif), Work Sans (Sans), and Special Elite (Typewriter).

---

## 🔨 Development Workflow

### Local Development
```bash
# Start the Angular dev server
npm.cmd run start

# Run unit tests (Karma + ChromeHeadless)
npm.cmd run test -- --watch=false --browsers=ChromeHeadless

# Run linting
npm.cmd run lint
```

### Mobile Workflow
```bash
# Refresh app icons and splash artwork
npm.cmd run assets:mobile

# Complete build (Web + Mobile Assets + Capacitor Sync)
npm.cmd run build:mobile

# Open in Native IDEs
npm.cmd run android:open
npm.cmd run ios:open
```

---

## 📦 Store Publishing & Assets

*   `docs/design_principles.md`: The authoritative guide for the UI/UX.
*   `docs/privacy-policy.md`: Publishable privacy policy source.
*   `store-assets/`: Checked-in folder structure for screenshots and store graphics.

---

> [!TIP]
> **Pro-Tip for Contributors:** Always use the `.stamped-effect` and `.cardstock-layer` utility classes in `global.scss` to maintain the "physical object" feel of new components.
