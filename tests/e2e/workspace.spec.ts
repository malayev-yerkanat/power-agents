import { expect, test } from '@playwright/test';
import { completed, mockWorkspace } from './fixtures';

for (const width of [320, 390, 768, 1440]) {
  test(`no page overflow at ${width}px`, async ({ page }) => {
    await mockWorkspace(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator('#team-settings > summary').click();
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      available: document.documentElement.clientWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.available);
  });
}

test('phone functional controls have 44px targets', async ({ page }) => {
  await mockWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#team-settings > summary').click();
  const bad = await page.locator('.header-nav button, .icon-button, .leader-button, .city-motion-toggle').evaluateAll(elements =>
    elements.map(element => ({
      name: element.getAttribute('aria-label') || element.textContent,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })).filter(item => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44)));
  expect(bad).toEqual([]);
  const unreadable = await page.locator('.header-nav button, .header-new-task, .leader-button, .primary-button, .city-motion-toggle')
    .evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0)
      .map(element => ({ name: element.getAttribute('aria-label') || element.textContent,
        fontSize: parseFloat(getComputedStyle(element).fontSize) }))
      .filter(item => item.fontSize < 12));
  expect(unreadable).toEqual([]);
});

test('workspace bootstrap is isolated', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Составить план', exact: true })).toBeEnabled();
});

test('short goal validation returns focus to the field', async ({ page }) => {
  await mockWorkspace(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const goal = page.getByLabel('Что нужно сделать?', { exact: true });
  await goal.fill('short');
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect(goal).toBeFocused();
  await expect(goal).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#goal-error')).toContainText('минимум 10');
});

test('invalid collapsed team expands before focusing the member', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await page.getByLabel('Что нужно сделать?', { exact: true }).fill('Полная цель для проверки формы');
  await page.locator('#team-settings > summary').click();
  const name = page.getByLabel('Имя участника 1', { exact: true });
  await name.fill('');
  await page.locator('#team-settings > summary').click();
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect(page.locator('#team-settings')).toHaveAttribute('open', '');
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
});

test('editing one invalid field preserves other field guidance', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await page.locator('#team-settings > summary').click();
  const name = page.getByLabel('Имя участника 1', { exact: true });
  await name.fill('');
  await page.locator('#team-settings > summary').click();
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  const goal = page.getByLabel('Что нужно сделать?', { exact: true });
  const nameError = page.locator(`#${await name.getAttribute('id')}-error`);
  await expect(goal).toHaveAttribute('aria-invalid', 'true');
  await expect(nameError).toContainText('Укажите имя');
  await goal.fill('Теперь цель содержит достаточно подробностей');
  await expect(goal).not.toHaveAttribute('aria-invalid');
  await expect(nameError).toContainText('Укажите имя');
});

test('removed provider cannot submit a restored demo draft', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('power-agents:composer:v1', JSON.stringify({ version: 1, value: {
      goal: 'Проверить демо с удалённым подключением', mode: 'demo', leaderId: 'member-one',
      members: [
        { id: 'member-one', name: 'Автор', connectionId: 'removed-provider', model: '', role: 'Автор' },
        { id: 'member-two', name: 'Ревьюер', connectionId: 'codex', model: '', role: 'Ревью' },
      ],
    } }));
  });
  await mockWorkspace(page);
  const posts: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') posts.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Составить демо-план', exact: true }).click();
  const provider = page.locator('#connection-member-one');
  await expect(page.locator('#team-settings')).toHaveAttribute('open', '');
  await expect(provider).toBeFocused();
  await expect(provider).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#connection-member-one-error')).toBeVisible();
  expect(posts).toHaveLength(0);
});

test('creation draft survives visiting a run and reloading', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await page.getByLabel('Что нужно сделать?', { exact: true }).fill('Сохранить это описание задачи');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();
  await page.getByRole('button', { name: 'Новая задача', exact: true }).click();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('Сохранить это описание задачи');
  await page.reload();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('Сохранить это описание задачи');
});

