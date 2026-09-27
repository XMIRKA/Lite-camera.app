export interface TrafficDensityMetrics {
  vehicleCount: number;
  pedestrianCount: number;
  averageSpeedKmh: number;
  congestionScore: number;
  congestionLevel: 'СВОБОДНО' | 'УМЕРЕННЫЙ' | 'ПЛОТНЫЙ' | 'ПРОБКА';
  levelOfService: 'LOS A' | 'LOS B' | 'LOS C' | 'LOS D' | 'LOS E' | 'LOS F';
  roadOccupancyPct: number;
  vehicleDensityPerKm: number;
  densityDescriptionRu: string;
}

export interface TrackedTrafficEntity {
  id: number;
  x: number;
  y: number;
  speedKmh: number;
}

export function calculateTrafficDensityAndLOS(entities: TrackedTrafficEntity[]): TrafficDensityMetrics {
  const vehicleCount = entities.length;
  const avgSpeed = entities.reduce((acc, e) => acc + e.speedKmh, 0) / (vehicleCount || 1);
  const score = Math.min(100, vehicleCount * 12);
  let los: 'LOS A' | 'LOS B' | 'LOS C' | 'LOS D' | 'LOS E' | 'LOS F' = 'LOS A';
  let congestionLevel: 'СВОБОДНО' | 'УМЕРЕННЫЙ' | 'ПЛОТНЫЙ' | 'ПРОБКА' = 'СВОБОДНО';

  if (score > 80) { los = 'LOS F'; congestionLevel = 'ПРОБКА'; }
  else if (score > 60) { los = 'LOS E'; congestionLevel = 'ПЛОТНЫЙ'; }
  else if (score > 40) { los = 'LOS C'; congestionLevel = 'УМЕРЕННЫЙ'; }

  return {
    vehicleCount,
    pedestrianCount: 0,
    averageSpeedKmh: parseFloat(avgSpeed.toFixed(1)),
    congestionScore: Math.round(score),
    congestionLevel,
    levelOfService: los,
    roadOccupancyPct: Math.round(score * 0.8),
    vehicleDensityPerKm: Math.round(vehicleCount * 15),
    densityDescriptionRu: 'Плотность потока в норме'
  };
}

export function evaluatePairwiseCollisionRisks(...args: any[]): any[] {
  return [];
}
