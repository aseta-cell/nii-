<?php

// Editors: academic discussions — overview, moderation queue, all comments,
// editorial prompt library and reader feedback.
// Reader names are never shown here either; editors see a pseudonymous participant code.

require_once "config.php";

require_role("editor");

$tab = $_GET["tab"] ?? "overview";
$tabs = [
    "overview" => "Overview",
    "queue"    => "Moderation queue",
    "all"      => "All comments",
    "prompts"  => "Editorial prompts",
    "feedback" => "Reader feedback",
];
if (!isset($tabs[$tab])) {
    $tab = "overview";
}

// ---------- actions on prompts and feedback ----------

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    check_csrf();

    $act = $_POST["act"] ?? "";
    $id = (int)($_POST["id"] ?? 0);

    if ($act === "prompt_add" || $act === "prompt_save") {
        $category = (string)($_POST["category"] ?? "");
        $text = trim((string)($_POST["text"] ?? ""));
        $journal = trim((string)($_POST["journal"] ?? ""));
        $keywords = mb_substr(trim((string)($_POST["keywords"] ?? "")), 0, 255);
        $journal = in_array($journal, $settings["journals"], true) ? $journal : null;
        $keywords = $keywords !== "" ? $keywords : null;

        if (isset(PROMPT_CATEGORIES[$category]) && mb_strlen($text) >= 10) {
            if ($act === "prompt_add") {
                $stmt = $conn->prepare("INSERT INTO discussion_prompts (category, journal, keywords, text) VALUES (?, ?, ?, ?)");
                $stmt->bind_param("ssss", $category, $journal, $keywords, $text);
            } else {
                $stmt = $conn->prepare("UPDATE discussion_prompts SET category = ?, journal = ?, keywords = ?, text = ? WHERE id = ?");
                $stmt->bind_param("ssssi", $category, $journal, $keywords, $text, $id);
            }
            $stmt->execute();
        }
    }

    if ($act === "prompt_toggle") {
        $stmt = $conn->prepare("UPDATE discussion_prompts SET is_active = 1 - is_active WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
    }

    if ($act === "feedback_status") {
        $status = ($_POST["status"] ?? "") === "Reviewed" ? "Reviewed" : "New";
        $stmt = $conn->prepare("UPDATE reader_feedback SET status = ? WHERE id = ?");
        $stmt->bind_param("si", $status, $id);
        $stmt->execute();
    }

    redirect("discussions-admin.php?tab=" . urlencode($tab) . "#" . ($act === "prompt_add" ? "prompts" : "item-" . $id));
}

$return = "/discussions-admin.php?tab=" . $tab;
$journal_pages = array_flip($settings["journals"]); // name => page

// Where a comment lives
function discussion_link($c)
{
    global $journal_pages;
    if (!empty($c["submission_id"])) {
        return "article.php?id=" . (int)$c["submission_id"] . "#comment-" . (int)$c["id"];
    }
    $page = $journal_pages[$c["journal"]] ?? "journals.html";
    return $page . "#comment-" . (int)$c["id"];
}

