import { z } from 'zod';
const text = z.string().trim().min(1);
const score = z.number().int().min(1).max(5);
export const beatNames = ['hook', 'world', 'escalation', 'twist', 'loop'] as const;
export const wordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;
const hook = text.regex(/\S.* explained in Roblox$/, 'Hook must end with explained in Roblox');
export const ideaSchema = z.object({ candidates: z.array(z.object({
  topic: text, hook, mechanic: text, payoff: text,
  scores: z.object({ hook: score, mappability: score, payoff: score, timeliness: score, safety: score }).strict(),
  total: z.number().int(),
}).strict()).min(3).max(5), chosen: z.number().int().nonnegative() }).strict().superRefine((value, ctx) => {
  value.candidates.forEach((candidate, i) => {
    if (candidate.hook !== `${candidate.topic} explained in Roblox`) ctx.addIssue({ code: 'custom', message: 'Hook must be <Topic> explained in Roblox', path: ['candidates', i, 'hook'] });
    if (candidate.total !== Object.values(candidate.scores).reduce((sum, n) => sum + n, 0)) ctx.addIssue({ code: 'custom', message: 'Total must equal the five scores', path: ['candidates', i, 'total'] });
  });
  const chosen = value.candidates[value.chosen];
  if (!chosen || chosen.total < 18 || value.candidates.some(c => c.total > chosen.total)) ctx.addIssue({ code: 'custom', message: 'Choose the highest scoring candidate with total >= 18', path: ['chosen'] });
});
const interval = { start: z.number().finite().nonnegative(), end: z.number().finite().positive() };
/** Allowed spoken length around the node's target; the voice's pace decides the target, not the brief's 130–160. */
export const scriptWordRange = (target: number): [number, number] => [Math.max(80, target - 10), Math.min(200, target + 10)];
// Models miscount words, so wordCount is always replaced with the measured count before validation.
export const scriptSchema = z.preprocess(value => value && typeof value === 'object' && typeof (value as { fullText?: unknown }).fullText === 'string'
  ? { ...value, wordCount: wordCount((value as { fullText: string }).fullText) } : value, z.object({ title: text, hook,
  metaphorMap: z.array(z.object({ real: text, roblox: text }).strict()).min(1),
  beats: z.array(z.object({ name: z.enum(beatNames), ...interval, text }).strict()).length(5),
  wordCount: z.number().int(), fullText: text,
}).strict().superRefine((value, ctx) => {
  const count = wordCount(value.fullText);
  // Outer bounds only; the Script node enforces its own target ±10 (see scriptWordRange).
  if (count < 80 || count > 200) ctx.addIssue({ code: 'custom', message: `Script has ${count} words; return 80–200 words`, path: ['wordCount'] });
  const normalize = (s: string) => s.trim().replace(/\s+/gu, ' ');
  if (normalize(value.fullText) !== normalize(value.beats.map(b => b.text).join(' '))) ctx.addIssue({ code: 'custom', message: 'fullText must concatenate beat texts' });
  if (value.beats[0].text.replace(/[.!?]+$/, '') !== value.hook) ctx.addIssue({ code: 'custom', message: 'First beat must speak the hook' });
  const starts = [0, 2, 10, 40, 50], ends = [2, 10, 40, 50, 55];
  value.beats.forEach((beat, i) => {
    if (beat.name !== beatNames[i] || beat.start !== starts[i] || beat.end !== ends[i]) ctx.addIssue({ code: 'custom', message: 'Use fixed hook 0–2, world 2–10, escalation 10–40, twist 40–50, loop 50–55 beat times', path: ['beats', i] });
  });
}));
export const scenesSchema = z.object({ scenes: z.array(z.object({ id: text, beat: z.enum(beatNames), ...interval,
  set: text, cast: z.array(text), action: text, camera: text, onScreenText: text.optional(),
}).strict()).min(5).max(100) }).strict();
export type BeatTiming = { beat: typeof beatNames[number]; start: number; end: number };
const timingSchema = z.array(z.object({ beat: z.enum(beatNames), ...interval })).length(5);
/** F4 may supply explicit beat intervals or forced-alignment word intervals. */
export function sceneTimings(script: z.infer<typeof scriptSchema>, timings?: unknown): BeatTiming[] {
  if (timings === undefined) return script.beats.map(({ name, start, end }) => ({ beat: name, start, end }));
  const object = z.object({ beats: z.unknown().optional(), words: z.unknown().optional() }).parse(timings);
  let result: BeatTiming[];
  if (object.beats !== undefined) result = timingSchema.parse(object.beats);
  else {
    const words = z.array(z.object(interval)).min(1).parse(object.words);
    if (words.some((w, i) => w.end <= w.start || (i > 0 && w.start < words[i - 1].end))) throw new Error('Word timings must be ordered and non-overlapping');
    if (words.length !== wordCount(script.fullText)) throw new Error('Timings word count must match script');
    let offset = 0;
    result = script.beats.map(beat => {
      const start = offset; offset += wordCount(beat.text);
      return { beat: beat.name, start: words[start].start, end: words[offset - 1].end };
    });
  }
  if (result.some((t, i) => t.beat !== beatNames[i] || t.end <= t.start || (i > 0 && t.start < result[i - 1].end))) throw new Error('Timings must cover five ordered non-overlapping beats');
  return result;
}
export function validateSceneCoverage(value: z.infer<typeof scenesSchema>, timings: BeatTiming[]): void {
  if (new Set(value.scenes.map(s => s.id)).size !== value.scenes.length) throw new Error('Scene IDs must be unique');
  let previous = -1;
  for (const scene of value.scenes) {
    const index = beatNames.indexOf(scene.beat), t = timings[index];
    if (index < previous || scene.end <= scene.start || scene.start < t.start || scene.end > t.end) throw new Error('Scenes must follow beat order and timing intervals');
    previous = index;
  }
  for (const timing of timings) {
    const scenes = value.scenes.filter(s => s.beat === timing.beat);
    if (!scenes.length || scenes[0].start !== timing.start || scenes.at(-1)!.end !== timing.end || scenes.some((s, i) => i > 0 && Math.abs(s.start - scenes[i - 1].end) > .001)) throw new Error(`Scenes must cover the entire ${timing.beat} beat without gaps or overlaps`);
  }
}