test('failed creation preserves the draft and explicit clear removes it', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await page.getByLabel('Что нужно сделать?', { exact: true }).fill('Сохранить после ошибки запроса');
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic request rejected');
  await page.reload();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('Сохранить после ошибки запроса');
  await page.getByRole('button', { name: 'Очистить черновик', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('');
});

test('successful creation clears its draft', async ({ page }) => {
  await mockWorkspace(page);
  let release: (() => void) | undefined;
  await page.route('**/api/runs', async route => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { run: completed } });
  });
  await page.goto('/');
  await page.getByLabel('Что нужно сделать?', { exact: true }).fill('Сохранить до успешного создания задачи');
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  expect(await page.evaluate(() => sessionStorage.getItem('power-agents:composer:v1'))).toContain('Сохранить до успешного создания задачи');
  release!();
  await expect(page.getByRole('heading', { name: 'Проверяемый результат' })).toBeVisible();
  await page.getByRole('button', { name: 'Новая задача', exact: true }).click();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('');
  await page.reload();
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toHaveValue('');
});

test('restored missing provider stays selected until the user corrects it', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('power-agents:composer:v1', JSON.stringify({ version: 1, value: {
      goal: 'Выбрать новое подключение для задачи', mode: 'live', leaderId: 'member-one',
      members: [
        { id: 'member-one', name: 'Автор', connectionId: 'removed-provider', model: '', role: 'Автор' },
        { id: 'member-two', name: 'Ревьюер', connectionId: 'codex', model: '', role: 'Ревью' },
      ],
    } }));
  });
  await mockWorkspace(page);
  await page.goto('/');
  await page.getByText('Настроить команду').click();
  const provider = page.getByLabel('Подключение').first();
  await expect(provider).toHaveValue('removed-provider');
  await expect(provider.locator('option:checked')).toHaveText('Недоступное подключение: removed-provider');
});

test('an empty connection list keeps the draft editable without offering launch', async ({ page }) => {
  await mockWorkspace(page, []);
  await page.route('**/api/bootstrap', route => route.fulfill({ json: {
    connections: [], runs: [], totalRuns: 0, csrfToken: 'fixture-only',
    eventCursor: 0, maxConcurrent: 3,
  } }));
  await page.goto('/');
  const goal = page.getByLabel('Что нужно сделать?', { exact: true });
  await goal.fill('Подготовить задачу до настройки подключений');
  await expect(page.getByText('Подключения не найдены. Обновите их статус перед запуском.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Составить план', exact: true })).toBeDisabled();
  await page.reload();
  await expect(goal).toHaveValue('Подготовить задачу до настройки подключений');
});

test('newer steering text survives a successful in-flight send', async ({ page }) => {
  const paused = { ...completed, status: 'paused' as const, phase: 'tasks' as const };
  await mockWorkspace(page, [paused]);
  let release: (() => void) | undefined;
  await page.route('**/api/runs/review-fixture/messages', async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { run: paused } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();
  const field = page.getByLabel('Направьте команду', { exact: true });
  await field.fill('Первое уточнение');
  await page.getByRole('button', { name: 'Отправить команде', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await field.fill('Следующее уточнение');
  release!();
  await expect(field).toHaveValue('Следующее уточнение');
  await page.reload();
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();
  await expect(field).toHaveValue('Следующее уточнение');
});

test('terminal run keeps a restored steering draft copyable', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('power-agents:steering:review-fixture:v1',
      JSON.stringify({ version: 1, value: 'Сохранённое уточнение' }));
  });
  await mockWorkspace(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();
  const field = page.getByLabel('Направьте команду', { exact: true });
  await expect(field).toHaveValue('Сохранённое уточнение');
  await expect(field).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Отправить команде', exact: true })).toBeDisabled();
});

test('goal precedes decoration in first viewport', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  const goal = page.getByLabel('Что нужно сделать?', { exact: true });
  await expect(goal).toBeVisible();
  const box = await goal.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeLessThan(400);
});

test('collapsed city defers artwork requests until expansion', async ({ page }) => {
  await mockWorkspace(page);
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/');
  await expect(page.getByLabel('Что нужно сделать?', { exact: true })).toBeVisible();
  const cityAssets = ['/art/city-v2/', '/art/vehicles-v3/', '/art/monster-motion/'];
  expect(requests.filter(url => cityAssets.some(path => url.includes(path)))).toEqual([]);
  await page.getByRole('button', { name: 'Показать город', exact: true }).click();
  await expect.poll(() => requests.some(url => url.includes('/art/city-v2/panorama.png'))).toBe(true);
  await expect.poll(() => requests.some(url => url.includes('/art/vehicles-v3/airliner.png'))).toBe(true);
  await expect.poll(() => requests.some(url => url.includes('/art/monster-motion/'))).toBe(true);
  await page.getByRole('button', { name: 'Свернуть город', exact: true }).click();
  await expect(page.locator('#ambient-city')).toBeHidden();
});

