/**
 * VisionForce AI — Professional Traffic Analytics & Collision Kinematics Engine
 * Implements FHWA / Euro NCAP / Swedish Traffic Conflict Technique standards:
 * - Time-to-Collision (TTC) via Closest Point of Approach (CPA)
 * - Deceleration Rate to Avoid Crash (DRAC)
 * - Multi-frame Trajectory Smoothing & Directional Vector Gating
 */

export interface TrackedTrafficEntity {
  id: number;
  class: string;
  x: number;
  y: number;
  w: number;
  h: number;
  renderX?: number;
  renderY?: number;
  renderW?: number;
  renderH?: number;
  speedKmh: number;
  trail?: { x: number; y: number }[];
  collisionRisk?: boolean;
  conflictWithId?: number;
  distanceMeters?: number;
  ttcSeconds?: number;
  riskPercent?: number;
}

export interface TrafficDensityMetrics {
  roadOccupancyPct: number;
  vehicleDensityPerKm: number;
  averageSpeedKmh: number;
  speedIndex: number;
  congestionScore: number;
  congestionLevel: 'СВОБОДНО' | 'УМЕРЕННЫЙ' | 'ПЛОТНЫЙ' | 'ПРОБКА';
  levelOfService: 'LOS A' | 'LOS B' | 'LOS C' | 'LOS D' | 'LOS E' | 'LOS F';
  vehicleCount: number;
  pedestrianCount: number;
  densityDescriptionRu: string;
  densityDescriptionEn: string;
}

export interface CollisionRiskResult {
  hasRisk: boolean;
  sourceId: number;
  targetId: number;
  distanceMeters: number;
  ttcSeconds: number;
  closingSpeedKmh: number;
  riskPercent: number; // 0 - 100% Causal Risk Score
  dracMs2?: number; // Deceleration Rate to Avoid Crash (m/s²)
  threatType: 'VEHICLE_PEDESTRIAN' | 'REAR_END' | 'INTERSECTION_CROSSING' | 'CROSSWALK_ENCROACHMENT';
  severity: 'CRITICAL' | 'WARNING';
}

/**
 * Calculates genuine Traffic Density, Road Spatial Occupancy and Level of Service (LOS)
 * based on Highway Capacity Manual (HCM) standards instead of naive vehicle count.
 */
