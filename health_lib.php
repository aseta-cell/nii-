<?php
// Study Hub → Health: daily habits (sleep, no sugar, no fast food…) and a daily
// workout checklist. Every item is ticked per day; everything can be edited.
// Loaded by study.php after study_lib.php.

if (!isset($conn)) {
    http_response_code(404);
    exit;
}

function ensure_health_schema()
{
    global $conn;

    $exists = $conn->query("SHOW TABLES LIKE 'study_exercise_log'");
    if ($exists && $exists->num_rows > 0) {
        return;
    }

    $tables = [
        "study_habits" => "
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(120) NOT NULL,
            sort INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (user_id)",
        "study_habit_log" => "
            user_id INT NOT NULL,
            habit_id INT NOT NULL,
            log_date DATE NOT NULL,
            PRIMARY KEY (user_id, habit_id, log_date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (habit_id) REFERENCES study_habits(id) ON DELETE CASCADE",
        "study_exercises" => "
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            block VARCHAR(20) NOT NULL,
            name VARCHAR(120) NOT NULL,
            target VARCHAR(60) NOT NULL DEFAULT '',
            weight VARCHAR(30) NOT NULL DEFAULT '',
            sort INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (user_id)",
        "study_exercise_log" => "
            user_id INT NOT NULL,
            exercise_id INT NOT NULL,
            log_date DATE NOT NULL,
            PRIMARY KEY (user_id, exercise_id, log_date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (exercise_id) REFERENCES study_exercises(id) ON DELETE CASCADE",
    ];

    foreach ($tables as $name => $columns) {
        $conn->query("CREATE TABLE IF NOT EXISTS $name ($columns) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    // Marks that the starter habits and workout were created for a user
    $has = $conn->query("SHOW COLUMNS FROM study_settings LIKE 'health_seeded'");
    if ($has && $has->num_rows === 0) {
        $conn->query("ALTER TABLE study_settings ADD COLUMN health_seeded TINYINT(1) NOT NULL DEFAULT 0");
    }
}

ensure_health_schema();

const WORKOUT_BLOCKS = [
    "core"     => ["Core", "Пресс"],
    "glutes"   => ["Glutes", "Ягодицы"],
    "posture"  => ["Posture", "Осанка"],
    "upper"    => ["Arms and chest", "Руки и грудь"],
    "pilates"  => ["Pilates", "Пилатес"],
    "cardio"   => ["Cardio", "Кардио"],
    "yoga"     => ["Yoga and calisthenics", "Йога и калистеника"],
];

// Starter habits and workout (names in English / Russian; the user's language is used)
const STARTER_HABITS = [
    ["Sleep 8 hours", "Сон 8 часов"],
    ["No sugar", "Без сахара"],
    ["No fast food", "Без фастфуда"],
];

const STARTER_EXERCISES = [
    ["core", "Plank", "Планка", "2 min", "2 мин"],
    ["core", "Bicycle crunches", "Велосипед", "200", "200"],
    ["core", "Crunches", "Скручивания", "200", "200"],
    ["core", "Russian twists", "Русские твисты", "200", "200"],
    ["core", "Flutter kicks", "Ножницы", "200", "200"],
    ["glutes", "Fire hydrants (each side)", "Гидранты (на каждую сторону)", "200", "200"],
    ["glutes", "Banded glute kickbacks (each side)", "Отведения ноги назад с лентой (на каждую сторону)", "100", "100"],
    ["posture", "Wall angels", "Ангелы у стены", "3 × 15", "3 × 15"],
    ["posture", "Superman hold", "Супермен (удержание)", "3 × 30 s", "3 × 30 с"],
    ["posture", "Cat–cow", "Кошка–корова", "10", "10"],
    ["upper", "Push-ups", "Отжимания", "3 × 10", "3 × 10"],
    ["pilates", "The hundred", "Сотня (hundred)", "100", "100"],
    ["pilates", "Single-leg stretch", "Растяжка одной ноги", "20", "20"],
    ["pilates", "Side-lying leg lifts (each side)", "Махи ногой лёжа на боку (на каждую сторону)", "50", "50"],
    ["cardio", "Jumping in place", "Прыжки на месте", "60 min", "60 мин"],
    ["cardio", "Walking", "Ходьба", "3 h · 25 000 steps", "3 ч · 25 000 шагов"],
    ["yoga", "Sun salutation", "Приветствие солнцу", "5 rounds", "5 кругов"],
    ["yoga", "Downward dog", "Собака мордой вниз", "1 min", "1 мин"],
    ["yoga", "Hollow body hold", "Лодочка (hollow body)", "3 × 30 s", "3 × 30 с"],
    ["yoga", "Crow pose practice", "Ворона (журавль), попытки", "3 × 10 s", "3 × 10 с"],
    ["yoga", "Bridge", "Мостик", "3 × 20 s", "3 × 20 с"],
];

function seed_health_for_user($user_id, $lang)
{
    global $conn;

    $row = $conn->query("SELECT health_seeded FROM study_settings WHERE user_id = " . (int)$user_id)->fetch_assoc();
    if (!$row || $row["health_seeded"]) {
        return;
    }

    $ru = $lang === "ru";

    $stmt = $conn->prepare("INSERT INTO study_habits (user_id, name, sort) VALUES (?, ?, ?)");
    foreach (STARTER_HABITS as $i => $h) {
        $name = $ru ? $h[1] : $h[0];
        $stmt->bind_param("isi", $user_id, $name, $i);
        $stmt->execute();
    }

    $stmt = $conn->prepare("INSERT INTO study_exercises (user_id, block, name, target, weight, sort) VALUES (?, ?, ?, ?, ?, ?)");
    foreach (STARTER_EXERCISES as $i => $x) {
        $name = $ru ? $x[2] : $x[1];
        $target = $ru ? $x[4] : $x[3];
        $weight = "";
        $stmt->bind_param("issssi", $user_id, $x[0], $name, $target, $weight, $i);
        $stmt->execute();
    }

    $conn->query("UPDATE study_settings SET health_seeded = 1 WHERE user_id = " . (int)$user_id);
}

// Days in a row (ending on $day, or the day before if $day is not ticked yet)
function health_streak(array $dates, $day)
{
    $set = array_flip($dates);
    $cursor = isset($set[$day]) ? $day : date("Y-m-d", strtotime($day . " -1 day"));
    $n = 0;
    while (isset($set[$cursor])) {
        $n++;
        $cursor = date("Y-m-d", strtotime($cursor . " -1 day"));
    }
    return $n;
}

// The day being ticked: a valid date within the last year and not in the future
function health_day($value)
{
    $today = date("Y-m-d");
    $day = study_date($value);
    if (!$day || $day > $today || $day < date("Y-m-d", strtotime("-365 day"))) {
        return $today;
    }
    return $day;
}
