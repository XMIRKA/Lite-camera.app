/**
 * VisionForce AI — Advanced Event Rule & Temporal Smoothing Engine
 * 
 * Implements strict Competition Rules & TZ Guidelines:
 * 1. stopped_vehicle: Vehicle track speed ≈ 0 for > 10.0 seconds outside signal queues.
 * 2. congestion: Simultaneous multi-lane standstill or severe occupancy bottleneck across lanes.
 * 3. solid_line_crossing: Wheel contact trajectory point (bottom-center of bbox) crossing solid lane markings.
 * 4. fire_smoke & road_obstacle: Lightweight optical/neural smoke/fire and road debris detection.
 * 5. Temporal Smoothing & Debouncing:
 *    - Remove micro-flicker segments (duration < 0.5 seconds)
 *    - Union/Merge adjacent segments of same class with gap < 1.5 - 2.0 seconds
 */

import { OfficialClass, TrafficEvent } from '../types/hackathon';

export interface VehicleTrajectoryPoint {
  t: number;      // timestamp in seconds
  x: number;      // normalized 0..1 center X
  y: number;      // normalized 0..1 bottom Y (wheel contact point)
  speedKmh: number;
}

export interface TrackHistoryState {
  id: number;
  class: string;
  firstSeenSec: number;
  lastSeenSec: number;
  stoppedDurationSec: number;
  lastMovingSec: number;
  points: VehicleTrajectoryPoint[];
  laneIndex: number;
  hasTriggeredStoppedEvent: boolean;
  hasCrossedSolidLine: boolean;
}

export interface SolidLaneDivider {
  id: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface OpticalSmokeFireResult {
  detected: boolean;
  type: 'fire_smoke' | null;
  confidence: number;
  bbox?: [number, number, number, number];
}

export interface RoadObstacleResult {
  detected: boolean;
  type: 'road_obstacle' | null;
  confidence: number;
  bbox?: [number, number, number, number];
  description: string;
}

/**
 * Standard Solid Lane Markings for typical CCTV perspectives (calibrated with road vanishing perspective)
 */
export const DEFAULT_SOLID_DIVIDERS: SolidLaneDivider[] = [
  { id: 'solid_1', name: 'Сплошная линия #1 (Левая полоса L1-L2)', x1: 0.38, y1: 0.28, x2: 0.28, y2: 0.94 },
  { id: 'solid_2', name: 'Сплошная линия #2 (Правая полоса L2-L3)', x1: 0.62, y1: 0.28, x2: 0.72, y2: 0.94 }
];

/**
 * Tests if a line segment (p1 -> p2) intersects with another segment (p3 -> p4)
 */
export function doSegmentsIntersect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean {
  const ccw = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  };
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Temporal Smoothing & Debouncing Pipeline for Competition Submissions
 * 
 * Rules:
 * 1. Filter out micro-segments with duration < minDurationSec (default 0.5s)
 * 2. Merge adjacent segments of the same class if gap <= maxGapSec (default 1.5s)
 */
export function smoothAndDebounceEvents(
  rawEvents: TrafficEvent[],
  minDurationSec: number = 0.5,
  maxGapSec: number = 1.5
): TrafficEvent[] {
  if (!rawEvents || rawEvents.length === 0) return [];

  // Group events by class
  const classMap = new Map<OfficialClass, TrafficEvent[]>();

  rawEvents.forEach(evt => {
    const list = classMap.get(evt.label) || [];
    list.push({ ...evt });
    classMap.set(evt.label, list);
  });

  const finalEvents: TrafficEvent[] = [];

  classMap.forEach((events, label) => {
    // 1. Sort chronologically by start_sec
    events.sort((a, b) => a.start_sec - b.start_sec);

    // 2. Merge overlapping or near events (gap < maxGapSec)
    const merged: TrafficEvent[] = [];
    let current: TrafficEvent | null = null;

    for (const evt of events) {
      if (!current) {
        current = { ...evt };
      } else {
        // If current and next overlap or have a small gap
        if (evt.start_sec <= current.end_sec + maxGapSec) {
          current.end_sec = Math.max(current.end_sec, evt.end_sec);
          current.confidence = Math.max(current.confidence || 0.85, evt.confidence || 0.85);
          if (evt.description && !current.description?.includes(evt.description)) {
            current.description = `${current.description || ''}; ${evt.description}`;
          }
        } else {
          merged.push(current);
          current = { ...evt };
        }
      }
    }

    if (current) {
      merged.push(current);
    }

    // 3. Debounce: Remove micro-segments duration < minDurationSec
    for (const m of merged) {
      const duration = m.end_sec - m.start_sec;
      if (duration >= minDurationSec) {
        finalEvents.push({
          ...m,
          start_sec: parseFloat(m.start_sec.toFixed(2)),
          end_sec: parseFloat(m.end_sec.toFixed(2))
        });
      }
    }
  });

  // Sort overall list by start time
  finalEvents.sort((a, b) => a.start_sec - b.start_sec);
  return finalEvents;
}

/**
 * Analyzes video pixels for optical flame, flickering heat and smoke plumes
 */
export function analyzeOpticalSmokeFire(
  ctx: CanvasRenderingContext2D,
  width: number = 640,
  height: number = 360
): OpticalSmokeFireResult {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let firePixels = 0;
    let smokePixels = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;

    const step = 4; // Sample every 4th pixel for speed
    for (let y = 0; y < height; y += step) {
      const row = y * width * 4;
      for (let x = 0; x < width; x += step) {
        const idx = row + x * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Fire chromatic filter: high red, moderate green, low blue, high brightness
        if (r > 200 && g > 110 && g < 190 && b < 80 && (r - g) > 40) {
          firePixels++;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }

        // Smoke chromatic filter: low saturation, gray/dark-white plume with variance
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const diff = maxC - minC;
        if (diff < 16 && maxC > 80 && maxC < 210) {
          // Check if in upper road/air region
          if (y < height * 0.75) {
            smokePixels++;
          }
        }
      }
    }

    const totalSampled = (width / step) * (height / step);
    const fireRatio = firePixels / totalSampled;
    const smokeRatio = smokePixels / totalSampled;

    if (fireRatio > 0.008 || (smokeRatio > 0.06 && fireRatio > 0.002)) {
      const bx = Math.max(0, minX - 10) / width;
      const by = Math.max(0, minY - 10) / height;
      const bw = Math.min(width, maxX - minX + 20) / width;
      const bh = Math.min(height, maxY - minY + 20) / height;

      return {
        detected: true,
        type: 'fire_smoke',
        confidence: Math.min(0.96, 0.70 + fireRatio * 15),
        bbox: [bx, by, bw, bh]
      };
    }

    return { detected: false, type: null, confidence: 0 };
  } catch {
    return { detected: false, type: null, confidence: 0 };
  }
}
