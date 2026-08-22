# Firefox and Zen action-popup sizing

Research date: 2026-08-22. Sources are Mozilla documentation, Firefox source and Bugzilla, plus Zen's source repository where its browser UI differs from Firefox.

## Finding

For a normal Firefox action popup, set a concrete width on `<body>`. Do not derive the body's preferred width from `vw`, `100%`, or the popup's current viewport. Firefox measures the body's preferred content size and then resizes the browser-owned panel. A rule such as `width: min(420px, 100vw)` can trap the document at a narrow initial viewport because `100vw` means the width the popup already has, not the width it should request.

Zen adds an important wrinkle. Recent Zen versions host extension controls in a custom Site Control Centre built around Firefox's unified-extensions code. That entry path is not a standard Firefox popup-placement guarantee. A popup opened from a directly pinned toolbar action is the reliable target for Firefox's normal shrink-to-content behavior.

## Firefox behavior

- Firefox calculates a strict-mode popup from the `<body>` element. It finds the preferred content width, reflows at that width, and sizes the popup to avoid vertical scrolling until it reaches the browser limit. Mozilla documents a maximum of 800 by 600 CSS pixels when the screen has room. Mozilla also says to put an explicit width on `<body>`, not `:root`. [MDN popup resizing](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Popups#popup_resizing)
- Firefox recalculates popup size just before showing it and at most ten times per second after DOM mutations. Rendering the link list after an asynchronous message should therefore trigger another measurement without extension code calling a resize API. [MDN popup resizing](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Popups#popup_resizing)
- The Firefox popup host passes `maxWidth: 800` and `maxHeight: 600` to its content-sizing code. For a normal popup, it applies the measured width and height to the embedded browser element. [Firefox `ExtensionPopups.sys.mjs`](https://searchfox.org/firefox-main/source/browser/components/extensions/ExtensionPopups.sys.mjs)
- Long inline content can change the preferred width. A Firefox bug about unexpectedly wide popups was resolved by documenting that authors must set width on `body`, because setting it on `:root` did not constrain the preferred-content measurement. [Bug 1671778](https://bugzilla.mozilla.org/show_bug.cgi?id=1671778)
- `vw` is relative to the current viewport's initial containing block. It does not express a preferred browser-popup size. Using `100vw` as the body's width in an auto-sized popup is circular. The conclusion about the narrow-size trap is an inference from the CSS definition and Firefox's popup measurement algorithm. [MDN viewport-percentage lengths](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#viewport-percentage_lengths), [MDN popup resizing](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Popups#popup_resizing)

### Toolbar versus overflow

MDN still says that a popup opened from the menu or toolbar overflow receives a fixed width. Firefox changed that behavior in Firefox 106. Browser actions in overflow now open in their own panel because embedding them in the overflow panel caused sizing failures. The older fixed-width limitation was closed as a duplicate of that change. [Bug 1783972](https://bugzilla.mozilla.org/show_bug.cgi?id=1783972), [Bug 1373490](https://bugzilla.mozilla.org/show_bug.cgi?id=1373490)

For current Firefox, an overflow action should therefore get a separate panel. Do not treat the remaining fixed-width sentence on MDN as the current desktop Firefox behavior.

Firefox supports `"default_area": "navbar"` in the manifest `action` object. This places a new action in the main toolbar initially. Firefox remembers a user's placement, including across uninstall and reinstall, so changing this value will not move an existing installation. [MDN `browser_action.default_area`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_action#default_area)

## What Zen changes

Zen has replaced or supplemented Firefox's Extensions Panel with a custom Site Control Centre. Zen's own code connects that panel to `gUnifiedExtensions`; the Zen contributor describes it as hosting extension controls in custom panel content. Mozilla notes that extension buttons and unified-panel items are different browser UI paths. [Zen `ZenSiteDataPanel.sys.mjs`](https://github.com/zen-browser/desktop/blob/0ae7c19c302c2e68346e5e9440f3f2ea8514376a/src/zen/urlbar/ZenSiteDataPanel.sys.mjs#L157-L161), [Mozilla discussion of Zen's customization in Bug 2006001](https://bugzilla.mozilla.org/show_bug.cgi?id=2006001#c6)

This means Firefox's separate-overflow-panel fix does not prove that Zen's Site Control Centre will grant the same width. If Zen embeds the action popup in a narrow browser-owned view, extension CSS cannot enlarge the outer panel. A large body width will overflow or be clipped. The extension should optimize the normal pinned-toolbar path and keep its dedicated tab as the fallback for dense batch work.

## Concrete recommendation for this extension

Use a fixed preferred width on the popup body:

```css
html {
  margin: 0;
}

body.popup-body {
  box-sizing: border-box;
  width: 420px;
  margin: 0;
}
```

Do not put any of these constraints on `html`, `:root`, or `body.popup-body`:

```css
width: 100vw;
width: min(420px, 100vw);
max-width: 100vw;
width: 100%;
min-width: 420px;
```

The first four make the preferred width depend on the current viewport. `min-width` can force horizontal overflow if Zen embeds the document in a narrower view.

Keep descendants responsive inside the 420-pixel body:

```css
* {
  box-sizing: border-box;
}

.panel,
.candidate,
.button-row > * {
  min-width: 0;
}

.url,
button {
  overflow-wrap: anywhere;
}

input,
select,
textarea {
  max-width: 100%;
}
```

Let the document grow naturally in height. Firefox will resize after the link-list DOM mutation and cap the popup at its available height. Content beyond that limit must scroll; an action popup cannot promise to show an arbitrary number of links at once.

Add `"default_area": "navbar"` for new Firefox and Zen installations. Keep onboarding instructions that tell existing users to pin the action, because the browser remembers their current placement.

## Verification matrix

Test both paths on the project's supported Zen build:

1. Open the popup from a directly pinned TorBox action. Its inner width should be about 420 CSS pixels, subject to screen space.
2. Open it from Zen's Site Control Centre or unpinned extensions UI. Record `window.innerWidth`, `document.body.getBoundingClientRect().width`, and the computed body width in the popup debugger.
3. Render zero links, one link, and at least seven links. Width should stay stable. Height should grow after the DOM update and then scroll once it reaches the browser's vertical limit.
4. Check long hostnames, source URLs, and button labels at 100%, 125%, and 150% Windows display scaling.

If the pinned path is 420 pixels but the Site Control Centre remains narrow, treat that result as a Zen container limitation. Do not shrink the primary popup CSS to match it. Direct the user to pin the action or open the dedicated batch tab.
