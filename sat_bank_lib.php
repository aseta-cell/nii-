<?php
// SAT task book inside the Study Hub: tasks are split into modules of 50 like game levels,
// answers are checked automatically, progress gives XP, levels and stars.
//
// The tasks themselves are NOT stored in the code repository: an editor (or a special-access
// user while the book is empty) uploads the task book file once on the site.
// Loaded by study.php after study_lib.php.

if (!isset($conn)) {
    http_response_code(404);
    exit;
}

const SAT_MODULE_SIZE = 50;
const SAT_UNLOCK_SHARE = 0.8;      // a module opens when 80% of the previous one is answered
const SAT_DAILY_GOAL = 44;         // the book's plan: 44 tasks a day
const SAT_XP_FIRST_TRY = 10;
const SAT_XP_LATER = 5;
const SAT_XP_PER_LEVEL = 500;

function ensure_sat_bank_schema()
{
    global $conn;

    $exists = $conn->query("SHOW TABLES LIKE 'sat_bank'");
    if ($exists && $exists->num_rows > 0) {
        return;
    }

    $conn->query("
        CREATE TABLE IF NOT EXISTS sat_bank (
            no INT PRIMARY KEY,
            section VARCHAR(120) NOT NULL,
            area VARCHAR(10) NOT NULL,
            topic VARCHAR(80) NOT NULL,
            question TEXT NOT NULL,
            answer VARCHAR(60) NOT NULL,
            explanation TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $conn->query("
        CREATE TABLE IF NOT EXISTS study_sat_bank_progress (
            user_id INT NOT NULL,
            task_no INT NOT NULL,
            status VARCHAR(10) NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            my_answer VARCHAR(100) NULL,
            xp INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, task_no),
            INDEX (user_id, created_at),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

ensure_sat_bank_schema();


// ---------------------------------------------------------------
// Answer checking
// ---------------------------------------------------------------

function sat_norm($s)
{
    $s = mb_strtolower(trim((string)$s));
    $s = str_replace(["−", "–", "—", "×", "·", "²", "“", "”", "‘", "’", "«", "»", "\"", "'"],
                     ["-", "-", "-", "*", "*", "^2", "", "", "", "", "", "", "", ""], $s);
    $s = preg_replace('/\s+/u', '', $s);
    $s = preg_replace('/(pi|п)$/u', 'π', rtrim($s, "."));
    return $s;
}

// "37/5", "7.4", "-3", "1/2" → float, or null
function sat_number($s)
{
    if (preg_match('/^[+-]?\d+(\.\d+)?$/', $s)) {
        return (float)$s;
    }
    if (preg_match('/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/', $s, $m) && (float)$m[2] != 0) {
        return (float)$m[1] / (float)$m[2];
    }
    return null;
}

function sat_same_value($a, $b)
{
    if ($a === $b) {
        return true;
    }
    $x = sat_number($a);
    $y = sat_number($b);
    return $x !== null && $y !== null && abs($x - $y) < 1e-6;
}

// Factors of "(x+5)(x+3)" or "(x+5)^2" → sorted list
function sat_factors($s)
{
    if (!preg_match_all('/\(([^()]+)\)(\^2)?/', $s, $m, PREG_SET_ORDER)) {
        return null;
    }
    if (preg_replace('/\(([^()]+)\)(\^2)?/', '', $s) !== "") {
        return null;
    }
    $out = [];
    foreach ($m as $f) {
        $out[] = $f[1];
        if (!empty($f[2])) {
            $out[] = $f[1];
        }
    }
    sort($out);
    return $out;
}

function sat_check_answer($given, $key)
{
    $g = sat_norm($given);
    $k = sat_norm($key);

    if ($g === "") {
        return false;
    }
    if ($g === $k) {
        return true;
    }

    // Letter choices: "b", "b)", "(b)", "option b"
    if (preg_match('/^[a-e]$/', $k)) {
        return preg_replace('/^(option|answer|ответ)?\(?([a-e])\)?$/u', '$2', $g) === $k;
    }

    // Multiples of π: "22π", "22pi"
    if (str_ends_with($k, "π")) {
        return str_ends_with($g, "π") && sat_same_value(substr($g, 0, -strlen("π")) ?: "1", substr($k, 0, -strlen("π")) ?: "1");
    }

    // Factored form: factors in any order, (x+5)^2 = (x+5)(x+5)
    if (str_starts_with($k, "(x")) {
        $fk = sat_factors($k);
        $fg = sat_factors($g);
        return $fk !== null && $fk === $fg;
    }

    // Ordered pair "(4,-4)"; also accept "x=4,y=-4"
    if (preg_match('/^\(([^,]+),([^,]+)\)$/', $k, $mk)) {
        $g2 = preg_replace('/^x=([^,]+),y=(.+)$/', '($1,$2)', $g);
        return preg_match('/^\(?([^,()]+),([^,()]+)\)?$/', $g2, $mg)
            && sat_same_value($mg[1], $mk[1]) && sat_same_value($mg[2], $mk[2]);
    }

    // Inequality "x<5"
    if (preg_match('/^x([<>]=?)(.+)$/', $k, $mk)) {
        return preg_match('/^x([<>]=?)(.+)$/', $g, $mg) && $mg[1] === $mk[1] && sat_same_value($mg[2], $mk[2]);
    }

    // Several values (roots) in any order: "-1,1"; a double root "-7" also accepts "-7,-7"
    $kv = array_values(array_unique(explode(",", preg_replace('/^x=/', '', $k))));
    $gv = array_values(array_unique(explode(",", preg_replace('/x=/', '', $g))));
    if (count($kv) > 1 || count($gv) > 1) {
        if (count($kv) !== count($gv)) {
            return false;
        }
        foreach ($kv as $v) {
            $found = false;
            foreach ($gv as $i => $w) {
                if (sat_same_value($v, $w)) {
                    unset($gv[$i]);
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                return false;
            }
        }
        return true;
    }

    // Single number ("x = 16", "16.0", "7.4" for 37/5; "-7, -7" for a double root -7) or word
    return sat_same_value($gv[0], $k);
}


// ---------------------------------------------------------------
// Modules and progress
// ---------------------------------------------------------------

function sat_bank_count()
{
    global $conn;
    return (int)$conn->query("SELECT COUNT(*) AS n FROM sat_bank")->fetch_assoc()["n"];
}

function sat_module_of($no)
{
    return intdiv($no - 1, SAT_MODULE_SIZE) + 1;
}

// Per module: answered, correct, total, title, stars, unlocked
function sat_modules($user_id)
{
    global $conn;

    $modules = [];

    foreach ($conn->query("
        SELECT FLOOR((no - 1) / " . SAT_MODULE_SIZE . ") + 1 AS m, COUNT(*) AS total,
               MIN(no) AS first_no, MAX(no) AS last_no,
               SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT section ORDER BY no SEPARATOR '|'), '|', 2) AS sections,
               SUM(area = 'Math') AS math, SUM(area <> 'Math') AS rw
        FROM sat_bank GROUP BY m ORDER BY m
    ")->fetch_all(MYSQLI_ASSOC) as $r) {
        $modules[(int)$r["m"]] = $r + ["answered" => 0, "correct" => 0];
    }

    $stmt = $conn->prepare("
        SELECT FLOOR((task_no - 1) / " . SAT_MODULE_SIZE . ") + 1 AS m,
               COUNT(*) AS answered, SUM(status = 'correct') AS correct
        FROM study_sat_bank_progress WHERE user_id = ? GROUP BY m
    ");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();

    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $r) {
        if (isset($modules[(int)$r["m"]])) {
            $modules[(int)$r["m"]]["answered"] = (int)$r["answered"];
            $modules[(int)$r["m"]]["correct"] = (int)$r["correct"];
        }
    }

    $previous_done = true;

    foreach ($modules as $m => &$mod) {
        $mod["unlocked"] = $previous_done || $mod["answered"] > 0;
        $mod["complete"] = $mod["answered"] >= $mod["total"];
        $share = $mod["complete"] ? $mod["correct"] / max(1, $mod["total"]) : 0;
        $mod["stars"] = $share >= 0.9 ? 3 : ($share >= 0.75 ? 2 : ($share >= 0.5 ? 1 : 0));
        $previous_done = $mod["answered"] >= ceil($mod["total"] * SAT_UNLOCK_SHARE);
    }

    return $modules;
}

function sat_player($user_id)
{
    global $conn;

    $stmt = $conn->prepare("
        SELECT COALESCE(SUM(xp), 0) AS xp, COUNT(*) AS answered, COALESCE(SUM(status = 'correct'), 0) AS correct,
               COALESCE(SUM(DATE(created_at) = CURDATE()), 0) AS today
        FROM study_sat_bank_progress WHERE user_id = ?
    ");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $p = $stmt->get_result()->fetch_assoc();

    $p["level"] = intdiv((int)$p["xp"], SAT_XP_PER_LEVEL) + 1;
    $p["level_xp"] = (int)$p["xp"] % SAT_XP_PER_LEVEL;

    return $p;
}

// Uploaded task book (JSON list of {no, section, area, topic, question, answer, explanation})
function sat_import_bank($json)
{
    global $conn;

    $items = json_decode($json, true);

    if (!is_array($items) || count($items) < 1 || count($items) > 20000) {
        return "The file is not a task book (JSON list expected).";
    }

    $rows = [];
    foreach ($items as $i => $t) {
        $no = (int)($t["no"] ?? 0);
        if ($no < 1 || !isset($t["question"], $t["answer"], $t["topic"]) || isset($rows[$no])) {
            return "Task " . ($i + 1) . " is incomplete or repeated.";
        }
        $rows[$no] = [
            mb_substr((string)($t["section"] ?? ""), 0, 120),
            mb_substr((string)($t["area"] ?? ""), 0, 10),
            mb_substr((string)$t["topic"], 0, 80),
            mb_substr((string)$t["question"], 0, 5000),
            mb_substr((string)$t["answer"], 0, 60),
            mb_substr((string)($t["explanation"] ?? ""), 0, 5000),
        ];
    }

    $conn->begin_transaction();
    $conn->query("DELETE FROM sat_bank");
    $stmt = $conn->prepare("INSERT INTO sat_bank (no, section, area, topic, question, answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?)");
    foreach ($rows as $no => [$section, $area, $topic, $question, $answer, $explanation]) {
        $stmt->bind_param("issssss", $no, $section, $area, $topic, $question, $answer, $explanation);
        $stmt->execute();
    }
    $conn->commit();

    return count($rows);
}
