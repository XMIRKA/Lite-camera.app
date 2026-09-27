export type OfficialClass =
  | 'accident'
  | 'near_miss'
  | 'red_light'
  | 'wrong_way'
  | 'illegal_u_turn'
  | 'stopped_vehicle'
  | 'jaywalking'
  | 'failure_to_yield'
  | 'illegal_turn'
  | 'solid_line_crossing'
  | 'stop_line'
  | 'congestion'
  | 'road_obstacle'
  | 'fire_smoke';

export interface TrafficEvent {
  id: string;
  start_sec: number;
  end_sec: number;
  label: OfficialClass;
  confidence?: number;
  description?: string;
  lane?: string;
  involvedObjects?: string[];
}

export interface RiskPoint {
  t_sec: number;
  score: number;
}

export interface BoundingBox {
  id: number;
  label: 'car' | 'truck' | 'bus' | 'motorcycle' | 'pedestrian' | 'debris' | 'smoke';
  x: number; // 0 to 1 normalized
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  color?: string;
}

export interface FrameAnnotation {
  t_sec: number;
  boxes: BoundingBox[];
  activeEvents: OfficialClass[];
  riskScore: number;
}

export interface SampleVideoData {
  id: string;
  filename: string;
  title: string;
  duration: number;
  fps: number;
  resolution: string;
  lighting: 'Daylight' | 'Dusk / Twilight' | 'Night / Glare' | 'Rain / Overcast';
  description: string;
  events: TrafficEvent[];
  riskCurve: RiskPoint[];
  mockBoxesByTime: (t: number) => BoundingBox[];
  failureNote?: string;
}

export interface TeamMember {
  name: string;
  nameRu?: string;
  role: string;
  roleRu?: string;
  contribution: string;
  contributionRu?: string;
  bio: string;
  bioRu?: string;
  avatarUrl: string;
  github: string;
  linkedin: string;
  portfolio: string;
  previousProjects: { title: string; desc: string; titleRu?: string; descRu?: string; link?: string }[];
}

export interface AblationStudy {
  configuration: string;
  detector: string;
  tracker: string;
  sampleFps: number;
  scoreA: number;
  scoreB: number;
  overallM: number;
  fpsSpeed: number;
  vramMb: number;
  notes: string;
}
