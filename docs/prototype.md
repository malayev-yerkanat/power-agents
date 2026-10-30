# Power Agents · локальный прототип

Рабочее пространство для команды Codex, Claude и Gemini. Роли определяются под задачу. После согласования плана агенты выполняют задачи, задают вопросы друг другу, передают текстовые материалы и проверяют общий результат.

## Запуск

Требуется Node.js 24+ и macOS/Linux для CLI-провайдеров.

```sh
npm install
npm run dev
```

Откройте http://127.0.0.1:4317. Сервер доступен только на этом компьютере.

Если сервер перезапустился, пока страница была открыта, интерфейс получает новую локальную сессию и один раз повторяет запрос. Если браузер не сохраняет cookie для `127.0.0.1`, откройте адрес в обычной вкладке и разрешите cookies для этого адреса.

Для собранной версии:

```sh
npm run build
npm start
```

При необходимости задайте другой порт через переменную `PORT`.

### Автозапуск на macOS

Если Mac остаётся включённым, пользовательский LaunchAgent запускает собранную версию при входе в macOS и перезапускает её после сбоя. Сначала остановите уже запущенный вручную `npm run dev` или `npm start`: два сервера не могут совместно использовать SQLite и порт. Затем выполните:

```sh
npm install
npm run build
npm run service:install
```

Откройте http://127.0.0.1:4317 (или порт из `.env`, если задан `PORT`). Установщик проверяет, свободны ли порт и база данных, прежде чем запустить агент. Сервис работает от вашего пользователя, загружает `.env` из корня проекта и сохраняет данные в той же `.power-agents/`, что и ручной запуск. Текущий каталог проекта нельзя переносить без повторной установки сервиса. Для CLI-провайдеров используются существующие входы этого пользователя. Логи: `.power-agents/logs/server.log` и `server-error.log`.

```sh
npm run service:status    # состояние LaunchAgent
npm run service:stop      # временно остановить для ручной разработки
npm run service:start     # снова запустить
npm run service:restart   # применить изменение .env или новую сборку
npm run service:uninstall # убрать автозапуск
```

После изменения клиентского кода выполните `npm run build` и `npm run service:restart`. LaunchAgent действует только пока пользователь вошёл в macOS и компьютер не спит; при выключенном или спящем Mac уведомления Telegram ждут следующего запуска. `service:stop` действует до следующего входа в macOS; для постоянного отключения используйте `service:uninstall`.

### Резервная копия и восстановление

Остановите сервер перед копированием (`npm run service:stop` при использовании LaunchAgent). Выберите новую папку вне `.power-agents/`:

```sh
npm run data:backup -- --to /absolute/path/power-agents-backup
```

Команда проверяет целостность SQLite, сохраняет базу и рабочие папки запусков, записывает контрольные суммы и публикует копию только после успешного завершения. `.env` и логи не включаются. Копия содержит тексты задач, ответы и возможные файлы в рабочих папках; храните её как приватные данные.

Для восстановления остановите сервер и убедитесь, что в целевом проекте **нет** папки `.power-agents/`. Если она существует, сначала сохраните её отдельно; команда ничего поверх неё не записывает. Затем выполните:

```sh
npm run data:restore -- --from /absolute/path/power-agents-backup
```

Восстановление проверяет контрольные суммы и SQLite, отказывает при занятом локальном порте и устанавливает состояние только после успешной проверки. После этого запустите сервер снова (`npm run service:start` для LaunchAgent).

## Подключения

