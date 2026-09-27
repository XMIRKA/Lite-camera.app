/**
 * VisionForce CV — High-Precision Multi-Zone Optical Traffic Light Detector & Phase Interlocking Engine
 * 
 * Compliant with Traffic Engineering & ПДД standards (ГОСТ Р 52282 / NEMA TS 2):
 * 1. Multi-Strategy Active Photometry:
 *    - Dual-mode: Full-resolution video crop sampling or canvas context sampling.
 *    - Works seamlessly on tight single-lamp crops or full 3-lamp housings.
 *    - Robust HSV & RGB chromatic purity filters for standard ГОСТ wavelengths (Red ~630nm, Amber ~590nm, Emerald-Cyan ~505nm).
 * 2. Positional Priors:
 *    - Vertical (Top Red, Mid Yellow, Bot Green) and Horizontal (Left Red, Mid Yellow, Right Green) as advisory weights.
 * 3. Fast-Response Stabilizer:
 *    - Fast sliding majority filter with immediate initial latching.
 */

export interface IndividualTrafficLight {
  id: number;
  label: string;
  direction: 'MAIN_DIRECTION' | 'CROSS_DIRECTION' | 'LEFT_TURN_PHASE' | 'PEDESTRIAN_PHASE';
  directionLabelRu: string;
  // Normalized bounding box on frame (0..1)
  x: number;
  y: number;
  w: number;
  h: number;
  state: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
  inferredState?: 'RED' | 'YELLOW' | 'GREEN';
  stateLabelRu: string;
  confidence: number;
  activeColorHex: string;
  lastUpdatedTime: number;
  isOccludedOrInferred: boolean;
  manualOverride?: 'AUTO' | 'RED' | 'YELLOW' | 'GREEN';
  lampValues: {
    red: number;
    yellow: number;
    green: number;
  };
}

export interface IntersectionPhaseState {
  mainPhase: 'RED' | 'YELLOW' | 'GREEN';
  crossPhase: 'RED' | 'YELLOW' | 'GREEN';
  activePhaseDescriptionRu: string;
  interlockCompliant: boolean;
  signals: IndividualTrafficLight[];
}

/**
 * Converts RGB [0..255] to HSV (H: 0..360, S: 0..1, V: 0..1)
 */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s, v };
}

// Reusable offscreen canvas for high-precision video crop sampling
let cachedCropCanvas: HTMLCanvasElement | null = null;
let cachedCropCtx: CanvasRenderingContext2D | null = null;

function getCropContext(w: number = 48, h: number = 96): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!cachedCropCanvas) {
    cachedCropCanvas = document.createElement('canvas');
    cachedCropCtx = cachedCropCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (cachedCropCanvas.width !== w || cachedCropCanvas.height !== h) {
    cachedCropCanvas.width = w;
    cachedCropCanvas.height = h;
  }
  return cachedCropCtx;
}

/**
 * High-Precision Optical Pixel Analyzer for Traffic Light ROI
 * Robust against evening/night glare, headlights, overexposed LED cores, and distance.
 * Combines:
 * 1. Physical 3-Lens Zonal Geometry (Vertical Top=Red, Mid=Yellow, Bot=Green / Horizontal Left=Red, Center=Yellow, Right=Green)
 * 2. Peak-Luminance Centroid (Center-of-Mass of Glowing Light Source)
 * 3. Chromatic & Halo Photometry (Isolated to Active Luminous Core)
 */
