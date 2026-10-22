/**
 * Main Application Controller with Alpine.js
 */

import { MODULE_PRESETS, ROOF_PRESETS, RASTER_OPTIONS, WALKWAY_INTERVAL_OPTIONS } from './presets.js?v=9';
import {
  snapToGrid,
  getRotatedDimensions,
  getModuleBounds,
  getRoofSetbacks,
  evaluateModuleBoundary,
  detectCollisions,
  calculateAutoFill,
  findFreeSpawnPosition
} from './layout.js?v=9';
import { SvgCanvasManager } from './canvas.js?v=9';

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
      width: 0.80,          // meters (80cm)
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
      showGrid: true
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

    // --- Exports (SVG / PNG / BOM) ---
    exportSVG() {
      const svgEl = document.getElementById('roof-canvas-svg');
      if (!svgEl) return;

      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgEl);

      // Add namespaces if missing
      if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `pv_roof_layout_${this.roof.width}x${this.roof.length}m_${this.modules.length}mods.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      this.showToast('Exported SVG layout blueprint');
    },

    exportPNG() {
      const svgEl = document.getElementById('roof-canvas-svg');
      if (!svgEl) return;

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgEl);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Render at crisp 2400px wide export
        const aspect = (this.roof.length + 2) / (this.roof.width + 2);
        canvas.width = 2400;
        canvas.height = Math.round(2400 * aspect);

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0B0F19';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Watermark / Info footer
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 32px Inter, sans-serif';
        ctx.fillText(`PV Flat Roof Plan: ${this.roof.width}m × ${this.roof.length}m | ${this.modules.length} Modules (${this.totalPowerKW} kWp)`, 40, 60);

        ctx.font = '22px Inter, sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`Module: ${this.module.width}×${this.module.height}mm (${this.module.power}Wp) | Roof Coverage: ${this.coveragePercent}%`, 40, 100);

        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `pv_roof_plan_${this.roof.width}x${this.roof.length}m.png`;
        link.click();
        URL.revokeObjectURL(url);
        this.showToast('Exported high-resolution PNG image');
      };
      img.src = url;
    },

    exportBOM() {
      const rows = [
        ['Parameter', 'Value', 'Unit'],
        ['Roof Width', this.roof.width, 'm'],
        ['Roof Length', this.roof.length, 'm'],
        ['Roof Area', this.roofArea, 'm²'],
        ['Perimeter Setback (Linked)', this.roof.setbackLinked ? 'Yes' : 'No', ''],
        ['Perimeter Setback (Top)', this.roofSetbackTop, 'm'],
        ['Perimeter Setback (Bottom)', this.roofSetbackBottom, 'm'],
        ['Perimeter Setback (Left)', this.roofSetbackLeft, 'm'],
        ['Perimeter Setback (Right)', this.roofSetbackRight, 'm'],
        ['Maintenance Walkways Enabled', this.walkway.enabled ? 'Yes' : 'No', ''],
        ['Walkway Width', this.walkway.enabled ? this.walkway.width : 'N/A', 'm'],
        ['Walkway Interval', this.walkway.enabled ? `Every ${this.walkway.interval} rows` : 'N/A', ''],
        ['Walkway Direction', this.walkway.enabled ? this.walkway.direction : 'N/A', ''],
        ['Usable Area', this.usableArea, 'm²'],
        ['Module Width', this.module.width, 'mm'],
        ['Module Height', this.module.height, 'mm'],
        ['Module Power', this.module.power, 'Wp'],
        ['Inter-Module Gap X', this.module.gapX, 'mm'],
        ['Inter-Module Gap Y', this.module.gapY, 'mm'],
        ['Total Modules Placed', this.modules.length, 'units'],
        ['Total System Peak Power', this.totalPowerKW, 'kWp'],
        ['Total PV Surface Area', this.pvTotalArea, 'm²'],
        ['Roof Coverage', this.coveragePercent, '%'],
        ['Specific Power Density', this.powerDensity, 'Wp/m²'],
        ['Issues / Collisions', this.issueCount, 'items'],
        [],
        ['Module ID', 'Position X (m)', 'Position Y (m)', 'Rotation (deg)', 'Status']
      ];

      this.modules.forEach(m => {
        rows.push([m.id, m.x, m.y, m.rotation, this.getModuleStatus(m)]);
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `pv_bill_of_materials_${this.roof.width}x${this.roof.length}m.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast('Exported Bill of Materials (CSV)');
    }
  }));
});
