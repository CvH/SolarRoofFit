/**
 * Solar PV Layout and Geometry Math Engine
 */

/**
 * Snaps a metric value to the nearest raster grid step.
 * Uses integer rounding to eliminate floating point imprecision.
 */
export function snapToGrid(value, step) {
  if (!step || step <= 0) return value;
  const inv = 1 / step;
  const snapped = Math.round(value * inv) / inv;
  return Number(snapped.toFixed(4));
}

/**
 * Returns module dimensions in meters based on its rotation.
 * 0° / 180° = Portrait (W x H)
 * 90° / 270° = Landscape (H x W)
 */
export function getRotatedDimensions(moduleConfig, rotation = 0) {
  const normRot = ((rotation % 360) + 360) % 360;
  const w = (moduleConfig.width || 1134) / 1000;
  const h = (moduleConfig.height || 1762) / 1000;

  if (normRot === 90 || normRot === 270) {
    return { width: h, height: w, isLandscape: true };
  }
  return { width: w, height: h, isLandscape: false };
}

/**
 * Computes bounding rectangle of a module in meters.
 */
export function getModuleBounds(mod, moduleConfig) {
  const dims = getRotatedDimensions(moduleConfig, mod.rotation || 0);
  return {
    id: mod.id,
    x: mod.x,
    y: mod.y,
    width: dims.width,
    height: dims.height,
    right: mod.x + dims.width,
    bottom: mod.y + dims.height,
    isLandscape: dims.isLandscape
  };
}

/**
 * Returns safe perimeter borders (setbacks) for all 4 edges in meters.
 */
export function getRoofSetbacks(roofConfig) {
  if (roofConfig.setbackLinked !== false) {
    const s = Math.max(0, roofConfig.setback !== undefined ? roofConfig.setback : 0.5);
    return { top: s, bottom: s, left: s, right: s };
  }
  const fallback = roofConfig.setback !== undefined ? roofConfig.setback : 0.5;
  return {
    top: Math.max(0, roofConfig.setbackTop !== undefined ? roofConfig.setbackTop : fallback),
    bottom: Math.max(0, roofConfig.setbackBottom !== undefined ? roofConfig.setbackBottom : fallback),
    left: Math.max(0, roofConfig.setbackLeft !== undefined ? roofConfig.setbackLeft : fallback),
    right: Math.max(0, roofConfig.setbackRight !== undefined ? roofConfig.setbackRight : fallback)
  };
}

/**
 * Evaluates module positioning relative to roof edges and safety setback.
 * Returns: 'ok' | 'warning_setback' | 'error_roof'
 */
export function evaluateModuleBoundary(mod, moduleConfig, roofConfig) {
  const b = getModuleBounds(mod, moduleConfig);
  const EPS = 0.005; // 5mm tolerance for floating point snapping

  // Outside outer roof perimeter
  if (
    b.x < -EPS ||
    b.y < -EPS ||
    b.right > roofConfig.width + EPS ||
    b.bottom > roofConfig.length + EPS
  ) {
    return 'error_roof';
  }

  // Inside roof, but violates safety setback
  const sb = getRoofSetbacks(roofConfig);
  if (
    b.x < sb.left - EPS ||
    b.y < sb.top - EPS ||
    b.right > roofConfig.width - sb.right + EPS ||
    b.bottom > roofConfig.length - sb.bottom + EPS
  ) {
    return 'warning_setback';
  }

  return 'ok';
}

/**
 * Detects overlapping modules among all placed modules.
 * Returns a Set of module IDs that are colliding.
 */
export function detectCollisions(modules, moduleConfig) {
  const collidingIds = new Set();
  const bounds = modules.map(m => getModuleBounds(m, moduleConfig));
  const EPS = 0.005; // 5mm overlap threshold to ignore touching borders

  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i];
      const b = bounds[j];

      const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);

      if (overlapX > EPS && overlapY > EPS) {
        collidingIds.add(a.id);
        collidingIds.add(b.id);
      }
    }
  }

  return collidingIds;
}

