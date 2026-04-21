# 🚗 Tag Spotter: The Digital Ephemera

**Tag Spotter** is a premium mobile experience designed for the modern road-tripper with a vintage soul. It turns the classic license plate game into a physical, collectible digital scrapbook, complete with regional trivia and distance-based achievements.

---

## ✨ The "Digital Ephemera" Aesthetic

Our design philosophy is rooted in the **Golden Age of American Travel (1950s-60s)**. Every pixel is crafted to feel like a physical artifact found in a dusty glovebox:

* **Physicality:** Stamped metal license plates, layered cardstock ribbons, and grainy paper textures.
* **Cohesive Diversity:** A unique visual identity for every US region—from the "High Desert" West to the "Established" Northeast.
* **Motel Modernism:** An iconic "Motel Marquee" header with a pulsating neon "Vacancy" glow that tracks your overall progress.

---

## 🛠 Features

### 📬 The Collection

Collect all 50 state license plates. Each plate is a unique piece of digital art, dynamically styled based on its geographic region.

### 🧭 Traveler's Handbook (New)

First-time users are inducted into the Collector's Club via an immersive, 4-page onboarding handbook. It explains the core mechanics of the road trip, from spotting plates to earning bonuses.

### 🎮 Dual Game Modes

Choose your preferred playstyle at any time:

* **Classic Mode:** Pure, relaxing license plate spotting. Perfect for a casual drive.
* **Trivia Mode:** Test your knowledge with 3 mini-challenges per state.

### 🧠 Weighted Trivia & Difficulty

Challenge yourself with **Easy**, **Medium**, or **Hard** trivia levels. Harder questions award more points per correct answer! Our dataset includes over 150 unique facts about state landmarks, movies, sports, and history.

### 📜 The Road Log (Dashboard)

A centralized "Atlas" to track your Coast-to-Coast progress, view your souvenir collection, and audit your total miles traveled.

### 🏆 Certified Road Tripper

Complete the full collection of 51 plates (including DC) to earn your digital seal and view a comprehensive trip summary of your trivia performance and mileage.

### 🗺️ The Road Atlas

A beautiful, static vector map powered by MapLibre GL displaying a flat, full-country composite view. See your progress visually as spotted states fill in with vintage red ink!

### 🚀 Seamless Navigation

A global, tactile bottom navigation bar featuring iconic mid-century symbols for effortless browsing between the road and your collection.

---

## 🎲 Scoring & Trivia Guide

The Collector's Club rewards both persistence and knowledge. While the basic journey is about spotting plates, the most seasoned travelers climb the ranks through our trivia challenges.

### Point Breakdown

| Difficulty | Trivia Mode | Classic Mode |
| :--- | :--- | :--- |
| **Easy** | 1 pt / question | 1 pt / state |
| **Medium** | 2 pts / question | - |
| **Hard** | 3 pts / question | - |

> [!NOTE]
> In Trivia mode, you face 3 questions per state discovery. A perfect "Hard" find can net you **9 points**!

### Trivia Topics

Our carefully curated dataset covers the rich tapestry of American life:

* **🏛️ Historic Landmarks:** From the Statue of Liberty to the deep canyons of Arizona.
* **🎬 Silver Screen:** Movie settings, famous filming locations, and pop-culture icons.
* **🏀 Sports Heritage:** Major league teams, legendary stadiums, and athletic milestones.
* **📜 State Foundations:** Curious facts about statehood, capitals, and unique local history.

---

## 💻 Technology Stack

* **Framework:** [Ionic](https://ionicframework.com/) + [Angular](https://angular.io/) (Standalone Components)
* **Native Engine:** [Capacitor](https://capacitorjs.com/)
* **State Management:** Angular Signals & RxJS
* **Map Rendering:** [MapLibre GL JS](https://maplibre.org/)
* **Styling:** Vanilla SCSS with a custom HSL-based design system.
* **Typography:** Newsreader (Serif), Work Sans (Sans), and Special Elite (Typewriter).

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

* `docs/design_principles.md`: The authoritative guide for the UI/UX.
* `docs/privacy-policy.md`: Publishable privacy policy source.
* `store-assets/`: Checked-in folder structure for screenshots and store graphics.

---

> [!TIP]
> **Pro-Tip for Contributors:** Always use the `.stamped-effect` and `.cardstock-layer` utility classes in `global.scss` to maintain the "physical object" feel of new components.
