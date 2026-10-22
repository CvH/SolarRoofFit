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
  const setback = roofConfig.setback || 0;
  if (
    b.x < setback - EPS ||
    b.y < setback - EPS ||
    b.right > roofConfig.width - setback + EPS ||
    b.bottom > roofConfig.length - setback + EPS
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
 * Calculates optimal 2D grid layout to maximize modules on the flat roof.
 * Respects setbacks, module gaps, and user raster alignment.
 */
export function calculateAutoFill(roofConfig, moduleConfig, orientationMode = 'optimal', gridStep = 0.1) {
  const setback = Math.max(0, roofConfig.setback || 0);
  const usableWidth = roofConfig.width - (2 * setback);
  const usableLength = roofConfig.length - (2 * setback);

  if (usableWidth <= 0 || usableLength <= 0) {
    return { modules: [], modeUsed: orientationMode, count: 0 };
  }

  const gapX = ((moduleConfig.gapX !== undefined ? moduleConfig.gapX : 20) / 1000); // meters
  const gapY = ((moduleConfig.gapY !== undefined ? moduleConfig.gapY : 20) / 1000); // meters

  const w = (moduleConfig.width || 1134) / 1000;
  const h = (moduleConfig.height || 1762) / 1000;

  // Calculate Portrait packing
  const calcGrid = (modW, modH, rot) => {
    // Number of columns: (cols * modW) + ((cols - 1) * gapX) <= usableWidth
    // cols * (modW + gapX) - gapX <= usableWidth
    // cols <= (usableWidth + gapX) / (modW + gapX)
    const cols = Math.max(0, Math.floor((usableWidth + gapX + 0.0001) / (modW + gapX)));
    const rows = Math.max(0, Math.floor((usableLength + gapY + 0.0001) / (modH + gapY)));
    const count = cols * rows;

    return { cols, rows, count, modW, modH, rot };
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
      // Tie breaker: pick the one with better aspect ratio utilization
      const portOcc = portrait.cols * portrait.rows * (w * h);
      const landOcc = landscape.cols * landscape.rows * (w * h);
      chosen = landOcc >= portOcc ? landscape : portrait;
    }
  }

  if (chosen.count <= 0) {
    return { modules: [], modeUsed: chosen.rot === 90 ? 'landscape' : 'portrait', count: 0 };
  }

  // Calculate total occupied span
  const totalSpanX = (chosen.cols * chosen.modW) + ((chosen.cols - 1) * gapX);
  const totalSpanY = (chosen.rows * chosen.modH) + ((chosen.rows - 1) * gapY);

  // Center the array within the usable area
  let startX = setback + ((usableWidth - totalSpanX) / 2);
  let startY = setback + ((usableLength - totalSpanY) / 2);

  // Snap start position to current raster step
  startX = snapToGrid(startX, gridStep);
  startY = snapToGrid(startY, gridStep);

  // Ensure snapped start still keeps entire array inside setback
  if (startX < setback) startX = setback;
  if (startY < setback) startY = setback;
  if (startX + totalSpanX > roofConfig.width - setback) {
    startX = Math.max(setback, roofConfig.width - setback - totalSpanX);
  }
  if (startY + totalSpanY > roofConfig.length - setback) {
    startY = Math.max(setback, roofConfig.length - setback - totalSpanY);
  }

  const generated = [];
  let idCounter = 1;

  for (let r = 0; r < chosen.rows; r++) {
    for (let c = 0; c < chosen.cols; c++) {
      const posX = Number((startX + c * (chosen.modW + gapX)).toFixed(4));
      const posY = Number((startY + r * (chosen.modH + gapY)).toFixed(4));

      generated.push({
        id: `pv-${Date.now()}-${idCounter++}`,
        x: posX,
        y: posY,
        rotation: chosen.rot,
        selected: false
      });
    }
  }

  return {
    modules: generated,
    modeUsed: chosen.rot === 90 ? 'landscape' : 'portrait',
    count: generated.length,
    cols: chosen.cols,
    rows: chosen.rows
  };
}

/**
 * Finds a suitable free position on the roof to spawn a new module.
 */
export function findFreeSpawnPosition(existingModules, moduleConfig, roofConfig, gridStep = 0.1) {
  const setback = roofConfig.setback || 0.5;
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

  for (let y = setback; y <= roofConfig.length - setback - dims.height; y += stepY) {
    for (let x = setback; x <= roofConfig.width - setback - dims.width; x += stepX) {
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
    x: snapToGrid(setback, gridStep),
    y: snapToGrid(setback, gridStep)
  };
}
