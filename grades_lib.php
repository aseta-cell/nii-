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

// Earlier the list had Algebra and Geometry instead of Mathematics. If both are still
// there without any works, they become one "Mathematics" subject.
function merge_empty_algebra_geometry($user_id)
{
    global $conn;

    $stmt = $conn->prepare("
        SELECT s.id, s.name, COUNT(a.id) AS works FROM study_ib_subjects s
        LEFT JOIN study_ib_assessments a ON a.subject_id = s.id
        WHERE s.user_id = ? AND s.name IN ('Algebra', 'Алгебра', 'Geometry', 'Геометрия', 'Mathematics', 'Математика')
        GROUP BY s.id, s.name
    ");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $found = [];
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $r) {
        $key = in_array($r["name"], ["Algebra", "Алгебра"], true) ? "algebra" : (in_array($r["name"], ["Geometry", "Геометрия"], true) ? "geometry" : "math");
        $found[$key] = $r;
    }

    if (isset($found["algebra"], $found["geometry"]) && !isset($found["math"])
        && !$found["algebra"]["works"] && !$found["geometry"]["works"]) {
        $name = $found["algebra"]["name"] === "Алгебра" ? "Математика" : "Mathematics";
        $a = (int)$found["algebra"]["id"];
        $g = (int)$found["geometry"]["id"];
        $stmt = $conn->prepare("UPDATE study_ib_subjects SET name = ? WHERE id = ? AND user_id = ?");
        $stmt->bind_param("sii", $name, $a, $user_id);
        $stmt->execute();
        $stmt = $conn->prepare("DELETE FROM study_ib_subjects WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $g, $user_id);
        $stmt->execute();
    }
}
