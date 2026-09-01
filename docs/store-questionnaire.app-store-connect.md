# App Store Connect — questionnaire answers

Drafted 2026-09-01 against the code at versionCode 16 / 1.2.0. Every answer below is
backed by a file in this repo, cited inline, so it can be re-checked rather than
re-remembered. **If any of the cited code changes, the answer changes with it** — in
particular, adding a backend, a leaderboard, ads, or analytics invalidates most of
Section 1.

Apple rewords these questionnaires periodically. Match on meaning, not on exact
question text; the underlying facts are what matter and they are listed in Section 0.

---

## 0. The facts every answer derives from

| Fact | Evidence |
|---|---|
| No backend, no network calls to any remote host | The only `HttpClient` use is `http.get('assets/us-states.json')` — a bundled asset (`src/app/shared/road-atlas/road-atlas.component.ts:161`). No other `http`/`fetch`/`WebSocket` call exists in `src/app`. |
| CSP names no remote hosts | `src/index.html`, `script-src 'self'` (F-21, `con-0002`) |
| No accounts, no login | `con-0004-no-backend-no-accounts` |
| No ads, no analytics, no IAP, no third-party SDKs | No ad/analytics/billing dependency in `package.json`; `docs/ads-rewarded-hint-plan.md` is an unimplemented plan |
| Location is read on demand, used for one arithmetic operation, never persisted | `LocationService.getCurrentLocationAccess` feeds `GameCommandService.applyDistance` (`src/app/services/game-command.service.ts:74`). Coordinates live in a 60-second in-memory cache only (`src/app/services/location.service.ts`), never written to Preferences. |
| Legacy saves that carried coordinates are stripped on load | `normalizeStoredState` rebuilds `fnd` from an explicit field list, dropping `LegacyFoundProgress.lat/lng` (`src/app/models/game-persistence.model.ts:113`) |
| Coarse location is the default; precise is an explicit in-app opt-in | `DEFAULT_LOCATION_PRECISION`, `dec-0007-coarse-location-default` |
| The app works fully with location denied | Denial returns `status: 'denied'` and the plate is still recorded — see the release-verification list in `docs/app-store-release.md` |
| Save data is plain local JSON in UserDefaults | `dec-0009`, `@capacitor/preferences` |
| Trivia content is generated from state civics/geography facts | Topics: Capital, Abbreviation, Region, Landmark, Nickname, Bird, AdmissionYear, Flower, Tree, LargestCity, Flag, Movie, Sports (`src/app/services/quiz.service.ts:18`) |
| iPhone-only, portrait-only | `TARGETED_DEVICE_FAMILY = "1"` (`dec-0016`), `con-0005-portrait-only` |

---

## 1. App Privacy ("nutrition label")

### The top-level answer

> **Do you or your third-party partners collect data from this app?**
> **No — "Data Is Not Collected."**

This is the correct answer, and the reasoning matters because it looks wrong at first
glance (the app clearly *reads* location). Apple defines **collect** as transmitting
data off the device, or storing it in a way that persists beyond the immediate request.
Tag Spotter does neither:

- Location is read, converted to a distance in the same call stack, and dropped. There
  is no server to send it to, and no field in the save file that holds it.
- Gameplay progress is stored **only on the device**. Apple explicitly excludes
  on-device-only data from "collection."

Selecting "Data Is Not Collected" ends the flow — no data-type, linkage, or tracking
sub-questions are presented.

### If the flow asks anyway, or a reviewer follows up

| Sub-question | Answer |
|---|---|
| Data used to track you | **None.** `NSPrivacyTracking = false`, `NSPrivacyTrackingDomains` empty (`ios/App/App/PrivacyInfo.xcprivacy`) |
| Data linked to the user | **None** |
| Data not linked to the user | **None** |
| Advertising identifier (IDFA) used? | **No.** No ad SDK, no `ATTrackingManager` call anywhere |
| Third-party analytics? | **No** |

### Consistency check — three files must agree

These three say the same thing today. Change one, change all three:

1. `ios/App/App/PrivacyInfo.xcprivacy` — `NSPrivacyCollectedDataTypes` empty
2. `docs/store-metadata.google-play.json` — `dataSafety.locationCollected: false`,
   `locationProcessedOnDevice: true`
3. `docs/privacy-policy.md` — the published policy at the URL in both metadata files

### Privacy policy URL

`https://justsmitty.github.io/tagspotter_v3/privacy-policy.html` — live, and
`guardrail:store-placeholder-urls` keeps a placeholder from ever replacing it.