/**
 * Calculates optimal spacing, offsets, and walkway insertions along one axis.
 */
export function computeDimensionLayout(availableSpan, modSpan, baseGap, hasWalkways, interval, walkWidth) {
  if (availableSpan < modSpan) return { count: 0, totalSpan: 0, offsets: [], walkways: [] };

  let count = 0;
  const offsets = [];
  const walkways = [];
  let curOffset = 0;

  while (true) {
    const nextIndex = count;
    let addedSpace = 0;
    let isWalkway = false;
    let walkStart = 0;

    if (nextIndex > 0) {
      if (hasWalkways && nextIndex % interval === 0) {
        addedSpace = walkWidth;
        isWalkway = true;
        walkStart = curOffset;
      } else {
        addedSpace = baseGap;
      }
    }

    const testOffset = nextIndex === 0 ? 0 : curOffset + addedSpace;
    const testTotal = testOffset + modSpan;

    if (testTotal <= availableSpan + 0.0001) {
      if (isWalkway) {
        walkways.push({ start: Number(walkStart.toFixed(4)), width: walkWidth });
      }
      offsets.push(Number(testOffset.toFixed(4)));
      curOffset = testOffset + modSpan;
      count++;
    } else {
      break;
    }
  }

  const totalSpan = count > 0 ? Number((offsets[offsets.length - 1] + modSpan).toFixed(4)) : 0;
  return { count, totalSpan, offsets, walkways };
}

/**
 * Calculates optimal 2D grid layout to maximize modules on the flat roof.
 * Respects 4-sided setbacks, clamp gaps, maintenance walkways, and raster alignment.
 */
