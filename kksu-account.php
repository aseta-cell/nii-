<?php
declare(strict_types=1);

ini_set('session.use_strict_mode', '1');
session_name('KKSU_SESSION');
session_start([
    'cookie_httponly' => true,
    'cookie_secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'cookie_samesite' => 'Lax',
]);
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');

function kksuHtml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function kksuDate($value): string
{
    if (!is_string($value) || $value === '') {
        return '';
    }
    try {
        return (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('Asia/Almaty'))->format('d.m.Y H:i');
    } catch (Exception $exception) {
        return '';
    }
}

function kksuLink($value): ?string
{
    return is_string($value) && filter_var($value, FILTER_VALIDATE_URL)
        && parse_url($value, PHP_URL_SCHEME) === 'https' ? $value : null;
}

function kksuRequest(string $path, ?array $body = null, ?string $token = null, ?string $preference = null): array
{
    static $config;
    if ($config === null) {
        $configPath = __DIR__ . '/config.local.php';
        $config = is_file($configPath) ? (require $configPath) : [];
    }
    $url = rtrim((string)($config['kksu_supabase_url'] ?? getenv('KKSU_SUPABASE_URL')), '/');
    $key = (string)($config['kksu_supabase_publishable_key'] ?? getenv('KKSU_SUPABASE_PUBLISHABLE_KEY'));
    if (!preg_match('~^https://[a-z0-9-]+\.supabase\.co$~D', $url)
        || !preg_match('/^sb_publishable_[A-Za-z0-9_-]+$/D', $key)) {
        throw new RuntimeException('KKSU пока не подключён к серверу.');
    }

    $headers = ['apikey: ' . $key, 'Accept: application/json'];
    if ($token !== null) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    if ($preference !== null) {
        $headers[] = 'Prefer: ' . $preference;
    }
    $options = [
        'method' => $body === null ? 'GET' : 'POST',
        'timeout' => 10,
        'ignore_errors' => true,
        'follow_location' => 0,
    ];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        $options['content'] = json_encode($body, JSON_THROW_ON_ERROR);
    }
    $options['header'] = $headers;
    $response = @file_get_contents($url . $path, false, stream_context_create(['http' => $options]));
    $statusLine = $http_response_header[0] ?? '';
    preg_match('/^HTTP\/\S+ (\d{3})\b/', $statusLine, $matches);
    $status = (int)($matches[1] ?? 0);
    if ($status >= 200 && $status < 300 && $preference !== null && $response === '') {
        return [];
    }
    $data = $response === false ? null : json_decode($response, true);
    if ($status === 429) {
        throw new RuntimeException('Слишком много запросов. Попробуйте позже.', $status);
    }
    if ($status < 200 || $status >= 300 || !is_array($data)) {
        $message = match ($data['error_code'] ?? '') {
            'invalid_credentials' => 'Проверьте email и пароль.',
            'email_not_confirmed' => 'Подтвердите email через письмо от KKSU.',
            default => 'Не удалось выполнить запрос к KKSU. Попробуйте ещё раз.',
        };
        throw new RuntimeException($message, $status);
    }
    return $data;
}

function kksuSession(array $response): array
{
    $id = $response['user']['id'] ?? '';
    $access = $response['access_token'] ?? '';
    $refresh = $response['refresh_token'] ?? '';
    if (!preg_match('/^[a-f0-9-]{36}$/Di', $id)
        || !preg_match('/^[A-Za-z0-9._-]+$/D', $access)
        || !preg_match('/^[A-Za-z0-9._-]+$/D', $refresh)) {
        throw new RuntimeException('Не удалось открыть сессию KKSU.');
    }
    return [
        'id' => $id,
        'access' => $access,
        'refresh' => $refresh,
        'expires' => time() + max(0, (int)($response['expires_in'] ?? 0) - 30),
    ];
}

function kksuUuid($value): bool
{
    return is_string($value) && preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/Di', $value);
}

function kksuNewUuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 15) | 64);
    $bytes[8] = chr((ord($bytes[8]) & 63) | 128);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function kksuAssignmentFilters(string $uuid): array
{
    $upperUuid = strtoupper($uuid);
    return [
        'data->>audience' => 'eq.students',
        'data->>approvedByTeacher' => 'eq.true',
        'or' => "(data->assignedIDs.eq.[],data->assignedIDs.cs.[\"$uuid\"],data->assignedIDs.cs.[\"$upperUuid\"])",
    ];
}

function kksuSubmitWork(array $auth, array $input): void
{
    $assignmentId = $input['assignment_id'] ?? null;
    $id = $input['submission_id'] ?? null;
    $text = $input['text'] ?? '';
    if (!kksuUuid($assignmentId) || !kksuUuid($id) || !is_string($text)
        || trim($text) === '' || strlen($text) > 40000 || !preg_match('//u', $text)) {
        throw new RuntimeException('Введите текст работы и повторите отправку.');
    }
    $studentId = strtolower($auth['id']);
    $query = http_build_query(kksuAssignmentFilters($studentId) + [
        'select' => 'id', 'id' => 'eq.' . $assignmentId, 'school_id' => 'eq.kksu',
        'collection' => 'eq.assignments', 'deleted' => 'eq.false',
    ]);
    $assignments = kksuRequest('/rest/v1/kksu_records?' . $query, null, $auth['access']);
    if (!$assignments) {
        throw new RuntimeException('Задание больше недоступно.');
    }
    kksuRequest('/rest/v1/kksu_records?on_conflict=collection,id', [
        'collection' => 'submissions',
        'id' => $id,
        'school_id' => 'kksu',
        'owner_id' => $studentId,
        'visible_to' => [$studentId],
        'data' => [
            'id' => $id, 'assignmentID' => $assignmentId, 'studentID' => $studentId,
            'submittedAt' => gmdate('Y-m-d\TH:i:s\Z'), 'text' => trim($text),
            'attachments' => [], 'feedback' => '', 'status' => 'submitted',
        ],
    ], $auth['access'], 'resolution=ignore-duplicates,return=minimal');
}

