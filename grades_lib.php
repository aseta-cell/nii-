<?php
// Study Hub → IB grades: semesters, planned summatives and the predicted
// semester grade (MYP-style: average level per criterion A–D → total /32 → 1–7).
// Loaded by study.php after study_lib.php.

if (!isset($conn)) {
    http_response_code(404);
    exit;
}

function ensure_grades_columns()
{
    global $conn;
    $has = $conn->query("SHOW COLUMNS FROM study_ib_assessments LIKE 'term'");
    if ($has && $has->num_rows === 0) {
        $conn->query("ALTER TABLE study_ib_assessments ADD COLUMN term TINYINT NULL AFTER due_date");
    }
    // Dream university and the GPA to aim for
    $has = $conn->query("SHOW COLUMNS FROM study_settings LIKE 'gpa_goal'");
    if ($has && $has->num_rows === 0) {
        $conn->query("ALTER TABLE study_settings ADD COLUMN gpa_goal DECIMAL(3,2) NOT NULL DEFAULT 3.90, ADD COLUMN gpa_goal_name VARCHAR(60) NOT NULL DEFAULT 'Harvard'");
    }
}

ensure_grades_columns();

// Grade 10, NIS (IB track): the usual subjects. Every name can be changed or deleted.
const NIS_GRADE10_SUBJECTS = [
    ["Kazakh Language and Literature", "Казахский язык и литература"],
    ["Russian Language and Literature", "Русский язык и литература"],
    ["English", "Английский язык"],
    ["Mathematics", "Математика"],
    ["Physics", "Физика"],
    ["Chemistry", "Химия"],
    ["Biology", "Биология"],
    ["History of Kazakhstan", "История Казахстана"],
    ["World History", "Всемирная история"],
    ["Geography", "География"],
    ["Economics", "Экономика"],
    ["Computer Science", "Информатика"],
    ["Arts", "Искусство (Arts)"],
    ["Physical Education", "Физическая культура"],
    ["Global Perspectives and Project Work", "Глобальные перспективы и проектные работы"],
];

// Assessment types; the ones marked true count towards the semester grade
const IB_KINDS = [
    "summative"      => [true,  "Summative for unit (SAU)", "Суммативная за раздел (СОР)"],
    "summative_term" => [true,  "Summative for term (SAT)", "Суммативная за четверть/семестр (СОЧ)"],
    "test"           => [true,  "Test", "Контрольная"],
    "project"        => [true,  "Project", "Проект"],
    "ia"             => [true,  "Internal assessment", "Internal assessment"],
    "homework"       => [false, "Homework", "Домашнее задание"],
    "formative"      => [false, "Formative (practice)", "Формативная (тренировка)"],
];

// Semester of a date: September–December → 1, January–August → 2
function ib_term_of($date)
{
    $month = (int)date("n", $date ? strtotime($date) : time());
    return $month >= 9 ? 1 : 2;
}

// Predicted grade for one subject from its graded assessments.
// Returns null when nothing is graded yet, otherwise:
//   grade (1–7), approx (not all four criteria have scores yet), avg [a..d] (null if none),
//   total (0–32), count (graded works counted), to_next (points needed for the next grade or null)
function ib_estimate(array $assessments, $boundaries)
{
    $sums = ["a" => [], "b" => [], "c" => [], "d" => []];
    $count = 0;

    foreach ($assessments as $a) {
        if (empty(IB_KINDS[$a["kind"]][0])) {
            continue;
        }
        $used = false;
        foreach ($sums as $c => $_) {
            if ($a["crit_" . $c] !== null) {
                $sums[$c][] = (int)$a["crit_" . $c];
                $used = true;
            }
        }
        $count += $used ? 1 : 0;
    }

    if (!$count) {
        return null;
    }

    $avg = [];
    foreach ($sums as $c => $values) {
        $avg[$c] = $values ? array_sum($values) / count($values) : null;
    }

    $known = array_filter($avg, fn($v) => $v !== null);
    $approx = count($known) < 4;
    // Each criterion: its typical level (average, rounded). Missing criteria: like the others for now.
    $total = $approx
        ? (int)round(array_sum($known) / count($known) * 4)
        : array_sum(array_map(fn($v) => (int)round($v), $avg));

    $mins = array_map("intval", explode(",", $boundaries));
    $grade = 1;
    foreach ($mins as $i => $min) {
        if ($total >= $min) {
            $grade = $i + 1;
        }
    }

    return [
        "grade" => $grade,
        "approx" => $approx,
        "avg" => $avg,
        "total" => $total,
        "count" => $count,
        "to_next" => $grade < 7 ? $mins[$grade] - $total : null,
    ];
}