export function calculateAutoFill(roofConfig, moduleConfig, orientationMode = 'optimal', gridStep = 0.1, walkwayConfig = null) {
  const sb = getRoofSetbacks(roofConfig);
  const usableWidth = roofConfig.width - sb.left - sb.right;
  const usableLength = roofConfig.length - sb.top - sb.bottom;

  if (usableWidth <= 0 || usableLength <= 0) {
    return { modules: [], walkways: [], modeUsed: orientationMode, count: 0, summary: 'No usable area' };
  }

  const gapX = ((moduleConfig.gapX !== undefined ? moduleConfig.gapX : 20) / 1000); // meters
  const gapY = ((moduleConfig.gapY !== undefined ? moduleConfig.gapY : 20) / 1000); // meters

  const w = (moduleConfig.width || 1134) / 1000;
  const h = (moduleConfig.height || 1762) / 1000;

  const walkwayEnabled = !!walkwayConfig?.enabled;
  const walkwayWidth = walkwayEnabled ? Math.max(0.05, walkwayConfig.width !== undefined ? Number(walkwayConfig.width) : 0.1) : 0;
  const walkwayInterval = walkwayEnabled ? Math.max(1, walkwayConfig.interval || 2) : 9999;
  const walkwayDir = walkwayConfig?.direction || 'horizontal';

  const hasHWalkways = walkwayEnabled && (walkwayDir === 'horizontal' || walkwayDir === 'both');
  const hasVWalkways = walkwayEnabled && (walkwayDir === 'vertical' || walkwayDir === 'both');

  /**
   * Generates a uniform block of modules in a designated rectangular region.
   */
  const generateBlock = (originX, originY, availW, availH, modW, modH, rot, vWalk, hWalk) => {
    if (availW < modW || availH < modH) {
      return { count: 0, modules: [], walkways: [], totalSpanX: 0, totalSpanY: 0, cols: 0, rows: 0 };
    }
    const colLayout = computeDimensionLayout(availW, modW, gapX, vWalk, walkwayInterval, walkwayWidth);
    const rowLayout = computeDimensionLayout(availH, modH, gapY, hWalk, walkwayInterval, walkwayWidth);

    const blockMods = [];
    for (let r = 0; r < rowLayout.count; r++) {
      for (let c = 0; c < colLayout.count; c++) {
        blockMods.push({
          x: originX + colLayout.offsets[c],
          y: originY + rowLayout.offsets[r],
          rotation: rot
        });
      }
    }

    const blockWalkways = [];
    if (hWalk) {
      rowLayout.walkways.forEach(wk => {
        blockWalkways.push({
          x: originX,
          y: originY + wk.start,
          width: colLayout.totalSpan,
          height: wk.width,
          direction: 'horizontal'
        });
      });
    }
    if (vWalk) {
      colLayout.walkways.forEach(wk => {
        blockWalkways.push({
          x: originX + wk.start,
          y: originY,
          width: wk.width,
          height: rowLayout.totalSpan,
          direction: 'vertical'
        });
      });
    }

    return {
      count: blockMods.length,
      modules: blockMods,
      walkways: blockWalkways,
      totalSpanX: colLayout.totalSpan,
      totalSpanY: rowLayout.totalSpan,
      cols: colLayout.count,
      rows: rowLayout.count,
      colLayout,
      rowLayout
    };
  };

  // Pure Baselines across the entire usable roof
  const purePort = generateBlock(0, 0, usableWidth, usableLength, w, h, 0, hasVWalkways, hasHWalkways);
  const candPurePortrait = {
    type: 'pure',
    modeUsed: 'portrait',
    summary: `${purePort.count} portrait`,
    count: purePort.count,
    modules: purePort.modules,
    walkways: purePort.walkways
  };

  const pureLand = generateBlock(0, 0, usableWidth, usableLength, h, w, 90, hasVWalkways, hasHWalkways);
  const candPureLandscape = {
    type: 'pure',
    modeUsed: 'landscape',
    summary: `${pureLand.count} landscape`,
    count: pureLand.count,
    modules: pureLand.modules,
    walkways: pureLand.walkways
  };

  /**
   * Finalizes coordinates, centers the entire layout within safe setbacks, and snaps to grid.
   */
  const finalizeCandidate = (winner) => {
    if (!winner || winner.count <= 0) {
      return { modules: [], walkways: [], modeUsed: orientationMode, count: 0, summary: 'No modules fit' };
    }

    const mods = winner.modules;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    mods.forEach(m => {
      const isL = m.rotation === 90;
      const mw = isL ? h : w;
      const mh = isL ? w : h;
      if (m.x < minX) minX = m.x;
      if (m.x + mw > maxX) maxX = m.x + mw;
      if (m.y < minY) minY = m.y;
      if (m.y + mh > maxY) maxY = m.y + mh;
    });

    const spanX = maxX - minX;
    const spanY = maxY - minY;

    let startX = sb.left + ((usableWidth - spanX) / 2);
    let startY = sb.top + ((usableLength - spanY) / 2);

    startX = snapToGrid(startX, gridStep);
    startY = snapToGrid(startY, gridStep);

    if (startX < sb.left) startX = sb.left;
    if (startY < sb.top) startY = sb.top;
    if (startX + spanX > roofConfig.width - sb.right) {
      startX = Math.max(sb.left, roofConfig.width - sb.right - spanX);
    }
    if (startY + spanY > roofConfig.length - sb.bottom) {
      startY = Math.max(sb.top, roofConfig.length - sb.bottom - spanY);
    }

    const deltaX = startX - minX;
    const deltaY = startY - minY;

    let idCounter = 1;
    const timestamp = Date.now();

    const finalizedModules = mods.map(m => ({
      id: `pv-${timestamp}-${idCounter++}`,
      x: Number((m.x + deltaX).toFixed(4)),
      y: Number((m.y + deltaY).toFixed(4)),
      rotation: m.rotation,
      selected: false
    }));

    const finalizedWalkways = (winner.walkways || []).map(wk => ({
      x: Number((wk.x + deltaX).toFixed(4)),
      y: Number((wk.y + deltaY).toFixed(4)),
      width: Number(wk.width.toFixed(4)),
      height: Number(wk.height.toFixed(4)),
      direction: wk.direction
    }));

    return {
      modules: finalizedModules,
      walkways: finalizedWalkways,
      modeUsed: winner.modeUsed,
      summary: winner.summary,
      count: finalizedModules.length
    };
  };

  // If user explicitly picked portrait or landscape, return pure candidate
  if (orientationMode === 'portrait') {
    return finalizeCandidate(candPurePortrait);
  }
  if (orientationMode === 'landscape') {
    return finalizeCandidate(candPureLandscape);
  }

  // If user requested best with same alignment (uniform orientation across all panels)
  if (orientationMode === 'same' || orientationMode === 'uniform') {
    const bestPure = candPureLandscape.count >= candPurePortrait.count ? candPureLandscape : candPurePortrait;
    return finalizeCandidate({
      ...bestPure,
      modeUsed: 'same',
      summary: `${bestPure.count} ${bestPure.modeUsed} (same alignment)`
    });
  }

  // --- "Auto (Best)" Optimal / Mixed Mode: Explore Pure AND Mixed Orientations ---
  const candidates = [candPurePortrait, candPureLandscape];

  // Strategy 1: Horizontal Guillotine Splits (Top Block + Bottom Block)
  // Top Portrait (r1 rows) + Bottom Landscape (fill remainder)
  for (let r1 = 1; r1 < purePort.rows; r1++) {
    const hTop = purePort.rowLayout.offsets[r1 - 1] + h;
    const topBlock = generateBlock(0, 0, usableWidth, hTop, w, h, 0, hasVWalkways, hasHWalkways);
    const remH = usableLength - (hTop + gapY);
    if (remH >= w) {
      const bottomBlock = generateBlock(0, hTop + gapY, usableWidth, remH, h, w, 90, hasVWalkways, hasHWalkways);
      if (bottomBlock.count > 0) {
        candidates.push({
          type: 'mixed',
          modeUsed: 'mixed',
          summary: `${topBlock.count} portrait + ${bottomBlock.count} landscape (mixed)`,
          count: topBlock.count + bottomBlock.count,
          modules: [...topBlock.modules, ...bottomBlock.modules],
          walkways: [...topBlock.walkways, ...bottomBlock.walkways]
        });
      }
    }
  }

  // Top Landscape (r1 rows) + Bottom Portrait (fill remainder)
  for (let r1 = 1; r1 < pureLand.rows; r1++) {
    const hTop = pureLand.rowLayout.offsets[r1 - 1] + w;
    const topBlock = generateBlock(0, 0, usableWidth, hTop, h, w, 90, hasVWalkways, hasHWalkways);
    const remH = usableLength - (hTop + gapY);
    if (remH >= h) {
      const bottomBlock = generateBlock(0, hTop + gapY, usableWidth, remH, w, h, 0, hasVWalkways, hasHWalkways);
      if (bottomBlock.count > 0) {
        candidates.push({
          type: 'mixed',
          modeUsed: 'mixed',
          summary: `${topBlock.count} landscape + ${bottomBlock.count} portrait (mixed)`,
          count: topBlock.count + bottomBlock.count,
          modules: [...topBlock.modules, ...bottomBlock.modules],
          walkways: [...topBlock.walkways, ...bottomBlock.walkways]
        });
      }
    }
  }

  // Strategy 2: Vertical Guillotine Splits (Left Block + Right Block)
  // Left Portrait (c1 cols) + Right Landscape (fill remainder)
  for (let c1 = 1; c1 < purePort.cols; c1++) {
    const wLeft = purePort.colLayout.offsets[c1 - 1] + w;
    const leftBlock = generateBlock(0, 0, wLeft, usableLength, w, h, 0, hasVWalkways, hasHWalkways);
    const remW = usableWidth - (wLeft + gapX);
    if (remW >= h) {
      const rightBlock = generateBlock(wLeft + gapX, 0, remW, usableLength, h, w, 90, hasVWalkways, hasHWalkways);
      if (rightBlock.count > 0) {
        candidates.push({
          type: 'mixed',
          modeUsed: 'mixed',
          summary: `${leftBlock.count} portrait + ${rightBlock.count} landscape (mixed)`,
          count: leftBlock.count + rightBlock.count,
          modules: [...leftBlock.modules, ...rightBlock.modules],
          walkways: [...leftBlock.walkways, ...rightBlock.walkways]
        });
      }
    }
  }

  // Left Landscape (c1 cols) + Right Portrait (fill remainder)
  for (let c1 = 1; c1 < pureLand.cols; c1++) {
    const wLeft = pureLand.colLayout.offsets[c1 - 1] + h;
    const leftBlock = generateBlock(0, 0, wLeft, usableLength, h, w, 90, hasVWalkways, hasHWalkways);
    const remW = usableWidth - (wLeft + gapX);
    if (remW >= w) {
      const rightBlock = generateBlock(wLeft + gapX, 0, remW, usableLength, w, h, 0, hasVWalkways, hasHWalkways);
      if (rightBlock.count > 0) {
        candidates.push({
          type: 'mixed',
          modeUsed: 'mixed',
          summary: `${leftBlock.count} landscape + ${rightBlock.count} portrait (mixed)`,
          count: leftBlock.count + rightBlock.count,
          modules: [...leftBlock.modules, ...rightBlock.modules],
          walkways: [...leftBlock.walkways, ...rightBlock.walkways]
        });
      }
    }
  }

  // Strategy 3: Corner / L-Shape Residual Packing
  // Main Landscape + Right Strip Portrait + Bottom Strip Portrait
  if (pureLand.count > 0) {
    const remW = usableWidth - (pureLand.totalSpanX + gapX);
    const remH = usableLength - (pureLand.totalSpanY + gapY);

    // Variation A: Right strip full height, Bottom strip under main block
    const rightStripA = remW >= w ? generateBlock(pureLand.totalSpanX + gapX, 0, remW, usableLength, w, h, 0, false, false) : null;
    const bottomStripA = remH >= h ? generateBlock(0, pureLand.totalSpanY + gapY, pureLand.totalSpanX, remH, w, h, 0, false, false) : null;
    const extraA = (rightStripA?.count || 0) + (bottomStripA?.count || 0);
    if (extraA > 0) {
      candidates.push({
        type: 'mixed',
        modeUsed: 'mixed',
        summary: `${pureLand.count} landscape + ${extraA} portrait (mixed)`,
        count: pureLand.count + extraA,
        modules: [...pureLand.modules, ...(rightStripA?.modules || []), ...(bottomStripA?.modules || [])],
        walkways: pureLand.walkways
      });
    }

    // Variation B: Bottom strip full width, Right strip above bottom strip
    const bottomStripB = remH >= h ? generateBlock(0, pureLand.totalSpanY + gapY, usableWidth, remH, w, h, 0, false, false) : null;
    const rightStripB = remW >= w ? generateBlock(pureLand.totalSpanX + gapX, 0, remW, pureLand.totalSpanY, w, h, 0, false, false) : null;
    const extraB = (rightStripB?.count || 0) + (bottomStripB?.count || 0);
    if (extraB > 0) {
      candidates.push({
        type: 'mixed',
        modeUsed: 'mixed',
        summary: `${pureLand.count} landscape + ${extraB} portrait (mixed)`,
        count: pureLand.count + extraB,
        modules: [...pureLand.modules, ...(rightStripB?.modules || []), ...(bottomStripB?.modules || [])],
        walkways: pureLand.walkways
      });
    }
  }

  // Main Portrait + Right Strip Landscape + Bottom Strip Landscape
  if (purePort.count > 0) {
    const remW = usableWidth - (purePort.totalSpanX + gapX);
    const remH = usableLength - (purePort.totalSpanY + gapY);

    // Variation A: Right strip full height, Bottom strip under main block
    const rightStripA = remW >= h ? generateBlock(purePort.totalSpanX + gapX, 0, remW, usableLength, h, w, 90, false, false) : null;
    const bottomStripA = remH >= w ? generateBlock(0, purePort.totalSpanY + gapY, purePort.totalSpanX, remH, h, w, 90, false, false) : null;
    const extraA = (rightStripA?.count || 0) + (bottomStripA?.count || 0);
    if (extraA > 0) {
      candidates.push({
        type: 'mixed',
        modeUsed: 'mixed',
        summary: `${purePort.count} portrait + ${extraA} landscape (mixed)`,
        count: purePort.count + extraA,
        modules: [...purePort.modules, ...(rightStripA?.modules || []), ...(bottomStripA?.modules || [])],
        walkways: purePort.walkways
      });
    }

    // Variation B: Bottom strip full width, Right strip above bottom strip
    const bottomStripB = remH >= w ? generateBlock(0, purePort.totalSpanY + gapY, usableWidth, remH, h, w, 90, false, false) : null;
    const rightStripB = remW >= h ? generateBlock(purePort.totalSpanX + gapX, 0, remW, purePort.totalSpanY, h, w, 90, false, false) : null;
    const extraB = (rightStripB?.count || 0) + (bottomStripB?.count || 0);
    if (extraB > 0) {
      candidates.push({
        type: 'mixed',
        modeUsed: 'mixed',
        summary: `${purePort.count} portrait + ${extraB} landscape (mixed)`,
        count: purePort.count + extraB,
        modules: [...purePort.modules, ...(rightStripB?.modules || []), ...(bottomStripB?.modules || [])],
        walkways: purePort.walkways
      });
    }
  }

  // Winner Selection:
  // Default to the better of the pure orientations
  let bestCandidate = candPureLandscape.count >= candPurePortrait.count ? candPureLandscape : candPurePortrait;
  let maxCount = bestCandidate.count;

  // If a mixed orientation achieves strictly more modules, mixed wins!
  for (const cand of candidates) {
    if (cand.count > maxCount) {
      maxCount = cand.count;
      bestCandidate = cand;
    }
  }

  return finalizeCandidate(bestCandidate);
}

