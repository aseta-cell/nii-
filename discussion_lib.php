<?php
// Academic discussions: shared settings and helpers.
// Loaded by config.php. Extends the existing journal_comments table instead of
// creating a second comments system.

if (!isset($conn)) {
    http_response_code(404);
    exit;
}

// Who may see a comment of each status:
//   Published, Featured, Reported — everyone (Reported is waiting for an editor)
//   Pending Review — its author and editors
//   Hidden, Archived — editors only
const DISCUSSION_STATUSES = ["Pending Review", "Published", "Featured", "Hidden", "Reported", "Archived"];
const DISCUSSION_PUBLIC_STATUSES = ["Published", "Featured", "Reported"];

// Reports from this many different readers hide a comment until an editor decides
const DISCUSSION_REPORTS_TO_HIDE = 3;

// Subject labels a reader can give a comment
const DISCUSSION_TOPICS = [
    "general"       => "General discussion",
    "question"      => "Question to the authors",
    "methodology"   => "Research methodology",
    "applications"  => "Practical applications",
    "future"        => "Future research",
    "interdisciplinary" => "Interdisciplinary perspective",
    "ethics"        => "Ethics and integrity",
    "education"     => "Education and knowledge",
    "global"        => "Global perspective",
];

// Categories of the editorial prompt library
const PROMPT_CATEGORIES = [
    "appreciation"      => "Scholarly Appreciation",
    "reflection"        => "Intellectual Reflection",
    "interdisciplinary" => "Interdisciplinary Perspectives",
    "future"            => "Future Research Directions",
    "methodology"       => "Research Methodology",
    "applications"      => "Practical Applications",
    "ethics"            => "Research Ethics and Integrity",
    "global"            => "Global Academic Perspectives",
    "education"         => "Education and Knowledge Development",
    "dialogue"          => "Constructive Academic Dialogue",
];

const REPORT_REASONS = [
    "spam"        => "Spam or advertising",
    "abuse"       => "Personal attack or harassment",
    "offtopic"    => "Not related to the research",
    "misinformation" => "Unsupported or misleading claims",
    "plagiarism"  => "Plagiarism or fabricated citations",
    "other"       => "Other",
];

const SUGGESTION_CATEGORIES = [
    "topic"         => "New research topic",
    "special_issue" => "Special journal issue",
    "theme"         => "Interdisciplinary theme",
    "event"         => "Academic event",
    "collaboration" => "Research collaboration",
    "experience"    => "Improving the publishing experience",
];


// ---------------------------------------------------------------
// Database: added once, automatically, without touching old data
// ---------------------------------------------------------------

