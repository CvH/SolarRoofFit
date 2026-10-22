/**
 * Main Application Controller with Alpine.js
 */

import { MODULE_PRESETS, ROOF_PRESETS, RASTER_OPTIONS, WALKWAY_INTERVAL_OPTIONS } from './presets.js?v=17';
import {
  snapToGrid,
  getRotatedDimensions,
  getModuleBounds,
  getRoofSetbacks,
  evaluateModuleBoundary,
  detectCollisions,
  calculateAutoFill,
  findFreeSpawnPosition
} from './layout.js?v=17';
import { SvgCanvasManager } from './canvas.js?v=17';

/**
 * Safely triggers a file download from a Blob across modern browsers
 * without premature URL revocation.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (_) {}
  }, 2500);
}

document.addEventListener('alpine:init', () => {
  Alpine.data('roofPlannerApp', () => ({
    // Presets catalog
    modulePresets: MODULE_PRESETS,
    roofPresets: ROOF_PRESETS,
    rasterOptions: RASTER_OPTIONS,
    walkwayIntervalOptions: WALKWAY_INTERVAL_OPTIONS,

    // Active configurations
    roof: {
      width: 12.0,          // meters
      length: 8.0,          // meters
      setback: 0.5,         // uniform master setback
      setbackTop: 0.5,      // individual side setbacks
      setbackBottom: 0.5,
      setbackLeft: 0.5,
      setbackRight: 0.5,
      setbackLinked: true,  // true = all 4 sides linked, false = independent
      preset: 'res_standard'
    },

    walkway: {
      enabled: false,
      width: 0.10,          // meters (starts at 0.1m)
      interval: 2,           // every 2 rows
      direction: 'horizontal', // 'horizontal' | 'vertical' | 'both'
      corridors: []
    },

    module: {
      width: 1134,      // mm
      height: 1762,     // mm
      power: 430,       // Wp
      gapX: 20,         // mm
      gapY: 20,         // mm
      preset: 'standard_430'
    },

    grid: {
      enabled: true,
      step: 0.25,       // meters
      showGrid: true,
      snapToPanels: true // Magnetic snap to neighbor panels with clamp gap
    },

    autoFillMode: 'optimal', // 'optimal' | 'portrait' | 'landscape'

    // Placed modules array: { id, x, y, rotation, selected }
    modules: [],
    selectedIds: [],

    // Collisions and boundaries cache
    collidingIds: new Set(),

    // Undo / Redo history
    history: [],
    historyIndex: -1,

    // Toast notification
    toast: null,
    toastTimer: null,

    // Canvas manager reference
    canvasManager: null,

    init() {
      // Initialize SVG Canvas Manager
      const svgEl = document.getElementById('roof-canvas-svg');
      if (svgEl) {
        this.canvasManager = new SvgCanvasManager(
          svgEl,
          () => ({
            modules: this.modules,
            selectedIds: this.selectedIds,
            grid: this.grid,
            roof: this.roof,
            module: this.module
          }),
          (newState) => {
            if (newState.modules) {
              this.modules = newState.modules;
              this.refreshValidation();
            }
            if (newState.selectedIds !== undefined) {
              this.selectedIds = newState.selectedIds;
            }
          }
        );

        this.canvasManager.onDragComplete = () => {
          this.saveHistory('Move module(s)');
          this.refreshValidation();
        };
      }

      if (window.location.search.includes('reset=1')) {
        localStorage.removeItem('pv_roof_planner_state');
      }

      // Restore saved state from localStorage or run initial auto-fill
      const saved = localStorage.getItem('pv_roof_planner_state');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.roof) this.roof = { ...this.roof, ...parsed.roof };
          if (parsed.module) this.module = { ...this.module, ...parsed.module };
          if (parsed.grid) this.grid = { ...this.grid, ...parsed.grid };
          if (parsed.walkway) this.walkway = { ...this.walkway, ...parsed.walkway };
          if (Array.isArray(parsed.modules) && parsed.modules.length > 0) {
            this.modules = parsed.modules;
          } else {
            this.runAutoFill('optimal', false);
          }
        } catch (e) {
          console.error('Failed to load saved state:', e);
          this.runAutoFill('optimal', false);
        }
      } else {
        this.runAutoFill('optimal', false);
      }

      this.refreshValidation();

      // Fit view to roof on start
      this.$nextTick(() => {
        if (this.canvasManager) {
          this.canvasManager.fitToRoof(this.roof.width, this.roof.length);
          this.renderCanvasModules();
          if (this.walkway && this.walkway.corridors) {
            this.canvasManager.renderWalkways(this.walkway.corridors);
          }
        }
      });

      // Register keyboard shortcuts
      this.initKeyboardShortcuts();

      // Auto-save debounce watcher
      this.$watch('modules', () => {
        this.persistState();
        this.renderCanvasModules();
      });
      this.$watch('selectedIds', () => this.renderCanvasModules());
      this.$watch('roof', () => this.persistState());
      this.$watch('module', () => this.persistState());
      this.$watch('grid', () => this.persistState());
      this.$watch('walkway', () => this.persistState());

      this.saveHistory('Initial State');
    },

    // --- Validation, Collisions & Visual Sync ---
    refreshValidation() {
      this.collidingIds = detectCollisions(this.modules, this.module);
      this.renderCanvasModules();
    },

    renderCanvasModules() {
      if (!this.canvasManager) return;
      this.canvasManager.renderModules(
        this.modules,
        this.module,
        this.selectedIds,
        (mod) => this.getModuleStatus(mod),
        {
          onPointerDown: (mod, e) => this.onModulePointerDown(mod, e),
          onClick: (mod, e) => this.toggleModuleSelection(mod, e)
        }
      );
    },

    getModuleStatus(mod) {
      if (this.collidingIds.has(mod.id)) {
        return 'collision';
      }
      return evaluateModuleBoundary(mod, this.module, this.roof);
    },

    getModuleDims(mod) {
      return getRotatedDimensions(this.module, mod.rotation || 0);
    },

    // --- 4-Sided Setback Computed Getters ---
    get roofSetbackTop() {
      return getRoofSetbacks(this.roof).top;
    },

    get roofSetbackBottom() {
      return getRoofSetbacks(this.roof).bottom;
    },

    get roofSetbackLeft() {
      return getRoofSetbacks(this.roof).left;
    },

    get roofSetbackRight() {
      return getRoofSetbacks(this.roof).right;
    },

    // --- Computed Metrics ---
    get totalPowerKW() {
      return ((this.modules.length * this.module.power) / 1000).toFixed(2);
    },

    get roofArea() {
      return (this.roof.width * this.roof.length).toFixed(1);
    },

    get usableArea() {
      const sb = getRoofSetbacks(this.roof);
      const uw = Math.max(0, this.roof.width - sb.left - sb.right);
      const ul = Math.max(0, this.roof.length - sb.top - sb.bottom);
      return (uw * ul).toFixed(1);
    },

    get pvTotalArea() {
      const singleArea = (this.module.width / 1000) * (this.module.height / 1000);
      return (this.modules.length * singleArea).toFixed(1);
    },

    get coveragePercent() {
      const rArea = this.roof.width * this.roof.length;
      if (rArea <= 0) return 0;
      const singleArea = (this.module.width / 1000) * (this.module.height / 1000);
      const pvArea = this.modules.length * singleArea;
      return Math.min(100, Math.round((pvArea / rArea) * 100));
    },

    get powerDensity() {
      const rArea = this.roof.width * this.roof.length;
      if (rArea <= 0) return 0;
      const totalW = this.modules.length * this.module.power;
      return Math.round(totalW / rArea);
    },

    get issueCount() {
      let count = 0;
      for (const m of this.modules) {
        const s = this.getModuleStatus(m);
        if (s === 'collision' || s === 'error_roof' || s === 'warning_setback') {
          count++;
        }
      }
      return count;
    },

    // --- Setback Controls ---
    toggleSetbackLinked() {
      this.roof.setbackLinked = !this.roof.setbackLinked;
      if (this.roof.setbackLinked) {
        // Sync individual sides to uniform master setback value
        this.roof.setbackTop = this.roof.setback;
        this.roof.setbackBottom = this.roof.setback;
        this.roof.setbackLeft = this.roof.setback;
        this.roof.setbackRight = this.roof.setback;
      }
      this.refreshValidation();
      this.saveHistory('Toggle linked setback');
    },

    onSetbackMasterChange() {
      if (this.roof.setbackLinked) {
        this.roof.setbackTop = this.roof.setback;
        this.roof.setbackBottom = this.roof.setback;
        this.roof.setbackLeft = this.roof.setback;
        this.roof.setbackRight = this.roof.setback;
      }
      this.refreshValidation();
    },

    onSetbackSideChange() {
      this.refreshValidation();
      this.saveHistory('Adjust side setback');
    },

    // --- Walkway Controls ---
    onWalkwayToggle() {
      this.runAutoFill(this.autoFillMode);
    },

    onWalkwayConfigChange() {
      if (this.walkway.enabled) {
        this.runAutoFill(this.autoFillMode);
      }
    },

    // --- Presets Handlers ---
    onRoofPresetChange() {
      const preset = this.roofPresets[this.roof.preset];
      if (preset) {
        this.roof.width = preset.width;
        this.roof.length = preset.length;
        this.roof.setback = preset.setback;
        this.roof.setbackTop = preset.setbackTop !== undefined ? preset.setbackTop : preset.setback;
        this.roof.setbackBottom = preset.setbackBottom !== undefined ? preset.setbackBottom : preset.setback;
        this.roof.setbackLeft = preset.setbackLeft !== undefined ? preset.setbackLeft : preset.setback;
        this.roof.setbackRight = preset.setbackRight !== undefined ? preset.setbackRight : preset.setback;
        this.roof.setbackLinked = preset.setbackLinked !== undefined ? preset.setbackLinked : true;

        this.runAutoFill(this.autoFillMode);
        if (this.canvasManager) {
          this.canvasManager.fitToRoof(this.roof.width, this.roof.length);
        }
        this.showToast(`Applied preset: ${preset.name}`);
      }
    },

    onModulePresetChange() {
      const preset = this.modulePresets[this.module.preset];
      if (preset) {
        this.module.width = preset.width;
        this.module.height = preset.height;
        this.module.power = preset.power;
        this.refreshValidation();
        this.showToast(`Selected module: ${preset.name}`);
      }
    },

    onRoofDimensionChange() {
      this.refreshValidation();
      if (this.canvasManager) {
        this.canvasManager.fitToRoof(this.roof.width, this.roof.length);
      }
      this.saveHistory('Change roof dimensions');
    },

    // --- Module Operations ---
    runAutoFill(mode = this.autoFillMode, recordUndo = true) {
      this.autoFillMode = mode;
      const step = this.grid.enabled ? this.grid.step : 0.05;
      const result = calculateAutoFill(this.roof, this.module, mode, step, this.walkway);

      this.modules = result.modules;
      this.walkway.corridors = result.walkways || [];
      this.selectedIds = [];
      this.refreshValidation();

      if (this.canvasManager) {
        this.canvasManager.renderWalkways(this.walkway.corridors);
      }

      if (recordUndo) {
        this.saveHistory(`Auto-fill (${result.modeUsed})`);
      }
      this.showToast(`Auto-filled ${result.count} modules (${result.modeUsed})`);
    },

    addModule() {
      const step = this.grid.enabled ? this.grid.step : 0.1;
      const pos = findFreeSpawnPosition(this.modules, this.module, this.roof, step);

      const newMod = {
        id: `pv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        x: pos.x,
        y: pos.y,
        rotation: 0,
        selected: true
      };

      this.modules.push(newMod);
      this.selectedIds = [newMod.id];
      this.refreshValidation();
      this.saveHistory('Add module');
      this.showToast('Added 1 PV module');
    },

    rotateSelected() {
      if (this.selectedIds.length === 0) {
        this.showToast('Select one or more modules to rotate', 'info');
        return;
      }

      const gridStep = this.grid.enabled ? this.grid.step : 0.05;

      this.modules = this.modules.map(m => {
        if (this.selectedIds.includes(m.id)) {
          const nextRot = (m.rotation === 0 || m.rotation === 180) ? 90 : 0;
          return {
            ...m,
            rotation: nextRot,
            x: snapToGrid(m.x, gridStep),
            y: snapToGrid(m.y, gridStep)
          };
        }
        return m;
      });

      this.refreshValidation();
      this.saveHistory('Rotate module(s)');
      this.showToast(`Rotated ${this.selectedIds.length} module(s)`);
    },

    duplicateSelected() {
      if (this.selectedIds.length === 0) return;

      const offset = this.grid.enabled ? Math.max(this.grid.step, 0.2) : 0.2;
      const newItems = [];
      const newIds = [];

      this.modules.forEach(m => {
        if (this.selectedIds.includes(m.id)) {
          const dup = {
            ...m,
            id: `pv-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            x: snapToGrid(m.x + offset, this.grid.step),
            y: snapToGrid(m.y + offset, this.grid.step)
          };
          newItems.push(dup);
          newIds.push(dup.id);
        }
      });

      this.modules = [...this.modules, ...newItems];
      this.selectedIds = newIds;
      this.refreshValidation();
      this.saveHistory('Duplicate module(s)');
      this.showToast(`Duplicated ${newItems.length} module(s)`);
    },

    deleteSelected() {
      if (this.selectedIds.length === 0) return;
      const count = this.selectedIds.length;
      this.modules = this.modules.filter(m => !this.selectedIds.includes(m.id));
      this.selectedIds = [];
      this.refreshValidation();
      this.saveHistory('Delete module(s)');
      this.showToast(`Deleted ${count} module(s)`);
    },

    clearAll() {
      if (this.modules.length === 0) return;
      if (confirm(`Remove all ${this.modules.length} PV modules from the roof?`)) {
        this.modules = [];
        this.selectedIds = [];
        this.walkway.corridors = [];
        if (this.canvasManager) {
          this.canvasManager.renderWalkways([]);
        }
        this.refreshValidation();
        this.saveHistory('Clear all modules');
        this.showToast('Cleared all modules');
      }
    },

    selectAll() {
      this.selectedIds = this.modules.map(m => m.id);
      this.showToast(`Selected all ${this.modules.length} modules`);
    },

    deselectAll() {
      this.selectedIds = [];
    },

    toggleModuleSelection(mod, event) {
      if (event.shiftKey) {
        if (this.selectedIds.includes(mod.id)) {
          this.selectedIds = this.selectedIds.filter(id => id !== mod.id);
        } else {
          this.selectedIds.push(mod.id);
        }
      } else {
        this.selectedIds = [mod.id];
      }
    },

    // --- Drag Interaction Delegator ---
    onModulePointerDown(mod, event) {
      if (this.canvasManager) {
        this.canvasManager.startModuleDrag(mod, event);
      }
    },

    // --- View Navigation ---
    zoomIn() {
      if (this.canvasManager) this.canvasManager.zoomBy(0.85);
    },

    zoomOut() {
      if (this.canvasManager) this.canvasManager.zoomBy(1.18);
    },

    fitToRoof() {
      if (this.canvasManager) {
        this.canvasManager.fitToRoof(this.roof.width, this.roof.length);
        this.showToast('Fit view to roof');
      }
    },

    // --- Undo / Redo System ---
    saveHistory(actionName = 'Edit') {
      const snapshot = JSON.stringify({
        modules: this.modules,
        roof: this.roof,
        module: this.module,
        walkway: this.walkway
      });

      // Truncate forward history if branching
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }

      this.history.push({ name: actionName, data: snapshot });
      if (this.history.length > 30) this.history.shift();
      this.historyIndex = this.history.length - 1;
    },

    undo() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        const state = JSON.parse(this.history[this.historyIndex].data);
        this.modules = state.modules;
        this.roof = state.roof;
        this.module = state.module;
        if (state.walkway) {
          this.walkway = state.walkway;
          if (this.canvasManager) {
            this.canvasManager.renderWalkways(this.walkway.corridors || []);
          }
        }
        this.selectedIds = [];
        this.refreshValidation();
        this.showToast(`Undo: ${this.history[this.historyIndex].name}`);
      }
    },

    redo() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        const state = JSON.parse(this.history[this.historyIndex].data);
        this.modules = state.modules;
        this.roof = state.roof;
        this.module = state.module;
        if (state.walkway) {
          this.walkway = state.walkway;
          if (this.canvasManager) {
            this.canvasManager.renderWalkways(this.walkway.corridors || []);
          }
        }
        this.selectedIds = [];
        this.refreshValidation();
        this.showToast(`Redo: ${this.history[this.historyIndex].name}`);
      }
    },

    // --- Keyboard Shortcuts ---
    initKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        // Ignore if typing inside input / select
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
          return;
        }

        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          this.rotateSelected();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.selectedIds.length > 0) {
            e.preventDefault();
            this.deleteSelected();
          }
        } else if (e.key === 'd' || e.key === 'D') {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.duplicateSelected();
          }
        } else if (e.key === 'a' || e.key === 'A') {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.selectAll();
          }
        } else if (e.key === 'z' || e.key === 'Z') {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              this.redo();
            } else {
              this.undo();
            }
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.redo();
          }
        } else if (e.key === 'Escape') {
          this.deselectAll();
        } else if (e.key === 'f' || e.key === 'F') {
          this.fitToRoof();
        }
      });
    },

    // --- Toast Notifications ---
    showToast(message, type = 'success') {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toast = { message, type };
      this.toastTimer = setTimeout(() => {
        this.toast = null;
      }, 3000);
    },

    // --- Persistence ---
    persistState() {
      const data = {
        roof: this.roof,
        module: this.module,
        grid: this.grid,
        walkway: this.walkway,
        modules: this.modules
      };
      try {
        localStorage.setItem('pv_roof_planner_state', JSON.stringify(data));
      } catch (_) {}
    },

    // --- Standalone SVG Blueprint Generator ---
    getExportableSVGString() {
      const svgEl = document.getElementById('roof-canvas-svg');
      if (!svgEl) return null;

      const clone = svgEl.cloneNode(true);

      // 1. Remove dynamic interaction layers from export
      const snapLayer = clone.querySelector('#snap-guides-layer');
      if (snapLayer) snapLayer.remove();

      // 2. Remove grid overlay if hidden
      const gridOverlay = clone.querySelector('#roof-grid-overlay');
      if (gridOverlay && !this.grid.showGrid) {
        gridOverlay.remove();
      }

      // 3. Remove all Alpine.js colon-prefixed and x-prefixed attributes which cause fatal XML syntax errors in standalone parsers
      const sanitizeAttributes = (el) => {
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith(':') || attr.name.startsWith('x-')) {
            el.removeAttribute(attr.name);
          }
        });
      };
      sanitizeAttributes(clone);
      clone.querySelectorAll('*').forEach(sanitizeAttributes);

      // 4. Set explicit standard SVG numerical attributes
      const pattern = clone.querySelector('#raster-grid-pattern');
      if (pattern) {
        const step = String(this.grid.step || 0.25);
        pattern.setAttribute('width', step);
        pattern.setAttribute('height', step);
        const lines = pattern.querySelectorAll('line');
        if (lines[0]) lines[0].setAttribute('x2', step);
        if (lines[1]) lines[1].setAttribute('y2', step);
      }

      const surface = clone.querySelector('#roof-surface');
      if (surface) {
        surface.setAttribute('x', '0');
        surface.setAttribute('y', '0');
        surface.setAttribute('width', String(this.roof.width));
        surface.setAttribute('height', String(this.roof.length));
      }

      const setback = clone.querySelector('#roof-setback');
      if (setback) {
        setback.setAttribute('x', String(this.roofSetbackLeft));
        setback.setAttribute('y', String(this.roofSetbackTop));
        setback.setAttribute('width', String(Math.max(0, this.roof.width - this.roofSetbackLeft - this.roofSetbackRight)));
        setback.setAttribute('height', String(Math.max(0, this.roof.length - this.roofSetbackTop - this.roofSetbackBottom)));
      }

      if (gridOverlay) {
        gridOverlay.setAttribute('x', '0');
        gridOverlay.setAttribute('y', '0');
        gridOverlay.setAttribute('width', String(this.roof.width));
        gridOverlay.setAttribute('height', String(this.roof.length));
      }

      // Dimension lines & text annotations
      const dimGroup = clone.querySelector('.dimension-annotations');
      if (dimGroup) {
        const lines = dimGroup.querySelectorAll('line');
        if (lines[0]) lines[0].setAttribute('x2', String(this.roof.width));
        if (lines[2]) {
          lines[2].setAttribute('x1', String(this.roof.width));
          lines[2].setAttribute('x2', String(this.roof.width));
        }
        if (lines[3]) lines[3].setAttribute('y2', String(this.roof.length));
        if (lines[5]) {
          lines[5].setAttribute('y1', String(this.roof.length));
          lines[5].setAttribute('y2', String(this.roof.length));
        }

        const texts = dimGroup.querySelectorAll('text');
        if (texts[0]) {
          texts[0].setAttribute('x', String(this.roof.width / 2));
          texts[0].textContent = Number(this.roof.width).toFixed(2) + ' m';
        }
        if (texts[1]) {
          texts[1].setAttribute('y', String(this.roof.length / 2));
          texts[1].setAttribute('transform', `rotate(-90, -0.75, ${this.roof.length / 2})`);
          texts[1].textContent = Number(this.roof.length).toFixed(2) + ' m';
        }
      }

      // 5. Clean blueprint dimensions and margin
      const marginX = Math.max(1.2, this.roof.width * 0.12);
      const marginY = Math.max(1.2, this.roof.length * 0.12);
      const vbX = -marginX;
      const vbY = -marginY;
      const vbW = this.roof.width + (2 * marginX);
      const vbH = this.roof.length + (2 * marginY);

      clone.setAttribute('viewBox', `${vbX.toFixed(3)} ${vbY.toFixed(3)} ${vbW.toFixed(3)} ${vbH.toFixed(3)}`);
      clone.setAttribute('width', Math.round(vbW * 120).toString());
      clone.setAttribute('height', Math.round(vbH * 120).toString());
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // 6. Solid background
      let bgRect = clone.querySelector('#canvas-bg');
      if (!bgRect) {
        bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clone.insertBefore(bgRect, clone.firstChild);
      }
      bgRect.setAttribute('x', vbX.toFixed(3));
      bgRect.setAttribute('y', vbY.toFixed(3));
      bgRect.setAttribute('width', vbW.toFixed(3));
      bgRect.setAttribute('height', vbH.toFixed(3));
      bgRect.setAttribute('fill', '#070B14');

      // 7. Embed CSS styles
      let defs = clone.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        clone.insertBefore(defs, clone.firstChild);
      }

      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleEl.textContent = `
        text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .roof-membrane { fill: #141B2D; stroke: #334155; stroke-width: 0.03; }
        .roof-setback-line { fill: rgba(6, 182, 212, 0.04); stroke: #06B6D4; stroke-width: 0.025; stroke-dasharray: 0.15 0.1; }
        .walkway-corridor { fill: rgba(6, 182, 212, 0.08); stroke: #06B6D4; stroke-width: 0.016; stroke-dasharray: 0.1 0.05; }
        .walkway-centerline { stroke: rgba(6, 182, 212, 0.35); stroke-width: 0.01; stroke-dasharray: 0.12 0.06; }
        .walkway-annotation { fill: #06B6D4; font-family: monospace; font-size: 0.13px; font-weight: bold; text-anchor: middle; dominant-baseline: central; }
        .dim-line { stroke: #64748B; stroke-width: 0.02; }
        .dim-text { fill: #94A3B8; font-family: monospace; font-size: 0.35px; text-anchor: middle; dominant-baseline: central; }
        .pv-module-frame { fill: #0F172A; stroke: #475569; stroke-width: 0.02; rx: 0.01; }
        .pv-cell-rect { fill: url(#pv-cell-gradient); }
        .pv-busbar-line { stroke: rgba(255, 255, 255, 0.15); stroke-width: 0.003; }
        .pv-junction-indicator { fill: #1E293B; stroke: #334155; stroke-width: 0.005; }
        .pv-module-group.selected .pv-module-frame { stroke: #06B6D4 !important; stroke-width: 0.045 !important; }
        .pv-module-group.warning .pv-module-frame { stroke: #F59E0B !important; stroke-width: 0.045 !important; }
        .pv-module-group.collision .pv-module-frame, .pv-module-group.error_roof .pv-module-frame { stroke: #EF4444 !important; stroke-width: 0.05 !important; }
      `;
      defs.appendChild(styleEl);

      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(clone);

      if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      return source;
    },

    // --- Exports (SVG / PNG / BOM) ---
    exportSVG() {
      try {
        const source = this.getExportableSVGString();
        if (!source) {
          this.showToast('SVG canvas not found', 'error');
          return;
        }

        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const filename = `pv_roof_layout_${this.roof.width}x${this.roof.length}m_${this.modules.length}mods.svg`;
        downloadBlob(blob, filename);
        this.showToast('Exported SVG layout blueprint');
      } catch (err) {
        console.error('Failed to export SVG:', err);
        this.showToast('SVG export error: ' + err.message, 'error');
      }
    },

    exportPNG() {
      try {
        const source = this.getExportableSVGString();
        if (!source) {
          this.showToast('SVG canvas not found', 'error');
          return;
        }

        // Use data URL with encodeURIComponent to ensure seamless, sandboxed image rendering
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
        const img = new Image();

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const aspect = (this.roof.length + 2.5) / (this.roof.width + 2.5);
            canvas.width = 2400;
            canvas.height = Math.max(1200, Math.round(2400 * aspect));

            const ctx = canvas.getContext('2d');
            // Clean dark CAD canvas background
            ctx.fillStyle = '#070B14';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw SVG blueprint
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // High-end Blueprint Header Info Card
            ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
            ctx.fillRect(35, 35, 860, 95);
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
            ctx.lineWidth = 2;
            ctx.strokeRect(35, 35, 860, 95);

            ctx.fillStyle = '#F8FAFC';
            ctx.font = 'bold 28px Inter, -apple-system, sans-serif';
            ctx.fillText(`RoofPlaner CAD: ${this.roof.width.toFixed(2)}m × ${this.roof.length.toFixed(2)}m Flat Roof`, 55, 75);

            ctx.font = '18px Inter, -apple-system, sans-serif';
            ctx.fillStyle = '#94A3B8';
            ctx.fillText(`${this.modules.length} PV Modules | ${this.totalPowerKW} kWp | Coverage: ${this.coveragePercent}% (${this.pvTotalArea} m²)`, 55, 108);

            const filename = `pv_roof_plan_${this.roof.width}x${this.roof.length}m_${this.modules.length}mods.png`;

            if (canvas.toBlob) {
              canvas.toBlob((blob) => {
                if (blob) {
                  downloadBlob(blob, filename);
                } else {
                  const fallbackData = canvas.toDataURL('image/png');
                  const link = document.createElement('a');
                  link.href = fallbackData;
                  link.download = filename;
                  document.body.appendChild(link);
                  link.click();
                  setTimeout(() => document.body.removeChild(link), 1000);
                }
                this.showToast('Exported high-resolution PNG image');
              }, 'image/png');
            } else {
              const fallbackData = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.href = fallbackData;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              setTimeout(() => document.body.removeChild(link), 1000);
              this.showToast('Exported high-resolution PNG image');
            }
          } catch (canvasErr) {
            console.error('Canvas draw error:', canvasErr);
            this.showToast('PNG render error: ' + canvasErr.message, 'error');
          }
        };

        img.onerror = (err) => {
          console.error('SVG Image load failed for PNG export:', err);
          this.showToast('Could not convert SVG to PNG', 'error');
        };

        img.src = dataUrl;
      } catch (err) {
        console.error('Failed to export PNG:', err);
        this.showToast('PNG export error: ' + err.message, 'error');
      }
    },

    exportBOM() {
      try {
        const escapeCSV = (val) => {
          if (val === null || val === undefined) return '""';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        };

        const rows = [
          ['ROOFPLANER SOLAR PV - BILL OF MATERIALS & SYSTEM SPECIFICATION'],
          ['Export Timestamp', new Date().toISOString()],
          [],
          ['ROOF SPECIFICATIONS', 'VALUE', 'UNIT'],
          ['Roof Width (X)', this.roof.width, 'm'],
          ['Roof Length (Y)', this.roof.length, 'm'],
          ['Gross Roof Area', this.roofArea, 'm²'],
          ['Perimeter Setbacks Linked', this.roof.setbackLinked ? 'Yes' : 'No', ''],
          ['Perimeter Setback (Top / North)', this.roofSetbackTop, 'm'],
          ['Perimeter Setback (Bottom / South)', this.roofSetbackBottom, 'm'],
          ['Perimeter Setback (Left / West)', this.roofSetbackLeft, 'm'],
          ['Perimeter Setback (Right / East)', this.roofSetbackRight, 'm'],
          ['Net Usable Solar Area', this.usableArea, 'm²'],
          ['Maintenance Walkways Enabled', this.walkway.enabled ? 'Yes' : 'No', ''],
          ['Walkway Corridor Width', this.walkway.enabled ? this.walkway.width : 'N/A', 'm'],
          ['Walkway Insertion Interval', this.walkway.enabled ? `Every ${this.walkway.interval} rows` : 'N/A', ''],
          ['Walkway Corridor Direction', this.walkway.enabled ? this.walkway.direction : 'N/A', ''],
          [],
          ['PV MODULE SPECIFICATIONS', 'VALUE', 'UNIT'],
          ['Module Model Preset', this.modulePresets[this.module.preset]?.name || 'Custom', ''],
          ['Module Width', this.module.width, 'mm'],
          ['Module Height / Length', this.module.height, 'mm'],
          ['Module Peak Power', this.module.power, 'Wp'],
          ['Inter-Module Clamp Gap X', this.module.gapX, 'mm'],
          ['Inter-Module Clamp Gap Y', this.module.gapY, 'mm'],
          [],
          ['SYSTEM PERFORMANCE TOTALS', 'VALUE', 'UNIT'],
          ['Total Modules Placed', this.modules.length, 'pcs'],
          ['Total System Peak Capacity', this.totalPowerKW, 'kWp'],
          ['Total Active PV Surface Area', this.pvTotalArea, 'm²'],
          ['Roof Area Coverage Ratio', this.coveragePercent, '%'],
          ['Specific Power Density', this.powerDensity, 'Wp/m²'],
          ['Array Boundary / Spacing Issues', this.issueCount, 'items'],
          [],
          ['PLACED MODULE SCHEDULE'],
          ['#', 'Module ID', 'Position X (m)', 'Position Y (m)', 'Orientation', 'Rotation (deg)', 'Power (Wp)', 'Status']
        ];

        this.modules.forEach((m, idx) => {
          const isLandscape = m.rotation === 90 || m.rotation === 270;
          rows.push([
            idx + 1,
            m.id,
            Number(m.x).toFixed(3),
            Number(m.y).toFixed(3),
            isLandscape ? 'Landscape' : 'Portrait',
            m.rotation,
            this.module.power,
            this.getModuleStatus(m)
          ]);
        });

        // Use UTF-8 Byte Order Mark (BOM) so Excel and spreadsheet apps correctly parse accents and characters
        const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCSV).join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const filename = `pv_bill_of_materials_${this.roof.width}x${this.roof.length}m_${this.modules.length}mods.csv`;
        downloadBlob(blob, filename);
        this.showToast('Exported Bill of Materials (CSV)');
      } catch (err) {
        console.error('Failed to export BOM CSV:', err);
        this.showToast('BOM export error: ' + err.message, 'error');
      }
    }
  }));
});