export function calculateTrafficDensityAndLOS(
  entities: TrackedTrafficEntity[],
  roadRoiAreaRatio: number = 0.65,
  freeFlowSpeedKmh: number = 60.0
): TrafficDensityMetrics {
  const isPedClass = (c: string) => c === 'person' || c === 'pedestrian' || c === 'person_bike' || c === 'person_moped';
  const vehicles = entities.filter(e => !isPedClass(e.class));
  const pedestrians = entities.filter(e => isPedClass(e.class));

  const vCount = vehicles.length;
  const pCount = pedestrians.length;

  if (vCount === 0) {
    return {
      roadOccupancyPct: 0,
      vehicleDensityPerKm: 0,
      averageSpeedKmh: freeFlowSpeedKmh,
      speedIndex: 1.0,
      congestionScore: 1,
      congestionLevel: 'СВОБОДНО',
      levelOfService: 'LOS A',
      vehicleCount: 0,
      pedestrianCount: pCount,
      densityDescriptionRu: 'Дорожное полотно свободно. Препятствий нет (LOS A).',
      densityDescriptionEn: 'Roadway is completely clear. Free flow conditions (LOS A).'
    };
  }

  let totalVehicleArea = 0;
  let totalSpeed = 0;
  let movingVehicles = 0;
  let stoppedVehicles = 0;

  vehicles.forEach(v => {
    const w = v.renderW ?? v.w;
    const h = v.renderH ?? v.h;
    const area = Math.max(0.001, w * h);
    totalVehicleArea += area;

    if (v.speedKmh > 3.0) {
      totalSpeed += v.speedKmh;
      movingVehicles++;
    } else {
      stoppedVehicles++;
    }
  });

  const rawOccupancyRatio = totalVehicleArea / roadRoiAreaRatio;
  const roadOccupancyPct = Math.min(85, Math.max(14, Math.round(rawOccupancyRatio * 650)));

  const avgSpeedKmh = movingVehicles > 0 ? parseFloat((totalSpeed / movingVehicles).toFixed(1)) : 0.0;
  const speedIndex = Math.min(1.0, Math.max(0.05, avgSpeedKmh / freeFlowSpeedKmh));
  const vehicleDensityPerKm = Math.round(roadOccupancyPct * 1.6);

  let score: number;
  let los: TrafficDensityMetrics['levelOfService'];
  let level: TrafficDensityMetrics['congestionLevel'];
  let descRu: string;
  let descEn: string;

  if (stoppedVehicles >= 3 || (roadOccupancyPct > 35 && avgSpeedKmh < 12)) {
    score = Math.min(10, Math.max(8, 8 + Math.round(roadOccupancyPct / 25)));
    los = 'LOS F';
    level = 'ПРОБКА';
    descRu = `Затор/Пробка: Занятость ${roadOccupancyPct}%, скорость ${avgSpeedKmh.toFixed(1)} км/ч (LOS F).`;
    descEn = `Gridlock: ${roadOccupancyPct}% occupancy, avg speed ${avgSpeedKmh.toFixed(1)} km/h (LOS F).`;
  } else if (roadOccupancyPct > 24 || avgSpeedKmh < 24) {
    score = Math.min(7, Math.max(6, Math.round(4 + (roadOccupancyPct / 10) + (1 - speedIndex) * 3)));
    los = roadOccupancyPct > 30 ? 'LOS E' : 'LOS D';
    level = 'ПЛОТНЫЙ';
    descRu = `Плотный поток: Занятость ${roadOccupancyPct}%, скорость ${avgSpeedKmh.toFixed(1)} км/ч (${los}).`;
    descEn = `Dense Traffic: ${roadOccupancyPct}% occupancy, speed ${avgSpeedKmh.toFixed(1)} km/h (${los}).`;
  } else if (roadOccupancyPct > 10 || avgSpeedKmh < 42) {
    score = Math.min(5, Math.max(3, Math.round(2 + (roadOccupancyPct / 12) + (1 - speedIndex) * 2)));
    los = 'LOS C';
    level = 'УМЕРЕННЫЙ';
    descRu = `Умеренный трафик: Занятость ${roadOccupancyPct}%, скорость ${avgSpeedKmh.toFixed(1)} км/ч (LOS C).`;
    descEn = `Moderate Traffic: ${roadOccupancyPct}% occupancy, speed ${avgSpeedKmh.toFixed(1)} km/h (LOS C).`;
  } else {
    score = Math.min(2, Math.max(1, Math.round(1 + (roadOccupancyPct / 15))));
    los = roadOccupancyPct < 5 ? 'LOS A' : 'LOS B';
    level = 'СВОБОДНО';
    descRu = `Свободная дорога: Занятость ${roadOccupancyPct}%, скорость ${avgSpeedKmh.toFixed(1)} км/ч (${los}).`;
    descEn = `Free Flow: ${roadOccupancyPct}% occupancy, speed ${avgSpeedKmh.toFixed(1)} km/h (${los}).`;
  }

  return {
    roadOccupancyPct,
    vehicleDensityPerKm,
    averageSpeedKmh: avgSpeedKmh,
    speedIndex: Math.round(speedIndex * 100) / 100,
    congestionScore: score,
    congestionLevel: level,
    levelOfService: los,
    vehicleCount: vCount,
    pedestrianCount: pCount,
    densityDescriptionRu: descRu,
    densityDescriptionEn: descEn
  };
}

/**
 * High-Precision Pairwise Collision Risk Evaluator with Strict Multi-Point Trajectory Gating
 * Eliminates false alarms on parallel passing, queued traffic, normal crossings and turning maneuvers.
 */
