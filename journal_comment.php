<?php

// Academic discussions: every action on comments.
//   add (default) — new comment or reply (journal or article discussion)
//   edit / delete — author of the comment (delete also editors)
//   helpful       — mark someone else's comment as helpful (toggle)
//   report        — report a comment to the editors
//   moderate      — editors: pin, unpin, feature, publish, hide, archive
//   prompt        — editors: publish an editorial question

require_once "config.php";

require_login();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    redirect("journals.html");
}

check_csrf();

$user_id = (int)$_SESSION["user_id"];
$action = $_POST["action"] ?? "add";
$comment = trim((string)($_POST["comment"] ?? ""));
$comment_id = (int)($_POST["comment_id"] ?? 0);
$editor = is_editor();

// Back to the page the form was on (only paths on this site)
function back_to_discussion($anchor = "#comments")
{
    $return = (string)($_POST["return"] ?? "");

    if ($return !== "" && $return[0] === "/" && !str_starts_with($return, "//") && !preg_match('/[\r\n\\\\]/', $return)) {
        redirect($return . $anchor);
    }

    redirect_back("journals.html", $anchor);
}

function fail($message, $code = 400)
{
    http_response_code($code);
    die(e($message) . ' <a href="javascript:history.back()">Go back</a>');
}

function load_comment($id)
{
    global $conn;
    $stmt = $conn->prepare("SELECT * FROM journal_comments WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}

if (mb_strlen($comment) > 5000) {
    fail("The comment is too long (maximum 5000 characters).");
}


// ---------- edit / delete ----------

if ($action === "edit" || $action === "delete") {

    $existing = load_comment($comment_id);
    $is_owner = $existing && (int)$existing["user_id"] === $user_id;

    if ($action === "edit" && $is_owner && $existing["kind"] === "comment") {

        if (mb_strlen($comment) < 2) {
            fail("Please write your comment.");
        }

        // An edited comment with a link goes back to review, like a new one
        $status = $existing["status"];
        if (!$editor && preg_match('~https?://|www\.~i', $comment) && in_array($status, ["Published", "Featured"], true)) {
            $status = "Pending Review";
        }

        $stmt = $conn->prepare("UPDATE journal_comments SET comment = ?, status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->bind_param("ssi", $comment, $status, $comment_id);
        $stmt->execute();
        back_to_discussion("#comment-" . $comment_id);
    }

    if ($action === "delete" && ($is_owner || ($existing && $editor))) {
        // Replies go together with the comment they answer
        $stmt = $conn->prepare("DELETE FROM journal_comments WHERE id = ? OR parent_id = ?");
        $stmt->bind_param("ii", $comment_id, $comment_id);
        $stmt->execute();
        back_to_discussion();
    }

    fail("You can change only your own comments.", 403);
}


// ---------- helpful ----------

if ($action === "helpful") {

    $existing = load_comment($comment_id);

    if (!$existing || $existing["kind"] !== "comment" || !in_array($existing["status"], DISCUSSION_PUBLIC_STATUSES, true)) {
        fail("Comment not found.", 404);
    }
    if ((int)$existing["user_id"] === $user_id) {
        fail("You cannot mark your own comment.", 403);
    }

    $stmt = $conn->prepare("DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND reaction = 'helpful'");
    $stmt->bind_param("ii", $comment_id, $user_id);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        $stmt = $conn->prepare("INSERT INTO comment_reactions (comment_id, user_id, reaction) VALUES (?, ?, 'helpful')");
        $stmt->bind_param("ii", $comment_id, $user_id);
        $stmt->execute();
    }

    back_to_discussion("#comment-" . $comment_id);
}


// ---------- report ----------

if ($action === "report") {

    $existing = load_comment($comment_id);
    $reason = (string)($_POST["reason"] ?? "");
    $details = mb_substr(trim((string)($_POST["details"] ?? "")), 0, 500);

    if (!$existing || !isset(REPORT_REASONS[$reason])) {
        fail("Please choose a reason.");
    }
    if ((int)$existing["user_id"] === $user_id) {
        fail("You cannot report your own comment.", 403);
    }

    // One report per reader per comment
    $stmt = $conn->prepare("
        INSERT INTO comment_reports (comment_id, user_id, reason, details) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE reason = VALUES(reason), details = VALUES(details), resolved = 0
    ");
    $stmt->bind_param("iiss", $comment_id, $user_id, $reason, $details);
    $stmt->execute();

    $stmt = $conn->prepare("SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ? AND resolved = 0");
    $stmt->bind_param("i", $comment_id);
    $stmt->execute();
    $reports = (int)$stmt->get_result()->fetch_assoc()["n"];

    // Reported: stays visible and goes to the editors' queue.
    // Several independent reports hide it until an editor decides.
    if (in_array($existing["status"], ["Published", "Featured", "Reported"], true)) {
        $status = $reports >= DISCUSSION_REPORTS_TO_HIDE ? "Hidden" : "Reported";
        $stmt = $conn->prepare("UPDATE journal_comments SET status = ? WHERE id = ?");
        $stmt->bind_param("si", $status, $comment_id);
        $stmt->execute();
    }

    back_to_discussion("#comment-" . $comment_id);
}


// ---------- moderation (editors) ----------

if ($action === "moderate") {

    if (!$editor) {
        fail("Only editors can moderate discussions.", 403);
    }

    $existing = load_comment($comment_id);
    if (!$existing) {
        fail("Comment not found.", 404);
    }

    $do = (string)($_POST["do"] ?? "");
    $statuses = ["publish" => "Published", "feature" => "Featured", "hide" => "Hidden", "archive" => "Archived", "review" => "Pending Review"];

    if ($do === "pin" || $do === "unpin") {
        $pinned = $do === "pin" ? 1 : 0;
        $stmt = $conn->prepare("UPDATE journal_comments SET is_pinned = ? WHERE id = ?");
        $stmt->bind_param("ii", $pinned, $comment_id);
        $stmt->execute();
    } elseif (isset($statuses[$do])) {
        $stmt = $conn->prepare("UPDATE journal_comments SET status = ? WHERE id = ?");
        $stmt->bind_param("si", $statuses[$do], $comment_id);
        $stmt->execute();

        // The editor has decided: the reports are closed
        $stmt = $conn->prepare("UPDATE comment_reports SET resolved = 1 WHERE comment_id = ?");
        $stmt->bind_param("i", $comment_id);
        $stmt->execute();
    } else {
        fail("Unknown action.");
    }

    back_to_discussion("#comment-" . $comment_id);
}


// ---------- new comment, reply or editorial question ----------

$journal = trim((string)($_POST["journal"] ?? ""));
$submission_id = (int)($_POST["submission_id"] ?? 0);
$parent_id = (int)($_POST["parent_id"] ?? 0);
$topic = (string)($_POST["topic"] ?? "general");
$kind = $action === "prompt" ? "prompt" : "comment";
$parent = null;

if ($kind === "prompt" && !$editor) {
    fail("Only editors can publish editorial questions.", 403);
}

if (!isset(DISCUSSION_TOPICS[$topic])) {
    $topic = "general";
}

if (mb_strlen($comment) < 2) {
    fail("Please write your comment.");
}

if ($parent_id > 0) {

    // Replies hang under the first comment of the conversation, in the same discussion
    $parent = load_comment($parent_id);

    if ($parent && $parent["parent_id"]) {
        $parent = load_comment((int)$parent["parent_id"]);
    }

    if (!$parent || !in_array($parent["status"], DISCUSSION_PUBLIC_STATUSES, true)) {
        fail("The comment you are replying to is no longer available.", 404);
    }

    $parent_id = (int)$parent["id"];
    $journal = $parent["journal"];
    $submission_id = (int)$parent["submission_id"];
    $kind = "comment";
    $topic = $parent["kind"] === "comment" ? $parent["topic"] : $topic;
}

$article = null;

if ($submission_id > 0) {

    // Only public, published articles have a discussion
    $stmt = $conn->prepare("SELECT id, user_id, journal, title FROM submissions WHERE id = ? AND status = 'Published' AND visibility = 'public'");
    $stmt->bind_param("i", $submission_id);
    $stmt->execute();
    $article = $stmt->get_result()->fetch_assoc();

    if (!$article) {
        fail("This article is not open for discussion.", 404);
    }

    $journal = (string)$article["journal"];

} elseif (!in_array($journal, $settings["journals"], true)) {
    fail("Unknown journal.");
}

$submission_value = $submission_id ?: null;

if ($kind === "comment") {

    // Not too many comments in a short time
    $stmt = $conn->prepare("SELECT COUNT(*) AS n FROM journal_comments WHERE user_id = ? AND created_at > NOW() - INTERVAL 10 MINUTE");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();

    if ((int)$stmt->get_result()->fetch_assoc()["n"] >= 8) {
        fail("You are posting very quickly. Please wait a few minutes and try again.", 429);
    }

    // The same text twice in the same discussion
    $stmt = $conn->prepare("
        SELECT comment FROM journal_comments
        WHERE user_id = ? AND journal = ? AND submission_id <=> ? AND created_at > NOW() - INTERVAL 30 DAY
    ");
    $stmt->bind_param("isi", $user_id, $journal, $submission_value);
    $stmt->execute();

    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $old) {
        if (normalize_comment_text($old["comment"]) === normalize_comment_text($comment)) {
            fail("You have already posted this comment here.", 409);
        }
    }
}

// Links are a common sign of advertising: such comments are checked by the editors first
$status = ($kind === "comment" && !$editor && preg_match('~https?://|www\.~i', $comment)) ? "Pending Review" : "Published";
$pinned = ($kind === "prompt" && !empty($_POST["pin"])) ? 1 : 0;
$parent_value = $parent_id ?: null;

$stmt = $conn->prepare("
    INSERT INTO journal_comments (journal, submission_id, user_id, parent_id, kind, topic, comment, status, is_pinned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("siiissssi", $journal, $submission_value, $user_id, $parent_value, $kind, $topic, $comment, $status, $pinned);
$stmt->execute();
$new_id = (int)$conn->insert_id;

// Notifications (they never say who wrote the comment)
if ($status === "Published" && $kind === "comment") {

    $anchor = "#comment-" . ($parent_value ?: $new_id);
    $page = array_search($journal, $settings["journals"], true);
    $link = $article ? "article.php?id=" . (int)$article["id"] . $anchor : ($page ? $page . $anchor : "journals.html");
    $where = $article ? " on \"" . mb_substr($article["title"], 0, 80) . "\"" : " in " . $journal;

    if ($parent && $parent["kind"] === "comment" && (int)$parent["user_id"] !== $user_id) {
        notify_user((int)$parent["user_id"], "Someone replied to your comment" . $where . ".", $link, $new_id, $submission_value);
    }

    if ($article && (int)$article["user_id"] !== $user_id && (!$parent || (int)$parent["user_id"] !== (int)$article["user_id"])) {
        notify_user((int)$article["user_id"], "A reader " . ($parent ? "replied in the discussion of" : "commented on") . " your article \"" . mb_substr($article["title"], 0, 80) . "\".",
            $link, $new_id, (int)$article["id"]);
    }
}

back_to_discussion("#comment-" . ($parent_value ?: $new_id));
