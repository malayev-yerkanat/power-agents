export const idea = { candidates: ['Inflation', 'FOMO', 'Trading'].map(topic => ({ topic, hook: `${topic} explained in Roblox`, mechanic: 'Robux trading', payoff: 'Prices rise', scores: { hook: 4, mappability: 4, payoff: 4, timeliness: 4, safety: 5 }, total: 21 })), chosen: 0 };
const names = ['hook', 'world', 'escalation', 'twist', 'loop'];
const starts = [0, 2, 10, 40, 50], ends = [2, 10, 40, 50, 55];
export function script(words = 140) {
  const hook = 'Inflation explained in Roblox';
  const texts = [hook, ...[30, words - 64, 20, 10].map(n => Array(n).fill('Robux').join(' '))];
  return { title: 'Inflation', hook, metaphorMap: [{ real: 'money', roblox: 'Robux' }], beats: names.map((name, i) => ({ name, start: starts[i], end: ends[i], text: texts[i] })), wordCount: words, fullText: texts.join(' ') };
}

export const scenes = { scenes: names.map((beat, i) => ({ id: `s${i}`, beat, start: starts[i], end: ends[i], set: 'market', cast: ['noob'], action: 'trade', camera: 'wide' })) };
export { names, starts, ends };
