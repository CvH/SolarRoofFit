# SolarRoofFit ☀️

> 🚀 **Live App:** [https://cvh.github.io/SolarRoofFit/](https://cvh.github.io/SolarRoofFit/)

**SolarRoofFit** is an interactive, browser-based solar PV flat roof CAD planner and layout optimizer. It calculates, visualizes, and maximizes solar panel arrays on residential and commercial flat roofs.

## Features

- **⚡ Smart Auto-Fill**:
  - **Mixed Alignment**: Combines horizontal and vertical panels to maximize total kWp in residual spaces.
  - **Same Alignment**: Evaluates pure portrait vs. landscape to find the single best uniform layout.
- **📐 Interactive 2D CAD**: Drag & drop, magnetic clamp-gap snapping (e.g. 20&nbsp;mm), raster grid, and collision detection.
- **🛡️ Setbacks & Walkways**: 4-sided independent safe perimeter margins and configurable maintenance corridors.
- **📊 Live Metrics**: Real-time module count, system peak power (kWp), roof coverage %, and power density.
- **💾 Export**: Download vector SVG blueprints, high-resolution PNG renders, and Bill of Materials (CSV).

## Quick Start

- **Online**: Launch directly at **[cvh.github.io/SolarRoofFit](https://cvh.github.io/SolarRoofFit/)** (no install needed).
- **Local**: Open `index.html` in any browser, or run:

```bash
python -m http.server 8080
```

## Shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>R</kbd> | Rotate 90° |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Duplicate |
| <kbd>Del</kbd> | Delete |
| <kbd>Alt</kbd> + Drag | Free drag (bypass snap) |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Y</kbd> | Undo / Redo |
| <kbd>F</kbd> | Fit view to roof |

## License

[GNU General Public License v2.0](LICENSE)
