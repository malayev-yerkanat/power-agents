import { z } from 'zod';

const MAX_DRAFT_LENGTH = 600_000;

const memberDraftSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  name: z.string().max(80),
  connectionId: z.string().max(100),
  model: z.string().max(300),
  role: z.string().max(300),
}).strict();

export const composerDraftSchema = z.object({
  goal: z.string().max(12_000),
  mode: z.enum(['live', 'demo']),
  members: z.array(memberDraftSchema).min(2).max(5),
  leaderId: z.string().max(80),
  repoPath: z.string().max(1000).optional(),
  checkCommand: z.string().max(1000).optional(),
}).strict().refine(
  (value) => new Set(value.members.map((item) => item.id)).size === value.members.length
    && value.members.some((item) => item.id === value.leaderId),
  'Invalid team',
);

export type ComposerDraft = z.infer<typeof composerDraftSchema>;

export const steeringDraftSchema = z.string().max(8_000);

export function readDraft<T>(
  store: Pick<Storage, 'getItem'>,
  key: string,
  schema: z.ZodType<T>,
): { value?: T; error: string } {
  try {
    const raw = store.getItem(key);
    if (raw === null) return { error: '' };
    if (raw.length > MAX_DRAFT_LENGTH) {
      return { error: 'Сохранённый черновик слишком велик и не загружен.' };
    }
    const envelope = z.object({ version: z.literal(1), value: schema })
      .strict()
      .safeParse(JSON.parse(raw));
    return envelope.success
      ? { value: envelope.data.value, error: '' }
      : { error: 'Сохранённый черновик повреждён или устарел. Начат новый черновик.' };
  } catch {
    return { error: 'Черновик не удалось восстановить. Сохранение в этой вкладке может быть недоступно.' };
  }
}

export function writeDraft<T>(
  store: Pick<Storage, 'setItem'>,
  key: string,
  value: T,
  schema: z.ZodType<T>,
): string {
  try {
    const parsed = schema.safeParse(value);
    if (!parsed.success) return 'Черновик не сохранён: данные не прошли проверку.';
    const raw = JSON.stringify({ version: 1, value: parsed.data });
    if (raw.length > MAX_DRAFT_LENGTH) return 'Черновик не сохранён: он слишком велик.';
    store.setItem(key, raw);
    return '';
  } catch {
    return 'Черновик не сохранён. Не закрывайте вкладку; скопируйте важный текст.';
  }
}