test('completed result is above the optional encounter', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();

  const result = page.getByRole('heading', { name: 'План проверки', exact: true });
  await expect(result).toBeVisible();
  expect((await result.boundingBox())!.y).toBeLessThan(900);
  expect(await page.locator('.artifact').first().evaluate(element =>
    Boolean(element.compareDocumentPosition(document.querySelector('.encounter-panel')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.locator('.encounter-stage')).toHaveCount(0);
});

test('paused recovery keeps the actual phase and focuses the clarification field', async ({ page }) => {
  const paused = { ...completed, status: 'paused' as const, phase: 'synthesize' as const,
    artifacts: [{ id: 'review', title: 'Review', kind: 'review' as const, authorId: 'b',
      body: 'Добавить источники', createdAt: completed.updatedAt }] };
  await mockWorkspace(page, [paused]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();

  await expect(page.getByText('Добавить источники')).toBeVisible();
  await expect(page.locator('.phase-list [aria-current="step"]')).toHaveText('Итог');
  await expect(page.locator('.encounter-stage')).toHaveCount(0);
  await page.getByRole('button', { name: 'Уточнить задачу' }).click();
  await expect(page.locator('#steering')).toBeFocused();
});

test('planning run starts with the optional encounter available', async ({ page }) => {
  const planning = { ...completed, status: 'planning' as const, phase: 'plan' as const, artifacts: [] };
  await mockWorkspace(page, [planning]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();

  await expect(page.locator('.encounter-panel')).toHaveAttribute('open', '');
  await expect(page.locator('.encounter-stage')).toBeVisible();
  await expect(page.locator('.phase-list [aria-current="step"]')).toHaveText('План');
});

test('encounter collapses when an active run is paused and can be reopened', async ({ page }) => {
  const planning = { ...completed, status: 'planning' as const, phase: 'plan' as const, artifacts: [] };
  const paused = { ...planning, status: 'paused' as const, version: planning.version + 1 };
  await mockWorkspace(page, [planning]);
  await page.route('**/api/runs/review-fixture/control', route => route.fulfill({ json: { run: paused } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /Проверяемый результат/ }).click();

  await expect(page.locator('.encounter-panel')).toHaveAttribute('open', '');
  await expect(page.locator('.encounter-stage')).toBeVisible();
  await page.getByRole('button', { name: 'Пауза', exact: true }).click();
  await expect(page.locator('.encounter-panel')).not.toHaveAttribute('open', '');
  await expect(page.locator('.encounter-stage')).toHaveCount(0);
  await page.getByText('Сцена команды', { exact: true }).click();
  await expect(page.locator('.encounter-stage')).toBeVisible();
});

test('direct run links restore tabs through back navigation and reload', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/#/runs/review-fixture?tab=messages');
  const messages = page.getByRole('tab', { name: /^Обсуждение/ });
  await expect(messages).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /^Результаты/ }).click();
  await expect(page).toHaveURL(/tab=artifacts$/);
  await page.goBack();
  await expect(messages).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(messages).toHaveAttribute('aria-selected', 'true');
  await messages.focus();
  await messages.press('ArrowRight');
  await expect(page).toHaveURL(/tab=artifacts$/);
  await expect(page.getByRole('tab', { name: /^Результаты/ })).toBeFocused();
});

test('all tasks opens searchable loaded history', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Запуски', exact: true }).click();
  await page.getByRole('button', { name: /^Все задачи/ }).click();
  await expect(page.getByRole('heading', { name: 'Все задачи', exact: true })).toBeVisible();
  await expect(page.getByText('Загружено 1 из 1 запусков.')).toBeVisible();
  await page.getByLabel('Поиск среди загруженных запусков').fill('несуществующее');
  await expect(page.getByText('Совпадений среди загруженных запусков нет.')).toBeVisible();
});

test('a malformed link offers a way back to history', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/#/runs/review-fixture?tab=unknown');
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть историю' }).click();
  await expect(page).toHaveURL(/#\/runs$/);
  await expect(page.getByRole('heading', { name: 'Все задачи' })).toBeVisible();
});

test('direct run link resolves even when the run is absent from loaded history', async ({ page }) => {
  await mockWorkspace(page);
  await page.route('**/api/bootstrap', route => route.fulfill({ json: {
    connections: [], runs: [], totalRuns: 1, csrfToken: 'fixture-only',
    eventCursor: 0, maxConcurrent: 3,
  } }));
  await page.goto('/#/runs/review-fixture?tab=messages');
  await expect(page.getByRole('heading', { name: 'Проверяемый результат' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Обсуждение/ })).toHaveAttribute('aria-selected', 'true');
});

test('creation controls are disabled while a request is in flight', async ({ page }) => {
  await mockWorkspace(page);
  let release: (() => void) | undefined;
  await page.route('**/api/runs', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { run: completed } });
  });
  await page.goto('/');
  const goal = page.getByLabel('Что нужно сделать?', { exact: true });
  await goal.fill('Проверить блокировку формы во время создания задачи');
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await expect(goal).toBeDisabled();
  await expect(page.locator('.team-section').getByRole('button', { name: 'Подключения' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Создаём задачу…' })).toBeDisabled();
  release!();
  await expect(page.getByRole('heading', { name: 'Проверяемый результат' })).toBeVisible();
});

test('keyboard tabs and modal Escape restore the invoking control', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/#/runs/review-fixture?tab=tasks');
  const tasks = page.getByRole('tab', { name: 'Задачи', exact: true });
  await tasks.focus();
  await tasks.press('End');
  await expect(page.getByRole('tab', { name: 'Журнал', exact: true })).toBeFocused();
  await expect(page).toHaveURL(/tab=events$/);

  const connectionsButton = page.locator('.header-nav').getByRole('button', { name: /^Подключения/ });
  await connectionsButton.click();
  await expect(page.getByRole('dialog', { name: 'Подключения' })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть подключения', exact: true }).press('Escape');
  await expect(page.getByRole('dialog', { name: 'Подключения' })).toBeHidden();
  await expect(connectionsButton).toBeFocused();
});

test('paused review leads to clarification without a mutation', async ({ page }) => {
  const paused = { ...completed, status: 'paused' as const, phase: 'synthesize' as const,
    reviewRound: 3, error: 'После трёх проверок остались замечания.',
    artifacts: [...completed.artifacts, { id: 'review', title: 'Review', kind: 'review' as const,
      authorId: 'b', body: 'Укажите источники.', createdAt: '2026-10-09T08:02:00Z' }] };
  await mockWorkspace(page, [paused]);
  const mutations: string[] = [];
  page.on('request', request => {
    if (request.method() !== 'GET') mutations.push(request.url());
  });
  await page.goto('/#/runs/review-fixture');
  await expect(page.getByText('Укажите источники.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Уточнить задачу', exact: true }).click();
  await expect(page.getByLabel('Направьте команду', { exact: true })).toBeFocused();
  expect(mutations).toEqual([]);
});

test('reduced motion is respected after the city first expands', async ({ page }) => {
  await mockWorkspace(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Показать город', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Анимация города', exact: true })).toBeDisabled();
  await expect(page.locator('#ambient-city')).toHaveClass(/city-backdrop-paused/);
  expect(await page.locator('.city-car').first().evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
});

