import { useEffect, useState } from 'react';
import type { Member, Run } from '../shared/types';

export type Point = { x: number; y: number };
export type CombatMode = 'idle' | 'working' | 'waiting' | 'planning' | 'synthesizing' | 'reviewing' | 'communicating' | 'victory' | 'paused' | 'failed';
export type CombatProvider = 'codex' | 'claude' | 'gemini' | 'neutral';

const providers: Readonly<Record<string, CombatProvider>> = {
  codex: 'codex', 'codex-cli': 'codex', 'openai-api': 'codex',
  claude: 'claude', 'claude-cli': 'claude', 'anthropic-api': 'claude',
  gemini: 'gemini', 'gemini-cli': 'gemini',
};

export function providerFor(connectionId: string): CombatProvider {
  return Object.hasOwn(providers, connectionId) ? providers[connectionId] : 'neutral';
}

/** Run lifecycle wins over stale task statuses left behind by cancellation or failure. */
export function memberMode(run: Run, member: Member): CombatMode {
  if (run.status === 'completed') return 'victory';
  if (run.status === 'failed') return 'failed';
  if (run.status === 'paused' || run.status === 'cancelled') return 'paused';
  if (run.status === 'awaiting_approval') return 'waiting';
  if (run.phase === 'plan') return member.id === run.leaderId ? 'planning' : 'waiting';
  if (run.phase === 'synthesize') return member.id === run.leaderId ? 'synthesizing' : 'idle';
  if (run.phase === 'review') {
    const reviewer = run.members.find(candidate => candidate.id !== run.leaderId);
    return member.id === reviewer?.id ? 'reviewing' : 'idle';
  }
  if (run.status !== 'running' || run.phase !== 'tasks') return 'idle';
  if (run.messages.some(message => message.toId === member.id && message.request && message.status === 'delivered')) return 'communicating';
  const assigned = run.tasks.filter(task => task.assigneeId === member.id);
  if (assigned.some(task => task.status === 'running')) return 'working';
  if (assigned.some(task => task.status === 'failed')) return 'failed';
  if (assigned.some(task => task.status === 'waiting' || task.status === 'pending')) return 'waiting';
  return 'idle';
}

export interface AttackSample {
  phase: 'idle' | 'windup' | 'strike' | 'recover';
  /** Progress through the current phase, including both endpoints. */
  progress: number;
  /** A short contact window, not a measure of real task progress. */
  hit: boolean;
}

/** Four seconds at 12 fps. Member offsets prevent synchronized attacks. */
export function attackSample(frame: number, index: number): AttackSample {
  const safeFrame = Number.isFinite(frame) ? Math.floor(frame) : 0;
  const safeIndex = Number.isFinite(index) ? Math.floor(index) : 0;
  const tick = ((safeFrame + safeIndex * 13) % 48 + 48) % 48;
  if (tick < 12) return { phase: 'idle', progress: tick / 11, hit: false };
  if (tick < 18) return { phase: 'windup', progress: (tick - 12) / 5, hit: false };
  if (tick < 24) return { phase: 'strike', progress: (tick - 18) / 5, hit: tick >= 21 };
  if (tick < 30) return { phase: 'recover', progress: (tick - 24) / 5, hit: false };
  return { phase: 'idle', progress: (tick - 30) / 17, hit: false };
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const prefersReducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia(reducedMotionQuery).matches : false;

export function useCombatClock(enabled: boolean): {
  frame: number;
  reducedMotion: boolean;
  motionEnabled: boolean;
  setMotionEnabled: (enabled: boolean) => void;
} {
  const [frame, setFrame] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [motionEnabled, setMotionEnabled] = useState(true);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(reducedMotionQuery);
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!enabled || !motionEnabled || reducedMotion) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const syncVisibility = () => {
      stop();
      if (document.visibilityState !== 'visible') return;
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') setFrame(current => current + 1);
      }, 1000 / 12);
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, [enabled, motionEnabled, reducedMotion]);

  return { frame, reducedMotion, motionEnabled, setMotionEnabled };
}