- **Codex CLI:** установленный `codex` и вход через его штатный механизм.
- **Claude Code:** установленный `claude` и выполненный вход.
- **Gemini:** Antigravity CLI (`agy`) с выполненным входом.
- **OpenAI API / Anthropic API:** переменные окружения `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. Модель выбирается из списка, который сервер запрашивает через API провайдера; API оплачивается отдельно. Можно скопировать `.env.example` в `.env`: скрипты запуска загружают его автоматически. Эти ключи используются только API-подключениями: CLI-участники их не получают и работают через собственный вход, поэтому ключ в `.env` не переводит Codex или Claude Code на оплату API.

Обнаруженный CLI означает наличие исполняемого файла. Codex и Antigravity предоставляют списки моделей через свои CLI; для Claude Code показаны документированные варианты Sonnet, Opus и Haiku. Фактическая авторизация и возможность запустить выбранную модель проверяются при первом реальном вызове. Если список моделей не загрузился, рядом с выбором модели показана причина: ключ отклонён (HTTP 401/403, с названием переменной в `.env`), лимит или квота (HTTP 429), недоступность провайдера, отсутствие связи или пустой список. Для CLI выводится подсказка проверить вход, без текста ответа CLI. Ошибки вызова API используют те же формулировки. После установки CLI или изменения ключей перезапустите сервер. Ключи не отправляются в браузер и не сохраняются в SQLite.

## Уведомления Telegram

Для уведомлений создайте бота через BotFather, задайте `TELEGRAM_BOT_TOKEN` в `.env` или окружении сервера и перезапустите приложение. Токен остаётся на сервере; не вводите его в браузере и не добавляйте в Git. В настройках приложения создайте одноразовую ссылку, откройте её в Telegram и отправьте боту команду Start. Поддерживается один привязанный личный чат. Там же можно отправить тестовое сообщение, включить или выключить два типа уведомлений и отключить чат.

Бот сообщает, когда новая версия плана ожидает согласования и когда задача завершена после проверки результата. Сообщения содержат только тип события, ID работы и, для плана, номер версии; тексты задачи и артефакты не отправляются. Согласование выполняется в локальном приложении, а не в Telegram. Адрес `127.0.0.1` на телефоне не открывает приложение на компьютере.

Задания на отправку сохраняются в SQLite вместе с переходом состояния и отправляются фоновым процессом с повторными попытками. При выключенном приложении сообщения ждут следующего запуска. Уже созданные до привязки задачи не рассылаются задним числом. При сбое после принятия сообщения Telegram возможна повторная доставка.

Статус бота становится недоступным при ошибке опроса Telegram и восстанавливается после успешного опроса. Пока опрос недоступен, создание ссылки привязки и тестовое уведомление заблокированы; открытые настройки обновляют статус автоматически.

## Первый запуск команды

1. Опишите цель, желаемый результат и ограничения.
2. Выберите 2–5 участников, подключения и лидера. Модель выбирайте из списка для каждого подключения. Для CLI можно оставить «По умолчанию»; для API выбор модели обязателен.
3. Нажмите «Составить план». Это реальный вызов лидера. Для ознакомления включите **демо без запросов к моделям**.
4. Изучите роли, задачи, зависимости и критерии. Замечание на этом этапе отправляет план на пересмотр.
5. Согласуйте план. Независимые задачи выполняются параллельно; вопрос коллеге доставляется в отдельный ход, ответ возвращает ожидающую задачу к работе.
6. Лидер объединяет материалы, другой участник проверяет итог. Замечания вызывают новую версию. Материалы можно скачать в Markdown.

Демо использует детерминированные образцы, включая запрос коллеге и исправление после проверки. Они явно помечены и не являются ответами моделей.

## Файлы и код

**Файлы.** Каждая задача участника с CLI-подключением получает свою папку `tasks/<id задачи>` в рабочей области запуска и может создавать и менять файлы только в ней: Codex работает в `workspace-write` без доступа к временным папкам системы, Claude — в `acceptEdits` только с файловыми инструментами, Gemini — в `accept-edits` внутри своей песочницы. Режимы обхода всех проверок не используются. Остальные ходы только читают: зависимая задача видит папки своих зависимостей, сборка итога и проверка — папки всех задач. Готовая задача показывает свои файлы со ссылками для скачивания (до 200 файлов, 1 МБ на файл, 10 МБ на задачу). Если агент пытается записать файл вне своей папки, платформа один раз повторяет ход с подсказкой, куда сохранять. Участники с API-подключением отвечают только текстом.

**Код в git-проекте.** В форме задачи раскройте «Изменить код в git-проекте», укажите полный путь к папке репозитория и при желании команду проверки (например, `npm test`). Работа начинается с текущего коммита `HEAD`; незакоммиченные изменения в работу не попадают. Платформа создаёт ветку результата `power-agents/<запуск>/result` и для каждой задачи — отдельную рабочую копию (worktree) на своей ветке. Готовая задача фиксируется коммитом и сливается в ветку результата; зависимая задача начинается только после слияния своих зависимостей. При конфликте слияния лидер получает один ход на его разрешение; если маркеры конфликта остались, слияние отменяется и работа приостанавливается со списком файлов. После слияния всех задач платформа запускает команду проверки и сохраняет её результат как документ «Проверка кода»; итог и проверка видят изменения и результат. Ваша ветка и рабочая папка не меняются: слейте ветку результата сами. Рабочие копии удаляются после завершения или отмены, ветки остаются.

## Командные инструменты (MCP)

Участники с Claude Code и Codex получают во время хода командные инструменты локального MCP-сервера приложения (`POST /mcp`): `team_status` (задачи и доска фактов), `read_inbox`, `send_message` (сообщение или вопрос коллеге), `publish_fact`, `report_blocked`; руководитель также `add_task` и `assign_task`. Подключение настраивается на каждый ход: Claude — через `--mcp-config` со строгим режимом, Codex — через параметры `-c mcp_servers.team.*`; пользовательские настройки CLI не меняются.

Кто вызывает инструмент, определяет платформа: каждый ход получает свой одноразовый токен, который передаётся только через переменную окружения и перестаёт действовать, когда ход заканчивается или работа останавливается. Указать отправителя в аргументах нельзя — такой вызов отклоняется. Менять чужой факт, задавать вопрос вне своей задачи и вызывать инструменты руководителя без этой роли нельзя. Запросы с адресом браузера (`Origin`) или чужим `Host` отклоняются. Каждый вызов записывается в журнал от имени участника.

Gemini (agy) разрешает вызовы MCP-инструментов только через свои глобальные настройки, поэтому работает без командных инструментов и общается итоговым JSON-ответом; в форме задачи такие подключения помечены «без командных инструментов». Наличие инструментов определяется типом подключения, а не отдельной проверкой при каждом запуске.

## Пиксельное рабочее пространство

Интерфейс использует выбранное направление Airy Pixel: светлый фон, синие акценты, локальный пиксельный шрифт для навигации и заголовков, читаемый шрифт для длинных текстов. История доступна через «Все задачи», подключения — в верхнем меню. Дополнительные сведения о команде и управлении раскрываются под рабочей областью; пауза и продолжение доступны рядом со статусом.

Кнопка EN/RU в верхнем меню переключает язык интерфейса без перезагрузки; выбор хранится в `localStorage` (`power-agents.language`), по умолчанию — русский. Если хранилище недоступно, переключение действует до перезагрузки. Строки клиента переводятся по русскому ключу (`src/client/i18n.ts`, словарь `src/client/i18n-en.ts`); известные описания подключений, подсказки моделей и ошибки платформы переводятся при отображении через `src/client/uiMessages.ts`. Уже показанные ошибки полей, уведомления и объявления для экранного диктора меняют язык вместе с интерфейсом. Переключение сохраняет черновики; стандартные названия узлов отображаются на выбранном языке, а добавление узла и сохранение других его настроек не записывают перевод вместо исходного названия. Ответы агентов, планы, пользовательские тексты и названия, неизвестные сообщения сервера остаются на исходном языке.

Экран создания сначала показывает поле цели и краткий состав команды. Подробные настройки участников и превью исходных спрайтов в компактном построении раскрываются отдельно. Превью меняется вместе с выбранными подключениями; цвет монограммы также зависит от провайдера. Последний итоговый документ выделен отдельно, обсуждения и задачи разделяются тонкими линиями. Клавиатурная ссылка в начале страницы переводит фокус в рабочую область.

На странице запуска участники изображены рейнджерами в городе. Костюм зависит от подключения, а роль — от плана. Используются выбранные C1 (меч Codex), L1 (посох Claude) и бластер Gemini. Неизвестное подключение получает нейтральный знак. Незавершённые задачи представлены монстрами с номерами T1–T3; соответствие раскрывается под сценой. Одновременно показано до трёх монстров, остальные учитываются подписью; завершённые исчезают.

Подписи отражают состояние запуска и задач. Во время работы Codex делает рывок и удар мечом, Claude — выпад посохом, Gemini — выстрел; монстры реагируют на попадания и отвечают энергетическим выстрелом. Бой — визуальная метафора активности, а не процент готовности: победа над монстром воспроизводится только при переходе задачи в завершённое состояние. Новые сообщения между участниками показаны передачей конверта, ревью — сканированием, завершение запуска — коротким эффектом победы. Анимация работает на логической сетке с частотой 12 кадров/с; используются исходные спрайты и процедурные эффекты, а не новые нарисованные позы. Открытие истории не воспроизводит старые победы. Пауза, остановка, скрытая вкладка, настройка уменьшения движения и переключатель под сценой ограничивают движение. На узком экране город прокручивается горизонтально, сохраняя полный размер спрайтов. Согласование плана, обсуждение, результаты и журнал работают через прежний серверный протокол.

Декоративный город по умолчанию свёрнут. «Показать город» открывает прежнюю панораму без изменения масштаба спрайтов; изображения загружаются при первом открытии. Машины движутся по дороге, самолёты пересекают сцену, два монстра периодически делают короткий выпад с эффектом пыли у зданий. Этот фон не связан с задачами и не показывает прогресс. Кнопка «Анимация города» сохраняет паузу локально; сворачивание, скрытая вкладка и системное уменьшение движения останавливают фон. В открытом виде панорама занимает отдельную полосу 448 px высотой: город приведён без сглаживания к логической сетке и показан с увеличением 2×. Машины и самолёты перерисованы крупными пиксельными кластерами для малых сеток 80×32 и 96×32; они отображаются с увеличением 2× без сглаживания, сохранением пропорций и жёсткой границей прозрачности. Предыдущие детализированные версии транспорта больше не используются. Город использует сетку 768×256 с обрезкой верхних 64 экранных пикселей; монстры сохраняют кадры 320×320, машины — 160×64, самолёты — 192×64. Самолёты летят в верхней части неба, ноги монстров стоят на тротуаре, транспорт движется по переднему плану дороги. На узком экране сцена обрезается вокруг одного монстра, а не уменьшает персонажей. Существующие спрайты и процедурные эффекты используются без новых анимационных спрайт-листов.

### Рабочая область и документы

При открытии завершённого запуска первым показан принятый документ; сцена команды доступна ниже. Завершение текущей работы не переключает выбранную вкладку автоматически. При паузе или ошибке доступно последнее ревью, если оно есть, и переход к полю уточнения. Отправка уточнения и продолжение работы остаются отдельными действиями. Интерфейс не приписывает сохранённому ревью вердикт, которого нет в данных.

Документы отображаются как форматированный Markdown. HTML из ответов не исполняется, внешние изображения автоматически не загружаются. Исходный Markdown можно раскрыть, скопировать или скачать. Ошибка копирования показывает способ скопировать исходный текст вручную.

### Черновики и навигация

Цель, состав команды, режим и уточнения к отдельным запускам сохраняются в `sessionStorage` текущей вкладки. Они восстанавливаются после переходов и обновления страницы; сохранение после закрытия вкладки не гарантируется. Черновики не содержат ключей API или служебных сессий провайдеров. Кнопка «Очистить черновик» сбрасывает создание задачи. При недоступном хранилище интерфейс сообщает, что текст остаётся только в памяти.

Успешное создание очищает отправленный черновик; ошибка запроса сохраняет его. Успешная отправка уточнения не удаляет новый текст, введённый во время запроса. Черновик завершённого запуска можно прочитать и скопировать, но нельзя отправить.

Ссылки вида `#/runs/<id>?tab=artifacts` открывают конкретный запуск и вкладку. Работают кнопки браузера «Назад» и «Вперёд». «Все задачи» открывает отдельную историю. Поиск и фильтр применяются только к загруженным запускам; более ранние страницы загружаются отдельной кнопкой.

