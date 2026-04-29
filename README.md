# Shendal Browser

Minimal, clean, built for streamers. Features a metallic psychedelic aesthetic with glass morphism.

## Installation / Downloads
You can download the pre-compiled stand-alone portable client from the **Releases** section on the right side of the GitHub page.

1. Download `Shendal Browser.exe`.
2. Double click to run it. No installation required. (If Windows SmartScreen warns you, click "Run anyway").
3. Your data, extensions, bookmarks, and downloads will be saved inside your personal roaming AppData folder in Windows.

## Features
* **Three Independent Glass Bars**: Navigation, Tabs/Search, and Window controls.
* **Smart Auto-Hide**: Hover near the top of the window over the three different zones to individually reveal the bars.
* **Light / Dark Theme Support**: Adapts the UI shell colors exactly to your preference without breaking the dark web content.
* **YouTube Picture-in-Picture (PiP)**: Watch videos while browsing.
* **Shortcuts for Streamers**: Type `you` or `tw` into the search bar + Space/Semicolon to instantly search YouTube or Twitch.
* **Session Persistence**: Close the browser and reopen it, and your tabs and bookmarks will perfectly recover.
* **Built-in Ad-Blocker**: Optional DNS-level ad blocking to keep your streamer view debloated and clean.
* **Window Cycling Mode**: `F11` (or resizing the square) cycles between Windowed, Maximized, and Borderless Fullscreen.
* **Chrome Extensions**: Directly load unpacked chromium extensions using the custom extension dropdown.

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