/**
 * Finds a suitable free position on the roof to spawn a new module.
 */
export function findFreeSpawnPosition(existingModules, moduleConfig, roofConfig, gridStep = 0.1) {
  const sb = getRoofSetbacks(roofConfig);
  const dims = getRotatedDimensions(moduleConfig, 0);

  // Default to snapped center
  const centerX = snapToGrid((roofConfig.width - dims.width) / 2, gridStep);
  const centerY = snapToGrid((roofConfig.length - dims.height) / 2, gridStep);

  // Check if center is occupied
  const testBounds = {
    x: centerX,
    y: centerY,
    right: centerX + dims.width,
    bottom: centerY + dims.height
  };

  const occupied = existingModules.some(m => {
    const b = getModuleBounds(m, moduleConfig);
    return Math.max(testBounds.x, b.x) < Math.min(testBounds.right, b.right) &&
           Math.max(testBounds.y, b.y) < Math.min(testBounds.bottom, b.bottom);
  });

  if (!occupied) {
    return { x: centerX, y: centerY };
  }

  // Scan from top-left safe setback
  const stepX = dims.width + 0.1;
  const stepY = dims.height + 0.1;

  for (let y = sb.top; y <= roofConfig.length - sb.bottom - dims.height; y += stepY) {
    for (let x = sb.left; x <= roofConfig.width - sb.right - dims.width; x += stepX) {
      const sx = snapToGrid(x, gridStep);
      const sy = snapToGrid(y, gridStep);
      const b1 = { x: sx, y: sy, right: sx + dims.width, bottom: sy + dims.height };

      const hit = existingModules.some(m => {
        const b2 = getModuleBounds(m, moduleConfig);
        return Math.max(b1.x, b2.x) < Math.min(b1.right, b2.right) &&
               Math.max(b1.y, b2.y) < Math.min(b1.bottom, b2.bottom);
      });

      if (!hit) {
        return { x: sx, y: sy };
      }
    }
  }

  // Fallback to top-left setback
  return {
    x: snapToGrid(sb.left, gridStep),
    y: snapToGrid(sb.top, gridStep)
  };
}

