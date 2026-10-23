/**
 * Main Application Controller with Alpine.js
 */

import { MODULE_PRESETS, RASTER_OPTIONS, WALKWAY_INTERVAL_OPTIONS, SKYLIGHT_PRESETS, CHIMNEY_PRESETS } from './presets.js?v=33';
import {
  snapToGrid,
  getRotatedDimensions,
  getModuleBounds,
  getRoofSetbacks,
  evaluateModuleBoundary,
  detectCollisions,
  calculateAutoFill,
  findFreeSpawnPosition,
  findFreeObstaclePosition,
  calculateObstacleSnap
} from './layout.js?v=26';
import { SvgCanvasManager } from './canvas.js?v=31';
import { translate } from './i18n.js?v=34';

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
    rasterOptions: RASTER_OPTIONS,
    walkwayIntervalOptions: WALKWAY_INTERVAL_OPTIONS,

    // Active configurations (default 8m x 8m)
    roof: {
      width: 8.0,           // meters
      length: 8.0,          // meters
      setback: 0.5,         // uniform master setback
      setbackTop: 0.5,      // individual side setbacks
      setbackBottom: 0.5,
      setbackLeft: 0.5,
      setbackRight: 0.5,
      setbackLinked: true   // true = all 4 sides linked, false = independent
    },

    walkway: {
      enabled: false,
      width: 0.80,          // meters (starts at 0.80m)
      interval: 2,           // every 2 rows
      direction: 'horizontal', // 'horizontal' | 'vertical' | 'both'
      corridors: [],
      customCorridors: []   // custom user-drawn walkways
    },

    activeTool: 'select',    // 'select' | 'draw_walkway'
    selectedWalkwayId: null, // ID of currently selected custom walkway
    walkwayEditModal: {
      open: false,
      id: null,
      width: 0.80,
      direction: 'vertical'
    },

    // Roof Obstacles (Skylights & Chimneys)
    skylightPresets: SKYLIGHT_PRESETS,
    chimneyPresets: CHIMNEY_PRESETS,
    obstacles: [],
    selectedObstacleId: null,
    obstacleTab: 'skylight', // 'skylight' | 'chimney'
    selectedObstaclePreset: 'dome_100_100',
    obstacleClearance: 0.30, // meters safety keep-out buffer
    obstacleCustomWidth: 1.00, // meters (0.30 - 2.50m)
    obstacleCustomLength: 1.00, // meters (0.30 - 2.50m)
    obstacleEditModal: {
      open: false,
      id: null,
      type: 'skylight',
      preset: 'dome_100_100',
      width: 1.00,
      length: 1.00,
      clearance: 0.30
    },

    exportModal: {
      open: false,
      format: 'svg', // 'svg' | 'png'
      mode: 'detailed', // 'detailed' | 'standard'
      showSetbacks: true,
      showArrayBounds: true,
      showWalkways: true,
      showModulePitch: true,
      showTitleBlock: true
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

    lang: 'en', // 'en' | 'de'
    autoFillMode: 'mixed', // 'mixed' | 'same' | 'portrait' | 'landscape'
    autoBestStrategy: 'mixed', // 'mixed' | 'same'
    autoDropdownOpen: false,

    t(key, params = {}) {
      return translate(this.lang, key, params);
    },

    getPresetName(preset) {
      if (!preset) return '';
      return (this.lang === 'de' && preset.name_de) ? preset.name_de : preset.name;
    },

    getIntervalLabel(opt) {
      if (!opt) return '';
      return (this.lang === 'de' && opt.label_de) ? opt.label_de : opt.label;
    },

    setLanguage(newLang) {
      if (newLang !== 'en' && newLang !== 'de') return;
      this.lang = newLang;
      try {
        localStorage.setItem('solarrooffit_lang', newLang);
      } catch (_) {}
      document.documentElement.lang = newLang;
      document.title = this.t('docTitle');
      this.refreshValidation();
      this.showToast(newLang === 'de' ? 'Sprache auf Deutsch eingestellt' : 'Language set to English');
    },

    formatLayoutSummary(summary) {
      if (!summary) return '';
      if (this.lang === 'de') {
        return summary
          .replace(/landscape/gi, 'Quer')
          .replace(/portrait/gi, 'Hochkant')
          .replace(/\(mixed\)/gi, '(gemischt)')
          .replace(/\(same alignment\)/gi, '(gleiche Ausrichtung)')
          .replace(/No modules fit/gi, 'Keine Module passen')
          .replace(/No usable area/gi, 'Keine nutzbare Fläche');
      }
      return summary;
    },

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
            module: this.module,
            walkway: this.walkway,
            activeTool: this.activeTool,
            selectedWalkwayId: this.selectedWalkwayId,
            obstacles: this.obstacles,
            selectedObstacleId: this.selectedObstacleId
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

      // Detect and initialize language preference (saved or browser language)
      try {
        const savedLang = localStorage.getItem('solarrooffit_lang');
        if (savedLang === 'en' || savedLang === 'de') {
          this.lang = savedLang;
        } else {
          const userLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
          this.lang = userLang.startsWith('de') ? 'de' : 'en';
        }
      } catch (_) {
        this.lang = 'en';
      }
      document.documentElement.lang = this.lang;
      document.title = this.t('docTitle');

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
          if (parsed.autoBestStrategy) this.autoBestStrategy = parsed.autoBestStrategy;
          if (parsed.autoFillMode) this.autoFillMode = parsed.autoFillMode;
          if (Array.isArray(parsed.obstacles)) {
            this.obstacles = parsed.obstacles;
          }
          if (Array.isArray(parsed.modules) && parsed.modules.length > 0) {
            this.modules = parsed.modules;
          } else {
            this.runAutoFill(this.autoBestStrategy || 'mixed', false);
          }
        } catch (e) {
          console.error('Failed to load saved state:', e);
          this.runAutoFill(this.autoBestStrategy || 'mixed', false);
        }
      } else {
        this.runAutoFill(this.autoBestStrategy || 'mixed', false);
      }

      this.refreshValidation();

      // Fit view to roof on start
      this.$nextTick(() => {
        if (this.canvasManager) {
          this.canvasManager.fitToRoof(this.roof.width, this.roof.length);
          this.renderCanvasModules();
          this.renderWalkways();
          this.renderObstacles();
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
      this.$watch('autoBestStrategy', () => this.persistState());
      this.$watch('obstacles', () => {
        this.persistState();
        this.renderObstacles();
      });
      this.$watch('selectedObstacleId', () => {
        this.renderObstacles();
      });

      this.saveHistory('Initial State');
    },

    // --- Validation, Collisions & Visual Sync ---
    refreshValidation() {
      this.collidingIds = detectCollisions(
        this.modules,
        this.module,
        this.walkway.customCorridors || [],
        this.obstacles || []
      );
      this.renderCanvasModules();
      this.renderWalkways();
      this.renderObstacles();
    },

    renderWalkways() {
      if (!this.canvasManager) return;
      this.canvasManager.renderWalkways(
        this.walkway.corridors || [],
        this.walkway.customCorridors || [],
        this.selectedWalkwayId,
        {
          onWalkwaySelect: (id, e) => this.selectWalkway(id, e),
          onWalkwayDblClick: (id, e) => this.openEditWalkwayModal(id),
          onWalkwayMove: (id, newX, newY) => this.onWalkwayMove(id, newX, newY),
          onWalkwayMoveEnd: (id, newX, newY) => this.onWalkwayMoveEnd(id, newX, newY),
          onWalkwayCreated: (newWalkway) => this.onWalkwayCreated(newWalkway),
          onBackgroundClick: (e) => this.onBackgroundClick(e)
        }
      );
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
    onModulePresetChange() {
      const preset = this.modulePresets[this.module.preset];
      if (preset) {
        this.module.width = preset.width;
        this.module.height = preset.height;
        this.module.power = preset.power;
        this.refreshValidation();
        this.showToast(this.t('toastSelectedModule', { name: this.getPresetName(preset) }));
      }
    },

    onRoofDimensionChange() {
      if (typeof this.roof.width !== 'number' || isNaN(this.roof.width) || this.roof.width <= 0) {
        this.roof.width = 1.0;
      }
      if (typeof this.roof.length !== 'number' || isNaN(this.roof.length) || this.roof.length <= 0) {
        this.roof.length = 1.0;
      }
      this.refreshValidation();
      if (this.canvasManager) {
        this.canvasManager.fitToRoof(this.roof.width, this.roof.length);
      }
      this.saveHistory(this.t('historyDimensions'));
    },

    selectAutoStrategy(strategy) {
      this.autoBestStrategy = strategy;
      this.autoDropdownOpen = false;
      this.runAutoFill(strategy);
    },

    // --- Module Operations ---
    runAutoFill(mode = this.autoFillMode, recordUndo = true) {
      if (mode === 'optimal' || !mode) {
        mode = this.autoBestStrategy || 'mixed';
      }
      this.autoFillMode = mode;
      if (mode === 'mixed' || mode === 'same') {
        this.autoBestStrategy = mode;
      }
      const step = this.grid.enabled ? this.grid.step : 0.05;
      const result = calculateAutoFill(
        this.roof,
        this.module,
        mode,
        step,
        this.walkway,
        this.walkway.customCorridors || [],
        this.obstacles || []
      );

      this.modules = result.modules;
      this.walkway.corridors = result.walkways || [];
      this.selectedIds = [];
      this.refreshValidation();
      this.renderWalkways();

      const summaryText = this.formatLayoutSummary(result.summary || result.modeUsed);
      if (recordUndo) {
        this.saveHistory(this.t('historyAutoFill', { summary: summaryText }));
      }
      this.showToast(this.t('toastAutoFilled', { count: result.count, summary: summaryText }));
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
      this.saveHistory(this.t('historyAddModule'));
      this.showToast(this.t('toastAddedModule'));
    },

    rotateSelected() {
      if (this.selectedObstacleId) {
        const obs = (this.obstacles || []).find(o => o.id === this.selectedObstacleId);
        if (obs) {
          const oldW = obs.width;
          obs.width = obs.length;
          obs.length = oldW;
          obs.rotation = ((obs.rotation || 0) + 90) % 360;
          // Ensure within roof
          const maxX = Math.max(0, this.roof.width - obs.width);
          const maxY = Math.max(0, this.roof.length - obs.length);
          obs.x = Math.max(0, Math.min(obs.x, maxX));
          obs.y = Math.max(0, Math.min(obs.y, maxY));
          this.refreshValidation();
          this.runAutoFill(this.autoFillMode, false);
          this.saveHistory(this.t('historyRotateObstacle'));
          this.showToast(this.t('historyRotateObstacle'));
        }
        return;
      }

      if (this.selectedWalkwayId) {
        const wk = (this.walkway.customCorridors || []).find(w => w.id === this.selectedWalkwayId);
        if (wk) {
          const oldW = wk.width;
          wk.width = wk.height;
          wk.height = oldW;
          wk.direction = wk.direction === 'horizontal' ? 'vertical' : 'horizontal';
          this.runAutoFill(this.autoFillMode, false);
          this.saveHistory('Rotate custom walkway');
          this.showToast('Walkway orientation rotated');
        }
        return;
      }

      if (this.selectedIds.length === 0) {
        this.showToast(this.lang === 'de' ? 'Wählen Sie Module zum Drehen aus' : 'Select one or more modules to rotate', 'info');
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
      this.saveHistory(this.t('historyRotate'));
      this.showToast(this.t('toastRotated', { n: this.selectedIds.length }));
    },

    duplicateSelected() {
      if (this.selectedObstacleId) {
        const obs = (this.obstacles || []).find(o => o.id === this.selectedObstacleId);
        if (obs) {
          const offset = this.grid.enabled ? Math.max(this.grid.step, 0.25) : 0.25;
          const dup = {
            ...obs,
            id: 'obs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            x: Math.max(0, Math.min(obs.x + offset, Math.max(0, this.roof.width - obs.width))),
            y: Math.max(0, Math.min(obs.y + offset, Math.max(0, this.roof.length - obs.length)))
          };
          this.obstacles = [...this.obstacles, dup];
          this.selectedObstacleId = dup.id;
          this.selectedIds = [];
          this.selectedWalkwayId = null;
          this.refreshValidation();
          this.runAutoFill(this.autoFillMode, false);
          this.saveHistory(this.t('historyAddObstacle'));
          this.showToast(this.t('toastObstacleAdded', { name: dup.name }));
        }
        return;
      }

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
      this.saveHistory(this.t('historyDuplicate'));
      this.showToast(this.t('toastDuplicated', { n: newItems.length }));
    },

    deleteSelected() {
      if (this.selectedObstacleId) {
        this.obstacles = (this.obstacles || []).filter(o => o.id !== this.selectedObstacleId);
        this.selectedObstacleId = null;
        this.refreshValidation();
        this.runAutoFill(this.autoFillMode, false);
        this.saveHistory(this.t('historyDeleteObstacle'));
        this.showToast(this.t('toastObstacleDeleted'));
        return;
      }

      if (this.selectedWalkwayId) {
        this.walkway.customCorridors = (this.walkway.customCorridors || []).filter(w => w.id !== this.selectedWalkwayId);
        this.selectedWalkwayId = null;
        this.runAutoFill(this.autoFillMode, false);
        this.saveHistory(this.t('historyDeleteWalkway'));
        this.showToast(this.t('toastWalkwayDeleted'));
        return;
      }

      if (this.selectedIds.length === 0) return;
      const count = this.selectedIds.length;
      this.modules = this.modules.filter(m => !this.selectedIds.includes(m.id));
      this.selectedIds = [];
      this.refreshValidation();
      this.saveHistory(this.t('historyDelete'));
      this.showToast(this.t('toastDeleted', { n: count }));
    },

    // --- Custom Walkway Operations ---
    toggleDrawWalkway() {
      if (this.activeTool === 'draw_walkway') {
        this.activeTool = 'select';
      } else {
        this.activeTool = 'draw_walkway';
        this.selectedWalkwayId = null;
        this.selectedIds = [];
        this.renderCanvasModules();
        this.renderWalkways();
        this.showToast(this.t('hintDrawWalkway'));
      }
    },

    onWalkwayCreated(newWalkway) {
      if (!this.walkway.customCorridors) {
        this.walkway.customCorridors = [];
      }
      newWalkway.id = 'cwk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      this.walkway.customCorridors.push(newWalkway);
      this.selectedWalkwayId = newWalkway.id;
      this.activeTool = 'select';
      // Automatically re-align panels around the newly drawn walkway
      this.runAutoFill(this.autoFillMode, false);
      this.saveHistory(this.t('historyAddWalkway'));
      this.showToast(this.t('toastWalkwayCreated'));
    },

    selectWalkway(id) {
      this.selectedWalkwayId = id;
      this.selectedIds = [];
      this.renderCanvasModules();
      this.renderWalkways();
    },

    onWalkwayMove(id, newX, newY) {
      const wk = (this.walkway.customCorridors || []).find(w => w.id === id);
      if (wk) {
        wk.x = newX;
        wk.y = newY;
      }
    },

    onWalkwayMoveEnd(id, newX, newY) {
      const wk = (this.walkway.customCorridors || []).find(w => w.id === id);
      if (wk) {
        wk.x = newX;
        wk.y = newY;
      }
      // Automatically re-align panels around the moved walkway
      this.runAutoFill(this.autoFillMode, false);
      this.saveHistory(this.t('historyMoveWalkway'));
    },

    deleteCustomWalkway(id) {
      this.walkway.customCorridors = (this.walkway.customCorridors || []).filter(w => w.id !== id);
      if (this.selectedWalkwayId === id) {
        this.selectedWalkwayId = null;
      }
      // Automatically re-align panels to fill in freed space
      this.runAutoFill(this.autoFillMode, false);
      this.saveHistory(this.t('historyDeleteWalkway'));
      this.showToast(this.t('toastWalkwayDeleted'));
    },

    clearCustomWalkways() {
      if (!this.walkway.customCorridors || this.walkway.customCorridors.length === 0) return;
      this.walkway.customCorridors = [];
      this.selectedWalkwayId = null;
      this.runAutoFill(this.autoFillMode, false);
      this.saveHistory('Clear custom walkways');
      this.showToast(this.t('toastWalkwayDeleted'));
    },

    openEditWalkwayModal(id) {
      const wk = (this.walkway.customCorridors || []).find(w => w.id === id);
      if (!wk) return;
      const currentSpan = wk.direction === 'vertical' ? wk.width : wk.height;
      this.walkwayEditModal = {
        open: true,
        id: wk.id,
        width: Number(currentSpan.toFixed(2)),
        direction: wk.direction
      };
      this.selectWalkway(id);
      this.$nextTick(() => {
        const inp = document.getElementById('input-edit-walkway-width');
        if (inp) {
          inp.focus();
          inp.select();
        }
      });
    },

    closeWalkwayEditModal() {
      this.walkwayEditModal.open = false;
    },

    applyWalkwayWidth() {
      const id = this.walkwayEditModal.id;
      const newWidth = Math.max(0.1, Number(this.walkwayEditModal.width) || 0.8);
      const wk = (this.walkway.customCorridors || []).find(w => w.id === id);
      if (wk) {
        if (wk.direction === 'vertical') {
          const delta = newWidth - wk.width;
          wk.x = Number((wk.x - delta / 2).toFixed(4));
          wk.width = Number(newWidth.toFixed(4));
        } else {
          const delta = newWidth - wk.height;
          wk.y = Number((wk.y - delta / 2).toFixed(4));
          wk.height = Number(newWidth.toFixed(4));
        }
        this.runAutoFill(this.autoFillMode, false);
        this.saveHistory(this.t('historyChangeWalkwayWidth', { width: newWidth.toFixed(2) }));
        this.showToast(this.t('toastWalkwayWidthChanged', { width: newWidth.toFixed(2) }));
      }
      this.walkwayEditModal.open = false;
    },

    // --- Roof Obstacle Operations (Skylights & Chimneys) ---
    renderObstacles() {
      if (!this.canvasManager) return;
      this.canvasManager.renderObstacles(
        this.obstacles || [],
        this.selectedObstacleId,
        {
          onObstacleSelect: (id) => this.selectObstacle(id),
          onObstacleDblClick: (id) => this.openEditObstacleModal(id),
          onObstacleMoveEnd: (id, x, y) => this.onObstacleMoveEnd(id, x, y),
          onBackgroundClick: () => {
            if (this.selectedObstacleId) {
              this.selectedObstacleId = null;
              this.renderObstacles();
            }
          }
        }
      );
    },

    selectObstacle(id) {
      this.selectedObstacleId = id;
      this.selectedIds = [];
      this.selectedWalkwayId = null;
      this.renderCanvasModules();
      this.renderWalkways();
      this.renderObstacles();
    },

    onObstacleMoveEnd(id, newX, newY) {
      const obs = (this.obstacles || []).find(o => o.id === id);
      if (obs) {
        obs.x = Number(newX.toFixed(4));
        obs.y = Number(newY.toFixed(4));
        this.refreshValidation();
        this.runAutoFill(this.autoFillMode, false);
        this.saveHistory(this.t('historyMoveObstacle'));
      }
    },

    onObstaclePresetChange(isModal = false) {
      const target = isModal ? this.obstacleEditModal : this;
      const type = isModal ? target.type : this.obstacleTab;
      const presetKey = isModal ? target.preset : this.selectedObstaclePreset;
      const catalog = type === 'skylight' ? this.skylightPresets : this.chimneyPresets;
      const p = catalog ? catalog[presetKey] : null;
      if (p && presetKey !== 'custom') {
        if (isModal) {
          target.width = Number(p.width.toFixed(2));
          target.length = Number(p.length.toFixed(2));
        } else {
          this.obstacleCustomWidth = Number(p.width.toFixed(2));
          this.obstacleCustomLength = Number(p.length.toFixed(2));
        }
      }
    },

    addObstacle(forcedType = null) {
      const type = forcedType || this.obstacleTab || 'skylight';
      let presetKey = this.selectedObstaclePreset;
      if (forcedType && forcedType !== this.obstacleTab) {
        this.obstacleTab = forcedType;
        presetKey = forcedType === 'skylight' ? 'dome_100_100' : 'single_40_40';
        this.selectedObstaclePreset = presetKey;
      }
      const catalog = type === 'skylight' ? this.skylightPresets : this.chimneyPresets;
      const presetObj = catalog ? catalog[presetKey] : null;

      let w = Number(this.obstacleCustomWidth) || 1.0;
      let l = Number(this.obstacleCustomLength) || 1.0;
      if (presetObj && presetKey !== 'custom') {
        w = presetObj.width;
        l = presetObj.length;
      }
      // Strict clamping to realistic common sizes: 0.30m to 2.50m
      w = Math.max(0.30, Math.min(2.50, Number(w.toFixed(2))));
      l = Math.max(0.30, Math.min(2.50, Number(l.toFixed(2))));

      const clr = Math.max(0.0, Math.min(1.50, Number(this.obstacleClearance !== undefined ? this.obstacleClearance : 0.30)));
      const step = this.grid.enabled ? this.grid.step : 0.25;
      const pos = findFreeObstaclePosition(this.obstacles, w, l, this.roof, step);

      const name = presetObj ? (this.lang === 'de' ? (presetObj.name_de || presetObj.name) : presetObj.name) : (type === 'skylight' ? 'Skylight' : 'Chimney');
      const newObs = {
        id: 'obs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type,
        preset: presetKey,
        name,
        width: w,
        length: l,
        clearance: clr,
        x: pos.x,
        y: pos.y,
        rotation: 0
      };

      if (!this.obstacles) this.obstacles = [];
      this.obstacles.push(newObs);
      this.selectedObstacleId = newObs.id;
      this.selectedIds = [];
      this.selectedWalkwayId = null;

      this.refreshValidation();
      this.runAutoFill(this.autoFillMode, false);
      this.saveHistory(this.t('historyAddObstacle'));
      this.showToast(this.t('toastObstacleAdded', { name }));
    },

    deleteObstacle(id) {
      this.obstacles = (this.obstacles || []).filter(o => o.id !== id);
      if (this.selectedObstacleId === id) {
        this.selectedObstacleId = null;
      }
      this.refreshValidation();
      this.runAutoFill(this.autoFillMode, false);
      this.saveHistory(this.t('historyDeleteObstacle'));
      this.showToast(this.t('toastObstacleDeleted'));
    },

    clearAllObstacles() {
      if (!this.obstacles || this.obstacles.length === 0) return;
      this.obstacles = [];
      this.selectedObstacleId = null;
      this.refreshValidation();
      this.runAutoFill(this.autoFillMode, false);
      this.saveHistory(this.t('historyClearObstacles'));
      this.showToast(this.t('toastObstaclesCleared'));
    },

    openEditObstacleModal(id) {
      const obs = (this.obstacles || []).find(o => o.id === id);
      if (!obs) return;
      this.obstacleEditModal = {
        open: true,
        id: obs.id,
        type: obs.type,
        preset: obs.preset || 'custom',
        width: Number(obs.width.toFixed(2)),
        length: Number(obs.length.toFixed(2)),
        clearance: Number((obs.clearance !== undefined ? obs.clearance : 0.30).toFixed(2))
      };
      this.selectObstacle(id);
    },

    closeObstacleEditModal() {
      this.obstacleEditModal.open = false;
    },

    rotateObstacleInModal() {
      const oldW = this.obstacleEditModal.width;
      this.obstacleEditModal.width = this.obstacleEditModal.length;
      this.obstacleEditModal.length = oldW;
    },

    applyObstacleEdit() {
      const id = this.obstacleEditModal.id;
      const obs = (this.obstacles || []).find(o => o.id === id);
      if (obs) {
        const w = Math.max(0.30, Math.min(2.50, Number(this.obstacleEditModal.width) || 1.0));
        const l = Math.max(0.30, Math.min(2.50, Number(this.obstacleEditModal.length) || 1.0));
        const clr = Math.max(0.0, Math.min(1.50, Number(this.obstacleEditModal.clearance) !== undefined ? Number(this.obstacleEditModal.clearance) : 0.30));

        obs.type = this.obstacleEditModal.type;
        obs.preset = this.obstacleEditModal.preset;
        obs.width = Number(w.toFixed(2));
        obs.length = Number(l.toFixed(2));
        obs.clearance = Number(clr.toFixed(2));

        const catalog = obs.type === 'skylight' ? this.skylightPresets : this.chimneyPresets;
        const p = catalog ? catalog[obs.preset] : null;
        if (p && obs.preset !== 'custom') {
          obs.name = this.lang === 'de' ? (p.name_de || p.name) : p.name;
        }

        // Clamp inside roof
        const maxX = Math.max(0, this.roof.width - obs.width);
        const maxY = Math.max(0, this.roof.length - obs.length);
        obs.x = Math.max(0, Math.min(obs.x, maxX));
        obs.y = Math.max(0, Math.min(obs.y, maxY));

        this.refreshValidation();
        this.runAutoFill(this.autoFillMode, false);
        this.saveHistory(this.t('historyUpdateObstacle'));
        this.showToast(this.t('toastObstacleUpdated'));
      }
      this.obstacleEditModal.open = false;
    },

    openExportModal(format = 'svg') {
      this.exportModal.format = format;
      this.exportModal.open = true;
    },

    closeExportModal() {
      this.exportModal.open = false;
    },

    executeExport() {
      const options = {
        detailed: this.exportModal.mode === 'detailed',
        mode: this.exportModal.mode,
        showSetbacks: this.exportModal.showSetbacks,
        showArrayBounds: this.exportModal.showArrayBounds,
        showWalkways: this.exportModal.showWalkways,
        showModulePitch: this.exportModal.showModulePitch,
        showTitleBlock: this.exportModal.showTitleBlock
      };

      if (this.exportModal.format === 'svg') {
        this.exportSVG(options);
      } else {
        this.exportPNG(options);
      }
      this.closeExportModal();
    },

    resetToDefault() {
      const confirmMsg = this.lang === 'de'
        ? 'Möchten Sie den gesamten Dachplaner auf die Standardeinstellungen zurücksetzen?'
        : 'Reset entire roof plan and settings to factory defaults?';
      if (!confirm(confirmMsg)) return;

      this.roof = {
        width: 8.0,
        length: 8.0,
        setback: 0.5,
        setbackTop: 0.5,
        setbackBottom: 0.5,
        setbackLeft: 0.5,
        setbackRight: 0.5,
        setbackLinked: true
      };

      this.walkway = {
        enabled: false,
        width: 0.80,
        interval: 2,
        direction: 'horizontal',
        corridors: [],
        customCorridors: []
      };

      this.obstacles = [];
      this.selectedObstacleId = null;

      this.module = {
        width: 1134,
        height: 1762,
        power: 430,
        gapX: 20,
        gapY: 20,
        preset: 'standard_430'
      };

      this.grid = {
        enabled: true,
        step: 0.25,
        showGrid: true,
        snapToPanels: true
      };

      this.activeTool = 'select';
      this.selectedWalkwayId = null;
      this.selectedIds = [];
      this.autoFillMode = 'mixed';
      this.autoBestStrategy = 'mixed';

      try {
        localStorage.removeItem('pv_roof_planner_state');
      } catch (_) {}

      this.runAutoFill('mixed', false);
      this.fitToRoof();
      this.saveHistory(this.t('historyResetDefault'));
      this.showToast(this.t('toastResetDefault'));
    },

    onBackgroundClick(e) {
      if (this.selectedWalkwayId) {
        this.selectedWalkwayId = null;
        this.renderWalkways();
      }
      if (this.activeTool === 'draw_walkway' && e && e.button !== 0) {
        this.activeTool = 'select';
      }
    },

    clearAll() {
      if (this.modules.length === 0) return;
      const confirmMsg = this.lang === 'de'
        ? `Möchten Sie alle ${this.modules.length} PV-Module vom Dach entfernen?`
        : `Remove all ${this.modules.length} PV modules from the roof?`;
      if (confirm(confirmMsg)) {
        this.modules = [];
        this.selectedIds = [];
        this.walkway.corridors = [];
        if (this.canvasManager) {
          this.canvasManager.renderWalkways([]);
        }
        this.refreshValidation();
        this.saveHistory(this.t('historyClear'));
        this.showToast(this.t('toastCleared'));
      }
    },

    selectAll() {
      this.selectedIds = this.modules.map(m => m.id);
      this.showToast(this.t('toastSelectedAll', { n: this.modules.length }));
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
        walkway: this.walkway,
        obstacles: this.obstacles
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
        if (state.obstacles) {
          this.obstacles = state.obstacles;
          this.renderObstacles();
        }
        this.selectedIds = [];
        this.selectedObstacleId = null;
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
        if (state.obstacles) {
          this.obstacles = state.obstacles;
          this.renderObstacles();
        }
        this.selectedIds = [];
        this.selectedObstacleId = null;
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
          if (this.selectedIds.length > 0 || this.selectedWalkwayId || this.selectedObstacleId) {
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
          if (this.activeTool === 'draw_walkway') {
            this.activeTool = 'select';
            this.canvasManager?.clearWalkwayDrawPreview();
            this.canvasManager?.renderSnapGuides([]);
          } else if (this.selectedWalkwayId) {
            this.selectedWalkwayId = null;
            this.renderWalkways();
          } else {
            this.deselectAll();
          }
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
        obstacles: this.obstacles,
        modules: this.modules,
        autoBestStrategy: this.autoBestStrategy,
        autoFillMode: this.autoFillMode
      };
      try {
        localStorage.setItem('pv_roof_planner_state', JSON.stringify(data));
      } catch (_) {}
    },

    // --- Standalone SVG Blueprint Generator ---
    getExportableSVGString(options = {}) {
      const svgEl = document.getElementById('roof-canvas-svg');
      if (!svgEl) return null;

      const clone = svgEl.cloneNode(true);

      // Determine export mode
      const isDetailed = options.detailed !== undefined
        ? options.detailed
        : (options.mode === 'detailed');
      const showSetbacks = options.showSetbacks !== false;
      const showArrayBounds = options.showArrayBounds !== false;
      const showWalkways = options.showWalkways !== false;
      const showModulePitch = options.showModulePitch !== false;
      const showTitleBlock = options.showTitleBlock !== false;

      // 1. Remove dynamic interaction layers from export
      const snapLayer = clone.querySelector('#snap-guides-layer');
      if (snapLayer) snapLayer.remove();
      const drawPreviewLayer = clone.querySelector('#drawing-preview-layer');
      if (drawPreviewLayer) drawPreviewLayer.remove();

      // Clean selection states on exported obstacles
      clone.querySelectorAll('.obstacle-group.selected').forEach(el => el.classList.remove('selected'));
      clone.querySelectorAll('.obstacle-selection-outline').forEach(el => el.remove());

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

      // Helpers to create SVG nodes
      const createEl = (tag, attrs = {}) => {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [k, v] of Object.entries(attrs)) {
          el.setAttribute(k, String(v));
        }
        return el;
      };

      const addHorizDim = (parent, x1, x2, y, label, isRoof = false, witnessY = null) => {
        if (Math.abs(x2 - x1) < 0.01) return;
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const midX = (left + right) / 2;
        const tick = isRoof ? 0.08 : 0.06;

        // Witness lines
        if (witnessY !== null) {
          parent.appendChild(createEl('line', {
            x1: left, y1: witnessY, x2: left, y2: y - (y < witnessY ? -0.06 : 0.06),
            class: 'cad-witness-line'
          }));
          parent.appendChild(createEl('line', {
            x1: right, y1: witnessY, x2: right, y2: y - (y < witnessY ? -0.06 : 0.06),
            class: 'cad-witness-line'
          }));
        }

        // Dimension main line
        parent.appendChild(createEl('line', {
          x1: left, y1: y, x2: right, y2: y,
          class: isRoof ? 'cad-roof-dim-line' : 'cad-dim-line'
        }));

        // 45-degree ticks
        parent.appendChild(createEl('line', {
          x1: left - tick, y1: y + tick, x2: left + tick, y2: y - tick,
          class: isRoof ? 'cad-roof-dim-tick' : 'cad-dim-tick'
        }));
        parent.appendChild(createEl('line', {
          x1: right - tick, y1: y + tick, x2: right + tick, y2: y - tick,
          class: isRoof ? 'cad-roof-dim-tick' : 'cad-dim-tick'
        }));

        // Label badge
        const textLen = String(label).length;
        const badgeW = Math.max(0.48, textLen * 0.12);
        const badgeH = 0.26;
        parent.appendChild(createEl('rect', {
          x: midX - badgeW / 2, y: y - badgeH / 2,
          width: badgeW, height: badgeH, rx: 0.05,
          class: isRoof ? 'cad-roof-dim-badge-bg' : 'cad-dim-badge-bg'
        }));
        const textEl = createEl('text', {
          x: midX, y: y,
          class: isRoof ? 'cad-roof-dim-text' : 'cad-dim-text'
        });
        textEl.textContent = label;
        parent.appendChild(textEl);
      };

      const addVertDim = (parent, y1, y2, x, label, isRoof = false, witnessX = null) => {
        if (Math.abs(y2 - y1) < 0.01) return;
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        const midY = (top + bottom) / 2;
        const tick = isRoof ? 0.08 : 0.06;

        // Witness lines
        if (witnessX !== null) {
          parent.appendChild(createEl('line', {
            x1: witnessX, y1: top, x2: x - (x < witnessX ? -0.06 : 0.06), y2: top,
            class: 'cad-witness-line'
          }));
          parent.appendChild(createEl('line', {
            x1: witnessX, y1: bottom, x2: x - (x < witnessX ? -0.06 : 0.06), y2: bottom,
            class: 'cad-witness-line'
          }));
        }

        // Dimension main line
        parent.appendChild(createEl('line', {
          x1: x, y1: top, x2: x, y2: bottom,
          class: isRoof ? 'cad-roof-dim-line' : 'cad-dim-line'
        }));

        // 45-degree ticks
        parent.appendChild(createEl('line', {
          x1: x - tick, y1: top + tick, x2: x + tick, y2: top - tick,
          class: isRoof ? 'cad-roof-dim-tick' : 'cad-dim-tick'
        }));
        parent.appendChild(createEl('line', {
          x1: x - tick, y1: bottom + tick, x2: x + tick, y2: bottom - tick,
          class: isRoof ? 'cad-roof-dim-tick' : 'cad-dim-tick'
        }));

        // Label badge (rotated -90deg)
        const textLen = String(label).length;
        const badgeW = Math.max(0.48, textLen * 0.12);
        const badgeH = 0.26;
        const g = createEl('g', {
          transform: `rotate(-90, ${x}, ${midY})`
        });
        g.appendChild(createEl('rect', {
          x: x - badgeW / 2, y: midY - badgeH / 2,
          width: badgeW, height: badgeH, rx: 0.05,
          class: isRoof ? 'cad-roof-dim-badge-bg' : 'cad-dim-badge-bg'
        }));
        const textEl = createEl('text', {
          x: x, y: midY,
          class: isRoof ? 'cad-roof-dim-text' : 'cad-dim-text'
        });
        textEl.textContent = label;
        g.appendChild(textEl);
        parent.appendChild(g);
      };

      const oldDimGroup = clone.querySelector('.dimension-annotations');

      // 5. Build Dimensions
      let allWalkways = [...(this.walkway.customCorridors || [])];
      if (this.walkway.enabled && this.walkway.corridors) {
        allWalkways.push(...this.walkway.corridors);
      }

      if (!isDetailed) {
        // Standard clean blueprint dimensions
        if (oldDimGroup) {
          const lines = oldDimGroup.querySelectorAll('line');
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

          const texts = oldDimGroup.querySelectorAll('text');
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
      } else {
        // Detailed CAD multi-tier blueprint
        if (oldDimGroup) oldDimGroup.remove();

        const cadGroup = createEl('g', { id: 'cad-dimensions-detailed', style: 'pointer-events: none;' });

        // Outer Tier (Level 2): Full Roof Dimensions
        addHorizDim(cadGroup, 0, this.roof.width, -1.45, `${Number(this.roof.width).toFixed(2)} m`, true, 0);
        addVertDim(cadGroup, 0, this.roof.length, -1.45, `${Number(this.roof.length).toFixed(2)} m`, true, 0);

        // Inner Tier (Level 1): Setbacks & PV Array footprint
        if (this.modules.length > 0) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const m of this.modules) {
            const isRot = m.rotation === 90 || m.rotation === 270;
            const mw = isRot ? (this.module.height / 1000) : (this.module.width / 1000);
            const mh = isRot ? (this.module.width / 1000) : (this.module.height / 1000);
            if (m.x < minX) minX = m.x;
            if (m.x + mw > maxX) maxX = m.x + mw;
            if (m.y < minY) minY = m.y;
            if (m.y + mh > maxY) maxY = m.y + mh;
          }
          const arrayW = maxX - minX;
          const arrayH = maxY - minY;
          const setbackW = minX;
          const setbackE = Math.max(0, this.roof.width - maxX);
          const setbackN = minY;
          const setbackS = Math.max(0, this.roof.length - maxY);

          // Horizontal chain at y = -0.60
          if (showSetbacks && setbackW > 0.04) {
            addHorizDim(cadGroup, 0, minX, -0.60, `${setbackW.toFixed(2)} m`, false, 0);
          }
          if (showArrayBounds && arrayW > 0.05) {
            addHorizDim(cadGroup, minX, maxX, -0.60, `Array: ${arrayW.toFixed(2)} m`, false, minY);
            // Array bounding dashed frame
            cadGroup.appendChild(createEl('rect', {
              x: minX.toFixed(3), y: minY.toFixed(3),
              width: arrayW.toFixed(3), height: arrayH.toFixed(3),
              fill: 'none', stroke: '#38BDF8',
              'stroke-width': '0.016', 'stroke-dasharray': '0.08 0.04',
              rx: '0.02', opacity: '0.85'
            }));
          }
          if (showSetbacks && setbackE > 0.04) {
            addHorizDim(cadGroup, maxX, this.roof.width, -0.60, `${setbackE.toFixed(2)} m`, false, 0);
          }

          // Vertical chain at x = -0.60
          if (showSetbacks && setbackN > 0.04) {
            addVertDim(cadGroup, 0, minY, -0.60, `${setbackN.toFixed(2)} m`, false, 0);
          }
          if (showArrayBounds && arrayH > 0.05) {
            addVertDim(cadGroup, minY, maxY, -0.60, `Array: ${arrayH.toFixed(2)} m`, false, minX);
          }
          if (showSetbacks && setbackS > 0.04) {
            addVertDim(cadGroup, maxY, this.roof.length, -0.60, `${setbackS.toFixed(2)} m`, false, 0);
          }

          // Module dimensions & clamp gap callout on sample module
          if (showModulePitch) {
            const sorted = [...this.modules].sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
            const m0 = sorted[0];
            const isRot = m0.rotation === 90 || m0.rotation === 270;
            const mw = isRot ? (this.module.height / 1000) : (this.module.width / 1000);
            const mh = isRot ? (this.module.width / 1000) : (this.module.height / 1000);

            // Highlight border on sample module
            cadGroup.appendChild(createEl('rect', {
              x: m0.x.toFixed(3), y: m0.y.toFixed(3),
              width: mw.toFixed(3), height: mh.toFixed(3),
              fill: 'none', stroke: '#F59E0B',
              'stroke-width': '0.024', 'stroke-dasharray': '0.04 0.02',
              rx: '0.015'
            }));

            // Callout badge with leader line
            const calloutX = m0.x + mw / 2;
            const calloutY = Math.max(-0.25, m0.y - 0.22);
            cadGroup.appendChild(createEl('line', {
              x1: calloutX, y1: m0.y, x2: calloutX, y2: calloutY + 0.1,
              stroke: '#F59E0B', 'stroke-width': '0.012', 'stroke-dasharray': '0.03 0.02'
            }));
            const badgeW = 2.4;
            const badgeH = 0.24;
            cadGroup.appendChild(createEl('rect', {
              x: calloutX - badgeW / 2, y: calloutY - badgeH / 2,
              width: badgeW, height: badgeH, rx: 0.05,
              class: 'cad-callout-pill'
            }));
            const cText = createEl('text', {
              x: calloutX, y: calloutY,
              class: 'cad-callout-text'
            });
            cText.textContent = `${mw.toFixed(3)}m × ${mh.toFixed(3)}m · Gap: ${this.module.gapX}mm`;
            cadGroup.appendChild(cText);
          }
        }

        // Walkway clearances & positions
        if (showWalkways && allWalkways.length > 0) {
          allWalkways.forEach((w, idx) => {
            const isVert = w.direction === 'vertical' || (w.height > w.width && w.direction !== 'horizontal');
            if (isVert) {
              const dimY = this.roof.length + 0.35 + (idx * 0.42);
              addHorizDim(cadGroup, w.x, w.x + w.width, dimY, `Walkway: ${w.width.toFixed(2)}m (Offset: ${w.x.toFixed(2)}m)`, false, this.roof.length);
            } else {
              const dimX = this.roof.width + 0.35 + (idx * 0.42);
              addVertDim(cadGroup, w.y, w.y + w.height, dimX, `Walkway: ${w.height.toFixed(2)}m (Offset: ${w.y.toFixed(2)}m)`, false, this.roof.width);
            }
          });
        }

        // Architectural CAD Title Block
        if (showTitleBlock) {
          const isDe = this.lang === 'de';
          const hasVertWalkway = allWalkways.some(w => w.direction === 'vertical' || (w.height > w.width && w.direction !== 'horizontal'));
          const tbW = Math.max(5.8, Math.min(9.2, this.roof.width));
          const tbX = Math.max(0, this.roof.width - tbW);
          const tbY = this.roof.length + (hasVertWalkway ? (allWalkways.length * 0.42 + 0.5) : 0.6);
          const tbH = 1.55;

          const tbGroup = createEl('g', { id: 'cad-title-block' });
          // Background box
          tbGroup.appendChild(createEl('rect', {
            x: tbX, y: tbY, width: tbW, height: tbH, rx: 0.06,
            class: 'cad-tb-bg'
          }));
          // Top header band
          tbGroup.appendChild(createEl('rect', {
            x: tbX, y: tbY, width: tbW, height: 0.38, rx: 0.06,
            class: 'cad-tb-header'
          }));
          // Blue accent strip
          tbGroup.appendChild(createEl('rect', {
            x: tbX, y: tbY, width: 0.08, height: tbH, rx: 0.03,
            class: 'cad-tb-accent'
          }));

          // Header Title & Subtitle
          const titleEl = createEl('text', {
            x: tbX + 0.22, y: tbY + 0.16,
            class: 'cad-tb-title'
          });
          titleEl.textContent = isDe ? 'SOLARROOFFIT CAD-BAUPLAN' : 'SOLARROOFFIT CAD BLUEPRINT';
          tbGroup.appendChild(titleEl);

          const subEl = createEl('text', {
            x: tbX + 0.22, y: tbY + 0.30,
            class: 'cad-tb-subtitle'
          });
          subEl.textContent = isDe ? 'Photovoltaik-Flachdachbelegung · Maßstab 1:1 Metrisch' : 'Photovoltaic Flat Roof Layout · Scale 1:1 Metric';
          tbGroup.appendChild(subEl);

          // Column 1: Roof Specs
          const col1X = tbX + 0.22;
          const lblRoof = createEl('text', { x: col1X, y: tbY + 0.54, class: 'cad-tb-label' });
          lblRoof.textContent = isDe ? 'Dachabmessungen' : 'Roof Dimensions';
          tbGroup.appendChild(lblRoof);
          const valRoof = createEl('text', { x: col1X, y: tbY + 0.70, class: 'cad-tb-val' });
          valRoof.textContent = `${this.roof.width.toFixed(2)}m × ${this.roof.length.toFixed(2)}m (${this.roofArea} m²)`;
          tbGroup.appendChild(valRoof);

          const lblUsable = createEl('text', { x: col1X, y: tbY + 0.90, class: 'cad-tb-label' });
          lblUsable.textContent = isDe ? 'Nutzbare Fläche' : 'Net Usable Area';
          tbGroup.appendChild(lblUsable);
          const valUsable = createEl('text', { x: col1X, y: tbY + 1.06, class: 'cad-tb-val' });
          valUsable.textContent = `${this.usableArea} m² (Setback: ${this.roof.setback}m)`;
          tbGroup.appendChild(valUsable);

          // Column 2: PV Array Specs
          const col2X = tbX + tbW * 0.36;
          const lblMods = createEl('text', { x: col2X, y: tbY + 0.54, class: 'cad-tb-label' });
          lblMods.textContent = isDe ? 'PV-Module & Leistung' : 'PV Modules & Power';
          tbGroup.appendChild(lblMods);
          const valMods = createEl('text', { x: col2X, y: tbY + 0.70, class: 'cad-tb-val' });
          valMods.textContent = `${this.modules.length} ${isDe ? 'Stk.' : 'pcs'} · ${this.totalPowerKW} kWp`;
          tbGroup.appendChild(valMods);

          const lblCov = createEl('text', { x: col2X, y: tbY + 0.90, class: 'cad-tb-label' });
          lblCov.textContent = isDe ? 'Dachbelegung' : 'Roof Coverage';
          tbGroup.appendChild(lblCov);
          const valCov = createEl('text', { x: col2X, y: tbY + 1.06, class: 'cad-tb-val' });
          valCov.textContent = `${this.coveragePercent}% (${this.pvTotalArea} m²)`;
          tbGroup.appendChild(valCov);

          // Column 3: Module & Gap Specs
          const col3X = tbX + tbW * 0.70;
          const lblType = createEl('text', { x: col3X, y: tbY + 0.54, class: 'cad-tb-label' });
          lblType.textContent = isDe ? 'Modultyp / Nennwert' : 'Module Model / Peak';
          tbGroup.appendChild(lblType);
          const valType = createEl('text', { x: col3X, y: tbY + 0.70, class: 'cad-tb-val' });
          valType.textContent = `${this.module.width}×${this.module.height}mm (${this.module.power}Wp)`;
          tbGroup.appendChild(valType);

          const lblGap = createEl('text', { x: col3X, y: tbY + 0.90, class: 'cad-tb-label' });
          lblGap.textContent = isDe ? 'Klemmenabstand X/Y' : 'Clamp Gap X / Y';
          tbGroup.appendChild(lblGap);
          const valGap = createEl('text', { x: col3X, y: tbY + 1.06, class: 'cad-tb-val' });
          valGap.textContent = `${this.module.gapX} mm / ${this.module.gapY} mm`;
          tbGroup.appendChild(valGap);

          // Bottom metadata line
          tbGroup.appendChild(createEl('line', {
            x1: tbX + 0.1, y1: tbY + 1.20, x2: tbX + tbW - 0.1, y2: tbY + 1.20,
            stroke: 'rgba(56, 189, 248, 0.25)', 'stroke-width': '0.01'
          }));
          const footEl = createEl('text', {
            x: tbX + 0.22, y: tbY + 1.36,
            class: 'cad-tb-label'
          });
          footEl.textContent = `${new Date().toLocaleDateString()} · Units: Metric (m / mm) · SolarRoofFit Simulator`;
          tbGroup.appendChild(footEl);

          cadGroup.appendChild(tbGroup);
        }

        clone.appendChild(cadGroup);
      }

      // 6. ViewBox and Canvas Bounds
      let vbX, vbY, vbW, vbH;
      if (isDetailed) {
        const hasVertWalkway = allWalkways.some(w => w.direction === 'vertical' || (w.height > w.width && w.direction !== 'horizontal'));
        const hasHorizWalkway = allWalkways.some(w => w.direction === 'horizontal' || (w.width >= w.height && w.direction !== 'vertical'));
        const maxWalkwaysBottom = (showWalkways && hasVertWalkway) ? (allWalkways.length * 0.42) : 0;
        const maxWalkwaysRight = (showWalkways && hasHorizWalkway) ? (allWalkways.length * 0.42) : 0;
        const titleBlockSpace = showTitleBlock ? 2.4 : 0.8;

        const marginLeft = Math.max(2.4, this.roof.width * 0.16);
        const marginTop = Math.max(2.3, this.roof.length * 0.16);
        const marginRight = Math.max(2.2, this.roof.width * 0.14) + maxWalkwaysRight;
        const marginBottom = Math.max(2.0, this.roof.length * 0.15) + maxWalkwaysBottom + titleBlockSpace;

        vbX = -marginLeft;
        vbY = -marginTop;
        vbW = this.roof.width + marginLeft + marginRight;
        vbH = this.roof.length + marginTop + marginBottom;
      } else {
        const marginX = Math.max(1.2, this.roof.width * 0.12);
        const marginY = Math.max(1.2, this.roof.length * 0.12);
        vbX = -marginX;
        vbY = -marginY;
        vbW = this.roof.width + (2 * marginX);
        vbH = this.roof.length + (2 * marginY);
      }

      clone.setAttribute('viewBox', `${vbX.toFixed(3)} ${vbY.toFixed(3)} ${vbW.toFixed(3)} ${vbH.toFixed(3)}`);
      clone.setAttribute('width', Math.round(vbW * 110).toString());
      clone.setAttribute('height', Math.round(vbH * 110).toString());
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // 7. Solid background
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

      // 8. Embed CSS styles
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
        .obstacle-clearance-zone { fill: rgba(14, 165, 233, 0.08); stroke: rgba(14, 165, 233, 0.45); stroke-width: 0.018; stroke-dasharray: 0.08 0.05; }
        .obstacle-clearance-label { fill: #0284C7; font-family: "JetBrains Mono", Consolas, monospace; font-size: 0.10px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
        .skylight-curb { fill: #F1F5F9; stroke: #0284C7; stroke-width: 0.022; }
        .skylight-glass { fill: #38BDF8; stroke: #0284C7; stroke-width: 0.015; }
        .skylight-glazing-line { stroke: rgba(255, 255, 255, 0.85); stroke-width: 0.012; stroke-dasharray: 0.08 0.04; }
        .chimney-masonry { fill: #7C2D12; stroke: #431407; stroke-width: 0.022; }
        .chimney-rim { fill: #475569; stroke: #334155; stroke-width: 0.015; }
        .chimney-flue-circle { fill: #0F172A; stroke: #1E293B; stroke-width: 0.015; }
        .obstacle-annotation { fill: #0F172A; font-family: "JetBrains Mono", Consolas, monospace; font-size: 0.11px; font-weight: 800; text-anchor: middle; dominant-baseline: central; }
        .obstacle-group.obstacle-chimney .obstacle-annotation { fill: #FEF3C7; }
        .cad-dim-line { stroke: #38BDF8; stroke-width: 0.02; fill: none; }
        .cad-dim-tick { stroke: #38BDF8; stroke-width: 0.025; stroke-linecap: square; }
        .cad-witness-line { stroke: rgba(56, 189, 248, 0.4); stroke-width: 0.012; stroke-dasharray: 0.06 0.04; fill: none; }
        .cad-dim-badge-bg { fill: #0B1120; stroke: #38BDF8; stroke-width: 0.014; }
        .cad-dim-text { fill: #38BDF8; font-family: "JetBrains Mono", Consolas, monospace; font-size: 0.18px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
        .cad-roof-dim-line { stroke: #94A3B8; stroke-width: 0.022; fill: none; }
        .cad-roof-dim-tick { stroke: #94A3B8; stroke-width: 0.028; stroke-linecap: square; }
        .cad-roof-dim-badge-bg { fill: #0F172A; stroke: #64748B; stroke-width: 0.016; }
        .cad-roof-dim-text { fill: #F8FAFC; font-family: "JetBrains Mono", Consolas, monospace; font-size: 0.22px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
        .cad-callout-pill { fill: #0F172A; stroke: #F59E0B; stroke-width: 0.015; }
        .cad-callout-text { fill: #FBBF24; font-family: "JetBrains Mono", Consolas, monospace; font-size: 0.14px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
        .cad-tb-bg { fill: #090E17; stroke: #38BDF8; stroke-width: 0.02; }
        .cad-tb-header { fill: #131E32; }
        .cad-tb-title { fill: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 0.20px; font-weight: 800; }
        .cad-tb-subtitle { fill: #38BDF8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 0.12px; font-weight: 600; }
        .cad-tb-label { fill: #64748B; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 0.11px; font-weight: 600; text-transform: uppercase; }
        .cad-tb-val { fill: #F1F5F9; font-family: "JetBrains Mono", Consolas, monospace; font-size: 0.13px; font-weight: 600; }
        .cad-tb-accent { fill: #38BDF8; }
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
    exportSVG(options = {}) {
      try {
        const isDetailed = options.detailed !== undefined
          ? options.detailed
          : (this.exportModal?.mode === 'detailed');

        const fullOptions = {
          detailed: isDetailed,
          mode: isDetailed ? 'detailed' : 'standard',
          showSetbacks: options.showSetbacks !== undefined ? options.showSetbacks : (this.exportModal?.showSetbacks ?? true),
          showArrayBounds: options.showArrayBounds !== undefined ? options.showArrayBounds : (this.exportModal?.showArrayBounds ?? true),
          showWalkways: options.showWalkways !== undefined ? options.showWalkways : (this.exportModal?.showWalkways ?? true),
          showModulePitch: options.showModulePitch !== undefined ? options.showModulePitch : (this.exportModal?.showModulePitch ?? true),
          showTitleBlock: options.showTitleBlock !== undefined ? options.showTitleBlock : (this.exportModal?.showTitleBlock ?? true)
        };

        const source = this.getExportableSVGString(fullOptions);
        if (!source) {
          this.showToast('SVG canvas not found', 'error');
          return;
        }

        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const prefix = fullOptions.detailed ? 'solarrooffit_blueprint_' : 'solarrooffit_';
        const filename = `${prefix}${this.roof.width}x${this.roof.length}m_${this.modules.length}mods.svg`;
        downloadBlob(blob, filename);
        this.showToast(fullOptions.detailed ? this.t('toastExportDetailed') : this.t('toastExportSVG'));
      } catch (err) {
        console.error('Failed to export SVG:', err);
        this.showToast('SVG export error: ' + err.message, 'error');
      }
    },

    exportPNG(options = {}) {
      try {
        const isDetailed = options.detailed !== undefined
          ? options.detailed
          : (this.exportModal?.mode === 'detailed');

        const fullOptions = {
          detailed: isDetailed,
          mode: isDetailed ? 'detailed' : 'standard',
          showSetbacks: options.showSetbacks !== undefined ? options.showSetbacks : (this.exportModal?.showSetbacks ?? true),
          showArrayBounds: options.showArrayBounds !== undefined ? options.showArrayBounds : (this.exportModal?.showArrayBounds ?? true),
          showWalkways: options.showWalkways !== undefined ? options.showWalkways : (this.exportModal?.showWalkways ?? true),
          showModulePitch: options.showModulePitch !== undefined ? options.showModulePitch : (this.exportModal?.showModulePitch ?? true),
          showTitleBlock: options.showTitleBlock !== undefined ? options.showTitleBlock : (this.exportModal?.showTitleBlock ?? true)
        };

        const source = this.getExportableSVGString(fullOptions);
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
            const vbMatch = source.match(/viewBox="([^"]+)"/);
            let vbW = this.roof.width + 4;
            let vbH = this.roof.length + 4;
            if (vbMatch && vbMatch[1]) {
              const parts = vbMatch[1].trim().split(/\s+/).map(Number);
              if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
                vbW = parts[2];
                vbH = parts[3];
              }
            }

            const aspect = vbH / vbW;
            canvas.width = 3200; // Ultra high-resolution 4K render
            canvas.height = Math.max(1600, Math.round(3200 * aspect));

            const ctx = canvas.getContext('2d');
            // Clean architectural daylight background
            ctx.fillStyle = '#070B14';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw SVG blueprint
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Studio Header Card only if no Title Block in SVG
            if (!fullOptions.detailed || !fullOptions.showTitleBlock) {
              ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
              ctx.lineWidth = 2;
              ctx.fillRect(35, 35, 860, 95);
              ctx.strokeRect(35, 35, 860, 95);

              ctx.fillStyle = '#F8FAFC';
              ctx.font = 'bold 28px Inter, -apple-system, sans-serif';
              ctx.fillText(`SolarRoofFit CAD: ${this.roof.width.toFixed(2)}m × ${this.roof.length.toFixed(2)}m ${this.t('exportFlatRoof')}`, 55, 75);

              ctx.font = '18px Inter, -apple-system, sans-serif';
              ctx.fillStyle = '#94A3B8';
              ctx.fillText(`${this.modules.length} PV ${this.t('metricModules')} | ${this.totalPowerKW} kWp | ${this.t('metricCoverage')}: ${this.coveragePercent}% (${this.pvTotalArea} m²)`, 55, 108);
            }

            const prefix = fullOptions.detailed ? 'solarrooffit_blueprint_' : 'solarrooffit_';
            const filename = `${prefix}${this.roof.width}x${this.roof.length}m_${this.modules.length}mods.png`;

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
                this.showToast(fullOptions.detailed ? this.t('toastExportDetailed') : this.t('toastExportPNG'));
              }, 'image/png');
            } else {
              const fallbackData = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.href = fallbackData;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              setTimeout(() => document.body.removeChild(link), 1000);
              this.showToast(fullOptions.detailed ? this.t('toastExportDetailed') : this.t('toastExportPNG'));
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

        const isDe = this.lang === 'de';
        const rows = [
          [isDe ? 'SOLARROOFFIT - SOLAR PV STÜCKLISTE & SYSTEMSPEZIFIKATION' : 'SOLARROOFFIT - SOLAR PV BILL OF MATERIALS & SYSTEM SPECIFICATION'],
          [isDe ? 'Export-Zeitstempel' : 'Export Timestamp', new Date().toISOString()],
          [],
          [isDe ? 'DACHABMESSUNGEN' : 'ROOF SPECIFICATIONS', isDe ? 'WERT' : 'VALUE', isDe ? 'EINHEIT' : 'UNIT'],
          [isDe ? 'Dachbreite (X)' : 'Roof Width (X)', this.roof.width, 'm'],
          [isDe ? 'Dachlänge (Y)' : 'Roof Length (Y)', this.roof.length, 'm'],
          [isDe ? 'Brutto-Dachfläche' : 'Gross Roof Area', this.roofArea, 'm²'],
          [isDe ? 'Randabstände gekoppelt' : 'Perimeter Setbacks Linked', this.roof.setbackLinked ? (isDe ? 'Ja' : 'Yes') : (isDe ? 'Nein' : 'No'), ''],
          [isDe ? 'Randabstand (Oben / Nord)' : 'Perimeter Setback (Top / North)', this.roofSetbackTop, 'm'],
          [isDe ? 'Randabstand (Unten / Süd)' : 'Perimeter Setback (Bottom / South)', this.roofSetbackBottom, 'm'],
          [isDe ? 'Randabstand (Links / West)' : 'Perimeter Setback (Left / West)', this.roofSetbackLeft, 'm'],
          [isDe ? 'Randabstand (Rechts / Ost)' : 'Perimeter Setback (Right / East)', this.roofSetbackRight, 'm'],
          [isDe ? 'Nutzbare Solarfläche' : 'Net Usable Solar Area', this.usableArea, 'm²'],
          [isDe ? 'Wartungsgänge aktiv' : 'Maintenance Walkways Enabled', this.walkway.enabled ? (isDe ? 'Ja' : 'Yes') : (isDe ? 'Nein' : 'No'), ''],
          [isDe ? 'Wegbreite' : 'Walkway Corridor Width', this.walkway.enabled ? this.walkway.width : 'N/A', 'm'],
          [isDe ? 'Intervall' : 'Walkway Insertion Interval', this.walkway.enabled ? (isDe ? `Alle ${this.walkway.interval} Reihen` : `Every ${this.walkway.interval} rows`) : 'N/A', ''],
          [isDe ? 'Laufrichtung' : 'Walkway Corridor Direction', this.walkway.enabled ? this.walkway.direction : 'N/A', ''],
          [],
          [isDe ? 'PV-MODUL SPEZIFIKATIONEN' : 'PV MODULE SPECIFICATIONS', isDe ? 'WERT' : 'VALUE', isDe ? 'EINHEIT' : 'UNIT'],
          [isDe ? 'Modell-Voreinstellung' : 'Module Model Preset', this.getPresetName(this.modulePresets[this.module.preset]) || 'Custom', ''],
          [isDe ? 'Modulbreite' : 'Module Width', this.module.width, 'mm'],
          [isDe ? 'Modullänge / Höhe' : 'Module Height / Length', this.module.height, 'mm'],
          [isDe ? 'Nennleistung' : 'Module Peak Power', this.module.power, 'Wp'],
          [isDe ? 'Klemmenabstand X' : 'Inter-Module Clamp Gap X', this.module.gapX, 'mm'],
          [isDe ? 'Klemmenabstand Y' : 'Inter-Module Clamp Gap Y', this.module.gapY, 'mm'],
          [],
          [isDe ? 'SYSTEMLEISTUNG GESAMT' : 'SYSTEM PERFORMANCE TOTALS', isDe ? 'WERT' : 'VALUE', isDe ? 'EINHEIT' : 'UNIT'],
          [isDe ? 'Anzahl Module' : 'Total Modules Placed', this.modules.length, 'pcs'],
          [isDe ? 'Gesamte Nennleistung' : 'Total System Peak Capacity', this.totalPowerKW, 'kWp'],
          [isDe ? 'Aktive Modulfläche' : 'Total Active PV Surface Area', this.pvTotalArea, 'm²'],
          [isDe ? 'Belegungsgrad' : 'Roof Area Coverage Ratio', this.coveragePercent, '%'],
          [isDe ? 'Spezifische Leistungsdichte' : 'Specific Power Density', this.powerDensity, 'Wp/m²'],
          [isDe ? 'Konflikte / Abstandswarnungen' : 'Array Boundary / Spacing Issues', this.issueCount, isDe ? 'Stk.' : 'items'],
          [],
          [isDe ? 'BELEGTE MODULE' : 'PLACED MODULE SCHEDULE'],
          isDe
            ? ['#', 'Modul-ID', 'Position X (m)', 'Position Y (m)', 'Ausrichtung', 'Drehung (Grad)', 'Leistung (Wp)', 'Status']
            : ['#', 'Module ID', 'Position X (m)', 'Position Y (m)', 'Orientation', 'Rotation (deg)', 'Power (Wp)', 'Status']
        ];

        this.modules.forEach((m, idx) => {
          const isLandscape = m.rotation === 90 || m.rotation === 270;
          rows.push([
            idx + 1,
            m.id,
            Number(m.x).toFixed(3),
            Number(m.y).toFixed(3),
            isLandscape ? (isDe ? 'Quer' : 'Landscape') : (isDe ? 'Hochkant' : 'Portrait'),
            m.rotation,
            this.module.power,
            this.getModuleStatus(m)
          ]);
        });

        if (this.walkway.customCorridors && this.walkway.customCorridors.length > 0) {
          rows.push([]);
          rows.push([isDe ? 'BENUTZERDEFINIERTE WARTUNGSGÄNGE' : 'CUSTOM MAINTENANCE WALKWAYS']);
          rows.push(isDe
            ? ['#', 'ID', 'Position X (m)', 'Position Y (m)', 'Breite (m)', 'Länge / Höhe (m)', 'Richtung']
            : ['#', 'ID', 'Position X (m)', 'Position Y (m)', 'Width (m)', 'Length / Height (m)', 'Direction']
          );
          this.walkway.customCorridors.forEach((w, idx) => {
            rows.push([
              idx + 1,
              w.id,
              Number(w.x).toFixed(3),
              Number(w.y).toFixed(3),
              Number(w.width).toFixed(3),
              Number(w.height).toFixed(3),
              w.direction
            ]);
          });
        }

        if (this.obstacles && this.obstacles.length > 0) {
          rows.push([]);
          rows.push([isDe ? 'DACHAUFBAUTEN & HINDERNISSE' : 'ROOF OBSTACLES & PENETRATIONS', isDe ? 'WERT' : 'VALUE', isDe ? 'EINHEIT' : 'UNIT']);
          rows.push([isDe ? 'Anzahl Aufbauten' : 'Total Obstacles Placed', this.obstacles.length, isDe ? 'Stk.' : 'pcs']);
          this.obstacles.forEach((obs, idx) => {
            rows.push([
              `#${idx + 1} ${obs.type === 'skylight' ? (isDe ? 'Lichtkuppel/Fenster' : 'Skylight/Window') : (isDe ? 'Kamin' : 'Chimney')}: ${obs.name || ''}`,
              `${Number(obs.width).toFixed(2)}m × ${Number(obs.length).toFixed(2)}m (X: ${Number(obs.x).toFixed(2)}m, Y: ${Number(obs.y).toFixed(2)}m, Buffer: ${(obs.clearance !== undefined ? Number(obs.clearance) : 0.3).toFixed(2)}m)`,
              ''
            ]);
          });
        }

        // Use UTF-8 Byte Order Mark (BOM) so Excel and spreadsheet apps correctly parse accents and characters
        const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCSV).join(',')).join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const filename = `solarrooffit_bom_${this.roof.width}x${this.roof.length}m_${this.modules.length}mods.csv`;
        downloadBlob(blob, filename);
        this.showToast(this.t('toastExportBOM'));
      } catch (err) {
        console.error('Failed to export BOM CSV:', err);
        this.showToast('BOM export error: ' + err.message, 'error');
      }
    }
  }));
});