---

## 2. Age Rating questionnaire

**Target rating: 4+.** Every content question is **None**. Answer each frequency
question with the lowest option ("None", or "None/Infrequent or Mild" where that is the
floor).

### Content questions — all None

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Sexual Content or Nudity | None |
| Graphic Sexual Content and Nudity | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Simulated Gambling | None |
| Medical/Treatment Information | None |
| Violent references toward a specific group | None |

The only authored text a player sees is state civics and geography trivia — capitals,
state birds, admission years, landmarks, flags. The "Movie" topic names a film
associated with a state as a setting; it neither depicts nor describes any content from
that film.

### Capability / behaviour questions

| Question | Answer | Why |
|---|---|---|
| Unrestricted web access (in-app browser)? | **No** | No `Browser.open`, `window.open`, or external link in `src/app` |
| User-generated content? | **No** | Nothing a player types is shown to anyone; there is nobody to show it to |
| Messaging, chat, or social features? | **No** | `con-0004-no-backend-no-accounts` |
| Does the app share the user's location with other users? | **No** | Location never leaves the device |
| Contests / sweepstakes? | **No** | |
| Gambling (real money)? | **No** | |
| In-app purchases? | **No** | No billing dependency |
| Advertising? | **No** | No ad SDK ships |
| Age assurance / parental controls in-app? | **No** | Not applicable at 4+ with no social surface |

### On the newer 13+/16+ bands

Apple's 2025 questionnaire added intermediate age bands and made capabilities (chat,
UGC, ads, location sharing) rating inputs, not just content. Tag Spotter answers **No**
to every one of those, so nothing pulls it above 4+. If a leaderboard or any social
surface is ever added, this section is re-answered before that build ships — the
capability questions are what would move the rating, not the trivia.

---

## 3. Other App Store Connect fields

| Field | Answer |
|---|---|
| Bundle ID | `com.tagspotter.app` |
| Primary category | Games (`primaryCategory` in the metadata JSON) |
| Game subcategories | Trivia, then Puzzle. ASC lets a Games primary carry two subcategories, which is where Trivia survives now that `secondaryCategory` is Puzzle |
| Secondary category | Puzzle (`secondaryCategory`). It must differ from the primary — ASC will not take the same category twice |
| Price | Free |
| Availability | All territories (the content is U.S.-specific, but nothing restricts distribution) |
| Export compliance | **Already answered in the binary.** `ITSAppUsesNonExemptEncryption = false` in `Info.plist`, so ASC will not ask per upload |
| Content rights — third-party content? | **No.** State flags and the atlas are public-domain/self-generated assets under `src/assets` |
| Advertising identifier | **No** |
| Game Center | **No** |
| Sign in with Apple | **Not applicable** — no login of any kind |
| Account deletion requirement | **Not applicable** — no accounts. If asked, the answer is that the app does not support account creation |
| App Review demo account | **Not required** — no login |

---

## 4. Notes to the App Review team

Paste this into "App Review Information → Notes". It pre-empts the two questions this
app predictably draws — why a trivia game wants location, and where that data goes.

> Tag Spotter is a fully offline single-player game. It has no backend, no accounts, and
> makes no network requests — the map data it loads is a file bundled inside the app.
>
> Location: the app requests location only at the moment the player marks a license
> plate as found, and uses that single reading to calculate a distance-bonus score for
> that plate. The coordinates are not stored, not written to the save file, and not
> transmitted anywhere. Coarse accuracy is the default; precise accuracy is an opt-in
> setting inside the app. Denying location permission is fully supported — the plate is
> still recorded, just without the distance bonus.
>
> To exercise the main flow: tap any state on the map, mark it as found, and either
> allow or deny the location prompt. Both paths record the plate. Trivia is reached from
> the same screen after a plate is marked.

---

## 5. Known nuances, stated rather than hidden

- **The 60-second location cache.** `LocationService` keeps the last fix in memory for
  60 seconds so marking several plates in a row does not re-prompt the GPS. This is
  process memory, not storage — it does not survive app termination and never reaches
  Preferences. It changes no answer above. The `NSLocationWhenInUseUsageDescription`
  string says "Your coordinates are not stored," which stays true in the sense a user
  reads it (nothing is retained), but the cache is worth knowing about if a reviewer
  asks a precise question.
- **`UIRequiredDeviceCapabilities = armv7`** in `Info.plist` is Capacitor's scaffold
  default on an arm64-only, iOS 15 minimum target. Historically accepted, but vestigial
  — worth resolving before the first upload rather than during a review.
