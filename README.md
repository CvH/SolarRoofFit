# SolarRoofFit ☀️

**SolarRoofFit** is an interactive, browser-based solar photovoltaic (PV) flat roof CAD planner and layout optimizer. It calculates, visualizes, and maximizes solar panel arrays on residential and commercial flat roofs.

---

## ✨ Features

- **⚡ Intelligent Auto-Fill Optimization**:
  - **Mixed Alignment (`Max Yield`)**: Combines horizontal (landscape) and vertical (portrait) modules into guillotine and L-shape blocks to squeeze the maximum possible power (kWp) into residual roof space.
  - **Same Alignment (`Uniform Rails`)**: Evaluates 100% portrait vs. 100% landscape across the usable roof area and selects whichever single orientation yields the most modules for clean, uniform mounting rails.
  - **Direct Manual Modes**: Quick 1-click overrides for 100% pure Portrait or Landscape placement.

- **📐 Interactive 2D CAD Canvas**:
  - Smooth pan, zoom, drag-and-drop, module duplication (<kbd>Ctrl</kbd>+<kbd>D</kbd>), rotation (<kbd>R</kbd>), and deletion.
  - **Magnetic Clamp-Gap Snapping**: Automatically snaps dragged modules to neighbor panels with precise clamp gap tolerances (e.g. 20&nbsp;mm).
  - **Raster Grid Snapping**: Configurable metric grid resolution (0.1&nbsp;m to 1.0&nbsp;m) with <kbd>Alt</kbd> bypass for free movement.

- **🛡️ Perimeter Setbacks & Maintenance Walkways**:
  - Independent 4-sided safe perimeter margins (North, South, East, West) or uniform linked setback.
  - Configurable maintenance walkway corridors (horizontal, vertical, or cross-grid) with customizable width and row intervals.

- **📊 Live Engineering Metrics**:
  - Instant HUD calculation of placed modules, system peak capacity (kWp), roof coverage ratio (%), active PV surface area (m²), and specific power density (Wp/m²).
  - Real-time collision detection and boundary safety validation.

- **💾 Professional Blueprints & Export**:
  - **Vector SVG**: Clean CAD blueprint export for vector editing or documentation.
  - **High-Res PNG**: High-resolution image export with blueprint header card.
  - **BOM CSV**: Detailed Bill of Materials including full module schedules, roof specs, and system performance metrics.

---

## 🚀 Getting Started

SolarRoofFit is a lightweight, zero-build client-side web application built with vanilla JavaScript, modern SVG, and Alpine.js.

### Quick Start
Simply open `index.html` in any modern web browser, or launch a local static HTTP server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .
```

Open your browser at `http://localhost:8080`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>R</kbd> | Rotate selected module(s) 90° |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Duplicate selected module(s) |
| <kbd>Del</kbd> / <kbd>Backspace</kbd> | Delete selected module(s) |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | Select all modules |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo last action |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo |
| <kbd>Alt</kbd> + Drag | Bypass magnetic snapping (free placement) |
| <kbd>F</kbd> | Fit zoom to roof |
| <kbd>Esc</kbd> | Deselect all |

---

## 📄 License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.