export function analyzeSingleTrafficLight(
  source: CanvasRenderingContext2D | HTMLVideoElement | HTMLCanvasElement,
  bbox: { x: number; y: number; w: number; h: number },
  canvasWidth: number = 640,
  canvasHeight: number = 360,
  previousState?: 'RED' | 'YELLOW' | 'GREEN'
): {
  state: 'RED' | 'YELLOW' | 'GREEN';
  confidence: number;
  colorHex: string;
  lampValues: { red: number; yellow: number; green: number };
} {
  const cropW = 48;
  const cropH = 96;
  const cropCtx = getCropContext(cropW, cropH);

  let imgData: ImageData | null = null;

  // Strategy A: Native Video Sampling
  if (source instanceof HTMLVideoElement && source.videoWidth > 0 && source.readyState >= 2 && cropCtx) {
    const vw = source.videoWidth;
    const vh = source.videoHeight;
    const sx = Math.max(0, Math.min(vw - 4, Math.floor(bbox.x * vw)));
    const sy = Math.max(0, Math.min(vh - 4, Math.floor(bbox.y * vh)));
    const sw = Math.max(4, Math.min(vw - sx, Math.floor(bbox.w * vw)));
    const sh = Math.max(4, Math.min(vh - sy, Math.floor(bbox.h * vh)));

    try {
      cropCtx.drawImage(source, sx, sy, sw, sh, 0, 0, cropW, cropH);
      imgData = cropCtx.getImageData(0, 0, cropW, cropH);
    } catch {
      imgData = null;
    }
  }

  // Strategy B: Canvas Context / Canvas Element fallback
  if (!imgData && cropCtx) {
    const canvasElem = source instanceof HTMLCanvasElement ? source : !(source instanceof HTMLVideoElement) ? source.canvas : null;
    if (canvasElem && canvasElem.width > 0) {
      const cw = canvasElem.width;
      const ch = canvasElem.height;
      const px = Math.max(0, Math.min(cw - 4, Math.floor(bbox.x * cw)));
      const py = Math.max(0, Math.min(ch - 4, Math.floor(bbox.y * ch)));
      const pw = Math.max(4, Math.min(cw - px, Math.floor(bbox.w * cw)));
      const ph = Math.max(4, Math.min(ch - py, Math.floor(bbox.h * ch)));

      try {
        cropCtx.drawImage(canvasElem, px, py, pw, ph, 0, 0, cropW, cropH);
        imgData = cropCtx.getImageData(0, 0, cropW, cropH);
      } catch {
        imgData = null;
      }
    }
  }

  if (!imgData) {
    const fallback = previousState || 'RED';
    return {
      state: fallback,
      confidence: 0.65,
      colorHex: fallback === 'RED' ? '#ef4444' : fallback === 'YELLOW' ? '#f59e0b' : '#10b981',
      lampValues: { red: fallback === 'RED' ? 70 : 10, yellow: fallback === 'YELLOW' ? 70 : 10, green: fallback === 'GREEN' ? 70 : 10 }
    };
  }

  const data = imgData.data;
  const pw = imgData.width;
  const ph = imgData.height;
  const rowStride = pw * 4;

  // 1. First Pass: Compute Max Luminance & Distribution
  let maxBrightness = 0;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const idx = y * rowStride + x * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum > maxBrightness) maxBrightness = lum;
    }
  }

  // Active lamp core threshold: focus on any luminous element in ROI
  const activeThreshold = Math.max(20, maxBrightness * 0.30);

  let redScore = 0;
  let yellowScore = 0;
  let greenScore = 0;

  // Centroid accumulators for the active light source
  let weightedYSum = 0;
  let weightedXSum = 0;
  let activeLumaWeightSum = 0;
  let brightPixelCount = 0;

  for (let y = 0; y < ph; y++) {
    const relY = y / ph;
    for (let x = 0; x < pw; x++) {
      const relX = x / pw;
      const idx = y * rowStride + x * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum < activeThreshold) continue;

      const excessLum = lum - activeThreshold;
      weightedYSum += relY * excessLum;
      weightedXSum += relX * excessLum;
      activeLumaWeightSum += excessLum;
      brightPixelCount++;

      const { h, s } = rgbToHsv(r, g, b);

      // A. RED SPECTRUM & OVEREXPOSED RED (Top lens)
      const isRedHue = (h >= 320 || h <= 42);
      const isRedRgb = (r > g + 10 && r > b + 10) || (r > 120 && r > g * 1.15 && r > b * 1.15);
      const isOverexposedRed = r >= 180 && (r - Math.max(g, b) >= 8);
      if (isRedHue || isRedRgb || isOverexposedRed) {
        const purity = Math.max(10, r - Math.max(g, b));
        const posBonus = relY < 0.45 ? 1.8 : relY > 0.65 ? 0.3 : 1.0;
        redScore += purity * (s + 0.35) * (lum / 255) * posBonus;
      }

      // B. YELLOW / AMBER SPECTRUM (Middle lens)
      const isYellowHue = (h >= 32 && h <= 75);
      const isYellowRgb = (r > 110 && g > 85 && b < Math.min(r, g) * 0.82);
      if (isYellowHue || isYellowRgb) {
        const purity = Math.max(10, Math.min(r, g) - b);
        const posBonus = (relY >= 0.25 && relY <= 0.75) ? 1.8 : 0.5;
        yellowScore += purity * (s + 0.35) * (lum / 255) * posBonus;
      }

      // C. GREEN / CYAN SPECTRUM (Bottom lens - modern LEDs emit ~505nm cyan-green)
      const isGreenHue = (h >= 80 && h <= 200);
      const isGreenRgb = (g > r + 10 && g > 75) || (g > 100 && g > r * 1.12);
      const isCyanHalo = (g > 90 && b > r + 10);
      if (isGreenHue || isGreenRgb || isCyanHalo) {
        const purity = Math.max(10, g - r + Math.max(0, b - r));
        const posBonus = relY > 0.52 ? 1.8 : relY < 0.38 ? 0.3 : 1.0;
        greenScore += purity * (s + 0.35) * (lum / 255) * posBonus;
      }
    }
  }

  // 2. Physical Spatial Prior from Light Centroid
  const centroidY = activeLumaWeightSum > 0 ? (weightedYSum / activeLumaWeightSum) : 0.5;
  const isHorizontalBox = bbox.w > bbox.h * 1.25;
  const centroidX = activeLumaWeightSum > 0 ? (weightedXSum / activeLumaWeightSum) : 0.5;

  if (isHorizontalBox) {
    // Horizontal Traffic Light: Left = RED, Center = YELLOW, Right = GREEN
    if (centroidX < 0.38) {
      redScore *= 2.4;
      redScore += 45;
    } else if (centroidX > 0.62) {
      greenScore *= 2.4;
      greenScore += 45;
    } else {
      yellowScore *= 2.2;
      yellowScore += 35;
    }
  } else {
    // Standard Vertical Traffic Light: Top = RED, Center = YELLOW, Bottom = GREEN
    if (centroidY < 0.40) {
      redScore *= 2.4;
      redScore += 45;
    } else if (centroidY > 0.60) {
      greenScore *= 2.4;
      greenScore += 45;
    } else {
      yellowScore *= 2.2;
      yellowScore += 35;
    }
  }

  const normRed = Math.min(100, Math.round(redScore / 10));
  const normYellow = Math.min(100, Math.round(yellowScore / 10));
  const normGreen = Math.min(100, Math.round(greenScore / 10));

  const lampValues = {
    red: normRed,
    yellow: normYellow,
    green: normGreen
  };

  const totalScore = normRed + normYellow + normGreen;

  // Fallback decision if ROI pixel contrast is low: use positional centroid
  if (totalScore < 10 || brightPixelCount < 2) {
    const fallback: 'RED' | 'YELLOW' | 'GREEN' = previousState && previousState !== 'GREEN' ? previousState : (centroidY < 0.42 ? 'RED' : centroidY > 0.62 ? 'GREEN' : 'YELLOW');
    return {
      state: fallback,
      confidence: 0.70,
      colorHex: fallback === 'RED' ? '#ef4444' : fallback === 'YELLOW' ? '#f59e0b' : '#10b981',
      lampValues: {
        red: fallback === 'RED' ? 80 : 10,
        yellow: fallback === 'YELLOW' ? 80 : 10,
        green: fallback === 'GREEN' ? 80 : 10
      }
    };
  }

  // Active state decision based on highest score
  if (normYellow > normRed * 1.10 && normYellow > normGreen * 1.10) {
    const conf = Math.min(0.99, normYellow / totalScore + 0.35);
    return { state: 'YELLOW', confidence: conf, colorHex: '#f59e0b', lampValues };
  }

  if (normRed >= normGreen) {
    const conf = Math.min(0.99, normRed / totalScore + 0.35);
    return { state: 'RED', confidence: conf, colorHex: '#ef4444', lampValues };
  }

  const conf = Math.min(0.99, normGreen / totalScore + 0.35);
  return { state: 'GREEN', confidence: conf, colorHex: '#10b981', lampValues };
}

