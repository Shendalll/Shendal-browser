<p align="center">
  <img src="icon white256.png" width="128" height="128" alt="Shendal Icon">
</p>

Navegador vibecoded con electron. siguiendo mi visión en como tendría que ser un navegador cómodo.
Minimalista y limpio. Presenta una estética metálica psicodélica con glass morphism.

*Nota: Este es un proyecto personal y experimental. Todo está sujeto a cambios.*

---

Vibecoded browser built with Electron. Following my vision of what a comfortable browser should be.
Minimal and clean. Features a metallic psychedelic aesthetic with glass morphism.

*Note: This is a personal and experimental project. Everything is subject to change.*

## Installation / Downloads
You can download the pre-compiled stand-alone portable client from the **Releases** section on the right side of the GitHub page.

1. Download `Shendal Browser.exe`.
2. Double click to run it. No installation required. (If Windows SmartScreen warns you, click "Run anyway").
3. Your data, extensions, bookmarks, and downloads will be saved inside your personal roaming AppData folder in Windows.

## Features
* **Three Independent Glass Bars**: Navigation, Tabs/Search, and Window controls that independently react to your hover.
* **Smart Auto-Hide**: Trigger zones expanded for a more ergonomic experience. Bars reveal themselves only when you need them.
* **Split Screen Workspaces**: Use two tabs at once with a resizable divider.
* **Global Pinned Tab (Star Button)**: Pin a specific tab (like a chat or video) to the side globally. It stays visible while you navigate through other tabs.
* **Dynamic Tab Previews**: Hover over any tab to see a live thumbnail. Split tabs show dual previews with individual close buttons.
* **Smart URL Formatting**: minimalist address bar that hides protocols (`https://`) and `www.` while not in focus.
* **Voice Search**: Built-in voice recognition for hands-free navigation.
* **YouTube Picture-in-Picture (PiP)**: Dedicated button to pop out YouTube videos.
* **Light / Dark Theme Support**: Metallic psychedelic UI that adapts perfectly to your OS theme.
* **Custom Floating Scrollbars**: Rounded, minimal scrollbars designed to stay out of the way.
* **Session Persistence**: Your tabs, splits, and pinned state are saved and restored automatically.
* **Shortcuts for Streamers**: Type `you` or `tw` + Space to instantly search YouTube or Twitch.
* **Chrome Extensions**: Support for loading unpacked Chromium extensions.
* **Built-in Ad-Blocker**: Clean, debloated browsing experience.
* **Window Cycling Mode**: `F11` cycles between Windowed, Maximized, and Borderless Fullscreen.

## Developing
To run the browser directly from the source code:

1. Clone or download this repository.
2. Install [Node.js](https://nodejs.org/).
3. Open a terminal in the folder and run `npm install`.
4. Start the app using `npm start`.

To build the executable yourself:
```bash
npx electron-builder --win portable
```