$csrf = $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$auth = $_SESSION['auth'] ?? null;
$error = '';
$member = null;
$memberships = [
    'student' => 'Ученик', 'parent' => 'Родитель', 'teacher' => 'Педагог',
    'psychologist' => 'Психолог', 'expert' => 'Эксперт', 'mentor' => 'Наставник',
    'partner' => 'Партнёр', 'admin' => 'Администратор',
];
$sections = [
    'programs' => 'Учебные программы',
    'library' => 'Библиотека',
    'sessions' => 'Моё расписание',
    'notifications' => 'Уведомления',
    'assignments' => 'Задания',
    'submissions' => 'Мои работы и оценки',
];
$section = $_GET['section'] ?? 'programs';
if (!is_string($section) || !isset($sections[$section])) {
    $section = 'programs';
}
$page = filter_input(INPUT_GET, 'page', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 10000]]) ?: 1;
$items = [];
$hasMore = false;
$assignmentTitles = [];
$notice = $_SESSION['notice'] ?? '';
unset($_SESSION['notice']);
$action = '';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $submittedToken = $_POST['csrf'] ?? '';
        if (!is_string($submittedToken) || !hash_equals($csrf, $submittedToken)) {
            http_response_code(403);
            throw new RuntimeException('Форма устарела. Обновите страницу.');
        }
        $action = $_POST['action'] ?? '';
        if ($action === 'logout') {
            unset($_SESSION['auth']);
        } elseif ($action === 'login' && $auth === null) {
            $rawEmail = $_POST['email'] ?? '';
            $password = $_POST['password'] ?? '';
            $email = is_string($rawEmail) ? trim($rawEmail) : '';
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !is_string($password) || $password === '' || strlen($password) > 1024) {
                throw new RuntimeException('Введите email и пароль KKSU.');
            }
            $_SESSION['auth'] = kksuSession(kksuRequest('/auth/v1/token?grant_type=password', [
                'email' => $email,
                'password' => $password,
            ]));
        } elseif ($action !== 'submit_work' || $auth === null) {
            http_response_code(400);
            throw new RuntimeException('Неизвестное действие.');
        }
        if ($action !== 'submit_work') {
            session_regenerate_id(true);
            unset($_SESSION['csrf']);
            header('Location: kksu-account.php', true, 303);
            exit;
        }
    }

    if ($auth !== null) {
        if ($auth['expires'] <= time()) {
            $auth = $_SESSION['auth'] = kksuSession(kksuRequest('/auth/v1/token?grant_type=refresh_token', [
                'refresh_token' => $auth['refresh'],
            ]));
        }
        $members = kksuRequest('/rest/v1/kksu_members?select=full_name,role,blocked,approved&school_id=eq.kksu&user_id=eq.' . $auth['id'], null, $auth['access']);
        $member = $members[0] ?? null;
        if ($member === null || $member['blocked'] || !$member['approved'] || !isset($memberships[$member['role']])) {
            throw new RuntimeException('Этот аккаунт пока не имеет доступа к кабинету KKSU.');
        }
        if ($action === 'submit_work') {
            if ($member['role'] !== 'student') {
                http_response_code(403);
                throw new RuntimeException('Сдавать работы могут ученики.');
            }
            kksuSubmitWork($auth, $_POST);
            $_SESSION['notice'] = 'Работа отправлена на проверку.';
            header('Location: kksu-account.php?section=submissions', true, 303);
            exit;
        }
        if ($member['role'] !== 'student') {
            unset($sections['assignments'], $sections['submissions']);
            $section = isset($sections[$section]) ? $section : 'programs';
        }
        $uuid = strtolower($auth['id']);
        $upperUuid = strtoupper($uuid);
        $filters = match ($section) {
            'sessions' => [
                'or' => "(data->participantIDs.cs.[\"$uuid\"],data->participantIDs.cs.[\"$upperUuid\"])",
                'order' => 'data->>start.asc,id.asc',
            ],
            'notifications' => [
                'visible_to' => 'cs.{' . $uuid . '}',
                'data->>userID' => 'ilike.' . $uuid,
                'order' => 'data->>date.desc,id.asc',
            ],
            'submissions' => [
                'data->>studentID' => 'ilike.' . $uuid,
                'order' => 'data->>submittedAt.desc,id.asc',
            ],
            'assignments' => kksuAssignmentFilters($uuid) + ['order' => 'data->>dueDate.asc,id.asc'],
            default => ['visible_to' => 'eq.{}', 'order' => 'data->>title.asc,id.asc'],
        };
        $query = http_build_query($filters + [
            'select' => 'id,data', 'school_id' => 'eq.kksu', 'collection' => 'eq.' . $section,
            'deleted' => 'eq.false', 'limit' => 21, 'offset' => ($page - 1) * 20,
        ]);
        $items = kksuRequest('/rest/v1/kksu_records?' . $query, null, $auth['access']);
        $hasMore = count($items) > 20;
        $items = array_slice($items, 0, 20);
        if ($section === 'submissions' && $items) {
            $assignmentIds = [];
            foreach ($items as $item) {
                $id = $item['data']['assignmentID'] ?? null;
                if (is_string($id) && preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/Di', $id)) {
                    $assignmentIds[strtolower($id)] = true;
                }
            }
            if ($assignmentIds) {
                $titleQuery = http_build_query([
                    'select' => 'id,data->>title', 'school_id' => 'eq.kksu', 'collection' => 'eq.assignments',
                    'deleted' => 'eq.false', 'data->>approvedByTeacher' => 'eq.true',
                    'data->>audience' => 'eq.students', 'id' => 'in.(' . implode(',', array_keys($assignmentIds)) . ')',
                ]);
                $assignments = kksuRequest('/rest/v1/kksu_records?' . $titleQuery, null, $auth['access']);
                foreach ($assignments as $assignment) {
                    if (is_string($assignment['title'] ?? null)) {
                        $assignmentTitles[$assignment['id']] = $assignment['title'];
                    }
                }
            }
        }
    }
} catch (RuntimeException | JsonException $exception) {
    if ($auth !== null && in_array($exception->getCode(), [400, 401], true)) {
        unset($_SESSION['auth']);
        $auth = null;
        $member = null;
    }
    $error = $exception instanceof JsonException ? 'Не удалось отправить запрос.' : $exception->getMessage();
}
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Кабинет KKSU</title>
  <style>
    body { font: 1rem/1.6 system-ui, sans-serif; margin: 0; background: #f0fdfa; color: #0f172a; }
    main { width: min(48rem, calc(100% - 2rem)); margin: 2rem auto; overflow-wrap: anywhere; }
    a { color: #0f665f; }
    form, article { background: white; padding: 1rem; border-radius: .75rem; margin-block: 1rem; }
    label { display: block; margin-bottom: .75rem; }
    input, textarea { display: block; box-sizing: border-box; width: min(100%, 28rem); padding: .5rem; font: inherit; }
    button { font: inherit; color: white; background: #0f665f; border: 0; border-radius: .4rem; padding: .5rem 1rem; cursor: pointer; }
    nav { display: flex; flex-wrap: wrap; gap: 1rem; }
    [aria-current] { font-weight: bold; }
    [role="alert"] { color: #991b1b; }
  </style>
</head>
<body><main>
  <a href="kksu.html">← О проекте KKSU</a>
  <h1>Кабинет KKSU</h1>
  <?php if ($notice !== ''): ?><p role="status"><?= kksuHtml($notice) ?></p><?php endif; ?>
  <?php if ($error !== ''): ?><p role="alert"><?= kksuHtml($error) ?></p><?php endif; ?>
  <?php if ($auth === null): ?>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= kksuHtml($csrf) ?>">
      <input type="hidden" name="action" value="login">
      <label>Email KKSU <input type="email" name="email" autocomplete="username" required maxlength="254"></label>
      <label>Пароль <input type="password" name="password" autocomplete="current-password" required maxlength="1024"></label>
      <button type="submit">Войти</button>
    </form>
  <?php else: ?>
    <form method="post">
      <input type="hidden" name="csrf" value="<?= kksuHtml($csrf) ?>">
      <input type="hidden" name="action" value="logout">
      <button type="submit">Выйти</button>
    </form>
    <?php if ($error === '' && $member !== null): ?>
      <p><?= kksuHtml($member['full_name']) ?> · <?= kksuHtml($memberships[$member['role']]) ?></p>
      <nav aria-label="Разделы кабинета">
        <?php foreach ($sections as $key => $title): ?>
          <a href="?section=<?= $key ?>"<?= $section === $key ? ' aria-current="page"' : '' ?>><?= kksuHtml($title) ?></a>
        <?php endforeach; ?>
      </nav>
      <h2><?= kksuHtml($sections[$section]) ?></h2>
      <?php if (!$items): ?><p>На этой странице пока нет материалов.</p><?php endif; ?>
      <?php foreach ($items as $item):
        $data = $item['data'] ?? [];
        $link = kksuLink($data['url'] ?? null);
        $title = $section === 'submissions'
            ? ($assignmentTitles[strtolower((string)($data['assignmentID'] ?? ''))] ?? 'Учебная работа')
            : (string)($data['title'] ?? '');
        $summary = match ($section) {
            'assignments' => $data['details'] ?? '',
            'notifications' => $data['body'] ?? '',
            'submissions' => $data['text'] ?? '',
            default => $data['summary'] ?? '',
        };
        ?>
        <article>
          <h3><?= kksuHtml($title) ?></h3>
          <?php if (is_string($summary) && $summary !== ''): ?><p><?= nl2br(kksuHtml($summary)) ?></p><?php endif; ?>
          <?php if ($section === 'programs'): ?>
            <p><?= kksuHtml((string)($data['ageRange'] ?? '')) ?> · Недель: <?= (int)($data['durationWeeks'] ?? 0) ?></p>
          <?php elseif ($section === 'sessions'):
            $meeting = kksuLink($data['meetingURL'] ?? null);
            $recording = kksuLink($data['recordingURL'] ?? null);
            if (($data['meetingURL'] ?? '') === '' && ($data['isOnline'] ?? false) === true
                && ($data['platform'] ?? '') === 'jitsi' && preg_match('/^[a-f0-9-]{36}$/Di', $item['id'] ?? '')) {
                $meeting = 'https://meet.jit.si/KKSU-' . strtoupper(substr($item['id'], 0, 8));
            }
            ?>
            <p><?= kksuHtml((string)($data['subject'] ?? '')) ?> · <?= kksuHtml(kksuDate($data['start'] ?? null)) ?> (Алматы) · <?= (int)($data['durationMinutes'] ?? 0) ?> мин</p>
            <?php if (is_string($data['room'] ?? null) && $data['room'] !== ''): ?><p>Кабинет <?= kksuHtml($data['room']) ?></p><?php endif; ?>
            <?php if ($meeting !== null): ?><a href="<?= kksuHtml($meeting) ?>" rel="noreferrer">Подключиться к занятию</a><?php endif; ?>
            <?php if ($recording !== null): ?><a href="<?= kksuHtml($recording) ?>" rel="noreferrer">Запись занятия</a><?php endif; ?>
          <?php elseif ($section === 'notifications'): ?>
            <p><?= kksuHtml(kksuDate($data['date'] ?? null)) ?> (Алматы)<?= ($data['isRead'] ?? true) === false ? ' · Новое' : '' ?></p>
          <?php elseif ($section === 'assignments'): ?>
            <p><?= kksuHtml((string)($data['subject'] ?? '')) ?> · Срок <?= kksuHtml(kksuDate($data['dueDate'] ?? null)) ?> (Алматы) · <?= (int)($data['maxScore'] ?? 0) ?> баллов</p>
            <details>
              <summary>Сдать текстовый ответ</summary>
              <form method="post">
                <input type="hidden" name="csrf" value="<?= kksuHtml($csrf) ?>">
                <input type="hidden" name="action" value="submit_work">
                <input type="hidden" name="assignment_id" value="<?= kksuHtml($item['id']) ?>">
                <input type="hidden" name="submission_id" value="<?= kksuNewUuid() ?>">
                <label>Ответ <textarea name="text" rows="5" maxlength="10000" required></textarea></label>
                <button type="submit">Отправить на проверку</button>
              </form>
            </details>
          <?php elseif ($section === 'submissions'):
            $status = match ($data['status'] ?? '') {
                'submitted' => 'На проверке',
                'graded' => 'Оценено',
                'returned' => 'На доработку',
                default => 'Статус не указан',
            };
            ?>
            <p><?= $status ?> · <?= kksuHtml(kksuDate($data['submittedAt'] ?? null)) ?> (Алматы)</p>
            <?php if (is_int($data['score'] ?? null)): ?><p>Балл: <?= $data['score'] ?></p><?php endif; ?>
            <?php if (is_string($data['feedback'] ?? null) && $data['feedback'] !== ''): ?>
              <p><strong>Отзыв педагога</strong><br><?= nl2br(kksuHtml($data['feedback'])) ?></p>
            <?php endif; ?>
          <?php elseif ($section === 'library' && $link !== null): ?>
            <a href="<?= kksuHtml($link) ?>" rel="noreferrer">Открыть материал</a>
          <?php endif; ?>
          <?php if (is_string($data['textAlternative'] ?? null) && $data['textAlternative'] !== ''): ?>
            <details><summary>Текстовая версия</summary><p><?= nl2br(kksuHtml($data['textAlternative'])) ?></p></details>
          <?php endif; ?>
        </article>
      <?php endforeach; ?>
      <nav aria-label="Страницы каталога">
        <?php if ($page > 1): ?><a href="?section=<?= $section ?>&amp;page=<?= $page - 1 ?>">Назад</a><?php endif; ?>
        <?php if ($hasMore && $page < 10000): ?><a href="?section=<?= $section ?>&amp;page=<?= $page + 1 ?>">Далее</a><?php endif; ?>
      </nav>
    <?php endif; ?>
  <?php endif; ?>
</main></body>
</html>
