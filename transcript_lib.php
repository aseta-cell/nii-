<?php
// Study Hub → Transcript: finished semester grades of earlier years (grades 7, 8, 9 …),
// GPA per semester, the cumulative GPA from grade 9 (what US universities look at)
// and a small chart per subject. Loaded by study.php after grades_lib.php.

if (!isset($conn)) {
    http_response_code(404);
    exit;
}

function ensure_transcript_schema()
{
    global $conn;

    $exists = $conn->query("SHOW TABLES LIKE 'study_past_grades'");
    if (!$exists || $exists->num_rows === 0) {
        $conn->query("
            CREATE TABLE IF NOT EXISTS study_past_grades (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                grade_level TINYINT NOT NULL,
                semester TINYINT NOT NULL,
                subject VARCHAR(100) NOT NULL,
                mark TINYINT NOT NULL,
                UNIQUE KEY one_mark (user_id, grade_level, semester, subject),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    $has = $conn->query("SHOW COLUMNS FROM study_settings LIKE 'current_grade'");
    if ($has && $has->num_rows === 0) {
        $conn->query("ALTER TABLE study_settings ADD COLUMN current_grade TINYINT NOT NULL DEFAULT 10");
    }
}

ensure_transcript_schema();

const TRANSCRIPT_GRADES = [7, 8, 9, 10, 11, 12];
const TRANSCRIPT_FROM_GRADE = 9;   // US high-school GPA counts grades 9–12

function subject_key($name)
{
    return mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string)$name)));
}

function gpa_of_marks(array $marks)
{
    $marks = array_filter($marks, fn($m) => $m >= 1 && $m <= 7);
    if (!$marks) {
        return null;
    }
    return array_sum(array_map(fn($m) => IB_TO_GPA[$m][0], $marks)) / count($marks);
}