## Управление и хранение

- Одновременно запускается один сервер на папку проекта: SQLite удерживает эксклюзивную блокировку до его остановки.
- Одновременно работает одна команда, до трёх вызовов; один участник выполняет один ход за раз.
- Пауза и отмена прерывают локальные процессы/HTTP-запросы. Провайдер мог уже принять запрос; отмена не гарантирует отмену начислений.
- Платформа запоминает каждый идущий вызов. После перезапуска работа приостановлена, а прерванные вызовы перечислены с пометкой «исход неизвестен»: вызов мог завершиться у провайдера. Их задачи отмечены ошибкой, и «Продолжить» повторяет их только после подтверждения пользователя. Пауза, отмена и ошибки не оставляют вызовы «в пути».
- Лимиты: 100 ходов на запуск, 20 на задачу, три проверки до паузы, пять минут на вызов (15 минут на сборку итога и проверку), до 40 фактов в одном ответе, 2 MiB ответа, 300 000 символов контекста одного хода.
- Каждый ход получает только нужное: задача — результаты своих зависимостей, итог — последние результаты задач, последнюю версию итога и проверки, проверка — последний итог. Каждый документ передаётся один раз; участник видит свою переписку и сообщения пользователя.
- Состояние и журнал: `.power-agents/state.sqlite`; рабочие каталоги: `.power-agents/workspaces`. Эти данные исключены из Git. Тексты задач и ответов хранятся локально без шифрования.
- При открытии приложение загружает краткие сведения о последних 30 запусках. Более ранние запуски доступны кнопкой в истории. Детали выбранного запуска загружаются отдельно; журнал показывает последние 100 событий и позволяет открыть более ранние страницы. Поток событий ограничивает повтор после разрыва и запрашивает полную синхронизацию при большом пропуске.
- Ошибка в задаче или в ответе на вопрос коллеги отмечает только эту задачу: остальные участники продолжают работу, готовые результаты сохраняются. Когда продвинуться больше нельзя, команда приостанавливается со списком невыполненных задач; «Продолжить» повторяет только их, а задача с открытым вопросом сначала ждёт ответа. Ошибка плана, итога или проверки приостанавливает команду сразу. Ошибка называет участника, у которого она произошла. Если CLI завершился с ошибкой и объяснил причину в своём ответе (например, «Not logged in»), показывается эта причина.
- Руководитель планирует только рабочие задачи: сборку итога и независимую проверку платформа запускает сама после их завершения. Он предпочитает параллельные задачи и для общих фактов (цены, числа, условия) указывает владельца; остальные участники спрашивают владельца, а не придумывают значение.
- Вопрос участнику, у которого есть свой неотвеченный вопрос, откладывается, пока он не получит ответ. Если участники ждут друг друга и больше ничего не выполняется и не завершилось ошибкой, самый ранний вопрос всё равно передаётся.
- Ответ на вопрос сохраняется, даже если отвечающий добавил встречный вопрос: такие вопросы доставляются как сообщения без ожидания ответа.
- Пустые необязательные поля ответа агента (`null`) считаются отсутствующими. Ошибка формата показывается одной строкой с названием поля, а некорректный JSON — с началом ответа. Если после полного JSON-ответа агент дописал текст, ответ принимается, а этот текст добавляется к краткому итогу. Ответ, который не удалось прочитать или проверить (включая некорректный план), один раз автоматически запрашивается повторно в той же сессии с указанием причины; повтор считается ходом и отмечается в журнале. Вторая ошибка отмечает задачу как невыполненную.
- Если проверка требует исправлений и указывает задачи в `revisions`, эти задачи возвращаются их владельцам с замечанием; руководитель собирает итог заново только после доработки. Без указанных задач итог дорабатывает руководитель. Замечание к несуществующей задаче считается ошибкой формата и запрашивается повторно.
- Общие факты (цены, граммовки, условия) участники публикуют в поле `facts`. Первый опубликовавший становится владельцем; изменить факт может только он, и версия факта увеличивается. Попытка другого участника изменить чужой факт считается ошибкой формата и запрашивается повторно. Все опубликованные факты видны каждому ходу в контексте. В `usesFacts` участник перечисляет факты коллег, на которые опирается его результат. Если владелец меняет такой факт во время работы над задачами, завершённые задачи, использовавшие старую версию, возвращаются исполнителям с сообщением «было → стало».
- Участник может ответить «жду» без вопроса, пока коллеги ещё работают: его задача ждёт и возобновляется, когда ему приходит сообщение или коллега завершает задачу. Если все остальные уже закончили, такая задача отмечается ошибкой, и «Продолжить» повторит её.
- Уточнения передаются в следующих ходах. Если уточнение поступило во время подготовки плана, итога или проверки, этот этап повторяется с новым контекстом.