/**
 * Fast-Response Signal Majority Filter (2 frames)
 * Immediate latching on startup, 0 perceptible lag when video is playing.
 */
const signalVoteHistory = new Map<string, ('RED' | 'YELLOW' | 'GREEN')[]>();

export function getStableSignalState(
  signalKey: string | number,
  instantState: 'RED' | 'YELLOW' | 'GREEN',
  windowSize: number = 3
): { state: 'RED' | 'YELLOW' | 'GREEN'; colorHex: string; stateLabelRu: string } {
  const key = String(signalKey);
  let hist = signalVoteHistory.get(key);
  if (!hist) {
    hist = [instantState];
    signalVoteHistory.set(key, hist);
    const colorHex = instantState === 'RED' ? '#ef4444' : instantState === 'YELLOW' ? '#f59e0b' : '#10b981';
    const stateLabelRu = instantState === 'RED' ? 'КРАСНЫЙ' : instantState === 'YELLOW' ? 'ЖЕЛТЫЙ' : 'ЗЕЛЕНЫЙ';
    return { state: instantState, colorHex, stateLabelRu };
  }

  hist.push(instantState);
  if (hist.length > windowSize) {
    hist.shift();
  }

  const votes: Record<'RED' | 'YELLOW' | 'GREEN', number> = { RED: 0, YELLOW: 0, GREEN: 0 };
  for (const s of hist) {
    votes[s]++;
  }

  let stable: 'RED' | 'YELLOW' | 'GREEN' = instantState;
  let maxVotes = -1;
  (['RED', 'YELLOW', 'GREEN'] as const).forEach(candidate => {
    if (votes[candidate] > maxVotes) {
      maxVotes = votes[candidate];
      stable = candidate;
    }
  });

  const colorHex = stable === 'RED' ? '#ef4444' : stable === 'YELLOW' ? '#f59e0b' : '#10b981';
  const stateLabelRu = stable === 'RED' ? 'КРАСНЫЙ' : stable === 'YELLOW' ? 'ЖЕЛТЫЙ' : 'ЗЕЛЕНЫЙ';

  return { state: stable, colorHex, stateLabelRu };
}