// Comments whose text appears more than once (possible duplicates or spam)
$duplicates = [];
foreach ($conn->query("
    SELECT LOWER(TRIM(comment)) AS t, COUNT(*) AS n
    FROM journal_comments WHERE kind = 'comment'
    GROUP BY LOWER(TRIM(comment)) HAVING COUNT(*) > 1
")->fetch_all(MYSQLI_ASSOC) as $d) {
    $duplicates[$d["t"]] = (int)$d["n"];
}

function comment_rows($where, $types = "", $params = [], $limit = 200)
{
    global $conn;
    $sql = "
        SELECT c.*, s.title AS article_title,
            (SELECT COUNT(*) FROM comment_reports p WHERE p.comment_id = c.id AND p.resolved = 0) AS open_reports,
            (SELECT GROUP_CONCAT(DISTINCT p.reason) FROM comment_reports p WHERE p.comment_id = c.id AND p.resolved = 0) AS report_reasons,
            (SELECT COUNT(*) FROM comment_reactions r WHERE r.comment_id = c.id AND r.reaction = 'helpful') AS helpful,
            (SELECT COUNT(*) FROM journal_comments x WHERE x.parent_id = c.id) AS replies
        FROM journal_comments c
        LEFT JOIN submissions s ON s.id = c.submission_id
        WHERE $where
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT " . (int)$limit;
    $stmt = $conn->prepare($sql);
    if ($types !== "") {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

$counts = [];
foreach ($conn->query("SELECT status, COUNT(*) AS n FROM journal_comments WHERE kind = 'comment' GROUP BY status")->fetch_all(MYSQLI_ASSOC) as $r) {
    $counts[$r["status"]] = (int)$r["n"];
}
$queue_count = ($counts["Pending Review"] ?? 0) + ($counts["Reported"] ?? 0)
    + (int)$conn->query("SELECT COUNT(DISTINCT c.id) AS n FROM journal_comments c JOIN comment_reports p ON p.comment_id = c.id AND p.resolved = 0 WHERE c.status = 'Hidden'")->fetch_assoc()["n"];
$new_feedback = (int)$conn->query("SELECT COUNT(*) AS n FROM reader_feedback WHERE status = 'New'")->fetch_assoc()["n"];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Academic Discussions | Editorial | <?= e($site_name) ?></title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-800">

<div class="max-w-6xl mx-auto py-10 px-4 md:px-6">

    <a href="editor-dashboard.php" class="text-blue-700 hover:underline">← Editorial dashboard</a>

    <h1 class="text-3xl font-bold mt-4 mb-2">Academic Discussions</h1>
    <p class="text-slate-600 mb-6">Comments are anonymous. Participant codes (P-XXXXX) let you recognise repeated activity without seeing names.</p>

    <nav class="flex flex-wrap gap-2 mb-8">
        <?php foreach ($tabs as $key => $label): ?>
            <a href="?tab=<?= e($key) ?>" class="px-4 py-2 rounded-lg border <?= $tab === $key ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50" ?>">
                <?= e($label) ?>
                <?php if ($key === "queue" && $queue_count): ?> (<?= $queue_count ?>)<?php endif; ?>
                <?php if ($key === "feedback" && $new_feedback): ?> (<?= $new_feedback ?> new)<?php endif; ?>
            </a>
        <?php endforeach; ?>
    </nav>

<?php
// ---------- one comment row (queue and all comments) ----------
$render_row = function ($c) use ($return, $duplicates) {
    $dup = $duplicates[mb_strtolower(trim($c["comment"]))] ?? 0;
    ?>
    <div class="bg-white rounded-xl border p-5" id="comment-<?= (int)$c["id"] ?>">
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span class="font-mono"><?= $c["kind"] === "prompt" ? "Editorial question" : e(comment_code($c["id"])) ?></span>
            <span class="font-semibold text-slate-700"><?= e($c["status"]) ?></span>
            <?php if ($c["kind"] === "comment"): ?><span><?= e(participant_code($c["user_id"])) ?></span><?php endif; ?>
            <span><?= e(DISCUSSION_TOPICS[$c["topic"]] ?? "") ?></span>
            <span><?= e(date("d.m.Y H:i", strtotime($c["created_at"]))) ?></span>
            <?php if ($c["is_pinned"]): ?><span>Pinned</span><?php endif; ?>
            <?php if ($c["parent_id"]): ?><span>Reply</span><?php endif; ?>
            <?php if ($c["helpful"]): ?><span>Helpful · <?= (int)$c["helpful"] ?></span><?php endif; ?>
            <?php if ($c["replies"]): ?><span><?= (int)$c["replies"] ?> replies</span><?php endif; ?>
        </div>
        <p class="text-sm mt-1">
            <a href="<?= e(discussion_link($c)) ?>" target="_blank" class="text-blue-700 hover:underline">
                <?= $c["article_title"] ? "Article: " . e(mb_substr($c["article_title"], 0, 90)) : e($c["journal"]) ?>
            </a>
        </p>
        <?php if ($c["open_reports"]): ?>
            <p class="mt-2 text-sm text-red-800">Reported by <?= (int)$c["open_reports"] ?> reader(s):
                <?= e(implode(", ", array_map(fn($r) => REPORT_REASONS[$r] ?? $r, explode(",", (string)$c["report_reasons"])))) ?></p>
        <?php endif; ?>
        <?php if ($dup > 1): ?>
            <p class="mt-2 text-sm text-amber-800">The same text appears <?= $dup ?> times — possible duplicate.</p>
        <?php endif; ?>
        <p class="mt-3 whitespace-pre-line"><?= e($c["comment"]) ?></p>
        <form action="journal_comment.php" method="POST" class="mt-3 flex flex-wrap gap-2 text-sm">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="moderate">
            <input type="hidden" name="comment_id" value="<?= (int)$c["id"] ?>">
            <input type="hidden" name="return" value="<?= e($return) ?>">
            <button name="do" value="publish" class="px-3 py-1 rounded border">Publish</button>
            <?php if ($c["kind"] === "comment"): ?><button name="do" value="feature" class="px-3 py-1 rounded border">Select as valuable</button><?php endif; ?>
            <?php if (!$c["parent_id"]): ?><button name="do" value="<?= $c["is_pinned"] ? "unpin" : "pin" ?>" class="px-3 py-1 rounded border"><?= $c["is_pinned"] ? "Unpin" : "Pin" ?></button><?php endif; ?>
            <button name="do" value="hide" class="px-3 py-1 rounded border">Hide</button>
            <button name="do" value="archive" class="px-3 py-1 rounded border">Archive</button>
        </form>
        <form action="journal_comment.php" method="POST" class="mt-2 text-sm" onsubmit="return confirm('Delete permanently, with its replies?')">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="comment_id" value="<?= (int)$c["id"] ?>">
            <input type="hidden" name="return" value="<?= e($return) ?>">
            <button class="text-red-800 hover:underline">Delete permanently</button>
        </form>
    </div>
    <?php
};
?>

<?php if ($tab === "overview"): ?>

    <?php
    $one = fn($sql) => (int)$conn->query($sql)->fetch_assoc()["n"];

    $reader_comments = $one("SELECT COUNT(*) AS n FROM journal_comments WHERE kind = 'comment' AND status IN ('Published','Featured','Reported')");
    $editorial_prompts = $one("SELECT COUNT(*) AS n FROM journal_comments WHERE kind = 'prompt'");
    $active = $one("SELECT COUNT(DISTINCT COALESCE(parent_id, id)) AS n FROM journal_comments WHERE created_at > NOW() - INTERVAL 30 DAY");
    $author_responses = $one("SELECT COUNT(*) AS n FROM journal_comments c JOIN submissions s ON s.id = c.submission_id WHERE c.kind = 'comment' AND c.user_id = s.user_id");
    $feedback_total = $one("SELECT COUNT(*) AS n FROM reader_feedback");
    $open_reports = $one("SELECT COUNT(DISTINCT comment_id) AS n FROM comment_reports WHERE resolved = 0");
    $unanswered = comment_rows(
        "c.kind = 'comment' AND c.parent_id IS NULL AND c.status IN ('Published','Featured','Reported')
         AND (c.topic = 'question' OR c.comment LIKE '%?%')
         AND NOT EXISTS (SELECT 1 FROM journal_comments x WHERE x.parent_id = c.id)", "", [], 20);

    $by_topic = $conn->query("SELECT topic, COUNT(*) AS n FROM journal_comments WHERE kind = 'comment' GROUP BY topic ORDER BY n DESC")->fetch_all(MYSQLI_ASSOC);
    $by_journal = $conn->query("SELECT journal, COUNT(*) AS n FROM journal_comments WHERE kind = 'comment' GROUP BY journal ORDER BY n DESC")->fetch_all(MYSQLI_ASSOC);
    $by_article = $conn->query("SELECT s.id, s.title, COUNT(*) AS n FROM journal_comments c JOIN submissions s ON s.id = c.submission_id WHERE c.kind = 'comment' GROUP BY s.id, s.title ORDER BY n DESC LIMIT 10")->fetch_all(MYSQLI_ASSOC);
    $suggest_categories = $conn->query("SELECT category, COUNT(*) AS n FROM reader_feedback WHERE kind = 'suggestion' GROUP BY category ORDER BY n DESC")->fetch_all(MYSQLI_ASSOC);

    // Reader comments per week, last 12 weeks
    $weeks = [];
    for ($i = 11; $i >= 0; $i--) {
        $weeks[date("o-W", strtotime("-$i week"))] = 0;
    }
    foreach ($conn->query("SELECT DATE_FORMAT(created_at, '%x-%v') AS w, COUNT(*) AS n FROM journal_comments WHERE kind = 'comment' AND created_at > NOW() - INTERVAL 12 WEEK GROUP BY w")->fetch_all(MYSQLI_ASSOC) as $r) {
        if (isset($weeks[$r["w"]])) {
            $weeks[$r["w"]] = (int)$r["n"];
        }
    }
    $max_week = max(1, max($weeks));

    // Recurring words in reader feedback and suggestions
    $stop = array_flip(explode(" ", "the and for with that this from are was were have has had would could should about into their there which what when where will more most also such than then them they these those your you our can may not but any all how why who its it's research study studies article journal topic topics paper would like very much some other been being use using used need needs just only into over under"));
    $freq = [];
    foreach ($conn->query("SELECT CONCAT_WS(' ', further_research, related_questions, applications, future_topics, message) AS t FROM reader_feedback")->fetch_all(MYSQLI_ASSOC) as $r) {
        foreach (text_words($r["t"]) as $w) {
            if (mb_strlen($w) >= 4 && !isset($stop[$w])) {
                $freq[$w] = ($freq[$w] ?? 0) + 1;
            }
        }
    }
    arsort($freq);
    $freq = array_slice($freq, 0, 20, true);
    ?>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <?php foreach ([
            ["Reader comments", $reader_comments, "Genuine, visible comments by registered users"],
            ["Active discussions", $active, "Threads with activity in the last 30 days"],
            ["Author responses", $author_responses, "Comments by an article's own author in its discussion"],
            ["Reader feedback", $feedback_total, "Private perspectives and suggestions"],
            ["Awaiting review", $counts["Pending Review"] ?? 0, "Comments not yet published"],
            ["Reported content", $open_reports, "Comments with open reports"],
            ["Unanswered questions", count($unanswered), "Reader questions without a reply"],
            ["Editorial questions", $editorial_prompts, "Posted by editors — not counted as reader activity"],
        ] as [$label, $value, $hint]): ?>
            <div class="bg-white rounded-xl border p-5">
                <div class="text-3xl font-bold"><?= (int)$value ?></div>
                <div class="font-semibold mt-1"><?= e($label) ?></div>
                <div class="text-xs text-slate-500 mt-1"><?= e($hint) ?></div>
            </div>
        <?php endforeach; ?>
    </div>

    <div class="grid md:grid-cols-2 gap-6">

        <section class="bg-white rounded-xl border p-6">
            <h2 class="text-xl font-bold mb-4">Reader comments per week</h2>
            <div class="flex items-end gap-1 h-40">
                <?php foreach ($weeks as $w => $n): ?>
                    <div class="flex-1 flex flex-col items-center justify-end h-full" title="Week <?= e($w) ?>: <?= $n ?>">
                        <span class="text-xs text-slate-500"><?= $n ?: "" ?></span>
                        <div class="w-full bg-slate-700 rounded-t" style="height: <?= round($n / $max_week * 100) ?>%; min-height: <?= $n ? 3 : 1 ?>px"></div>
                    </div>
                <?php endforeach; ?>
            </div>
            <p class="text-xs text-slate-500 mt-2">Last 12 weeks, reader comments only.</p>
        </section>

        <section class="bg-white rounded-xl border p-6">
            <h2 class="text-xl font-bold mb-4">Most discussed subjects</h2>
            <?php if (!$by_topic): ?><p class="text-slate-500">No comments yet.</p><?php endif; ?>
            <?php foreach ($by_topic as $r): ?>
                <div class="flex justify-between py-1 border-b"><span><?= e(DISCUSSION_TOPICS[$r["topic"]] ?? $r["topic"]) ?></span><span class="font-semibold"><?= (int)$r["n"] ?></span></div>
            <?php endforeach; ?>
        </section>

        <section class="bg-white rounded-xl border p-6">
            <h2 class="text-xl font-bold mb-4">By journal</h2>
            <?php foreach ($by_journal as $r): ?>
                <div class="flex justify-between py-1 border-b"><span><?= e($r["journal"]) ?></span><span class="font-semibold"><?= (int)$r["n"] ?></span></div>
            <?php endforeach; ?>
            <?php if ($by_article): ?>
                <h3 class="font-semibold mt-5 mb-2">Most discussed articles</h3>
                <?php foreach ($by_article as $r): ?>
                    <div class="flex justify-between py-1 border-b"><a class="text-blue-700 hover:underline" href="article.php?id=<?= (int)$r["id"] ?>#comments"><?= e(mb_substr($r["title"], 0, 70)) ?></a><span class="font-semibold"><?= (int)$r["n"] ?></span></div>
                <?php endforeach; ?>
            <?php endif; ?>
        </section>

        <section class="bg-white rounded-xl border p-6">
            <h2 class="text-xl font-bold mb-4">What readers suggest</h2>
            <?php if (!$suggest_categories && !$freq): ?><p class="text-slate-500">No feedback yet.</p><?php endif; ?>
            <?php foreach ($suggest_categories as $r): ?>
                <div class="flex justify-between py-1 border-b"><span><?= e(SUGGESTION_CATEGORIES[$r["category"]] ?? $r["category"]) ?></span><span class="font-semibold"><?= (int)$r["n"] ?></span></div>
            <?php endforeach; ?>
            <?php if ($freq): ?>
                <h3 class="font-semibold mt-5 mb-2">Recurring words in feedback</h3>
                <div class="flex flex-wrap gap-2">
                    <?php foreach ($freq as $w => $n): ?><span class="px-2 py-1 rounded bg-slate-100 text-sm"><?= e($w) ?> · <?= (int)$n ?></span><?php endforeach; ?>
                </div>
            <?php endif; ?>
        </section>

    </div>

    <section class="mt-6">
        <h2 class="text-xl font-bold mb-4">Unanswered reader questions</h2>
        <?php if (!$unanswered): ?><p class="text-slate-500">None — every question has a reply.</p><?php endif; ?>
        <div class="space-y-3">
            <?php foreach ($unanswered as $c): ?>
                <a href="<?= e(discussion_link($c)) ?>" class="block bg-white rounded-xl border p-4 hover:bg-slate-50">
                    <span class="text-sm text-slate-500"><?= e(comment_code($c["id"])) ?> · <?= $c["article_title"] ? e(mb_substr($c["article_title"], 0, 70)) : e($c["journal"]) ?></span>
                    <span class="block mt-1"><?= e(mb_substr($c["comment"], 0, 220)) ?></span>
                </a>
            <?php endforeach; ?>
        </div>
    </section>

<?php elseif ($tab === "queue"): ?>

    <?php
    $rows = comment_rows("c.status IN ('Pending Review','Reported') OR (c.status = 'Hidden' AND EXISTS (SELECT 1 FROM comment_reports p WHERE p.comment_id = c.id AND p.resolved = 0))");
    ?>
    <p class="text-slate-600 mb-4">Comments with links wait here before publication; reported comments stay visible until you decide (three independent reports hide them automatically).</p>
    <?php if (!$rows): ?><p class="bg-white rounded-xl border p-6 text-slate-500">The queue is empty.</p><?php endif; ?>
    <div class="space-y-4"><?php foreach ($rows as $c) { $render_row($c); } ?></div>

<?php elseif ($tab === "all"): ?>

    <?php
    $f_status = $_GET["status"] ?? "";
    $f_journal = $_GET["journal"] ?? "";
    $f_topic = $_GET["topic"] ?? "";
    $where = "1=1";
    $types = "";
    $params = [];
    if (in_array($f_status, DISCUSSION_STATUSES, true)) { $where .= " AND c.status = ?"; $types .= "s"; $params[] = $f_status; }
    if (in_array($f_journal, $settings["journals"], true)) { $where .= " AND c.journal = ?"; $types .= "s"; $params[] = $f_journal; }
    if (isset(DISCUSSION_TOPICS[$f_topic])) { $where .= " AND c.topic = ?"; $types .= "s"; $params[] = $f_topic; }
    $rows = comment_rows($where, $types, $params);
    ?>
    <form class="flex flex-wrap gap-2 mb-6">
        <input type="hidden" name="tab" value="all">
        <select name="status" class="border rounded-lg px-3 py-2"><option value="">All statuses</option>
            <?php foreach (DISCUSSION_STATUSES as $s): ?><option <?= $f_status === $s ? "selected" : "" ?>><?= e($s) ?></option><?php endforeach; ?></select>
        <select name="journal" class="border rounded-lg px-3 py-2"><option value="">All journals</option>
            <?php foreach ($settings["journals"] as $j): ?><option <?= $f_journal === $j ? "selected" : "" ?>><?= e($j) ?></option><?php endforeach; ?></select>
        <select name="topic" class="border rounded-lg px-3 py-2"><option value="">All subjects</option>
            <?php foreach (DISCUSSION_TOPICS as $k => $l): ?><option value="<?= e($k) ?>" <?= $f_topic === $k ? "selected" : "" ?>><?= e($l) ?></option><?php endforeach; ?></select>
        <button class="bg-slate-900 text-white px-4 py-2 rounded-lg">Filter</button>
    </form>
    <?php if (!$rows): ?><p class="bg-white rounded-xl border p-6 text-slate-500">No comments.</p><?php endif; ?>
    <div class="space-y-4"><?php foreach ($rows as $c) { $render_row($c); } ?></div>

<?php elseif ($tab === "prompts"): ?>

    <?php
    $f_cat = $_GET["category"] ?? "";
    $sql = "SELECT * FROM discussion_prompts" . (isset(PROMPT_CATEGORIES[$f_cat]) ? " WHERE category = ?" : "") . " ORDER BY category, journal IS NOT NULL, id";
    $stmt = $conn->prepare($sql);
    if (isset(PROMPT_CATEGORIES[$f_cat])) { $stmt->bind_param("s", $f_cat); }
    $stmt->execute();
    $prompts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $total_prompts = (int)$conn->query("SELECT COUNT(*) AS n FROM discussion_prompts")->fetch_assoc()["n"];
    ?>
    <p class="text-slate-600 mb-4">
        <?= $total_prompts ?> editorial questions. They are shown above discussions as questions from the Academia Institute editorial office —
        never as reader comments. Questions with keywords appear only on articles whose title, keywords or abstract match.
    </p>

    <details class="bg-white rounded-xl border p-5 mb-6" id="prompts">
        <summary class="cursor-pointer font-semibold">Add an editorial question</summary>
        <form method="POST" class="mt-4 grid md:grid-cols-2 gap-3">
            <?= csrf_field() ?>
            <input type="hidden" name="act" value="prompt_add">
            <select name="category" required class="border rounded-lg px-3 py-2">
                <?php foreach (PROMPT_CATEGORIES as $k => $l): ?><option value="<?= e($k) ?>"><?= e($l) ?></option><?php endforeach; ?></select>
            <select name="journal" class="border rounded-lg px-3 py-2"><option value="">All journals</option>
                <?php foreach ($settings["journals"] as $j): ?><option><?= e($j) ?></option><?php endforeach; ?></select>
            <input name="keywords" maxlength="255" placeholder="Keywords, comma separated (optional)" class="border rounded-lg px-3 py-2 md:col-span-2">
            <textarea name="text" required minlength="10" rows="2" placeholder="Question text" class="border rounded-lg px-3 py-2 md:col-span-2"></textarea>
            <button class="bg-slate-900 text-white px-4 py-2 rounded-lg md:col-span-2 justify-self-start">Add</button>
        </form>
    </details>

    <div class="flex flex-wrap gap-2 mb-4 text-sm">
        <a href="?tab=prompts" class="px-3 py-1 rounded border <?= $f_cat === "" ? "bg-slate-900 text-white" : "bg-white" ?>">All</a>
        <?php foreach (PROMPT_CATEGORIES as $k => $l): ?>
            <a href="?tab=prompts&category=<?= e($k) ?>" class="px-3 py-1 rounded border <?= $f_cat === $k ? "bg-slate-900 text-white" : "bg-white" ?>"><?= e($l) ?></a>
        <?php endforeach; ?>
    </div>

    <div class="space-y-3">
        <?php foreach ($prompts as $p): ?>
            <div class="bg-white rounded-xl border p-4 <?= $p["is_active"] ? "" : "opacity-60" ?>" id="item-<?= (int)$p["id"] ?>">
                <div class="text-xs text-slate-500 mb-1">
                    <?= e(PROMPT_CATEGORIES[$p["category"]] ?? $p["category"]) ?>
                    <?= $p["journal"] ? " · " . e($p["journal"]) : "" ?>
                    <?= $p["keywords"] ? " · keywords: " . e($p["keywords"]) : "" ?>
                    <?= $p["is_active"] ? "" : " · switched off" ?>
                </div>
                <details>
                    <summary class="cursor-pointer"><?= e($p["text"]) ?></summary>
                    <form method="POST" class="mt-3 grid md:grid-cols-2 gap-2">
                        <?= csrf_field() ?>
                        <input type="hidden" name="act" value="prompt_save">
                        <input type="hidden" name="id" value="<?= (int)$p["id"] ?>">
                        <select name="category" class="border rounded-lg px-3 py-2">
                            <?php foreach (PROMPT_CATEGORIES as $k => $l): ?><option value="<?= e($k) ?>" <?= $p["category"] === $k ? "selected" : "" ?>><?= e($l) ?></option><?php endforeach; ?></select>
                        <select name="journal" class="border rounded-lg px-3 py-2"><option value="">All journals</option>
                            <?php foreach ($settings["journals"] as $j): ?><option <?= $p["journal"] === $j ? "selected" : "" ?>><?= e($j) ?></option><?php endforeach; ?></select>
                        <input name="keywords" value="<?= e($p["keywords"]) ?>" maxlength="255" placeholder="Keywords (optional)" class="border rounded-lg px-3 py-2 md:col-span-2">
                        <textarea name="text" required minlength="10" rows="2" class="border rounded-lg px-3 py-2 md:col-span-2"><?= e($p["text"]) ?></textarea>
                        <button class="bg-slate-900 text-white px-4 py-2 rounded-lg justify-self-start">Save</button>
                    </form>
                </details>
                <form method="POST" class="mt-2">
                    <?= csrf_field() ?>
                    <input type="hidden" name="act" value="prompt_toggle">
                    <input type="hidden" name="id" value="<?= (int)$p["id"] ?>">
                    <button class="text-sm text-slate-600 hover:underline"><?= $p["is_active"] ? "Switch off" : "Switch on" ?></button>
                </form>
            </div>
        <?php endforeach; ?>
    </div>

<?php elseif ($tab === "feedback"): ?>

    <?php
    $f_kind = $_GET["kind"] ?? "";
    $sql = "
        SELECT f.*, s.title AS article_title, u.fullname, u.email
        FROM reader_feedback f
        LEFT JOIN submissions s ON s.id = f.submission_id
        LEFT JOIN users u ON u.id = f.user_id
        " . (in_array($f_kind, ["article", "suggestion"], true) ? "WHERE f.kind = ?" : "") . "
        ORDER BY f.status = 'New' DESC, f.created_at DESC
        LIMIT 300";
    $stmt = $conn->prepare($sql);
    if (in_array($f_kind, ["article", "suggestion"], true)) { $stmt->bind_param("s", $f_kind); }
    $stmt->execute();
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $collab = (int)$conn->query("SELECT COUNT(*) AS n FROM reader_feedback WHERE wants_collaboration = 1")->fetch_assoc()["n"];
    ?>
    <p class="text-slate-600 mb-4">Private feedback. Names and emails are shown only when the reader agreed to be contacted. <?= $collab ?> reader(s) expressed interest in collaboration.</p>
    <div class="flex gap-2 mb-6 text-sm">
        <?php foreach (["" => "All", "article" => "Perspectives on articles", "suggestion" => "Suggestions for the journal"] as $k => $l): ?>
            <a href="?tab=feedback&kind=<?= e($k) ?>" class="px-3 py-1 rounded border <?= $f_kind === $k ? "bg-slate-900 text-white" : "bg-white" ?>"><?= e($l) ?></a>
        <?php endforeach; ?>
    </div>
    <?php if (!$items): ?><p class="bg-white rounded-xl border p-6 text-slate-500">No feedback yet.</p><?php endif; ?>
    <div class="space-y-4">
        <?php foreach ($items as $f): ?>
            <div class="bg-white rounded-xl border p-5" id="item-<?= (int)$f["id"] ?>">
                <div class="flex flex-wrap gap-x-4 text-sm text-slate-500">
                    <span class="font-semibold text-slate-700"><?= e($f["status"]) ?></span>
                    <span><?= $f["kind"] === "article" ? "Perspective on an article" : e(SUGGESTION_CATEGORIES[$f["category"]] ?? "Suggestion") ?></span>
                    <span><?= e(date("d.m.Y", strtotime($f["created_at"]))) ?></span>
                    <?php if ($f["journal"]): ?><span><?= e($f["journal"]) ?></span><?php endif; ?>
                    <?php if ($f["wants_collaboration"]): ?><span class="text-blue-800 font-semibold">Interested in collaboration</span><?php endif; ?>
                </div>
                <?php if ($f["article_title"]): ?>
                    <a href="article.php?id=<?= (int)$f["submission_id"] ?>" class="text-blue-700 hover:underline text-sm"><?= e($f["article_title"]) ?></a>
                <?php endif; ?>
                <dl class="mt-3 space-y-2">
                    <?php foreach ([
                        "further_research" => "Further investigation",
                        "related_questions" => "Related research questions",
                        "applications" => "Potential applications",
                        "future_topics" => "Topics for future publications",
                        "message" => $f["kind"] === "article" ? "Other feedback" : "Suggestion",
                    ] as $key => $label): if (trim((string)$f[$key]) === "") continue; ?>
                        <div><dt class="text-xs text-slate-500"><?= e($label) ?></dt><dd class="whitespace-pre-line"><?= e($f[$key]) ?></dd></div>
                    <?php endforeach; ?>
                </dl>
                <p class="text-sm mt-3 text-slate-600">
                    <?php if ($f["share_contact"] && $f["email"]): ?>
                        Contact: <?= e($f["fullname"]) ?> · <a class="text-blue-700" href="mailto:<?= e($f["email"]) ?>"><?= e($f["email"]) ?></a>
                    <?php else: ?>
                        Anonymous (<?= $f["user_id"] ? e(participant_code($f["user_id"])) : "account deleted" ?>)
                    <?php endif; ?>
                </p>
                <form method="POST" class="mt-3">
                    <?= csrf_field() ?>
                    <input type="hidden" name="act" value="feedback_status">
                    <input type="hidden" name="id" value="<?= (int)$f["id"] ?>">
                    <input type="hidden" name="status" value="<?= $f["status"] === "New" ? "Reviewed" : "New" ?>">
                    <button class="px-3 py-1 rounded border text-sm"><?= $f["status"] === "New" ? "Mark as reviewed" : "Mark as new" ?></button>
                </form>
            </div>
        <?php endforeach; ?>
    </div>

<?php endif; ?>

</div>

</body>
</html>