## Границы версии 0.1

Прототип работает с текстами, файлами задач и изменениями кода в git-проекте. Передача результатов между агентами реализована структурированными JSON-ответами и общей историей. Универсальный MCP, вложения, редактирование внешних репозиториев, git-worktree интеграция, внешние действия агентов и денежный бюджет пока не реализованы. Отдельная опциональная интеграция Telegram отправляет только системные уведомления о состоянии работы. Агенты запускаются в plan/read-only режиме; Claude получает пустой набор инструментов и отключённые обычные hooks. Административные политики CLI сохраняются. CLI-изоляция зависит от установленного провайдера и его настроек; она не является отдельным контейнером.

Gemini получает prompt через стандартный поток ввода CLI, без текста задачи в аргументах процесса. Ход Gemini завершается, как только получена полная строка результата: при запуске из фоновой службы Antigravity CLI может выдать ответ и не завершиться, поэтому оставшийся процесс останавливается. CLI-провайдеры всё ещё имеют доступ к своей рабочей папке и необходимым данным авторизации; их режим plan/read-only не является жёсткой изоляцией. Anthropic API получает контекст хода заново при каждом вызове; остальные адаптеры сохраняют ID сессии там, где провайдер его поддерживает. Возможности инструментов провайдеров не используются для внешних действий.