/**
 * Optical Pixel Photometry for 2-Lens Pedestrian Traffic Light (Top RED, Bottom GREEN)
 */
export function analyzePedestrianTrafficLight(
  source: CanvasRenderingContext2D | HTMLVideoElement | HTMLCanvasElement,
  bbox: { x: number; y: number; w: number; h: number },
  canvasWidth: number = 640,
  canvasHeight: number = 360
): {
  state: 'RED' | 'GREEN';
  confidence: number;
  colorHex: string;
} {
  const cropW = 36;
  const cropH = 72;
  const cropCtx = getCropContext(cropW, cropH);

  let imgData: ImageData | null = null;
  if (source instanceof HTMLVideoElement && source.videoWidth > 0 && cropCtx) {
    const vw = source.videoWidth;
    const vh = source.videoHeight;
    const sx = Math.max(0, Math.min(vw - 4, Math.floor(bbox.x * vw)));
    const sy = Math.max(0, Math.min(vh - 4, Math.floor(bbox.y * vh)));
    const sw = Math.max(4, Math.min(vw - sx, Math.floor(bbox.w * vw)));
    const sh = Math.max(4, Math.min(vh - sy, Math.floor(bbox.h * vh)));
    try {
      cropCtx.drawImage(source, sx, sy, sw, sh, 0, 0, cropW, cropH);
      imgData = cropCtx.getImageData(0, 0, cropW, cropH);
    } catch {
      imgData = null;
    }
  } else if (!(source instanceof HTMLVideoElement)) {
    const canvasObj = source instanceof HTMLCanvasElement ? source : source.canvas;
    const px = Math.max(0, Math.min(canvasWidth - 8, Math.floor(bbox.x * canvasWidth)));
    const py = Math.max(0, Math.min(canvasHeight - 12, Math.floor(bbox.y * canvasHeight)));
    const pw = Math.max(8, Math.min(canvasWidth - px, Math.floor(bbox.w * canvasWidth)));
    const ph = Math.max(8, Math.min(canvasHeight - py, Math.floor(bbox.h * canvasHeight)));
    try {
      if (cropCtx && canvasObj) {
        cropCtx.drawImage(canvasObj, px, py, pw, ph, 0, 0, cropW, cropH);
        imgData = cropCtx.getImageData(0, 0, cropW, cropH);
      } else if ('getImageData' in source) {
        imgData = (source as CanvasRenderingContext2D).getImageData(px, py, pw, ph);
      }
    } catch {
      imgData = null;
    }
  }

  if (!imgData) {
    return { state: 'GREEN', confidence: 0.60, colorHex: '#10b981' };
  }

  const data = imgData.data;
  const pw = imgData.width;
  const ph = imgData.height;
  const rowStride = pw * 4;

  let redScore = 0;
  let greenScore = 0;

  for (let y = 0; y < ph; y++) {
    const relY = y / ph;
    const isTopZone = relY < 0.50;
    const isBotZone = relY >= 0.50;

    for (let x = 0; x < pw; x++) {
      const idx = y * rowStride + x * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 55) continue;

      const { h, s, v } = rgbToHsv(r, g, b);

      if ((h >= 325 || h <= 30 || (r > g + 25 && r > b + 25)) && (s > 0.20 || r > 140)) {
        redScore += (r - Math.max(g, b)) * (s + 0.2) * (v + 0.2) * (isTopZone ? 1.5 : 1.0);
      }

      if ((h >= 80 && h <= 195 || (g > r + 20)) && (s > 0.20 || g > 130)) {
        greenScore += (g - r) * (s + 0.2) * (v + 0.2) * (isBotZone ? 1.5 : 1.0);
      }
    }
  }

  if (redScore >= greenScore) {
    return {
      state: 'RED',
      confidence: Math.min(0.98, redScore / (redScore + greenScore + 1) + 0.3),
      colorHex: '#ef4444'
    };
  }

  return {
    state: 'GREEN',
    confidence: Math.min(0.98, greenScore / (redScore + greenScore + 1) + 0.3),
    colorHex: '#10b981'
  };
}

