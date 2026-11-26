<?php
// Study Hub → SAT course: lessons in two tracks (Math, Reading & Writing), 10 lessons per unit,
// a test after every unit and a review test of the last two units after every second unit.
// Lessons open one by one, gently: a lesson is done when all its practice tasks are answered;
// a test is passed at 60%. Content: sat_course.json (theory and tasks written for this course);
// warm-up tasks come from the SAT task book (sat_bank) when it is uploaded.
// Loaded by study.php after sat_bank_lib.php.

if (!isset($conn)) {
    http_response_code(404);
    exit;
}

const COURSE_WARMUP = 5;

function ensure_course_schema()
{
    global $conn;

    $exists = $conn->query("SHOW TABLES LIKE 'study_course_tests'");
    if ($exists && $exists->num_rows > 0) {
        return;
    }

    $conn->query("
        CREATE TABLE IF NOT EXISTS study_course_answers (
            user_id INT NOT NULL,
            item_key VARCHAR(30) NOT NULL,
            status VARCHAR(10) NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            my_answer VARCHAR(100) NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, item_key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $conn->query("
        CREATE TABLE IF NOT EXISTS study_course_tests (
            user_id INT NOT NULL,
            test_key VARCHAR(20) NOT NULL,
            last_score INT NOT NULL DEFAULT 0,
            best_score INT NOT NULL DEFAULT 0,
            total INT NOT NULL DEFAULT 0,
            attempts INT NOT NULL DEFAULT 0,
            answers TEXT NULL,
            taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, test_key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

ensure_course_schema();

function course_data()
{
    static $course = null;
    if ($course === null) {
        $course = json_decode((string)file_get_contents(__DIR__ . "/sat_course.json"), true) ?: ["tracks" => []];
    }
    return $course;
}

function course_track($track)
{
    return course_data()["tracks"][$track] ?? null;
}

// All course tasks by key (practice and test tasks of every lesson)
function course_items()
{
    static $items = null;
    if ($items === null) {
        $items = [];
        foreach (course_data()["tracks"] as $t) {
            foreach ($t["lessons"] as $l) {
                foreach (array_merge($l["practice"], $l["test"]) as $it) {
                    $items[$it["key"]] = $it + ["lesson" => $l["id"]];
                }
            }
        }
    }
    return $items;
}

function course_lesson($id)
{
    foreach (course_data()["tracks"] as $name => $t) {
        foreach ($t["lessons"] as $i => $l) {
            if ($l["id"] === $id) {
                return $l + ["track" => $name, "index" => $i];
            }
        }
    }
    return null;
}

// The track as a sequence of steps: lessons, unit tests (T), reviews of two units (R), final (F)
function course_steps($track)
{
    $t = course_track($track);
    if (!$t) {
        return [];
    }
    $prefix = $track === "math" ? "m" : "e";
    $units = [];
    foreach ($t["lessons"] as $i => $l) {
        $units[$l["unit"]][] = $l + ["index" => $i];
    }
    $steps = [];
    $last = max(array_keys($units));
    foreach ($units as $u => $lessons) {
        foreach ($lessons as $l) {
            $steps[] = ["type" => "lesson", "id" => $l["id"], "unit" => $u, "lesson" => $l];
        }
        // Unit test: the first two test tasks of each lesson
        $items = [];
        foreach ($lessons as $l) {
            $items = array_merge($items, array_column(array_slice($l["test"], 0, 2), "key"));
        }
        $steps[] = ["type" => "test", "id" => $prefix . "-T" . $u, "unit" => $u, "kind" => "unit", "items" => $items];

        // Review after every second unit: one task per lesson of the last two units
        if ($u % 2 === 0 || ($u === $last && $u > 1)) {
            $items = [];
            $from = $u % 2 === 0 ? $u - 1 : 1;
            for ($k = $from; $k <= $u; $k++) {
                foreach ($units[$k] as $l) {
                    $pick = $l["test"][2] ?? $l["practice"][count($l["practice"]) - 1];
                    $items[] = $pick["key"];
                }
            }
            $kind = $u % 2 === 0 ? "review" : "final";
            $steps[] = ["type" => "test", "id" => $prefix . ($kind === "review" ? "-R" : "-F") . $u, "unit" => $u, "kind" => $kind, "items" => $items, "from" => $from];
        }
    }
    return $steps;
}

// The user's answers (key => row) and tests (key => row)
function course_progress($user_id)
{
    global $conn;
    $answers = [];
    $stmt = $conn->prepare("SELECT * FROM study_course_answers WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $r) {
        $answers[$r["item_key"]] = $r;
    }
    $tests = [];
    $stmt = $conn->prepare("SELECT * FROM study_course_tests WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $r) {
        $tests[$r["test_key"]] = $r;
    }
    return [$answers, $tests];
}

function course_test_passed($row)
{
    return $row && $row["total"] > 0 && $row["best_score"] / $row["total"] >= course_data()["pass_share"];
}

// Steps with state: done, open (unlocked), locked; plus lesson stats
function course_state($track, array $answers, array $tests)
{
    $steps = course_steps($track);
    $open = true;
    foreach ($steps as &$s) {
        if ($s["type"] === "lesson") {
            $keys = array_column($s["lesson"]["practice"], "key");
            $answered = count(array_filter($keys, fn($k) => isset($answers[$k])));
            $correct = count(array_filter($keys, fn($k) => ($answers[$k]["status"] ?? "") === "correct"));
            $s["answered"] = $answered;
            $s["correct"] = $correct;
            $s["total"] = count($keys);
            $s["done"] = $answered >= count($keys);
        } else {
            $row = $tests[$s["id"]] ?? null;
            $s["row"] = $row;
            $s["done"] = course_test_passed($row);
        }
        $s["open"] = $open;
        $open = $open && $s["done"];
    }
    return $steps;
}

// Warm-up from the task book: 5 tasks of the lesson's topic (different ones for lessons sharing a topic)
function course_warmup(array $lesson)
{
    global $conn;
    if (empty($lesson["bank"]) || !sat_bank_count()) {
        return [];
    }
    $offset = 0;
    foreach (course_data()["tracks"] as $t) {
        foreach ($t["lessons"] as $l) {
            if ($l["id"] === $lesson["id"]) {
                break 2;
            }
            if (($l["bank"] ?? null) === $lesson["bank"]) {
                $offset += COURSE_WARMUP;
            }
        }
    }
    $limit = COURSE_WARMUP;
    $stmt = $conn->prepare("SELECT * FROM sat_bank WHERE topic = ? ORDER BY no LIMIT ? OFFSET ?");
    $stmt->bind_param("sii", $lesson["bank"], $limit, $offset);
    $stmt->execute();
    $out = [];
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $t) {
        $out[] = ["key" => "b" . $t["no"], "q" => $t["question"], "a" => $t["answer"], "why" => (string)$t["explanation"], "bank" => true];
    }
    return $out;
}

// One task by key: course task or task-book warm-up ("b123")
function course_item($key)
{
    global $conn;
    if (preg_match('/^b(\d{1,5})$/', $key, $m)) {
        $no = (int)$m[1];
        $stmt = $conn->prepare("SELECT * FROM sat_bank WHERE no = ?");
        $stmt->bind_param("i", $no);
        $stmt->execute();
        $t = $stmt->get_result()->fetch_assoc();
        return $t ? ["key" => $key, "q" => $t["question"], "a" => $t["answer"], "why" => (string)$t["explanation"], "bank" => true] : null;
    }
    return course_items()[$key] ?? null;
}