function ensure_discussion_schema()
{
    global $conn;

    $has_kind = $conn->query("SHOW COLUMNS FROM journal_comments LIKE 'kind'");

    if ($has_kind && $has_kind->num_rows === 0) {
        $conn->query("
            ALTER TABLE journal_comments
                ADD COLUMN submission_id INT NULL AFTER journal,
                ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'comment' AFTER parent_id,
                ADD COLUMN topic VARCHAR(30) NOT NULL DEFAULT 'general' AFTER kind,
                ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
                ADD INDEX (submission_id),
                ADD INDEX (status),
                ADD CONSTRAINT fk_comments_submission FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
        ");
    }

    $has_prompts = $conn->query("SHOW TABLES LIKE 'discussion_prompts'");

    if ($has_prompts && $has_prompts->num_rows === 0) {

        $conn->query("
            CREATE TABLE IF NOT EXISTS discussion_prompts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category VARCHAR(30) NOT NULL,
                journal VARCHAR(200) NULL,
                keywords VARCHAR(255) NULL,
                text TEXT NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (category),
                INDEX (journal)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $conn->query("
            CREATE TABLE IF NOT EXISTS comment_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                comment_id INT NOT NULL,
                user_id INT NOT NULL,
                reason VARCHAR(30) NOT NULL,
                details TEXT,
                resolved TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (comment_id) REFERENCES journal_comments(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY (comment_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $conn->query("
            CREATE TABLE IF NOT EXISTS comment_reactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                comment_id INT NOT NULL,
                user_id INT NOT NULL,
                reaction VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (comment_id) REFERENCES journal_comments(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY (comment_id, user_id, reaction)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $conn->query("
            CREATE TABLE IF NOT EXISTS reader_feedback (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                kind VARCHAR(20) NOT NULL,
                submission_id INT NULL,
                journal VARCHAR(200) NULL,
                category VARCHAR(30) NULL,
                further_research TEXT,
                related_questions TEXT,
                applications TEXT,
                future_topics TEXT,
                message TEXT,
                wants_collaboration TINYINT(1) NOT NULL DEFAULT 0,
                share_contact TINYINT(1) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'New',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
                INDEX (kind),
                INDEX (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $conn->query("
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                comment_id INT NULL,
                submission_id INT NULL,
                message VARCHAR(255) NOT NULL,
                link VARCHAR(255) NOT NULL,
                is_read TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (comment_id) REFERENCES journal_comments(id) ON DELETE CASCADE,
                INDEX (user_id, is_read)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        // Editorial prompt library (Academia Institute questions, not reader comments)
        $prompts = require __DIR__ . "/discussion-prompts-data.php";

        $stmt = $conn->prepare("INSERT INTO discussion_prompts (category, journal, keywords, text) VALUES (?, ?, ?, ?)");

        foreach ($prompts as $p) {
            $journal = $p["journal"] ?? null;
            $keywords = $p["keywords"] ?? null;
            $stmt->bind_param("ssss", $p["category"], $journal, $keywords, $p["text"]);
            $stmt->execute();
        }
    }
}

ensure_discussion_schema();


// ---------------------------------------------------------------
// Protection of forms against requests sent from other sites (CSRF)
// ---------------------------------------------------------------

function csrf_token()
{
    if (empty($_SESSION["csrf_token"])) {
        $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
    }
    return $_SESSION["csrf_token"];
}

function csrf_field()
{
    return '<input type="hidden" name="csrf_token" value="' . e(csrf_token()) . '">';
}

function check_csrf()
{
    $sent = $_POST["csrf_token"] ?? "";

    if (!is_string($sent) || empty($_SESSION["csrf_token"]) || !hash_equals($_SESSION["csrf_token"], $sent)) {
        http_response_code(400);
        die("The form has expired. Please go back, reload the page and try again.");
    }
}


// ---------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------

function current_user_role()
{
    global $conn;
    static $role = null;

    if ($role !== null) {
        return $role;
    }
    if (!isset($_SESSION["user_id"])) {
        return $role = "";
    }

    $stmt = $conn->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->bind_param("i", $_SESSION["user_id"]);
    $stmt->execute();

    return $role = ($stmt->get_result()->fetch_assoc()["role"] ?? "");
}

function is_editor()
{
    return current_user_role() === "editor";
}

// Random-looking but stable code of a comment, e.g. "#8k98439" (no names are shown)
function comment_code($id)
{
    $hash = md5("nii-comment-" . (int)$id);
    $letters = "abcdefghjkmnpqrstuvwxyz";
    return "#" . (hexdec($hash[0]) % 9 + 1)
        . $letters[hexdec(substr($hash, 1, 2)) % strlen($letters)]
        . str_pad((string)(hexdec(substr($hash, 3, 6)) % 100000), 5, "0", STR_PAD_LEFT);
}

// Stable pseudonymous code of a participant, shown to editors only, so they can
// recognise repeated spam without seeing names
function participant_code($user_id)
{
    return "P-" . strtoupper(substr(md5("nii-participant-" . (int)$user_id), 0, 5));
}

function normalize_comment_text($text)
{
    return mb_strtolower(preg_replace('/\s+/u', ' ', trim($text)));
}

function notify_user($user_id, $message, $link, $comment_id = null, $submission_id = null)
{
    global $conn;

    if (!$user_id) {
        return;
    }

    $stmt = $conn->prepare("
        INSERT INTO notifications (user_id, comment_id, submission_id, message, link)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->bind_param("iiiss", $user_id, $comment_id, $submission_id, $message, $link);
    $stmt->execute();
}

function unread_notifications_count($user_id)
{
    global $conn;

    $stmt = $conn->prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();

    return (int)$stmt->get_result()->fetch_assoc()["n"];
}


// ---------------------------------------------------------------
// Editorial prompts for a discussion
// ---------------------------------------------------------------

function text_words($text)
{
    preg_match_all('/[\p{L}\p{N}][\p{L}\p{N}\-]{2,}/u', mb_strtolower((string)$text), $m);
    return array_unique($m[0]);
}

// Up to $limit active prompts for an article (or a journal when $article is null).
// Article prompts are chosen by overlap of their keywords with the article's title,
// keywords and abstract; when nothing matches, general prompts are used. The choice is
// stable for one article (or one journal per week), so the page does not jump around.
function pick_discussion_prompts($journal, $article = null, $limit = 2)
{
    global $conn;

    $stmt = $conn->prepare("
        SELECT * FROM discussion_prompts
        WHERE is_active = 1 AND (journal IS NULL OR journal = ?)
        ORDER BY id
    ");
    $stmt->bind_param("s", $journal);
    $stmt->execute();
    $prompts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    if (!$prompts) {
        return [];
    }

    $seed = $article ? (int)$article["id"] : crc32($journal . date("o-W"));
    $words = $article ? text_words($article["title"] . " " . $article["keywords"] . " " . $article["abstract"]) : [];

    $scored = [];

    foreach ($prompts as $p) {
        $score = 0;

        if ($words && !empty($p["keywords"])) {
            foreach (array_map("trim", explode(",", mb_strtolower($p["keywords"]))) as $kw) {
                if ($kw === "") {
                    continue;
                }
                foreach ($words as $w) {
                    if ($w === $kw || (mb_strlen($kw) >= 4 && str_starts_with($w, $kw))) {
                        $score += 3;
                        break;
                    }
                }
            }
        }

        if ($p["journal"] !== null) {
            $score += 1;
        }

        // Small stable tie-breaker so different articles get different prompts
        $scored[] = [$score, crc32($seed . "-" . $p["id"]), $p];
    }

    usort($scored, fn($a, $b) => [$b[0], $a[1]] <=> [$a[0], $b[1]]);

    // Keyword-specific prompts are used only when the article really matches them
    $picked = [];
    $categories = [];

    foreach ($scored as [$score, , $p]) {
        if (!empty($p["keywords"]) && $score < 3) {
            continue;
        }
        if (isset($categories[$p["category"]])) {
            continue;
        }
        $picked[] = $p;
        $categories[$p["category"]] = true;

        if (count($picked) >= $limit) {
            break;
        }
    }

    return $picked;
}