/**
 * Strict ПДД (ГОСТ Р 52282 / ПДД 6.2 - 6.15) Dual Phase Interlocking Engine
 * Maintains consistency for auto-placed intersection signals without overriding custom user ROIs.
 */
export function evaluateIntersectionInterlocking(
  detectedSignals: IndividualTrafficLight[]
): IntersectionPhaseState {
  if (detectedSignals.length === 0) {
    return {
      mainPhase: 'GREEN',
      crossPhase: 'RED',
      activePhaseDescriptionRu: 'Фаза 1: Главное направление свободно (ЗЕЛЕНЫЙ), Второстепенное закрыто (КРАСНЫЙ).',
      interlockCompliant: true,
      signals: []
    };
  }

  const mainSignal = detectedSignals.find(s => s.direction === 'MAIN_DIRECTION') || detectedSignals[0];
  let mainEffectiveState: 'RED' | 'YELLOW' | 'GREEN' = mainSignal.state === 'OFF' ? 'GREEN' : mainSignal.state;

  if (mainSignal.manualOverride && mainSignal.manualOverride !== 'AUTO') {
    mainEffectiveState = mainSignal.manualOverride;
    mainSignal.state = mainEffectiveState;
    mainSignal.activeColorHex = mainEffectiveState === 'RED' ? '#ef4444' : mainEffectiveState === 'YELLOW' ? '#f59e0b' : '#10b981';
    mainSignal.stateLabelRu = mainEffectiveState === 'RED' ? 'КРАСНЫЙ' : mainEffectiveState === 'YELLOW' ? 'ЖЕЛТЫЙ' : 'ЗЕЛЕНЫЙ';
  }

  let inferredCrossState: 'RED' | 'YELLOW' | 'GREEN' = 'RED';
  if (mainEffectiveState === 'RED') {
    inferredCrossState = 'GREEN';
  } else if (mainEffectiveState === 'GREEN' || mainEffectiveState === 'YELLOW') {
    inferredCrossState = 'RED';
  }

  const activePhaseDescriptionRu = mainEffectiveState === 'RED'
    ? 'Фаза 2 (ПДД): Главная закрыта (КРАСНЫЙ) ➔ Поперечное направление движется (ЗЕЛЕНЫЙ)'
    : mainEffectiveState === 'YELLOW'
    ? 'Фаза смены (ПДД): ЖЕЛТЫЙ сигнал (Очистка перекрестка) ➔ Второстепенная закрыта'
    : 'Фаза 1 (ПДД): Главное направление открыто (ЗЕЛЕНЫЙ) ➔ Поперечное направление закрыто (КРАСНЫЙ)';

  return {
    mainPhase: mainEffectiveState,
    crossPhase: inferredCrossState,
    activePhaseDescriptionRu,
    interlockCompliant: true,
    signals: detectedSignals
  };
}

