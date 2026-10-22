import type { MonsterAction, MonsterKind } from './monsterAtlas';

export type MonsterBeat = {
  action: MonsterAction;
  frame: number;
  duration: number;
  effect?: 'dust';
};

function rest(duration: number): MonsterBeat[] {
  return [0, 1, 0, 1, 0].map((frame, index) => ({
    action: 'breathing', frame, duration: index === 4 ? duration - 2400 : 600,
  }));
}

function gesture(kind: MonsterKind, action: MonsterAction): MonsterBeat[] {
  const effect = action === 'stomp' || (kind === 'boss' && action === 'attack2')
    ? 'dust' : undefined;
  return [
    { action, frame: 0, duration: 280 },
    { action, frame: 1, duration: action === 'roar' ? 300 : 140 },
    { action, frame: 2, duration: 220, effect },
    { action, frame: 3, duration: 380 },
    { action: 'breathing', frame: 0, duration: 400 },
  ];
}

// Calm intervals separate authored gestures; the two monsters have different rhythms.
export function monsterTimeline(kind: MonsterKind): MonsterBeat[] {
  const actions: MonsterAction[] = kind === 'mantis'
    ? ['roar', 'attack1', 'stomp', 'attack3', 'attack2']
    : ['stomp', 'attack3', 'roar', 'attack1', 'attack2'];
  const rests = kind === 'mantis' ? [3400, 4600, 3800, 5100, 4200] : [5400, 3700, 4900, 4100, 5600];
  return actions.flatMap((action, index) => [...rest(rests[index]), ...gesture(kind, action)]);
}

export function paintMonsterEffect(context: CanvasRenderingContext2D, effect: MonsterBeat['effect']) {
  if (effect === 'dust') {
    context.fillStyle = '#667b88';
    context.fillRect(47, 142, 20, 3);
    context.fillRect(95, 141, 22, 4);
    context.fillStyle = '#c8b99b';
    context.fillRect(48, 138, 9, 4);
    context.fillRect(107, 137, 8, 4);
    context.fillRect(40, 131, 3, 3);
    context.fillRect(121, 129, 3, 3);
  }
}
