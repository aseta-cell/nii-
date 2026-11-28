# KKSU Online — веб-версия

Полная веб-версия iOS-приложения KKSU Online (все 134 задачи, 95 разделов, 8 ролей).
Работает с тем же сервером Supabase, что и приложение на iPhone: те же аккаунты,
задания, оценки, чат, курсы и оплаты.

- Исходники: `kksu-app/` (React + TypeScript + Vite).
- Готовый сайт: `kksu/` — статические файлы, открываются по адресу
  `https://nii-arai-publishhouse.kz/kksu/`. Сборка уже лежит в репозитории,
  на сервере ничего собирать не нужно.

## Как обновить сайт после изменений

```bash
cd kksu-app
npm install        # один раз
npm run build      # проверка типов + сборка в ../kksu
```

Потом закоммитить папку `kksu/` вместе с исходниками.

Локальный запуск: `npm run dev` → http://localhost:5173.

## Связь с iOS-приложением

Модели данных и список разделов генерируются из Swift-кода приложения
(репозиторий KKSU-):

```bash
KKSU_IOS_DIR=/путь/к/KKSU- npm run gen
```

- `src/core/models.gen.ts` — модели из `KKSU/Core/*.swift` (формат JSON 1:1 с Codable);
- `src/core/routes.gen.ts` — разделы и роли из `KKSUNavigation.swift`.

## Безопасность

- В браузере используется только publishable-ключ Supabase (как в приложении).
  Секретные ключи (service_role) сюда не добавлять.
- Доступ к данным ограничивают правила Supabase (RLS) — каждый видит только своё.
- AI-помощник на сайте работает локально, ключи AI в браузере не хранятся.
- Оплата на сайте — переводом по счёту (Kaspi, банки РК, Korona Pay, Western Union, Wise);
  администратор подтверждает платёж, доступ открывается и на сайте, и в приложении.

## Настройка Supabase

В Supabase → Authentication → URL Configuration добавьте в Redirect URLs:
`https://nii-arai-publishhouse.kz/kksu/`.
