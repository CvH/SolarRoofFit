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
    return { modules: [], walkways: [], modeUsed: orientationMode, count: 0 };
  }

  const gapX = ((moduleConfig.gapX !== undefined ? moduleConfig.gapX : 20) / 1000); // meters
  const gapY = ((moduleConfig.gapY !== undefined ? moduleConfig.gapY : 20) / 1000); // meters

  const w = (moduleConfig.width || 1134) / 1000;
  const h = (moduleConfig.height || 1762) / 1000;

  const walkwayEnabled = !!walkwayConfig?.enabled;
  const walkwayWidth = walkwayEnabled ? Math.max(0.2, walkwayConfig.width || 0.8) : 0;
  const walkwayInterval = walkwayEnabled ? Math.max(1, walkwayConfig.interval || 2) : 9999;
  const walkwayDir = walkwayConfig?.direction || 'horizontal';

  const hasHWalkways = walkwayEnabled && (walkwayDir === 'horizontal' || walkwayDir === 'both');
  const hasVWalkways = walkwayEnabled && (walkwayDir === 'vertical' || walkwayDir === 'both');

  const calcGrid = (modW, modH, rot) => {
    const colLayout = computeDimensionLayout(usableWidth, modW, gapX, hasVWalkways, walkwayInterval, walkwayWidth);
    const rowLayout = computeDimensionLayout(usableLength, modH, gapY, hasHWalkways, walkwayInterval, walkwayWidth);
    const count = colLayout.count * rowLayout.count;

    return { colLayout, rowLayout, count, modW, modH, rot };
  };

  const portrait = calcGrid(w, h, 0);
  const landscape = calcGrid(h, w, 90);

  let chosen;
  if (orientationMode === 'portrait') {
    chosen = portrait;
  } else if (orientationMode === 'landscape') {
    chosen = landscape;
  } else {
    // Optimal: highest count, or if equal, compare coverage area
    if (landscape.count > portrait.count) {
      chosen = landscape;
    } else if (portrait.count > landscape.count) {
      chosen = portrait;
    } else {
      const portOcc = portrait.colLayout.count * portrait.rowLayout.count * (w * h);
      const landOcc = landscape.colLayout.count * landscape.rowLayout.count * (w * h);
      chosen = landOcc >= portOcc ? landscape : portrait;
    }
  }

  if (chosen.count <= 0) {
    return { modules: [], walkways: [], modeUsed: chosen.rot === 90 ? 'landscape' : 'portrait', count: 0 };
  }

  // Center array within safe zone
  let startX = sb.left + ((usableWidth - chosen.colLayout.totalSpan) / 2);
  let startY = sb.top + ((usableLength - chosen.rowLayout.totalSpan) / 2);

  startX = snapToGrid(startX, gridStep);
  startY = snapToGrid(startY, gridStep);

  // Ensure within safe setback boundaries
  if (startX < sb.left) startX = sb.left;
  if (startY < sb.top) startY = sb.top;
  if (startX + chosen.colLayout.totalSpan > roofConfig.width - sb.right) {
    startX = Math.max(sb.left, roofConfig.width - sb.right - chosen.colLayout.totalSpan);
  }
  if (startY + chosen.rowLayout.totalSpan > roofConfig.length - sb.bottom) {
    startY = Math.max(sb.top, roofConfig.length - sb.bottom - chosen.rowLayout.totalSpan);
  }

  const generated = [];
  let idCounter = 1;

  for (let r = 0; r < chosen.rowLayout.count; r++) {
    for (let c = 0; c < chosen.colLayout.count; c++) {
      const posX = Number((startX + chosen.colLayout.offsets[c]).toFixed(4));
      const posY = Number((startY + chosen.rowLayout.offsets[r]).toFixed(4));

      generated.push({
        id: `pv-${Date.now()}-${idCounter++}`,
        x: posX,
        y: posY,
        rotation: chosen.rot,
        selected: false
      });
    }
  }

  // Generate walkway corridor bounding boxes on roof
  const walkwayCorridors = [];
  if (hasHWalkways) {
    chosen.rowLayout.walkways.forEach(w => {
      walkwayCorridors.push({
        x: Number(startX.toFixed(4)),
        y: Number((startY + w.start).toFixed(4)),
        width: Number(chosen.colLayout.totalSpan.toFixed(4)),
        height: Number(w.width.toFixed(4)),
        direction: 'horizontal'
      });
    });
  }
  if (hasVWalkways) {
    chosen.colLayout.walkways.forEach(w => {
      walkwayCorridors.push({
        x: Number((startX + w.start).toFixed(4)),
        y: Number(startY.toFixed(4)),
        width: Number(w.width.toFixed(4)),
        height: Number(chosen.rowLayout.totalSpan.toFixed(4)),
        direction: 'vertical'
      });
    });
  }

  return {
    modules: generated,
    walkways: walkwayCorridors,
    modeUsed: chosen.rot === 90 ? 'landscape' : 'portrait',
    count: generated.length,
    cols: chosen.colLayout.count,
    rows: chosen.rowLayout.count
  };
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
