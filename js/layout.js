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
export function detectCollisions(modules, moduleConfig, customWalkways = [], obstacles = []) {
  const collidingIds = new Set();
  const bounds = modules.map(m => getModuleBounds(m, moduleConfig));
  const EPS = 0.005; // 5mm overlap threshold to ignore touching borders

  // Module to Module collision
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

  // Module to Custom Walkway collision (Keep-out zone)
  if (customWalkways && customWalkways.length > 0) {
    bounds.forEach(m => {
      customWalkways.forEach(w => {
        const wRight = w.x + w.width;
        const wBottom = w.y + w.height;
        const overlapX = Math.min(m.right, wRight) - Math.max(m.x, w.x);
        const overlapY = Math.min(m.bottom, wBottom) - Math.max(m.y, w.y);
        if (overlapX > EPS && overlapY > EPS) {
          collidingIds.add(m.id);
        }
      });
    });
  }

  // Module to Obstacle collision (Skylights & Chimneys keep-out zone + clearance buffer)
  if (obstacles && obstacles.length > 0) {
    bounds.forEach(m => {
      obstacles.forEach(o => {
        const c = o.clearance !== undefined ? Number(o.clearance) : 0.30;
        const oH = o.length || o.height || 1.0;
        const oLeft = o.x - c;
        const oTop = o.y - c;
        const oRight = o.x + o.width + c;
        const oBottom = o.y + oH + c;
        const overlapX = Math.min(m.right, oRight) - Math.max(m.x, oLeft);
        const overlapY = Math.min(m.bottom, oBottom) - Math.max(m.y, oTop);
        if (overlapX > EPS && overlapY > EPS) {
          collidingIds.add(m.id);
        }
      });
    });
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
 * Decomposes a rectangular usable area into disjoint non-overlapping rectangular sub-zones
 * by subtracting custom maintenance walkways with safety clamp clearance.
 *
 * @param {Object} usableRect - { x, y, width, height }
 * @param {Array} customWalkways - Array of walkway objects { x, y, width, height }
 * @param {Number} gapX - Horizontal buffer / clamp gap
 * @param {Number} gapY - Vertical buffer / clamp gap
 * @returns {Array} Array of disjoint rectangular zones { x, y, width, height }
 */
export function decomposeUsableArea(usableRect, customWalkways = [], gapX = 0.02, gapY = 0.02) {
  let zones = [usableRect];
  const EPS = 0.005;

  const keepOutBoxes = [];

  for (const obstacle of (customWalkways || [])) {
    keepOutBoxes.push({
      ox1: obstacle.x - gapX,
      oy1: obstacle.y - gapY,
      ox2: obstacle.x + obstacle.width + gapX,
      oy2: obstacle.y + obstacle.height + gapY
    });
  }

  for (const box of keepOutBoxes) {
    const nextZones = [];
    const ox1 = box.ox1;
    const oy1 = box.oy1;
    const ox2 = box.ox2;
    const oy2 = box.oy2;

    for (const r of zones) {
      const rx1 = r.x;
      const ry1 = r.y;
      const rx2 = r.x + r.width;
      const ry2 = r.y + r.height;

      // Check intersection
      const ix1 = Math.max(rx1, ox1);
      const iy1 = Math.max(ry1, oy1);
      const ix2 = Math.min(rx2, ox2);
      const iy2 = Math.min(ry2, oy2);

      if (ix2 - ix1 <= EPS || iy2 - iy1 <= EPS) {
        // No overlap with this zone, keep intact
        nextZones.push(r);
        continue;
      }

      // Top piece
      if (iy1 - ry1 > EPS) {
        nextZones.push({ x: rx1, y: ry1, width: r.width, height: iy1 - ry1 });
      }
      // Bottom piece
      if (ry2 - iy2 > EPS) {
        nextZones.push({ x: rx1, y: iy2, width: r.width, height: ry2 - iy2 });
      }
      // Left piece (vertical span between iy1 and iy2)
      if (ix1 - rx1 > EPS) {
        nextZones.push({ x: rx1, y: iy1, width: ix1 - rx1, height: iy2 - iy1 });
      }
      // Right piece (vertical span between iy1 and iy2)
      if (rx2 - ix2 > EPS) {
        nextZones.push({ x: ix2, y: iy1, width: rx2 - ix2, height: iy2 - iy1 });
      }
    }
    zones = nextZones;
  }

  return zones;
}

/**
 * Calculates optimal 2D grid layout to maximize modules on the flat roof.
 * Respects 4-sided setbacks, clamp gaps, maintenance walkways, and raster alignment.
 */
export function calculateAutoFill(roofConfig, moduleConfig, orientationMode = 'optimal', gridStep = 0.1, walkwayConfig = null, customWalkways = [], obstacles = []) {
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

  // --- Zone-Partitioned Auto-Fill for Custom Walkways ---
  // When custom walkways divide the roof into separate corridors/sections,
  // partition the usable space into disjoint sub-zones and pack each zone independently.
  const hasCustomWalkways = customWalkways && customWalkways.length > 0;
  if (hasCustomWalkways) {
    const usableRect = { x: sb.left, y: sb.top, width: usableWidth, height: usableLength };
    const rawZones = decomposeUsableArea(usableRect, customWalkways, gapX, gapY);
    const minSide = Math.min(w, h);
    // Filter zones where at least one panel can physically fit
    const zones = rawZones.filter(z => Math.max(z.width, z.height) >= minSide && Math.min(z.width, z.height) >= minSide);

    if (zones.length === 0) {
      return { modules: [], walkways: [], modeUsed: orientationMode, count: 0, summary: '0 modules (walkway obstruction)' };
    }

    // Helper to solve an individual partitioned zone
    const solveZone = (z, mode) => {
      if (z.width < minSide || z.height < minSide) {
        return { count: 0, modules: [], totalSpanX: 0, totalSpanY: 0 };
      }
      const port = generateBlock(0, 0, z.width, z.height, w, h, 0, false, false);
      const land = generateBlock(0, 0, z.width, z.height, h, w, 90, false, false);

      if (mode === 'portrait') return port;
      if (mode === 'landscape') return land;
      if (mode === 'same' || mode === 'uniform') {
        return land.count >= port.count ? land : port;
      }

      // Mixed / Optimal Mode inside sub-zone:
      const candList = [port, land];

      // Horizontal splits
      for (let r1 = 1; r1 < port.rows; r1++) {
        const hTop = port.rowLayout.offsets[r1 - 1] + h;
        const topBlock = generateBlock(0, 0, z.width, hTop, w, h, 0, false, false);
        const remH = z.height - (hTop + gapY);
        if (remH >= w) {
          const bottomBlock = generateBlock(0, hTop + gapY, z.width, remH, h, w, 90, false, false);
          if (bottomBlock.count > 0) {
            candList.push({
              count: topBlock.count + bottomBlock.count,
              modules: [...topBlock.modules, ...bottomBlock.modules],
              totalSpanX: Math.max(topBlock.totalSpanX, bottomBlock.totalSpanX),
              totalSpanY: hTop + gapY + bottomBlock.totalSpanY
            });
          }
        }
      }
      for (let r1 = 1; r1 < land.rows; r1++) {
        const hTop = land.rowLayout.offsets[r1 - 1] + w;
        const topBlock = generateBlock(0, 0, z.width, hTop, h, w, 90, false, false);
        const remH = z.height - (hTop + gapY);
        if (remH >= h) {
          const bottomBlock = generateBlock(0, hTop + gapY, z.width, remH, w, h, 0, false, false);
          if (bottomBlock.count > 0) {
            candList.push({
              count: topBlock.count + bottomBlock.count,
              modules: [...topBlock.modules, ...bottomBlock.modules],
              totalSpanX: Math.max(topBlock.totalSpanX, bottomBlock.totalSpanX),
              totalSpanY: hTop + gapY + bottomBlock.totalSpanY
            });
          }
        }
      }

      // Vertical splits
      for (let c1 = 1; c1 < port.cols; c1++) {
        const wLeft = port.colLayout.offsets[c1 - 1] + w;
        const leftBlock = generateBlock(0, 0, wLeft, z.height, w, h, 0, false, false);
        const remW = z.width - (wLeft + gapX);
        if (remW >= h) {
          const rightBlock = generateBlock(wLeft + gapX, 0, remW, z.height, h, w, 90, false, false);
          if (rightBlock.count > 0) {
            candList.push({
              count: leftBlock.count + rightBlock.count,
              modules: [...leftBlock.modules, ...rightBlock.modules],
              totalSpanX: wLeft + gapX + rightBlock.totalSpanX,
              totalSpanY: Math.max(leftBlock.totalSpanY, rightBlock.totalSpanY)
            });
          }
        }
      }
      for (let c1 = 1; c1 < land.cols; c1++) {
        const wLeft = land.colLayout.offsets[c1 - 1] + h;
        const leftBlock = generateBlock(0, 0, wLeft, z.height, h, w, 90, false, false);
        const remW = z.width - (wLeft + gapX);
        if (remW >= w) {
          const rightBlock = generateBlock(wLeft + gapX, 0, remW, z.height, w, h, 0, false, false);
          if (rightBlock.count > 0) {
            candList.push({
              count: leftBlock.count + rightBlock.count,
              modules: [...leftBlock.modules, ...rightBlock.modules],
              totalSpanX: wLeft + gapX + rightBlock.totalSpanX,
              totalSpanY: Math.max(leftBlock.totalSpanY, rightBlock.totalSpanY)
            });
          }
        }
      }

      let best = land.count >= port.count ? land : port;
      for (const cand of candList) {
        if (cand.count > best.count) {
          best = cand;
        }
      }
      return best;
    };

    // If 'same', decide globally best pure orientation across all zones
    let effectiveMode = orientationMode;
    if (orientationMode === 'same' || orientationMode === 'uniform') {
      let totalPort = 0;
      let totalLand = 0;
      zones.forEach(z => {
        totalPort += solveZone(z, 'portrait').count;
        totalLand += solveZone(z, 'landscape').count;
      });
      effectiveMode = totalLand >= totalPort ? 'landscape' : 'portrait';
    }

    const timestamp = Date.now();
    let idCounter = 1;
    const allFinalModules = [];
    let portCount = 0;
    let landCount = 0;

    zones.forEach(z => {
      const zSol = solveZone(z, effectiveMode);
      if (!zSol || zSol.count === 0) return;

      const spanX = zSol.totalSpanX;
      const spanY = zSol.totalSpanY;
      let startX = z.x + Math.max(0, (z.width - spanX) / 2);
      let startY = z.y + Math.max(0, (z.height - spanY) / 2);

      startX = snapToGrid(startX, gridStep);
      startY = snapToGrid(startY, gridStep);

      // Clamp strictly within zone boundaries
      startX = Math.max(z.x, Math.min(z.x + z.width - spanX, startX));
      startY = Math.max(z.y, Math.min(z.y + z.height - spanY, startY));

      zSol.modules.forEach(m => {
        if (m.rotation === 90) landCount++; else portCount++;
        allFinalModules.push({
          id: `pv-${timestamp}-${idCounter++}`,
          x: Number((startX + m.x).toFixed(4)),
          y: Number((startY + m.y).toFixed(4)),
          rotation: m.rotation,
          selected: false
        });
      });
    });

    // Filter out any modules that intersect obstacles (Skylights & Chimneys keep-out + clearance)
    if (obstacles && obstacles.length > 0) {
      allFinalModules = allFinalModules.filter(m => {
        const dims = getRotatedDimensions(moduleConfig, m.rotation || 0);
        const mRight = m.x + dims.width;
        const mBottom = m.y + dims.height;
        const EPS = 0.005;
        return !obstacles.some(o => {
          const c = o.clearance !== undefined ? Number(o.clearance) : 0.30;
          const oH = o.length || o.height || 1.0;
          const oLeft = o.x - c;
          const oTop = o.y - c;
          const oRight = o.x + o.width + c;
          const oBottom = o.y + oH + c;
          const overlapX = Math.min(mRight, oRight) - Math.max(m.x, oLeft);
          const overlapY = Math.min(mBottom, oBottom) - Math.max(m.y, oTop);
          return overlapX > EPS && overlapY > EPS;
        });
      });
    }

    portCount = 0;
    landCount = 0;
    allFinalModules.forEach(m => {
      if (m.rotation === 90) landCount++; else portCount++;
    });

    let summaryText = `${allFinalModules.length} modules`;
    if (effectiveMode === 'portrait' || (portCount > 0 && landCount === 0)) {
      summaryText = `${allFinalModules.length} portrait`;
    } else if (effectiveMode === 'landscape' || (landCount > 0 && portCount === 0)) {
      summaryText = `${allFinalModules.length} landscape`;
    } else {
      summaryText = `${portCount} portrait + ${landCount} landscape (mixed)`;
    }

    return {
      modules: allFinalModules,
      walkways: [],
      modeUsed: effectiveMode,
      summary: summaryText,
      count: allFinalModules.length
    };
  }

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

    const timestamp = Date.now();
    let idCounter = 1;

    let finalizedModules = mods.map(m => ({
      id: `pv-${timestamp}-${idCounter++}`,
      x: Number((m.x + deltaX).toFixed(4)),
      y: Number((m.y + deltaY).toFixed(4)),
      rotation: m.rotation,
      selected: false
    }));

    // Filter out any modules that intersect custom walkways or obstacles (Keep-out zones)
    if (customWalkways && customWalkways.length > 0) {
      finalizedModules = finalizedModules.filter(m => {
        const dims = getRotatedDimensions(moduleConfig, m.rotation || 0);
        const mRight = m.x + dims.width;
        const mBottom = m.y + dims.height;
        const EPS = 0.005;
        return !customWalkways.some(w => {
          const wRight = w.x + w.width;
          const wBottom = w.y + w.height;
          const overlapX = Math.min(mRight, wRight) - Math.max(m.x, w.x);
          const overlapY = Math.min(mBottom, wBottom) - Math.max(m.y, w.y);
          return overlapX > EPS && overlapY > EPS;
        });
      });
    }

    if (obstacles && obstacles.length > 0) {
      finalizedModules = finalizedModules.filter(m => {
        const dims = getRotatedDimensions(moduleConfig, m.rotation || 0);
        const mRight = m.x + dims.width;
        const mBottom = m.y + dims.height;
        const EPS = 0.005;
        return !obstacles.some(o => {
          const c = o.clearance !== undefined ? Number(o.clearance) : 0.30;
          const oH = o.length || o.height || 1.0;
          const oLeft = o.x - c;
          const oTop = o.y - c;
          const oRight = o.x + o.width + c;
          const oBottom = o.y + oH + c;
          const overlapX = Math.min(mRight, oRight) - Math.max(m.x, oLeft);
          const overlapY = Math.min(mBottom, oBottom) - Math.max(m.y, oTop);
          return overlapX > EPS && overlapY > EPS;
        });
      });
    }

    const finalizedWalkways = (winner.walkways || []).map(wk => ({
      x: Number((wk.x + deltaX).toFixed(4)),
      y: Number((wk.y + deltaY).toFixed(4)),
      width: Number(wk.width.toFixed(4)),
      height: Number(wk.height.toFixed(4)),
      direction: wk.direction
    }));

    let pCount = 0;
    let lCount = 0;
    finalizedModules.forEach(m => {
      if (m.rotation === 90) lCount++; else pCount++;
    });

    let summaryText = `${finalizedModules.length} modules`;
    if (winner.modeUsed === 'portrait' || (pCount > 0 && lCount === 0)) {
      summaryText = `${finalizedModules.length} portrait`;
    } else if (winner.modeUsed === 'landscape' || (lCount > 0 && pCount === 0)) {
      summaryText = `${finalizedModules.length} landscape`;
    } else {
      summaryText = `${pCount} portrait + ${lCount} landscape (mixed)`;
    }

    return {
      modules: finalizedModules,
      walkways: finalizedWalkways,
      modeUsed: winner.modeUsed,
      summary: summaryText,
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
    const finPort = finalizeCandidate(candPurePortrait);
    const finLand = finalizeCandidate(candPureLandscape);
    const bestFin = finLand.count >= finPort.count ? finLand : finPort;
    return {
      ...bestFin,
      modeUsed: 'same',
      summary: `${bestFin.count} ${bestFin.modeUsed} (same alignment)`
    };
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
  // Default to the better of the pure orientations (evaluated after collision filtering)
  const finPort = finalizeCandidate(candPurePortrait);
  const finLand = finalizeCandidate(candPureLandscape);
  let bestCandidateResult = finLand.count >= finPort.count ? finLand : finPort;
  let maxCount = bestCandidateResult.count;

  // If a mixed orientation achieves strictly more modules, mixed wins!
  for (const cand of candidates) {
    const fin = finalizeCandidate(cand);
    if (fin.count > maxCount) {
      maxCount = fin.count;
      bestCandidateResult = fin;
    }
  }

  return bestCandidateResult;
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
  bypassSnap = false,
  customWalkways = []
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

  if (snapToPanels) {
    const curTop = rawTarget.y;
    const curBottom = rawTarget.y + modH;
    const curLeft = rawTarget.x;
    const curRight = rawTarget.x + modW;

    // 1. Snap to Stationary PV Panels
    if (stationary.length > 0) {
      stationary.forEach(neighbor => {
        const nBounds = getModuleBounds(neighbor, moduleConfig);

        // Check vertical proximity for horizontal alignment candidates
        const vOverlap = Math.max(0, Math.min(curBottom, nBounds.bottom) - Math.max(curTop, nBounds.y));
        const vDistance = Math.max(0, Math.max(curTop - nBounds.bottom, nBounds.y - curBottom));

        if (vOverlap > 0 || vDistance <= 0.3) {
          const xCandidates = [
            {
              x: nBounds.right + gapX,
              type: 'gap',
              label: `${(gapX * 1000).toFixed(0)}mm Gap`,
              guideX: nBounds.right + (gapX / 2),
              y1: Math.min(curTop, nBounds.y),
              y2: Math.max(curBottom, nBounds.bottom)
            },
            {
              x: nBounds.x - modW - gapX,
              type: 'gap',
              label: `${(gapX * 1000).toFixed(0)}mm Gap`,
              guideX: nBounds.x - (gapX / 2),
              y1: Math.min(curTop, nBounds.y),
              y2: Math.max(curBottom, nBounds.bottom)
            },
            {
              x: nBounds.x,
              type: 'flush',
              label: 'Flush Left',
              guideX: nBounds.x,
              y1: Math.min(curTop, nBounds.y) - 0.15,
              y2: Math.max(curBottom, nBounds.bottom) + 0.15
            },
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
          const yCandidates = [
            {
              y: nBounds.bottom + gapY,
              type: 'gap',
              label: `${(gapY * 1000).toFixed(0)}mm Gap`,
              guideY: nBounds.bottom + (gapY / 2),
              x1: Math.min(curLeft, nBounds.x),
              x2: Math.max(curRight, nBounds.right)
            },
            {
              y: nBounds.y - modH - gapY,
              type: 'gap',
              label: `${(gapY * 1000).toFixed(0)}mm Gap`,
              guideY: nBounds.y - (gapY / 2),
              x1: Math.min(curLeft, nBounds.x),
              x2: Math.max(curRight, nBounds.right)
            },
            {
              y: nBounds.y,
              type: 'flush',
              label: 'Flush Top',
              guideY: nBounds.y,
              x1: Math.min(curLeft, nBounds.x) - 0.15,
              x2: Math.max(curRight, nBounds.right) + 0.15
            },
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

    // 2. Snap to Custom Walkways (Clamp Gap & Flush Edges)
    if (customWalkways && customWalkways.length > 0) {
      customWalkways.forEach(cw => {
        const cwRight = cw.x + cw.width;
        const cwBottom = cw.y + cw.height;

        // Check vertical proximity for horizontal (X) alignment candidates
        const vOverlap = Math.max(0, Math.min(curBottom, cwBottom) - Math.max(curTop, cw.y));
        const vDistance = Math.max(0, Math.max(curTop - cwBottom, cw.y - curBottom));

        if (vOverlap > 0 || vDistance <= 0.35) {
          const xCandidates = [
            // Right side of walkway + clamp gap
            {
              x: cwRight + gapX,
              type: 'gap',
              label: `Walkway + ${(gapX * 1000).toFixed(0)}mm Gap`,
              guideX: cwRight + (gapX / 2),
              y1: Math.min(curTop, cw.y),
              y2: Math.max(curBottom, cwBottom)
            },
            // Left side of walkway - modW - clamp gap
            {
              x: cw.x - modW - gapX,
              type: 'gap',
              label: `Walkway + ${(gapX * 1000).toFixed(0)}mm Gap`,
              guideX: cw.x - (gapX / 2),
              y1: Math.min(curTop, cw.y),
              y2: Math.max(curBottom, cwBottom)
            },
            // Flush Left with walkway
            {
              x: cw.x,
              type: 'flush',
              label: 'Walkway Flush Left',
              guideX: cw.x,
              y1: Math.min(curTop, cw.y) - 0.15,
              y2: Math.max(curBottom, cwBottom) + 0.15
            },
            // Flush Right with walkway
            {
              x: cwRight - modW,
              type: 'flush',
              label: 'Walkway Flush Right',
              guideX: cwRight,
              y1: Math.min(curTop, cw.y) - 0.15,
              y2: Math.max(curBottom, cwBottom) + 0.15
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

        // Check horizontal proximity for vertical (Y) alignment candidates
        const hOverlap = Math.max(0, Math.min(curRight, cwRight) - Math.max(curLeft, cw.x));
        const hDistance = Math.max(0, Math.max(curLeft - cwRight, cw.x - curRight));

        if (hOverlap > 0 || hDistance <= 0.35) {
          const yCandidates = [
            // Below walkway + clamp gap
            {
              y: cwBottom + gapY,
              type: 'gap',
              label: `Walkway + ${(gapY * 1000).toFixed(0)}mm Gap`,
              guideY: cwBottom + (gapY / 2),
              x1: Math.min(curLeft, cw.x),
              x2: Math.max(curRight, cwRight)
            },
            // Above walkway - modH - clamp gap
            {
              y: cw.y - modH - gapY,
              type: 'gap',
              label: `Walkway + ${(gapY * 1000).toFixed(0)}mm Gap`,
              guideY: cw.y - (gapY / 2),
              x1: Math.min(curLeft, cw.x),
              x2: Math.max(curRight, cwRight)
            },
            // Flush Top with walkway
            {
              y: cw.y,
              type: 'flush',
              label: 'Walkway Flush Top',
              guideY: cw.y,
              x1: Math.min(curLeft, cw.x) - 0.15,
              x2: Math.max(curRight, cwRight) + 0.15
            },
            // Flush Bottom with walkway
            {
              y: cwBottom - modH,
              type: 'flush',
              label: 'Walkway Flush Bottom',
              guideY: cwBottom,
              x1: Math.min(curLeft, cw.x) - 0.15,
              x2: Math.max(curRight, cwRight) + 0.15
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

/**
 * Calculates magnetic snap for drawing a new walkway corridor.
 * Snaps to module row/column edges, clamp gaps, roof setbacks, and raster grid.
 * Auto-expands length across the full roof or aligned module group if short drag.
 */
export function calculateWalkwaySnap(
  startPoint,
  currentPoint,
  allModules = [],
  moduleConfig = {},
  roofConfig = {},
  walkwayWidth = 0.8,
  gridConfig = {}
) {
  const sb = getRoofSetbacks(roofConfig);
  const gapX = ((moduleConfig.gapX !== undefined ? moduleConfig.gapX : 20) / 1000);
  const gapY = ((moduleConfig.gapY !== undefined ? moduleConfig.gapY : 20) / 1000);
  const gridStep = gridConfig && gridConfig.step ? gridConfig.step : 0.25;
  const gridEnabled = gridConfig && gridConfig.enabled !== false;

  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);

  const guides = [];
  const snapThreshold = 0.25; // 25cm magnetic pull distance

  if (isHorizontal) {
    // Horizontal corridor: thickness is walkwayWidth (height)
    const wHeight = walkwayWidth;
    const targetY = currentPoint.y - wHeight / 2;
    let bestY = null;
    let minDiffY = snapThreshold;
    let yGuide = null;

    // Check module edges
    allModules.forEach(m => {
      const b = getModuleBounds(m, moduleConfig);
      const candidates = [
        { y: b.bottom + gapY, guideY: b.bottom + gapY, label: `Row Gap (${(b.bottom + gapY).toFixed(2)}m)` },
        { y: b.y - wHeight - gapY, guideY: b.y - gapY, label: `Row Gap (${(b.y - gapY).toFixed(2)}m)` },
        { y: b.bottom, guideY: b.bottom, label: `Row Edge (${b.bottom.toFixed(2)}m)` },
        { y: b.y - wHeight, guideY: b.y, label: `Row Edge (${b.y.toFixed(2)}m)` }
      ];

      candidates.forEach(c => {
        const diff = Math.abs(targetY - c.y);
        if (diff < minDiffY) {
          minDiffY = diff;
          bestY = c.y;
          yGuide = {
            axis: 'y',
            pos: c.guideY,
            label: c.label,
            type: 'alignment',
            x1: 0,
            x2: roofConfig.width
          };
        }
      });
    });

    // Check setbacks
    const roofCands = [
      { y: sb.top, guideY: sb.top, label: `Setback Top (${sb.top.toFixed(2)}m)` },
      { y: roofConfig.length - sb.bottom - wHeight, guideY: roofConfig.length - sb.bottom, label: `Setback Bottom (${(roofConfig.length - sb.bottom).toFixed(2)}m)` }
    ];
    roofCands.forEach(rc => {
      const diff = Math.abs(targetY - rc.y);
      if (diff < minDiffY) {
        minDiffY = diff;
        bestY = rc.y;
        yGuide = {
          axis: 'y',
          pos: rc.guideY,
          label: rc.label,
          type: 'setback',
          x1: 0,
          x2: roofConfig.width
        };
      }
    });

    const finalY = bestY !== null ? bestY : (gridEnabled ? snapToGrid(targetY, gridStep) : targetY);
    if (yGuide) guides.push(yGuide);

    // Horizontal span calculation
    let finalX, finalWidth;
    if (Math.abs(dx) < 0.6) {
      // Short drag / single click -> Auto-expand across full usable roof
      finalX = sb.left;
      finalWidth = Math.max(0.4, roofConfig.width - sb.left - sb.right);
    } else {
      let rawLeft = Math.min(startPoint.x, currentPoint.x);
      let rawRight = Math.max(startPoint.x, currentPoint.x);

      let bestLeft = null;
      let minDiffLeft = snapThreshold;
      let bestRight = null;
      let minDiffRight = snapThreshold;

      allModules.forEach(m => {
        const b = getModuleBounds(m, moduleConfig);
        const lDiff = Math.abs(rawLeft - b.x);
        if (lDiff < minDiffLeft) { minDiffLeft = lDiff; bestLeft = b.x; }
        const rDiff = Math.abs(rawRight - b.right);
        if (rDiff < minDiffRight) { minDiffRight = rDiff; bestRight = b.right; }
      });

      if (Math.abs(rawLeft - sb.left) < minDiffLeft) bestLeft = sb.left;
      if (Math.abs(rawRight - (roofConfig.width - sb.right)) < minDiffRight) bestRight = roofConfig.width - sb.right;
      if (Math.abs(rawLeft) < minDiffLeft) bestLeft = 0;
      if (Math.abs(rawRight - roofConfig.width) < minDiffRight) bestRight = roofConfig.width;

      finalX = bestLeft !== null ? bestLeft : (gridEnabled ? snapToGrid(rawLeft, gridStep) : rawLeft);
      const endX = bestRight !== null ? bestRight : (gridEnabled ? snapToGrid(rawRight, gridStep) : rawRight);
      finalWidth = Math.max(0.4, Math.abs(endX - finalX));
    }

    return {
      walkway: {
        x: Number(finalX.toFixed(4)),
        y: Number(finalY.toFixed(4)),
        width: Number(finalWidth.toFixed(4)),
        height: Number(wHeight.toFixed(4)),
        direction: 'horizontal',
        isCustom: true
      },
      guides
    };
  } else {
    // Vertical corridor: thickness is walkwayWidth (width)
    const wWidth = walkwayWidth;
    const targetX = currentPoint.x - wWidth / 2;
    let bestX = null;
    let minDiffX = snapThreshold;
    let xGuide = null;

    allModules.forEach(m => {
      const b = getModuleBounds(m, moduleConfig);
      const candidates = [
        { x: b.right + gapX, guideX: b.right + gapX, label: `Col Gap (${(b.right + gapX).toFixed(2)}m)` },
        { x: b.x - wWidth - gapX, guideX: b.x - gapX, label: `Col Gap (${(b.x - gapX).toFixed(2)}m)` },
        { x: b.right, guideX: b.right, label: `Col Edge (${b.right.toFixed(2)}m)` },
        { x: b.x - wWidth, guideX: b.x, label: `Col Edge (${b.x.toFixed(2)}m)` }
      ];

      candidates.forEach(c => {
        const diff = Math.abs(targetX - c.x);
        if (diff < minDiffX) {
          minDiffX = diff;
          bestX = c.x;
          xGuide = {
            axis: 'x',
            pos: c.guideX,
            label: c.label,
            type: 'alignment',
            y1: 0,
            y2: roofConfig.length
          };
        }
      });
    });

    const roofCands = [
      { x: sb.left, guideX: sb.left, label: `Setback Left (${sb.left.toFixed(2)}m)` },
      { x: roofConfig.width - sb.right - wWidth, guideX: roofConfig.width - sb.right, label: `Setback Right (${(roofConfig.width - sb.right).toFixed(2)}m)` }
    ];
    roofCands.forEach(rc => {
      const diff = Math.abs(targetX - rc.x);
      if (diff < minDiffX) {
        minDiffX = diff;
        bestX = rc.x;
        xGuide = {
          axis: 'x',
          pos: rc.guideX,
          label: rc.label,
          type: 'setback',
          y1: 0,
          y2: roofConfig.length
        };
      }
    });

    const finalX = bestX !== null ? bestX : (gridEnabled ? snapToGrid(targetX, gridStep) : targetX);
    if (xGuide) guides.push(xGuide);

    // Vertical span calculation
    let finalY, finalHeight;
    if (Math.abs(dy) < 0.6) {
      // Auto-expand across full usable roof length
      finalY = sb.top;
      finalHeight = Math.max(0.4, roofConfig.length - sb.top - sb.bottom);
    } else {
      let rawTop = Math.min(startPoint.y, currentPoint.y);
      let rawBottom = Math.max(startPoint.y, currentPoint.y);

      let bestTop = null;
      let minDiffTop = snapThreshold;
      let bestBottom = null;
      let minDiffBottom = snapThreshold;

      allModules.forEach(m => {
        const b = getModuleBounds(m, moduleConfig);
        const tDiff = Math.abs(rawTop - b.y);
        if (tDiff < minDiffTop) { minDiffTop = tDiff; bestTop = b.y; }
        const bDiff = Math.abs(rawBottom - b.bottom);
        if (bDiff < minDiffBottom) { minDiffBottom = bDiff; bestBottom = b.bottom; }
      });

      if (Math.abs(rawTop - sb.top) < minDiffTop) bestTop = sb.top;
      if (Math.abs(rawBottom - (roofConfig.length - sb.bottom)) < minDiffBottom) bestBottom = roofConfig.length - sb.bottom;
      if (Math.abs(rawTop) < minDiffTop) bestTop = 0;
      if (Math.abs(rawBottom - roofConfig.length) < minDiffBottom) bestBottom = roofConfig.length;

      finalY = bestTop !== null ? bestTop : (gridEnabled ? snapToGrid(rawTop, gridStep) : rawTop);
      const endY = bestBottom !== null ? bestBottom : (gridEnabled ? snapToGrid(rawBottom, gridStep) : rawBottom);
      finalHeight = Math.max(0.4, Math.abs(endY - finalY));
    }

    return {
      walkway: {
        x: Number(finalX.toFixed(4)),
        y: Number(finalY.toFixed(4)),
        width: Number(wWidth.toFixed(4)),
        height: Number(finalHeight.toFixed(4)),
        direction: 'vertical',
        isCustom: true
      },
      guides
    };
  }
}

/**
 * Calculates magnetic snap when dragging an existing custom walkway.
 */
export function calculateWalkwayDragSnap(
  movingWalkway,
  rawTarget,
  allModules = [],
  moduleConfig = {},
  roofConfig = {},
  gridConfig = {}
) {
  const sb = getRoofSetbacks(roofConfig);
  const gapX = ((moduleConfig.gapX !== undefined ? moduleConfig.gapX : 20) / 1000);
  const gapY = ((moduleConfig.gapY !== undefined ? moduleConfig.gapY : 20) / 1000);
  const gridStep = gridConfig && gridConfig.step ? gridConfig.step : 0.25;
  const gridEnabled = gridConfig && gridConfig.enabled !== false;

  const isHorizontal = movingWalkway.direction === 'horizontal';
  const guides = [];
  const snapThreshold = 0.22;

  let bestX = null;
  let minDiffX = snapThreshold;
  let xGuide = null;

  let bestY = null;
  let minDiffY = snapThreshold;
  let yGuide = null;

  if (isHorizontal) {
    // Snap Y (across rows)
    const targetY = rawTarget.y;
    allModules.forEach(m => {
      const b = getModuleBounds(m, moduleConfig);
      const cands = [
        { y: b.bottom + gapY, guideY: b.bottom + gapY, label: `Row Gap (${(b.bottom + gapY).toFixed(2)}m)` },
        { y: b.y - movingWalkway.height - gapY, guideY: b.y - gapY, label: `Row Gap (${(b.y - gapY).toFixed(2)}m)` },
        { y: b.bottom, guideY: b.bottom, label: `Row Edge (${b.bottom.toFixed(2)}m)` },
        { y: b.y - movingWalkway.height, guideY: b.y, label: `Row Edge (${b.y.toFixed(2)}m)` }
      ];
      cands.forEach(c => {
        const diff = Math.abs(targetY - c.y);
        if (diff < minDiffY) {
          minDiffY = diff;
          bestY = c.y;
          yGuide = { axis: 'y', pos: c.guideY, label: c.label, type: 'alignment', x1: 0, x2: roofConfig.width };
        }
      });
    });

    // Snap X to setback or 0
    if (Math.abs(rawTarget.x - sb.left) < minDiffX) {
      bestX = sb.left;
      xGuide = { axis: 'x', pos: sb.left, label: 'Setback Left', type: 'setback', y1: 0, y2: roofConfig.length };
    }
  } else {
    // Vertical: Snap X (across columns)
    const targetX = rawTarget.x;
    allModules.forEach(m => {
      const b = getModuleBounds(m, moduleConfig);
      const cands = [
        { x: b.right + gapX, guideX: b.right + gapX, label: `Col Gap (${(b.right + gapX).toFixed(2)}m)` },
        { x: b.x - movingWalkway.width - gapX, guideX: b.x - gapX, label: `Col Gap (${(b.x - gapX).toFixed(2)}m)` },
        { x: b.right, guideX: b.right, label: `Col Edge (${b.right.toFixed(2)}m)` },
        { x: b.x - movingWalkway.width, guideX: b.x, label: `Col Edge (${b.x.toFixed(2)}m)` }
      ];
      cands.forEach(c => {
        const diff = Math.abs(targetX - c.x);
        if (diff < minDiffX) {
          minDiffX = diff;
          bestX = c.x;
          xGuide = { axis: 'x', pos: c.guideX, label: c.label, type: 'alignment', y1: 0, y2: roofConfig.length };
        }
      });
    });

    if (Math.abs(rawTarget.y - sb.top) < minDiffY) {
      bestY = sb.top;
      yGuide = { axis: 'y', pos: sb.top, label: 'Setback Top', type: 'setback', x1: 0, x2: roofConfig.width };
    }
  }

  const finalX = bestX !== null ? bestX : (gridEnabled ? snapToGrid(rawTarget.x, gridStep) : rawTarget.x);
  const finalY = bestY !== null ? bestY : (gridEnabled ? snapToGrid(rawTarget.y, gridStep) : rawTarget.y);

  if (xGuide) guides.push(xGuide);
  if (yGuide) guides.push(yGuide);

  return {
    x: Number(finalX.toFixed(4)),
    y: Number(finalY.toFixed(4)),
    guides
  };
}

/**
 * Calculates snapped position and boundary clamping for moving a roof obstacle (skylight or chimney).
 */
export function calculateObstacleSnap(obstacle, rawTarget, roofConfig, gridConfig, existingObstacles = []) {
  const step = (gridConfig && gridConfig.enabled !== false) ? (gridConfig.step || 0.1) : 0.05;
  const oW = obstacle.width || 1.0;
  const oH = obstacle.length || obstacle.height || 1.0;

  let x = snapToGrid(rawTarget.x, step);
  let y = snapToGrid(rawTarget.y, step);

  const roofW = roofConfig?.width || 8.0;
  const roofL = roofConfig?.length || 8.0;

  // Clamping to roof boundaries
  const maxX = Math.max(0, roofW - oW);
  const maxY = Math.max(0, roofL - oH);
  x = Math.max(0, Math.min(x, maxX));
  y = Math.max(0, Math.min(y, maxY));

  const guides = [];
  const snapThreshold = 0.15;

  if (Math.abs(x) < snapThreshold) {
    guides.push({ axis: 'x', pos: 0, y1: 0, y2: roofL, type: 'roof', label: 'Roof Border' });
  } else if (Math.abs(x - maxX) < snapThreshold) {
    guides.push({ axis: 'x', pos: roofW, y1: 0, y2: roofL, type: 'roof', label: 'Roof Border' });
  }

  if (Math.abs(y) < snapThreshold) {
    guides.push({ axis: 'y', pos: 0, x1: 0, x2: roofW, type: 'roof', label: 'Roof Border' });
  } else if (Math.abs(y - maxY) < snapThreshold) {
    guides.push({ axis: 'y', pos: roofL, x1: 0, x2: roofW, type: 'roof', label: 'Roof Border' });
  }

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    guides
  };
}

/**
 * Finds a free, non-overlapping spawn position on the roof for a new obstacle.
 */
export function findFreeObstaclePosition(existingObstacles = [], width = 1.0, length = 1.0, roofConfig = {}, gridStep = 0.25) {
  const sb = getRoofSetbacks(roofConfig);
  const roofW = roofConfig?.width || 8.0;
  const roofL = roofConfig?.length || 8.0;

  // Prefer center-left or center
  const targetX = snapToGrid((roofW - width) / 2, gridStep);
  const targetY = snapToGrid((roofL - length) / 2, gridStep);

  const testObstacle = (x, y) => {
    return !(existingObstacles || []).some(o => {
      const oW = o.width || 1.0;
      const oH = o.length || o.height || 1.0;
      const overlapX = Math.min(x + width, o.x + oW) - Math.max(x, o.x);
      const overlapY = Math.min(y + length, o.y + oH) - Math.max(y, o.y);
      return overlapX > 0.05 && overlapY > 0.05;
    });
  };

  if (testObstacle(targetX, targetY)) {
    return { x: targetX, y: targetY };
  }

  const maxY = Math.max(0, roofL - sb.bottom - length);
  const maxX = Math.max(0, roofW - sb.right - width);
  for (let y = sb.top; y <= maxY; y += gridStep * 2) {
    for (let x = sb.left; x <= maxX; x += gridStep * 2) {
      const sx = snapToGrid(x, gridStep);
      const sy = snapToGrid(y, gridStep);
      if (testObstacle(sx, sy)) {
        return { x: sx, y: sy };
      }
    }
  }

  return {
    x: snapToGrid(sb.left, gridStep),
    y: snapToGrid(sb.top, gridStep)
  };
}