### Доступность и сохранение контекста

Вторичный текст и подписи используют более контрастную палитру; навигация, вкладки и содержимое настроек переносятся на узком экране. Горизонтальная прокрутка остаётся у пространственной городской сцены. Пиксельный шрифт сохраняется для коротких заголовков и элементов управления, обычный — для длинного текста.

При выборе запуска фокус переходит на его заголовок. Изменения статуса, этапа, числа выполненных/ожидающих задач и доставки сообщений отражаются в краткой области `role="status"`. Завершение не переключает выбранную вкладку автоматически: доступна кнопка «Посмотреть результаты». Если пользователь уже работал с запуском, поле уточнения остаётся на месте после завершения; черновик можно скопировать, отправка недоступна. Его сохранение в текущей вкладке описано выше.

Лидер обозначен текстом. Дополнительные документы раскрываются через нативные `details`/`summary`; последний итоговый документ виден полностью. Проверены сборка и выбранные браузерные сценарии, включая ширину 320 CSS-пикселей. Полная проверка VoiceOver/NVDA и сертификация WCAG не выполнялись.

## Разработка

```sh
npm test
npm run test:e2e
npm run test:coverage
npm run typecheck
npm run build
```

Тесты адаптеров используют заглушки процессов и HTTP. Они не расходуют квоты моделей. HTTP-тестам нужен доступ к loopback-порту. Демонстрация проходит через тот же движок, базу, API и интерфейс.