// The school programme has no separate Algebra and Geometry, only Mathematics.
// Subjects with those names (from the earlier list) are folded into "Mathematics";
// their works move there, nothing is lost.
function merge_algebra_geometry($user_id)
{
    global $conn;

    $stmt = $conn->prepare("SELECT id, name FROM study_ib_subjects WHERE user_id = ? AND name IN ('Algebra', 'Алгебра', 'Geometry', 'Геометрия', 'Mathematics', 'Математика') ORDER BY id");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $math = null;
    $old = [];
    foreach ($rows as $r) {
        if (in_array($r["name"], ["Mathematics", "Математика"], true)) {
            $math = $math ?? $r;
        } else {
            $old[] = $r;
        }
    }
    if (!$old) {
        return;
    }

    if (!$math) {
        // The first old subject becomes Mathematics
        $math = array_shift($old);
        $name = preg_match('/[А-Яа-я]/u', $math["name"]) ? "Математика" : "Mathematics";
        $id = (int)$math["id"];
        $stmt = $conn->prepare("UPDATE study_ib_subjects SET name = ? WHERE id = ? AND user_id = ?");
        $stmt->bind_param("sii", $name, $id, $user_id);
        $stmt->execute();
    }

    $target = (int)$math["id"];
    foreach ($old as $r) {
        $from = (int)$r["id"];
        $stmt = $conn->prepare("UPDATE study_ib_assessments SET subject_id = ? WHERE subject_id = ? AND user_id = ?");
        $stmt->bind_param("iii", $target, $from, $user_id);
        $stmt->execute();
        $stmt = $conn->prepare("DELETE FROM study_ib_subjects WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $from, $user_id);
        $stmt->execute();
    }
}

// Subjects of the grade-10 list that the user does not have yet (in EN or RU, any case)
function nis_missing_subjects(array $names)
{
    $have = array_map(fn($n) => mb_strtolower(trim($n)), $names);
    $missing = [];
    foreach (NIS_GRADE10_SUBJECTS as $pair) {
        $variants = [mb_strtolower($pair[0]), mb_strtolower($pair[1]), mb_strtolower(preg_replace('/\s*\(.*\)$/u', '', $pair[1]))];
        if (!array_intersect($variants, $have)) {
            $missing[] = $pair;
        }
    }
    return $missing;
}

// IB 1–7 → US 4.0 scale (a common conversion; universities may recalculate)
const IB_TO_GPA = [
    7 => [4.0, "A"],
    6 => [3.7, "A-"],
    5 => [3.3, "B+"],
    4 => [3.0, "B"],
    3 => [2.0, "C"],
    2 => [1.0, "D"],
    1 => [0.0, "F"],
];

// Average GPA of the subjects that already have a forecast: [gpa, count, approx] or null
function gpa_from_estimates(array $estimates)
{
    $points = [];
    $approx = false;
    foreach ($estimates as $est) {
        if ($est) {
            $points[] = IB_TO_GPA[$est["grade"]][0];
            $approx = $approx || $est["approx"];
        }
    }
    return $points ? [array_sum($points) / count($points), count($points), $approx] : null;
}

// Words for a GPA: [en, ru] and a colour
function gpa_rating($gpa)
{
    if ($gpa >= 3.7) return [["Excellent", "Отлично"], "#16a34a"];
    if ($gpa >= 3.3) return [["Very good", "Очень хорошо"], "#65a30d"];
    if ($gpa >= 3.0) return [["Good", "Хорошо"], "#ca8a04"];
    if ($gpa >= 2.0) return [["Satisfactory", "Удовлетворительно"], "#ea580c"];
    return [["Needs work", "Есть над чем поработать"], "#dc2626"];
}