/**
 * Calculates smart magnetic snapping for a moving module against stationary neighbor modules.
 * Prioritizes magnetic neighbor edge & clamp gap snapping when within proximity threshold.
 * Falls back to raster grid snapping if no neighbor is close.
 *
 * @param {Object} primaryMod - The module being dragged { id, x, y, rotation }
 * @param {Object} rawTarget - Raw target coordinates { x, y } in meters
 * @param {Array} allModules - All modules on the roof
 * @param {Array} selectedIds - IDs of modules currently moving together
 * @param {Object} moduleConfig - { width, height, gapX, gapY }
 * @param {Object} gridConfig - { enabled, step, snapToPanels }
 * @param {Boolean} bypassSnap - If true (e.g. Alt key held), bypasses all snapping
 * @returns {Object} { x, y, snappedX: boolean, snappedY: boolean, guides: Array }
 */
export function calculateSmartSnap(
  primaryMod,
  rawTarget,
  allModules = [],
  selectedIds = [],
  moduleConfig = {},
  gridConfig = {},
  bypassSnap = false
) {
  if (bypassSnap) {
    return {
      x: Number(rawTarget.x.toFixed(4)),
      y: Number(rawTarget.y.toFixed(4)),
      snappedX: false,
      snappedY: false,
      guides: []
    };
  }

  const dims = getRotatedDimensions(moduleConfig, primaryMod ? primaryMod.rotation || 0 : 0);
  const modW = dims.width;
  const modH = dims.height;

  const gapX = ((moduleConfig.gapX !== undefined ? moduleConfig.gapX : 20) / 1000); // meters
  const gapY = ((moduleConfig.gapY !== undefined ? moduleConfig.gapY : 20) / 1000); // meters

  // Filter out any modules that are part of the moving selection
  const stationary = allModules.filter(m => !selectedIds.includes(m.id));

  const snapThreshold = 0.16; // 16cm magnetic pull distance
  let bestX = null;
  let minDiffX = snapThreshold;
  let bestXGuide = null;

  let bestY = null;
  let minDiffY = snapThreshold;
  let bestYGuide = null;

  const snapToPanels = gridConfig && gridConfig.snapToPanels !== false;

  if (snapToPanels && stationary.length > 0) {
    const curTop = rawTarget.y;
    const curBottom = rawTarget.y + modH;
    const curLeft = rawTarget.x;
    const curRight = rawTarget.x + modW;

    stationary.forEach(neighbor => {
      const nBounds = getModuleBounds(neighbor, moduleConfig);

      // Check vertical proximity for horizontal alignment candidates
      const vOverlap = Math.max(0, Math.min(curBottom, nBounds.bottom) - Math.max(curTop, nBounds.y));
      const vDistance = Math.max(0, Math.max(curTop - nBounds.bottom, nBounds.y - curBottom));

      if (vOverlap > 0 || vDistance <= 0.3) {
        // X candidates:
        const xCandidates = [
          // 1. Right side of neighbor + clamp gap (e.g. 20mm)
          {
            x: nBounds.right + gapX,
            type: 'gap',
            label: `${(gapX * 1000).toFixed(0)}mm Gap`,
            guideX: nBounds.right + (gapX / 2),
            y1: Math.min(curTop, nBounds.y),
            y2: Math.max(curBottom, nBounds.bottom)
          },
          // 2. Left side of neighbor - moving width - clamp gap
          {
            x: nBounds.x - modW - gapX,
            type: 'gap',
            label: `${(gapX * 1000).toFixed(0)}mm Gap`,
            guideX: nBounds.x - (gapX / 2),
            y1: Math.min(curTop, nBounds.y),
            y2: Math.max(curBottom, nBounds.bottom)
          },
          // 3. Flush Align Left edge
          {
            x: nBounds.x,
            type: 'flush',
            label: 'Flush Left',
            guideX: nBounds.x,
            y1: Math.min(curTop, nBounds.y) - 0.15,
            y2: Math.max(curBottom, nBounds.bottom) + 0.15
          },
          // 4. Flush Align Right edge
          {
            x: nBounds.right - modW,
            type: 'flush',
            label: 'Flush Right',
            guideX: nBounds.right,
            y1: Math.min(curTop, nBounds.y) - 0.15,
            y2: Math.max(curBottom, nBounds.bottom) + 0.15
          }
        ];

        xCandidates.forEach(cand => {
          const diff = Math.abs(rawTarget.x - cand.x);
          if (diff < minDiffX) {
            minDiffX = diff;
            bestX = cand.x;
            bestXGuide = {
              axis: 'x',
              pos: cand.guideX,
              label: cand.label,
              type: cand.type,
              y1: cand.y1,
              y2: cand.y2
            };
          }
        });
      }

      // Check horizontal proximity for vertical alignment candidates
      const hOverlap = Math.max(0, Math.min(curRight, nBounds.right) - Math.max(curLeft, nBounds.x));
      const hDistance = Math.max(0, Math.max(curLeft - nBounds.right, nBounds.x - curRight));

      if (hOverlap > 0 || hDistance <= 0.3) {
        // Y candidates:
        const yCandidates = [
          // 1. Below neighbor + clamp gap (e.g. 20mm)
          {
            y: nBounds.bottom + gapY,
            type: 'gap',
            label: `${(gapY * 1000).toFixed(0)}mm Gap`,
            guideY: nBounds.bottom + (gapY / 2),
            x1: Math.min(curLeft, nBounds.x),
            x2: Math.max(curRight, nBounds.right)
          },
          // 2. Above neighbor - moving height - clamp gap
          {
            y: nBounds.y - modH - gapY,
            type: 'gap',
            label: `${(gapY * 1000).toFixed(0)}mm Gap`,
            guideY: nBounds.y - (gapY / 2),
            x1: Math.min(curLeft, nBounds.x),
            x2: Math.max(curRight, nBounds.right)
          },
          // 3. Flush Align Top edge
          {
            y: nBounds.y,
            type: 'flush',
            label: 'Flush Top',
            guideY: nBounds.y,
            x1: Math.min(curLeft, nBounds.x) - 0.15,
            x2: Math.max(curRight, nBounds.right) + 0.15
          },
          // 4. Flush Align Bottom edge
          {
            y: nBounds.bottom - modH,
            type: 'flush',
            label: 'Flush Bottom',
            guideY: nBounds.bottom,
            x1: Math.min(curLeft, nBounds.x) - 0.15,
            x2: Math.max(curRight, nBounds.right) + 0.15
          }
        ];

        yCandidates.forEach(cand => {
          const diff = Math.abs(rawTarget.y - cand.y);
          if (diff < minDiffY) {
            minDiffY = diff;
            bestY = cand.y;
            bestYGuide = {
              axis: 'y',
              pos: cand.guideY,
              label: cand.label,
              type: cand.type,
              x1: cand.x1,
              x2: cand.x2
            };
          }
        });
      }
    });
  }

  // Fallback to raster grid snapping if not snapped to neighbor
  const gridStep = gridConfig && gridConfig.step ? gridConfig.step : 0.25;
  const gridEnabled = !!(gridConfig && gridConfig.enabled);

  const finalX = bestX !== null ? bestX : (gridEnabled ? snapToGrid(rawTarget.x, gridStep) : rawTarget.x);
  const finalY = bestY !== null ? bestY : (gridEnabled ? snapToGrid(rawTarget.y, gridStep) : rawTarget.y);

  const guides = [];
  if (bestXGuide) guides.push(bestXGuide);
  if (bestYGuide) guides.push(bestYGuide);

  return {
    x: Number(finalX.toFixed(4)),
    y: Number(finalY.toFixed(4)),
    snappedX: bestX !== null,
    snappedY: bestY !== null,
    guides
  };
}

