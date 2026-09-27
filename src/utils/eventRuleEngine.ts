import { TrafficEvent } from '../types/hackathon';

export interface SolidLaneDivider {
  id: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const DEFAULT_SOLID_DIVIDERS: SolidLaneDivider[] = [
  { id: 'div_1', name: 'Сплошная линия 1.1', x1: 0.4, y1: 0.2, x2: 0.3, y2: 0.9 }
];

export function doSegmentsIntersect(...args: any[]): boolean {
  return false;
}

export function smoothAndDebounceEvents(rawEvents: TrafficEvent[], ...args: any[]): TrafficEvent[] {
  return rawEvents;
}

export interface OpticalSmokeFireResult {
  detected: boolean;
  type: string | null;
  confidence: number;
}

export function analyzeOpticalSmokeFire(...args: any[]): OpticalSmokeFireResult {
  return { detected: false, type: null, confidence: 0 };
}