GitHub Actions запускает проверку типов, все тесты с порогом 80% общего покрытия строк, браузерные проверки на синтетических данных, production-сборку и `npm audit --audit-level=high` для pull request и push в `main`.

Структура: `src/server/core` — протокол/контекст; `engine.ts` — диспетчер; `adapters` — провайдеры; `store.ts` — SQLite; `http.ts` — локальный API/SSE; `src/client` — интерфейс.

Дальнейшая архитектура: [дизайн платформы](superpowers/specs/2026-10-07-agent-team-platform-design.md). План прототипа: [этапы реализации](superpowers/plans/2026-10-07-power-agents-prototype.md).

### Артикулированные монстры фонового города — 2026-10-08

Фоновый город использует новые позы насекомого и красного босса: спокойное дыхание, рёв, топот и по три атаки. Между жестами есть спокойные интервалы; движения двух монстров разнесены по времени. Пыль появляется одновременно с топотом или ударом по земле. Это декоративная анимация, не показатель выполнения задач. Боевая сцена внутри запуска сохраняет прежний механизм.

Четыре прозрачных листа содержат 48 очищенных ключевых поз. Полные силуэты извлекаются по индивидуальным границам, выравниваются по опорной стопе и земле; масштаб постоянен для каждого монстра. Canvas192×176 отображается в2× с дополнительным местом для широких атак. Пауза, сворачивание, скрытая вкладка и системное уменьшение движения останавливают смену кадров; продолжение сохраняет оставшееся время кадра. При ошибке загрузки используется исходный статичный спрайт.

Это первая реализация анимации по ключевым позам: небольшие различия лица/брони между сгенерированными кадрами остаются; промежуточные кадры и полноценные эффекты выстрелов ещё не добавлены. [Описание ассетов](../public/art/monster-motion/README.md).

## Flows: F1–F4 engine, canvas, live text and media pipeline

Open **Потоки** in the sidebar or `#/flows` to list flows and create a **Новый поток** from the `roblox-reel` template. Choose **Демо** or **Живой** for the new flow; demo is the default and makes no model calls. Each flow opens at `#/flows/<id>` in a separate dark React Flow workspace with a dotted background, pan/zoom controls, a minimap and initial fit-to-view. The toolbar shows the flow title and mode, an **Автозапуск** toggle, and a **+ Узел** menu of registry types.

Cards show the node type, title, status and a short preview from the first output port. Port handles have type colours and port-name tooltips. Running nodes pulse, approval waits are amber, approved nodes green, stale output dimmed and errors red. Click **Запустить** on **Бренд**, then **Идея**; the idea waits for **Одобрить** before **Сценарий** becomes runnable. **Отклонить** opens a required note field and reruns the node with that note. With **Автозапуск** enabled, ready steps run after their inputs are approved; approval gates still stop the graph.

Drag a node to save its position after a short debounce. Drag between handles to connect compatible ports; a `text` input accepts any output type. Select nodes or edges and press Delete to remove them; removing a node also removes its edges. The client queues versioned PATCH requests, refetches after rejected writes (including 409 conflicts), and shows errors in a toast. The server remains authoritative for graph validation. Selecting a node opens the right inspector with title, approval gate, config fields generated from registry defaults, full output JSON, rejection notes, result version and any error. Strings use input/textarea controls, numbers use number inputs, and string arrays use one line per item. **Сохранить** applies the form via PATCH; execution settings cannot change while queued/running.

The separate typed DAG engine remains exposed through `/api/flows`. In live mode, Brand returns its configured values, and Idea, Script and Scenes call the existing provider adapters. F4 runs Voice, Capture, Edit, Preview, QA and Final through isolated Python stages in the content project. Cards play file outputs with native audio/video controls, and the inspector lists versioned files. Telegram flow approvals remain planned for F5. Demo retains deterministic inline fixtures and makes no provider calls.

The inspector's **Подключение** select loads `GET /api/flows/connections` (`{ connections }`, without executable paths), offers available connections and **Авто**, and retains a disabled label for an unavailable saved choice. An explicit connection uses that connection and `config.model`. Auto chooses the first available CLI in Claude Code → Codex → Gemini order; it never silently chooses a paid API. Missing/unavailable choices fail with Russian guidance. A synthetic member runs read-only in the node's version directory, with no team tools and no session reuse, including during retries.

