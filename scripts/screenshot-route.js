// Boots the app on a specific route, for store-screenshot capture only.
//
// This file is injected into the web build by the ios-screenshots workflow and
// is NEVER part of a shipped build. Nothing references it outside CI.
//
// Why it exists: capturing five screens means getting the app onto five screens,
// and the two obvious ways to do that are both worse than this one.
//
//   - Tapping the nav bar needs UI automation (XCUITest or idb). XCUITest means
//     adding a target to the Xcode project, which Capacitor rewrites; idb means
//     a brew install on a 10x-billed runner. Both are a lot of machinery to
//     press four buttons.
//   - Driving the router in-page (pushState + popstate, or clicking .nav-item)
//     works, but it leaves an Ionic page transition in flight. Observed while
//     validating this against the dev server: scripted navigations stacked seven
//     .ion-page elements in the outlet, several stuck at ion-page-invisible, and
//     the capture caught two screens composited on top of each other. A
//     screenshot of a half-finished transition is not a screenshot of the app.
//
// So: no navigation at all. Rewrite the URL *before* Angular bootstraps and let
// the router's initial navigation land on the target route directly — exactly
// what a deep link does, which is a path the app already supports (see the '**'
// route in app.routes.ts). One page, no transition, nothing to race.
//
// This must load before the Angular bundle. It is a classic (non-module) script,
// so it runs ahead of the deferred module scripts regardless of where in <head>
// the injection lands. It is also same-origin, which is what keeps it inside
// `script-src 'self'` — the CSP is not relaxed to accommodate screenshots
// (con-0002).
//
// The workflow rewrites the ROUTE line between captures, inside the installed
// .app bundle, and relaunches. Keep the marker comment: it is the anchor the
// rewrite matches on.
(function () {
  /* ROUTE */ var route = '/home';

  if (!route || route === '/home') return; // '' already resolves to home
  try {
    window.history.replaceState({}, '', route);
  } catch (err) {
    // Never let a screenshot helper stop the app from starting — a blank screen
    // would be captured silently and look like an app bug.
    console.warn('screenshot-route: could not set the start route', err);
  }
})();