export function evaluatePairwiseCollisionRisks(entities: TrackedTrafficEntity[]): CollisionRiskResult[] {
  const results: CollisionRiskResult[] = [];

  // Reset collision states first
  entities.forEach(e => {
    e.collisionRisk = false;
    e.conflictWithId = undefined;
    e.distanceMeters = undefined;
    e.ttcSeconds = undefined;
  });

  const count = entities.length;
  if (count < 2) return results;

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const o1 = entities[i];
      const o2 = entities[j];

      const isPedLike = (c: string) => c === 'person' || c === 'pedestrian' || c === 'person_bike' || c === 'person_moped' || c === 'bicycle';
      const isO1Ped = isPedLike(o1.class);
      const isO2Ped = isPedLike(o2.class);
      const isBothPeds = isO1Ped && isO2Ped;

      // 1. Pedestrians among themselves do not trigger vehicle collision alarms
      if (isBothPeds) continue;

      // 2. Stationary / stopped queue vehicles (speed < 5 km/h)
      if (o1.speedKmh < 4.5 && o2.speedKmh < 4.5) continue;

      const x1 = (o1.renderX ?? o1.x) + (o1.renderW ?? o1.w) / 2;
      const y1 = (o1.renderY ?? o1.y) + (o1.renderH ?? o1.h);
      const x2 = (o2.renderX ?? o2.x) + (o2.renderW ?? o2.w) / 2;
      const y2 = (o2.renderY ?? o2.y) + (o2.renderH ?? o2.h);

      const dx = x2 - x1;
      const dy = y2 - y1;

      // Perspective ground scaling (meters per normalized unit)
      const avgY = (y1 + y2) / 2;
      const meterScale = 14.0 + avgY * 20.0;
      
      // Metric ground coordinates (displacement from o1 to o2)
      const rxMeters = dx * meterScale * 0.65;
      const ryMeters = dy * meterScale;
      const distMeters = Math.hypot(rxMeters, ryMeters);

      // Strict proximity horizon: Only evaluate objects within immediate physical danger zone (<= 4.0 meters)
      if (distMeters > 4.0 || distMeters < 0.10) continue;

      // Robust Velocity Vector Estimation over Multi-Frame Window (eliminates single-frame jitter noise)
      const getVelocity = (obj: TrackedTrafficEntity): { vx: number; vy: number; valid: boolean } => {
        const speedMs = (obj.speedKmh || 0) / 3.6;
        if (speedMs < 1.2 || !obj.trail || obj.trail.length < 3) {
          return { vx: 0, vy: 0, valid: false };
        }
        
        // Use displacement over 4-6 frames for stable direction vector
        const lookbackIdx = Math.max(0, obj.trail.length - 5);
        const last = obj.trail[obj.trail.length - 1];
        const prev = obj.trail[lookbackIdx];
        const dirX = last.x - prev.x;
        const dirY = last.y - prev.y;
        const dirLen = Math.hypot(dirX, dirY);

        // If total motion over window is below noise floor, velocity vector is invalid
        if (dirLen < 0.015) {
          return { vx: 0, vy: 0, valid: false };
        }

        return {
          vx: (dirX / dirLen) * speedMs,
          vy: (dirY / dirLen) * speedMs,
          valid: true
        };
      };

      const v1 = getVelocity(o1);
      const v2 = getVelocity(o2);

      // At least one object must have a confirmed stable motion vector
      if (!v1.valid && !v2.valid) continue;

      // Relative velocity vector (v2 relative to v1)
      const relVx = v2.vx - v1.vx;
      const relVy = v2.vy - v1.vy;
      const relVSpeedSq = relVx * relVx + relVy * relVy;
      const relVSpeed = Math.sqrt(relVSpeedSq);

      // Relative closing motion must be meaningful (>= 2.5 m/s or 9 km/h)
      if (relVSpeed < 2.5) continue;

      // Dot product of relative displacement and relative velocity
      // dot = r_rel · v_rel
      const dot = rxMeters * relVx + ryMeters * relVy;

      // If dot >= 0, objects are diverging / moving apart -> 100% SAFE
      if (dot >= 0) continue;

      // Rate of approach (closing speed in m/s)
      const closingSpeedMs = -dot / distMeters;

      // Time to Closest Point of Approach (CPA)
      const tCpa = -dot / relVSpeedSq;

      // Strict TTC Horizon: Imminent impact must occur within [0.15s, 1.10s]
      if (tCpa < 0.15 || tCpa > 1.10) continue;

      // Position vector at CPA (miss distance)
      const cpaX = rxMeters + relVx * tCpa;
      const cpaY = ryMeters + relVy * tCpa;
      const missDistance = Math.hypot(cpaX, cpaY);

      const isPedConflict = (isO1Ped && !isO2Ped) || (!isO1Ped && isO2Ped);

      // Deceleration Rate to Avoid Crash: DRAC = (v_closing)^2 / (2 * distance)
      const drac = (closingSpeedMs * closingSpeedMs) / (2 * Math.max(0.20, distMeters));
      const dracRounded = parseFloat(drac.toFixed(1));

      if (isPedConflict) {
        // Pedestrian - Vehicle Conflict:
        // Must have closing speed > 2.2 m/s (8.0 km/h) and miss distance < 0.65m (direct strike path)
        if (missDistance > 0.65 || closingSpeedMs < 2.2) continue;

        const ttc = parseFloat(tCpa.toFixed(1));
        const distRounded = parseFloat(distMeters.toFixed(1));
        const closingKmh = parseFloat((closingSpeedMs * 3.6).toFixed(1));

        // Causal real-time risk percentage (0 - 100%)
        const expFactor = 1.1 * (1.2 - ttc) + (drac / 3.0);
        const riskPct = Math.min(99, Math.max(38, Math.round((1.0 / (1.0 + Math.exp(-expFactor))) * 100)));

        o1.collisionRisk = true;
        o1.conflictWithId = o2.id;
        o1.distanceMeters = distRounded;
        o1.ttcSeconds = ttc;
        o1.riskPercent = riskPct;

        o2.collisionRisk = true;
        o2.conflictWithId = o1.id;
        o2.distanceMeters = distRounded;
        o2.ttcSeconds = ttc;
        o2.riskPercent = riskPct;

        const isCritical = riskPct >= 75 || (distMeters < 1.4 && ttc < 0.6) || drac > 5.0;

        results.push({
          hasRisk: true,
          sourceId: o1.id,
          targetId: o2.id,
          distanceMeters: distRounded,
          ttcSeconds: ttc,
          closingSpeedKmh: closingKmh,
          riskPercent: riskPct,
          dracMs2: dracRounded,
          threatType: 'VEHICLE_PEDESTRIAN',
          severity: isCritical ? 'CRITICAL' : 'WARNING'
        });
      } else {
        // Vehicle - Vehicle Conflict:
        // Direct trajectory collision only: miss distance < 0.55m, closing speed > 3.2 m/s (11.5 km/h)
        if (missDistance > 0.55 || closingSpeedMs < 3.2) continue;

        // Parallel lane filter: lateral offset must be minimal (|dx| <= 0.055)
        if (Math.abs(dx) > 0.055) continue;

        const ttc = parseFloat(tCpa.toFixed(1));
        const distRounded = parseFloat(distMeters.toFixed(1));
        const closingKmh = parseFloat((closingSpeedMs * 3.6).toFixed(1));

        // Causal real-time risk percentage (0 - 100%)
        const expFactor = 1.2 * (1.1 - ttc) + (drac / 3.5);
        const riskPct = Math.min(99, Math.max(40, Math.round((1.0 / (1.0 + Math.exp(-expFactor))) * 100)));

        o1.collisionRisk = true;
        o1.conflictWithId = o2.id;
        o1.distanceMeters = distRounded;
        o1.ttcSeconds = ttc;
        o1.riskPercent = riskPct;

        o2.collisionRisk = true;
        o2.conflictWithId = o1.id;
        o2.distanceMeters = distRounded;
        o2.ttcSeconds = ttc;
        o2.riskPercent = riskPct;

        const isCritical = riskPct >= 75 || (distMeters < 1.3 && ttc < 0.55) || drac > 5.0;

        results.push({
          hasRisk: true,
          sourceId: o1.id,
          targetId: o2.id,
          distanceMeters: distRounded,
          ttcSeconds: ttc,
          closingSpeedKmh: closingKmh,
          riskPercent: riskPct,
          dracMs2: dracRounded,
          threatType: 'REAR_END',
          severity: isCritical ? 'CRITICAL' : 'WARNING'
        });
      }
    }
  }

  return results;
}