English prompts carry all connected upstream port values, brand text/rules, extra `config.prompt` instructions and every rejection note under “Revise according to these notes”. Idea proposes 3–5 topics from trends, evergreen phenomena, upcoming historical anniversaries or viewer comments; without supplied current evidence it uses evergreen topics. The brief's hard-no list (recent mass-casualty events, real private people, graphic violence), victim-mockery and partisan-bait rules are explicit prompt instructions. Semantic topic safety still needs the human approval gate; score validation alone cannot establish it. `config.topic` narrows the subject. Zod verifies five integer 1–5 scores, their sum, the exact `<Topic> explained in Roblox` hook and selection of a highest-scoring candidate with total ≥18.

Script asks for a metaphor map first and uses the selected idea. It targets `config.words` within 130–160 spoken words. Validation measures fullText itself, checks the reported count and joined beat texts, and requires the hook to end with “explained in Roblox”. The fixed 55-second version uses hook 0–2, world 2–10, escalation 10–40 (three developments), twist 40–50 and loop 50–55. Cards show Idea's chosen topic/hook and Script's hook/word count; the inspector retains full JSON.

Scenes validates ordered coverage of every script beat, unique scene IDs, sets, cast, action and camera. Optional connected timings override script beat times. Supported inline timing values are `{ beats: [{ beat: 'hook'|'world'|'escalation'|'twist'|'loop', start, end }] }` (five ordered intervals), or `{ words: [{ start, end }] }` (one ordered interval per whitespace-delimited script word); extra word fields such as `text` are accepted. Without connected timings it uses script beats. Brand is optional on all three LLM nodes; Scenes also accepts a brand port. An optional connected port still waits for upstream approval. The template connects Voice → Scenes timings, so Scenes waits for approved narration alignment. Existing flows retain their saved graph; reconnect Voice's timings output to Scenes if that edge was previously removed.

Each model result passes `parseJsonObject` then a Zod schema and semantic consistency checks. An invalid JSON/shape/count/scene result gets one stateless correction with its error, previous response and the original context. Script count errors state the measured count. A second invalid result fails the node with validation detail. Provider failures are not retried as formatting errors.

Use the existing `/api/bootstrap` session cookie and `X-CSRF-Token` for mutations. `POST /api/flows` accepts `{ title?, mode?: 'demo' | 'live', template?: 'roblox-reel' }`; the default is an empty demo flow. `GET /api/flows` returns `{ flows }` (up to 200 summaries). `GET /api/flows/:id` returns `{ flow, nodeRuns }` (latest 100 executions). Create and mutation responses return `{ flow }`.

`GET /api/flows/registry` returns `{ types }`: client-safe type/title, input/output port metadata, gate default, optional lane, and `configDefaults`. Server validation schemas and executors stay on the server. The global `/api/events` stream adds `flow` invalidations from `store.subscribeFlows`. Each matching event refetches `GET /api/flows/:id`; the list also refreshes. SSE open/reconnect refreshes flow state to recover events missed while disconnected. Flow notifications do not have their own replay history; the team-run event cursor remains unchanged.

`PATCH /api/flows/:id` requires the latest flow `version` and accepts `title`, `autoRun`, `nodes`, and `edges`. Supplied arrays replace the graph arrays. Each node supplies `id`, `type`, `title`, `position`, `config`, and `gate`; runtime status, output, notes, and execution versions are server owned. Config schemas apply defaults and reject unknown fields. Edges must reference existing compatible ports, each input allows one connection, and cycles are refused. A `text` input can accept any output type. Version conflicts and refused transitions return 409; missing flows/nodes return 404; invalid bodies and graphs return 400.

`POST /api/flows/:id/nodes/:nodeId/run` and `/approve` take `{}`; `/reject` takes `{ note: '...' }`. A node can run only after all required inputs are connected to approved sources. Gated output waits for approval; rejecting appends the note and queues another execution. Node versions increase at execution start. Config changes and upstream reruns/approvals invalidate descendant output while preserving its previous value. Editing a queued/running node's execution settings is refused. Optional inputs, if connected, also wait for source approval.

`autoRun` defaults to false. Enabling it queues ready idle/stale nodes; after execution or approval, newly ready nodes are queued. Failed nodes need an explicit run. Across all flows, at most three nodes execute concurrently, and Preview/Final share a single, lower-priority `render` lane. Files have directories `.power-agents/flows/<flowId>/<nodeId>/v<version>/`. Config and upstream identities/versions determine the SHA-256 input hash. SQLite retains execution status, input hash, timing and error in `node_runs`; output remains in the flow JSON. Restart changes queued/running nodes and unfinished executions to failed (`interrupted, run again`), without automatically rerunning them.

