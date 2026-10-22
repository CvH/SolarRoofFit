/**
 * SVG Canvas Manager: Pan, Zoom, Coordinate Systems & Drag Interaction
 */

import { snapToGrid, calculateSmartSnap } from './layout.js?v=12';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class SvgCanvasManager {
  constructor(svgElement, getAppState, updateAppState) {
    this.svg = svgElement;
    this.getAppState = getAppState;
    this.updateAppState = updateAppState;

    // ViewBox state in meters
    this.viewBox = {
      x: -1,
      y: -1,
      width: 14,
      height: 10
    };

    // Interaction states
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.viewBoxStart = { ...this.viewBox };

    this.dragState = null;
    this.initListeners();
  }

  /**
   * Convert client viewport coordinates (pixels) to canvas metric coordinates (meters)
   */
  clientToMeters(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    const meterX = this.viewBox.x + (normX * this.viewBox.width);
    const meterY = this.viewBox.y + (normY * this.viewBox.height);

    return { x: meterX, y: meterY };
  }

  /**
   * Recalculates and animates viewBox to frame the roof nicely with padding.
   */
  fitToRoof(roofWidth, roofLength, animate = true) {
    const paddingX = Math.max(1.0, roofWidth * 0.15);
    const paddingY = Math.max(1.0, roofLength * 0.15);

    const target = {
      x: -paddingX,
      y: -paddingY,
      width: roofWidth + (2 * paddingX),
      height: roofLength + (2 * paddingY)
    };

    this.viewBox = target;
    this.applyViewBox();
  }

  applyViewBox() {
    this.svg.setAttribute(
      'viewBox',
      `${this.viewBox.x.toFixed(4)} ${this.viewBox.y.toFixed(4)} ${this.viewBox.width.toFixed(4)} ${this.viewBox.height.toFixed(4)}`
    );
  }

  /**
   * Zooms in or out centered at a specific focal point in meters.
   */
  zoomAtPoint(focalMeters, zoomRatio) {
    const minSpan = 2.0;    // max zoom in (2 meters wide)
    const maxSpan = 150.0;  // max zoom out (150 meters wide)

    let newWidth = this.viewBox.width * zoomRatio;
    let newHeight = this.viewBox.height * zoomRatio;

    if (newWidth < minSpan) {
      newWidth = minSpan;
      newHeight = minSpan * (this.viewBox.height / this.viewBox.width);
    } else if (newWidth > maxSpan) {
      newWidth = maxSpan;
      newHeight = maxSpan * (this.viewBox.height / this.viewBox.width);
    }

    const relX = (focalMeters.x - this.viewBox.x) / this.viewBox.width;
    const relY = (focalMeters.y - this.viewBox.y) / this.viewBox.height;

    this.viewBox.x = focalMeters.x - (relX * newWidth);
    this.viewBox.y = focalMeters.y - (relY * newHeight);
    this.viewBox.width = newWidth;
    this.viewBox.height = newHeight;

    this.applyViewBox();
  }

  zoomBy(factor) {
    const centerMeters = {
      x: this.viewBox.x + (this.viewBox.width / 2),
      y: this.viewBox.y + (this.viewBox.height / 2)
    };
    this.zoomAtPoint(centerMeters, factor);
  }

  initListeners() {
    // Wheel zoom
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const focalMeters = this.clientToMeters(e.clientX, e.clientY);
      const zoomRatio = e.deltaY > 0 ? 1.12 : 0.89;
      this.zoomAtPoint(focalMeters, zoomRatio);
    }, { passive: false });

    // Background Pan on middle-click or background drag
    this.svg.addEventListener('pointerdown', (e) => {
      // If clicking directly on svg background or grid layer
      const isBg = e.target === this.svg ||
                   e.target.id === 'canvas-bg' ||
                   e.target.id === 'roof-surface' ||
                   e.target.classList.contains('canvas-background-layer');

      if (e.button === 1 || (e.button === 0 && isBg)) {
        this.isPanning = true;
        this.panStart = { x: e.clientX, y: e.clientY };
        this.viewBoxStart = { ...this.viewBox };
        this.svg.setPointerCapture(e.pointerId);
        this.svg.style.cursor = 'grabbing';
      }
    });

    this.svg.addEventListener('pointermove', (e) => {
      if (this.isPanning) {
        const rect = this.svg.getBoundingClientRect();
        const deltaPxX = e.clientX - this.panStart.x;
        const deltaPxY = e.clientY - this.panStart.y;

        const deltaMetersX = (deltaPxX / rect.width) * this.viewBoxStart.width;
        const deltaMetersY = (deltaPxY / rect.height) * this.viewBoxStart.height;

        this.viewBox.x = this.viewBoxStart.x - deltaMetersX;
        this.viewBox.y = this.viewBoxStart.y - deltaMetersY;
        this.applyViewBox();
        return;
      }

      // Handle active module dragging
      if (this.dragState) {
        this.handleModuleDragMove(e);
      }
    });

    const endPanOrDrag = (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        try { this.svg.releasePointerCapture(e.pointerId); } catch (_) {}
        this.svg.style.cursor = '';
      }
      if (this.dragState) {
        this.handleModuleDragEnd(e);
      }
    };

    this.svg.addEventListener('pointerup', endPanOrDrag);
    this.svg.addEventListener('pointercancel', endPanOrDrag);
  }

  /**
   * Starts drag-and-drop session for a clicked PV module
   */
  startModuleDrag(moduleItem, event) {
    event.stopPropagation();
    event.preventDefault();

    const appState = this.getAppState();
    const pointerMeters = this.clientToMeters(event.clientX, event.clientY);

    // If module not selected and no Shift key, make it the sole selection
    const isAlreadySelected = appState.selectedIds.includes(moduleItem.id);
    if (!isAlreadySelected && !event.shiftKey) {
      this.updateAppState({ selectedIds: [moduleItem.id] });
    } else if (!isAlreadySelected && event.shiftKey) {
      this.updateAppState({ selectedIds: [...appState.selectedIds, moduleItem.id] });
    }

    const currentSelected = this.getAppState().selectedIds;

    // Snapshot start positions of all currently selected modules
    const initialPositions = {};
    appState.modules.forEach(m => {
      if (currentSelected.includes(m.id)) {
        initialPositions[m.id] = { x: m.x, y: m.y };
      }
    });

    this.dragState = {
      pointerId: event.pointerId,
      primaryId: moduleItem.id,
      startPointerMeters: pointerMeters,
      initialPositions,
      hasMoved: false,
      effectiveDeltaX: 0,
      effectiveDeltaY: 0
    };

    try {
      this.svg.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  handleModuleDragMove(event) {
    if (!this.dragState) return;

    const currentPointer = this.clientToMeters(event.clientX, event.clientY);
    const deltaX = currentPointer.x - this.dragState.startPointerMeters.x;
    const deltaY = currentPointer.y - this.dragState.startPointerMeters.y;

    if (Math.hypot(deltaX, deltaY) > 0.02) {
      this.dragState.hasMoved = true;
    }

    const appState = this.getAppState();
    const primaryInit = this.dragState.initialPositions[this.dragState.primaryId];
    if (!primaryInit) return;

    const rawTargetX = primaryInit.x + deltaX;
    const rawTargetY = primaryInit.y + deltaY;

    // Find the primary module currently being dragged
    const primaryMod = (appState.modules || []).find(m => m.id === this.dragState.primaryId);

    // Smart magnetic snap to neighbor edges & clamp gaps, or fallback to raster grid
    const snapResult = calculateSmartSnap(
      primaryMod,
      { x: rawTargetX, y: rawTargetY },
      appState.modules || [],
      appState.selectedIds || [this.dragState.primaryId],
      appState.module || {},
      appState.grid || {},
      event.altKey // Hold Alt key to temporarily bypass all snapping
    );

    const effectiveDeltaX = snapResult.x - primaryInit.x;
    const effectiveDeltaY = snapResult.y - primaryInit.y;

    this.dragState.effectiveDeltaX = effectiveDeltaX;
    this.dragState.effectiveDeltaY = effectiveDeltaY;

    // Render visual snap guide lines
    this.renderSnapGuides(snapResult.guides);

    // Direct DOM transform updates for 60fps buttery smooth dragging
    for (const [id, init] of Object.entries(this.dragState.initialPositions)) {
      const gEl = this.svg.querySelector(`g.pv-module-group[data-id="${id}"]`);
      if (gEl) {
        const curX = Number((init.x + effectiveDeltaX).toFixed(4));
        const curY = Number((init.y + effectiveDeltaY).toFixed(4));
        gEl.setAttribute('transform', `translate(${curX}, ${curY})`);
      }
    }
  }

  handleModuleDragEnd(event) {
    if (!this.dragState) return;

    try {
      this.svg.releasePointerCapture(event.pointerId);
    } catch (_) {}

    const moved = this.dragState.hasMoved;
    const effectiveDeltaX = this.dragState.effectiveDeltaX || 0;
    const effectiveDeltaY = this.dragState.effectiveDeltaY || 0;
    const initialPositions = this.dragState.initialPositions;

    this.dragState = null;
    this.renderSnapGuides([]);

    if (moved && (Math.abs(effectiveDeltaX) > 0.001 || Math.abs(effectiveDeltaY) > 0.001)) {
      const appState = this.getAppState();
      const updatedModules = appState.modules.map(m => {
        const init = initialPositions[m.id];
        if (init) {
          return {
            ...m,
            x: Number((init.x + effectiveDeltaX).toFixed(4)),
            y: Number((init.y + effectiveDeltaY).toFixed(4))
          };
        }
        return m;
      });

      this.updateAppState({ modules: updatedModules });

      if (this.onDragComplete) {
        this.onDragComplete();
      }
    }
  }

  /**
   * Directly render modules to the SVG layer, avoiding namespace and template scoping issues
   */
  renderModules(modules, moduleConfig, selectedIds, getStatusFn, callbacks) {
    const layer = this.svg.querySelector('#modules-layer');
    if (!layer) return;

    layer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const modW = (moduleConfig.width || 1134) / 1000;
    const modH = (moduleConfig.height || 1762) / 1000;

    modules.forEach(mod => {
      const g = document.createElementNS(SVG_NS, 'g');
      const status = getStatusFn ? getStatusFn(mod) : 'ok';
      const isSelected = selectedIds.includes(mod.id);

      const classList = ['pv-module-group'];
      if (isSelected) classList.push('selected');
      if (status === 'warning_setback') classList.push('warning');
      if (status === 'collision') classList.push('collision');
      if (status === 'error_roof') classList.push('error_roof');
      g.setAttribute('class', classList.join(' '));
      g.setAttribute('transform', `translate(${mod.x}, ${mod.y})`);
      g.dataset.id = mod.id;

      const normRot = ((mod.rotation % 360) + 360) % 360;
      const isLandscape = normRot === 90 || normRot === 270;
      const w = isLandscape ? modH : modW;
      const h = isLandscape ? modW : modH;

      // Outer frame
      const frame = document.createElementNS(SVG_NS, 'rect');
      frame.setAttribute('class', 'pv-module-frame');
      frame.setAttribute('x', '0');
      frame.setAttribute('y', '0');
      frame.setAttribute('width', w.toFixed(4));
      frame.setAttribute('height', h.toFixed(4));
      g.appendChild(frame);

      // Monocrystalline cell texture
      const cell = document.createElementNS(SVG_NS, 'rect');
      cell.setAttribute('class', 'pv-cell-rect');
      cell.setAttribute('x', '0.015');
      cell.setAttribute('y', '0.015');
      cell.setAttribute('width', Math.max(0.01, w - 0.03).toFixed(4));
      cell.setAttribute('height', Math.max(0.01, h - 0.03).toFixed(4));
      cell.setAttribute('rx', '0.005');
      g.appendChild(cell);

      // Half-cut cell line
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('class', 'pv-busbar-line');
      if (isLandscape) {
        line.setAttribute('x1', (w / 2).toFixed(4));
        line.setAttribute('y1', '0.015');
        line.setAttribute('x2', (w / 2).toFixed(4));
        line.setAttribute('y2', (h - 0.015).toFixed(4));
      } else {
        line.setAttribute('x1', '0.015');
        line.setAttribute('y1', (h / 2).toFixed(4));
        line.setAttribute('x2', (w - 0.015).toFixed(4));
        line.setAttribute('y2', (h / 2).toFixed(4));
      }
      line.setAttribute('stroke-width', '0.008');
      g.appendChild(line);

      // Junction box indicator
      const junction = document.createElementNS(SVG_NS, 'circle');
      junction.setAttribute('class', 'pv-junction-indicator');
      junction.setAttribute('cx', (w / 2).toFixed(4));
      junction.setAttribute('cy', '0.035');
      junction.setAttribute('r', '0.018');
      g.appendChild(junction);

      // Power text label
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', (w / 2).toFixed(4));
      text.setAttribute('y', (h / 2).toFixed(4));
      text.setAttribute('fill', '#94A3B8');
      text.setAttribute('opacity', '0.85');
      text.setAttribute('font-family', "'JetBrains Mono', monospace");
      text.setAttribute('font-size', '0.14');
      text.setAttribute('font-weight', '600');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('style', 'pointer-events: none;');
      text.textContent = (moduleConfig.power || 430) + 'W';
      g.appendChild(text);

      // Pointer drag & click listeners
      g.addEventListener('pointerdown', (e) => {
        if (callbacks && callbacks.onPointerDown) {
          callbacks.onPointerDown(mod, e);
        }
      });

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks && callbacks.onClick) {
          callbacks.onClick(mod, e);
        }
      });

      fragment.appendChild(g);
    });

    layer.appendChild(fragment);
  }

  /**
   * Renders maintenance walk space corridors onto the SVG canvas
   */
  renderWalkways(walkways = []) {
    const layer = this.svg.querySelector('#walkways-layer');
    if (!layer) return;

    layer.innerHTML = '';
    if (!walkways || walkways.length === 0) return;

    const fragment = document.createDocumentFragment();

    walkways.forEach(w => {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'walkway-group');

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'walkway-corridor');
      rect.setAttribute('x', w.x.toFixed(4));
      rect.setAttribute('y', w.y.toFixed(4));
      rect.setAttribute('width', w.width.toFixed(4));
      rect.setAttribute('height', w.height.toFixed(4));
      g.appendChild(rect);

      // Walkway dashed centerline
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('class', 'walkway-centerline');
      if (w.direction === 'vertical') {
        const midX = w.x + w.width / 2;
        line.setAttribute('x1', midX.toFixed(4));
        line.setAttribute('y1', w.y.toFixed(4));
        line.setAttribute('x2', midX.toFixed(4));
        line.setAttribute('y2', (w.y + w.height).toFixed(4));
      } else {
        const midY = w.y + w.height / 2;
        line.setAttribute('x1', w.x.toFixed(4));
        line.setAttribute('y1', midY.toFixed(4));
        line.setAttribute('x2', (w.x + w.width).toFixed(4));
        line.setAttribute('y2', midY.toFixed(4));
      }
      g.appendChild(line);

      // Walkway text annotation
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'walkway-annotation');
      text.setAttribute('x', (w.x + w.width / 2).toFixed(4));
      text.setAttribute('y', (w.y + w.height / 2).toFixed(4));
      const spanDim = w.direction === 'vertical' ? w.width : w.height;
      text.textContent = `Walk Space (${spanDim.toFixed(2)}m)`;
      g.appendChild(text);

      fragment.appendChild(g);
    });

    layer.appendChild(fragment);
  }

  /**
   * Renders CAD magnetic snap alignment guide lines during module dragging
   */
  renderSnapGuides(guides = []) {
    const layer = this.svg.querySelector('#snap-guides-layer');
    if (!layer) return;

    layer.innerHTML = '';
    if (!guides || guides.length === 0) return;

    const fragment = document.createDocumentFragment();

    guides.forEach(g => {
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('class', 'snap-guide-group');

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('class', `snap-guide-line snap-${g.type}-line`);

      if (g.axis === 'x') {
        line.setAttribute('x1', g.pos.toFixed(4));
        line.setAttribute('y1', (g.y1 - 0.25).toFixed(4));
        line.setAttribute('x2', g.pos.toFixed(4));
        line.setAttribute('y2', (g.y2 + 0.25).toFixed(4));
      } else {
        line.setAttribute('x1', (g.x1 - 0.25).toFixed(4));
        line.setAttribute('y1', g.pos.toFixed(4));
        line.setAttribute('x2', (g.x2 + 0.25).toFixed(4));
        line.setAttribute('y2', g.pos.toFixed(4));
      }
      group.appendChild(line);

      // Label indicator text
      if (g.label) {
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('class', 'snap-guide-text');
        if (g.axis === 'x') {
          text.setAttribute('x', g.pos.toFixed(4));
          text.setAttribute('y', (g.y1 - 0.12).toFixed(4));
        } else {
          text.setAttribute('x', (g.x1 - 0.15).toFixed(4));
          text.setAttribute('y', (g.pos - 0.08).toFixed(4));
        }
        text.textContent = g.label;
        group.appendChild(text);
      }

      fragment.appendChild(group);
    });

    layer.appendChild(fragment);
  }
}