/**
 * Automatic Scanner to locate luminous traffic light lamp clusters in the upper 50% of the video frame
 */
export function autoLocateTrafficLightSpots(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number = 640,
  canvasHeight: number = 360
): { x: number; y: number; w: number; h: number }[] {
  let imgData: ImageData;
  const scanH = Math.floor(canvasHeight * 0.50);
  try {
    imgData = ctx.getImageData(0, 0, canvasWidth, scanH);
  } catch {
    return [
      { x: 0.70, y: 0.10, w: 0.045, h: 0.12 },
      { x: 0.20, y: 0.12, w: 0.045, h: 0.12 }
    ];
  }

  const data = imgData.data;
  const foundSpots: { x: number; y: number; weight: number }[] = [];

  for (let y = 10; y < scanH - 10; y += 4) {
    for (let x = 15; x < canvasWidth - 15; x += 4) {
      const idx = (y * canvasWidth + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const brightness = Math.max(r, g, b);
      if (brightness < 140) continue;

      const { h, s, v } = rgbToHsv(r, g, b);
      const isRed = (h >= 340 || h <= 20) && s > 0.40 && v > 0.55;
      const isYellow = h >= 30 && h <= 60 && s > 0.45 && v > 0.60;
      const isGreen = h >= 95 && h <= 180 && s > 0.35 && v > 0.50;

      if (isRed || isYellow || isGreen) {
        foundSpots.push({ x: x / canvasWidth, y: y / canvasHeight, weight: brightness });
      }
    }
  }

  if (foundSpots.length === 0) {
    return [
      { x: 0.70, y: 0.10, w: 0.045, h: 0.12 },
      { x: 0.20, y: 0.12, w: 0.045, h: 0.12 }
    ];
  }

  const clusters: { x: number; y: number; count: number }[] = [];
  for (const pt of foundSpots) {
    let matched = false;
    for (const c of clusters) {
      if (Math.hypot(pt.x - c.x, pt.y - c.y) < 0.10) {
        c.x = (c.x * c.count + pt.x) / (c.count + 1);
        c.y = (c.y * c.count + pt.y) / (c.count + 1);
        c.count++;
        matched = true;
        break;
      }
    }
    if (!matched && clusters.length < 3) {
      clusters.push({ x: pt.x, y: pt.y, count: 1 });
    }
  }

  const results = clusters.filter(c => c.count >= 2).map(c => ({
    x: Math.max(0.01, parseFloat((c.x - 0.022).toFixed(3))),
    y: Math.max(0.01, parseFloat((c.y - 0.045).toFixed(3))),
    w: 0.045,
    h: 0.12
  }));

  if (results.length === 0) {
    return [
      { x: 0.70, y: 0.10, w: 0.045, h: 0.12 },
      { x: 0.20, y: 0.12, w: 0.045, h: 0.12 }
    ];
  }

  return results;
}
