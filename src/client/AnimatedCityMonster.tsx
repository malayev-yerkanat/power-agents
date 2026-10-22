import { useEffect, useRef, useState } from 'react';
import { MONSTER_ATLAS, type MonsterKind } from './monsterAtlas';
import { monsterTimeline, paintMonsterEffect, type MonsterBeat } from './monsterAnimation';

type Props = { kind: MonsterKind; playing: boolean; className?: string };
type Sheets = { idle: HTMLImageElement; attacks: HTMLImageElement };

function drawPose(canvas: HTMLCanvasElement, sheets: Sheets, kind: MonsterKind, beat: MonsterBeat) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  const atlas = MONSTER_ATLAS[kind];
  const frame = atlas.frames[beat.action][beat.frame];
  context.clearRect(0, 0, 192, 176);
  context.imageSmoothingEnabled = false;
  context.drawImage(sheets[frame.sheet], frame.x, frame.y, frame.width, frame.height,
    Math.round(96 - frame.anchorX * atlas.scale), Math.round(160 - frame.baseline * atlas.scale),
    Math.round(frame.width * atlas.scale), Math.round(frame.height * atlas.scale));
  const pixels = context.getImageData(0, 0, 192, 176);
  for (let index = 3; index < pixels.data.length; index += 4) {
    pixels.data[index] = pixels.data[index] >= 128 ? 255 : 0;
  }
  context.putImageData(pixels, 0, 0);
  context.save();
  context.translate(16, 16);
  paintMonsterEffect(context, beat.effect);
  context.restore();
  canvas.dataset.action = beat.action;
  canvas.dataset.frame = String(beat.frame);
}

function MonsterCanvas({ kind, playing, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sheets, setSheets] = useState<Sheets | null>(null);
  const [failed, setFailed] = useState(false);
  const playback = useRef({ index: 0, remaining: 600 });

  useEffect(() => {
    let disposed = false;
    const loaded: Sheets = { idle: new Image(), attacks: new Image() };
    const ready = new Set<string>();
    for (const sheet of ['idle', 'attacks'] as const) {
      loaded[sheet].onload = () => {
        if (disposed) return;
        ready.add(sheet);
        if (ready.size === 2) setSheets(loaded);
      };
      loaded[sheet].onerror = () => { if (!disposed) setFailed(true); };
      loaded[sheet].src = MONSTER_ATLAS[kind].sources[sheet];
    }
    return () => {
      disposed = true;
      for (const image of Object.values(loaded)) { image.onload = null; image.onerror = null; }
    };
  }, [kind]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sheets || failed) return;
    const timeline = monsterTimeline(kind);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = 0;
    let disposed = false;
    const paint = () => {
      try { drawPose(canvas, sheets, kind, timeline[playback.current.index]); return true; }
      catch { setFailed(true); return false; }
    };
    const schedule = () => {
      started = performance.now();
      timer = setTimeout(() => {
        if (disposed) return;
        const index = (playback.current.index + 1) % timeline.length;
        playback.current = { index, remaining: timeline[index].duration };
        if (paint()) schedule();
      }, playback.current.remaining);
    };
    if (paint() && playing) schedule();
    return () => {
      disposed = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        playback.current = { ...playback.current, remaining: Math.max(1, playback.current.remaining - (performance.now() - started)) };
      }
    };
  }, [kind, sheets, playing, failed]);

  const fallback = failed || !sheets;
  return <span className={className} aria-hidden="true">
    {fallback && <img src={kind === 'mantis' ? '/art/villain-monster.png' : '/art/villain-boss.png'} alt="" width={320} height={320} draggable={false} />}
    <canvas ref={canvasRef} width={192} height={176} hidden={fallback} data-playing={playing && !fallback}
      style={{ position: 'absolute', left: -32, top: -32, width: 384, height: 352, maxWidth: 'none' }} />
  </span>;
}

export function AnimatedCityMonster(props: Props) {
  return <MonsterCanvas key={props.kind} {...props} />;
}