test('unavailable session storage reports failure without blocking editing', async ({ page }) => {
  await mockWorkspace(page);
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', {
    get() { throw new DOMException('Denied', 'SecurityError'); },
  }));
  await page.goto('/');
  const goal = page.getByLabel('Что нужно сделать?', { exact: true });
  await goal.fill('Текст остаётся доступен в открытой форме');
  await expect(goal).toHaveValue('Текст остаётся доступен в открытой форме');
  await expect(page.getByRole('alert')).toContainText('не сохранён');
});

test('malformed run path offers a recovery route to history', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/#/runs/%');
  await expect(page.getByRole('heading', { name: 'Страница не найдена', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть историю', exact: true }).click();
  await expect(page).toHaveURL(/#\/runs$/);
  await expect(page.getByRole('heading', { name: 'Все задачи', exact: true })).toBeVisible();
});

test('completion preserves the selected discussion tab and newer steering draft', async ({ page }) => {
  const active = { ...completed, status: 'paused' as const, phase: 'tasks' as const };
  await mockWorkspace(page, [active]);
  let release: (() => void) | undefined;
  await page.route('**/api/runs/review-fixture/messages', async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { run: { ...completed, version: 2 } } });
  });
  await page.goto('/#/runs/review-fixture?tab=messages');
  const field = page.getByLabel('Направьте команду', { exact: true });
  await field.fill('Отправляемое уточнение');
  await page.getByRole('button', { name: 'Отправить команде', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await field.fill('Новый черновик');
  release!();
  await expect(page.getByRole('tab', { name: /^Обсуждение/ })).toHaveAttribute('aria-selected', 'true');
  await expect(field).toHaveValue('Новый черновик');
  await expect(field).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Посмотреть результаты', exact: true })).toBeVisible();
});

test('loaded-only search keeps older-page loading available', async ({ page }) => {
  await mockWorkspace(page);
  const older = { ...completed, id: 'older', title: 'Старый документ' };
  await page.route('**/api/bootstrap', route => route.fulfill({ json: {
    connections: [], csrfToken: 'fixture-only', eventCursor: 0, maxConcurrent: 3,
    runs: [completed], totalRuns: 2, nextCursor: completed.id,
  } }));
  await page.route('**/api/runs?before=*', route => route.fulfill({ json: {
    runs: [older], totalRuns: 2,
  } }));
  await page.goto('/#/runs');
  await page.getByLabel('Поиск среди загруженных запусков').fill('Старый');
  await expect(page.getByText('Совпадений среди загруженных запусков нет.')).toBeVisible();
  await page.getByRole('button', { name: 'Загрузить более ранние запуски', exact: true }).click();
  await expect(page.getByRole('button', { name: /Старый документ/ })).toBeVisible();
  await expect(page.getByText('Загружено 2 из 2 запусков.')).toBeVisible();
});

test('EN/RU switch translates the interface and is remembered after reload', async ({ page }) => {
  await mockWorkspace(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  const goal = page.locator('#goal');
  await goal.fill('short');
  await page.getByRole('button', { name: 'Составить план', exact: true }).click();
  await expect(page.locator('#goal-error')).toContainText('минимум 10');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: /Assemble a team/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  await expect(goal).toHaveValue('short');
  await expect(goal).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#goal-error')).toHaveText('Describe the goal in more detail: at least 10 characters.');
  await page.getByRole('button', { name: 'Переключить на русский' }).click();
  await expect(page.locator('#goal-error')).toContainText('минимум 10');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(goal).toHaveValue('short');
  await expect(page.getByRole('button', { name: 'Flows', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Draft plan', exact: true }).click();
  await expect(page.locator('#goal-error')).toHaveText('Describe the goal in more detail: at least 10 characters.');
  await page.getByRole('button', { name: 'Переключить на русский' }).click();
  await expect(page.getByRole('button', { name: 'Новая задача', exact: true })).toBeVisible();
  await expect(page.locator('#goal-error')).toContainText('минимум 10');
});

test('language changes translate existing clipboard feedback and run announcements without altering documents', async ({ page }) => {
  await mockWorkspace(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  });
  await page.goto('/#/runs/review-fixture?tab=artifacts');
  await page.getByRole('button', { name: 'Копировать Markdown', exact: true }).click();
  await expect(page.locator('.artifact-action-notice')).toHaveText('Markdown скопирован.');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('.artifact-action-notice')).toHaveText('Markdown copied.');
  await expect(page.locator('.run-content > .sr-only[role="status"]')).toContainText('Task complete. Results are available');
  await expect(page.getByRole('heading', { name: 'План проверки', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Переключить на русский' }).click();
  await expect(page.locator('.artifact-action-notice')).toHaveText('Markdown скопирован.');
});

test('the language toggle works when browser storage is denied', async ({ page }) => {
  await mockWorkspace(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage denied', 'SecurityError'); } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Переключить на русский' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
});
