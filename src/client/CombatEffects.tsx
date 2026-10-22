import type { ReactNode } from 'react';

type Point = { x: number; y: number };
export type CombatEffectKind = 'saber' | 'staff' | 'blaster' | 'impact' | 'defeat' | 'message' | 'review' | 'victory' | 'charge';
type Props = { kind: CombatEffectKind; frame: number; from: Point; to?: Point };

const lengths: Record<CombatEffectKind, number> = {
  saber: 9, staff: 9, blaster: 9, impact: 8, defeat: 16,
  message: 16, review: 24, victory: 24, charge: 24,
};
const colors = { blue: '#60c9ed', white: '#fff5d7', amber: '#eeb95b', ink: '#344a68', muted: '#91a6ad' };

function square(x: number, y: number, size: number, fill: string, key: string | number) {
  return <rect key={key} x={Math.round(x)} y={Math.round(y)} width={size} height={size} fill={fill} />;
}

function steps(points: number[][], origin: Point, fill: string, direction = 1) {
  const coordinates = points.map(([x, y]) => `${Math.round(origin.x + x * direction)},${Math.round(origin.y + y)}`).join(' ');
  return <polygon points={coordinates} fill={fill} />;
}

function strike(kind: 'saber' | 'staff', frame: number, point: Point, direction: number) {
  const phase = Math.floor(frame / 3);
  const origin = { x: point.x - direction * (10 - phase * 5), y: point.y + phase * 4 - 4 };
  const outer = [[-24, -28], [-8, -28], [-8, -24], [4, -24], [4, -16], [12, -16], [12, -4], [16, -4], [16, 12], [12, 12], [12, 24], [4, 24], [4, 32], [-8, 32], [-8, 36], [-24, 36], [-24, 32], [-12, 32], [-12, 24], [-4, 24], [-4, 12], [0, 12], [0, -8], [-4, -8], [-4, -20], [-12, -20], [-12, -24], [-24, -24]];
  return <g>
    {steps(outer, origin, kind === 'saber' ? colors.blue : colors.amber, direction)}
    {phase < 2 && steps([[0, -16], [4, -16], [4, -8], [8, -8], [8, 12], [4, 12], [4, 20], [0, 20], [0, 8], [4, 8], [4, -4], [0, -4]], origin, colors.white, direction)}
    {kind === 'staff' && <rect x={Math.round(point.x - 30)} y={Math.round(point.y - 2)} width={44} height={4} fill={colors.white} />}
  </g>;
}

function burst(frame: number, point: Point, defeat = false) {
  const directions = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const distance = (defeat ? 8 : 4) + Math.floor(frame / 2) * (defeat ? 4 : 3);
  const size = frame < (defeat ? 8 : 4) ? 4 : 2;
  return <g>
    {frame < 3 && square(point.x - 3, point.y - 3, 6, colors.white, 'core')}
    {directions.map(([dx, dy], index) => square(point.x + dx * distance, point.y + dy * distance - (defeat ? frame : 0), size, defeat ? (index % 2 ? colors.muted : colors.ink) : (index % 2 ? colors.amber : colors.white), index))}
  </g>;
}

function bolt(frame: number, from: Point, to: Point) {
  const progress = Math.min(1, frame / 8);
  const point = { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
  return <g>
    {frame < 2 && burst(frame, from)}
    <rect x={Math.round(point.x - 6)} y={Math.round(point.y - 2)} width={12} height={4} fill={colors.blue} />
    {square(point.x + (to.x >= from.x ? 2 : -6), point.y - 2, 4, colors.white, 'head')}
  </g>;
}

function envelope(frame: number, from: Point, to: Point) {
  const progress = frame / 15;
  const x = Math.round(from.x + (to.x - from.x) * progress);
  const y = Math.round(from.y + (to.y - from.y) * progress - Math.sin(progress * Math.PI) * 20);
  return <g>
    <rect x={x - 8} y={y - 5} width={16} height={10} fill={colors.ink} />
    <rect x={x - 6} y={y - 3} width={12} height={6} fill={colors.white} />
    {steps([[-6, -3], [-2, -3], [-2, -1], [2, -1], [2, -3], [6, -3], [6, -1], [2, -1], [2, 1], [-2, 1], [-2, -1], [-6, -1]], { x, y }, colors.blue)}
  </g>;
}

function review(frame: number, point: Point) {
  const x = Math.round(point.x), y = Math.round(point.y);
  return <g fill={colors.blue}>
    <path d={`M${x - 22} ${y - 12}h8v2h-6v20h6v2h-8z M${x + 22} ${y - 12}h-8v2h6v20h-6v2h8z`} />
    {frame < 16 ? <rect x={x - 12 + Math.floor(frame / 2) * 3} y={y - 8} width={2} height={16} /> : steps([[-8, 0], [-4, 0], [-4, 4], [0, 4], [0, 0], [4, 0], [4, -4], [8, -4], [8, 0], [4, 0], [4, 4], [0, 4], [0, 8], [-4, 8], [-4, 4], [-8, 4]], point, colors.blue)}
  </g>;
}

function celebration(frame: number, point: Point) {
  return <g>{[-24, -12, 4, 20, 30].map((offset, index) => {
    const age = frame - index * 2;
    if (age < 0 || age > 15) return null;
    const y = point.y - 14 - Math.min(age, 8) * 2 + Math.max(0, age - 8) * 4;
    return square(point.x + offset + Math.floor(age / 4) * (index % 2 ? 2 : -2), y, 3, index % 2 ? colors.amber : colors.blue, index);
  })}</g>;
}

function charge(frame: number, point: Point) {
  const corners = [[-18, -18], [0, -22], [18, -18], [22, 0], [18, 18], [0, 22], [-18, 18], [-22, 0]];
  const phase = Math.floor(frame / 3);
  return <g>{[0, 3, 6].map((offset, index) => {
    const [x, y] = corners[(phase + offset) % corners.length];
    return square(point.x + x, point.y + y, index === 0 ? 4 : 2, index === 0 ? colors.white : colors.blue, offset);
  })}</g>;
}

/** Declarative, finite 12 fps effects on the same logical pixel grid as the scene. */
export function CombatEffects({ kind, frame, from, to = from }: Props) {
  if (!Number.isFinite(frame) || frame < 0 || frame >= lengths[kind]) return null;
  const age = Math.floor(frame);
  let artwork: ReactNode;
  switch (kind) {
    case 'saber': case 'staff': artwork = strike(kind, age, to, to.x >= from.x ? 1 : -1); break;
    case 'blaster': artwork = bolt(age, from, to); break;
    case 'impact': artwork = burst(age, to); break;
    case 'defeat': artwork = burst(age, to, true); break;
    case 'message': artwork = envelope(age, from, to); break;
    case 'review': artwork = review(age, from); break;
    case 'victory': artwork = celebration(age, from); break;
    case 'charge': artwork = charge(age, from); break;
  }
  return <svg className="encounter-effects" viewBox="0 0 768 356" width="768" height="356" aria-hidden="true" focusable="false" shapeRendering="crispEdges" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 400 }}>{artwork}</svg>;
}