The `roblox-reel` template includes Brand → Idea → Script → Voice → Scenes → Capture → Edit → Preview → QA → Final, with supplemental edges for shared brand, timings, audio, video and edit inputs. Voice has separate audio and timings output ports; QA approves automatically; Final requires QA's report. Registry and tests: `src/server/flows/`, `tests/flow-engine.test.ts`, `tests/flow-http.test.ts`, `tests/flow-executors.test.ts` (injected runners, including live API execution without sockets). The canvas lives in `src/client/flows/`; pure mapping/port helpers are covered by `tests/flow-canvas.test.ts`, route parsing/formatting by `tests/navigation.test.ts`, and the demo Brand → Idea → approval → Script path and full ten-node demo by `tests/e2e/flows.spec.ts`. The browser fixtures use the real flow engine and API handler with intercepted HTTP and flow notifications, without live providers. Running Playwright still requires a local Vite listener.

### F4 media setup and operation

Set `REEL_PIPELINE_DIR` in the server environment to the content project's `pipeline/stages/` directory, and set `ELEVENLABS_API_KEY` for Voice; restart the server after changing environment configuration. `.env.example` lists names only. There is no machine-specific pipeline path in code. Requires Python 3, ffmpeg/ffprobe and the content project's installed Remotion/npm tools; no new dependencies are installed by a stage. Voice always uses ElevenLabs's timestamp endpoint, with config.voice or the documented premade Rachel voice (`21m00Tcm4TlvDq8ikWAM`), then normalizes narration to -14 LUFS. Missing credentials or a missing take produce **Нужно действие**, with a message describing the required action; failed nodes require an explicit retry.

Record the Roblox Studio take with its magenta sync frame. Capture cards and the inspector offer **Загрузить съёмку** for MP4/MOV takes. `POST /api/flows/:id/nodes/:nodeId/upload` streams raw `application/octet-stream` directly to `<flows root>/<flowId>/<nodeId>/uploads/`, with `X-File-Name` (URI encoded for Unicode names), session and CSRF protection. The limit is 2 GiB; invalid extension, wrong media type, interrupted or oversized uploads fail without retaining a partial file. The server stores sanitized latest-upload metadata `{name, bytes, at}` on Capture, marks it and descendants stale and aborts invalidated work. Voice has no upload option.

The pipeline executor launches `python3 -I <stage>.py --in input.json --out output.json --dir <version directory>`. Input includes upstream inline values and absolute, contained upstream file paths, supplemental ancestor script/timings/brand, notes, node config and execution identity. Capture additionally receives the uploaded take. Stages return one `{port,value?,files?,log?}` result or `{outputs:{port:{value?,files?}},log?}` for multiple ports. Listed file paths must be relative regular files contained in the node version directory, including through symlinked parents. Exit 0 succeeds; exit 2 fails with `needsHuman`; other exits fail and preserve valid report output for inspection. Timeouts are Voice 5 min, Capture 10 min, Edit 2 min, Preview/Final 30 min and QA 5 min. Cancellation and timeout kill the Python process group, including ffmpeg/Remotion children.

Edit deterministically groups captions into at most three words with punctuation/gap breaks and an accent, adds punch-ins, a hook title and escalation/twist cards. Preview/Final stage footage, narration and edit data under Remotion's public `flows/<flowId>/<nodeId>-v<version>/`, render the dynamic `FlowReel` composition and clean up staged files. `config.height` is the vertical pixel height (540 preview, 1080 final); width is the nearest even 9:16 width for H.264 (304/608), and QA permits that subpixel aspect-ratio rounding. The legacy reel 001 composition remains available. QA checks 30–60 s length, dimensions, an audio stream, integrated -14 ±2 LUFS loudness, and hook words in the first three seconds of captions. It writes `{passed, checks:[{name,ok,detail}]}` and fails the node if any check fails, blocking Final until QA passes.

`GET /api/flows/:id/files/:nodeId/v:version/<relative path>` streams media with MP4/MP3/JSON/PNG/JPEG content types and byte ranges (`206`, invalid range `416`). Missing files, traversal and symlink escapes return `404`. A retained output has its own `outputVersion`, so its playback URL stays on the correct version during reruns or failures. Capture's upload metadata and `needsHuman` are server-owned fields, alongside outputs and execution status.

Pipeline tests use temporary Python stage scripts and generated tiny ffmpeg media. ElevenLabs tests use local HTTP stubs or mocked responses; Remotion invocation is mocked. No real provider call or real render is required by tests. Reel 002's full live script-to-final acceptance run remains unverified until a voice key, approved script, manual take and real renders are used. F5 Telegram gates remain planned.
