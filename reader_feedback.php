<?php

// Private reader feedback: perspectives on an article and suggestions for the journal.
// Stored in reader_feedback and seen only by editors (Discussions page).

require_once "config.php";

require_login();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    redirect("suggest.php");
}

check_csrf();

$user_id = (int)$_SESSION["user_id"];
$kind = ($_POST["kind"] ?? "") === "article" ? "article" : "suggestion";

$field = fn($name) => mb_substr(trim((string)($_POST[$name] ?? "")), 0, 3000);

$further = $field("further_research");
$related = $field("related_questions");
$applications = $field("applications");
$future = $field("future_topics");
$message = $field("message");
$wants_collaboration = !empty($_POST["wants_collaboration"]) ? 1 : 0;
$share_contact = !empty($_POST["share_contact"]) ? 1 : 0;
$submission_id = null;
$journal = null;
$category = null;

if ($kind === "article") {

    $id = (int)($_POST["submission_id"] ?? 0);
    $stmt = $conn->prepare("SELECT id, journal FROM submissions WHERE id = ? AND status = 'Published' AND visibility = 'public'");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $article = $stmt->get_result()->fetch_assoc();

    if (!$article) {
        http_response_code(404);
        die("Article not found.");
    }

    $submission_id = (int)$article["id"];
    $journal = $article["journal"];

    if ($further . $related . $applications . $future . $message === "" && !$wants_collaboration) {
        http_response_code(400);
        die('Please answer at least one question. <a href="javascript:history.back()">Go back</a>');
    }

} else {

    $category = (string)($_POST["category"] ?? "");
    $journal = trim((string)($_POST["journal"] ?? ""));

    if (!isset(SUGGESTION_CATEGORIES[$category]) || mb_strlen($message) < 10) {
        redirect("suggest.php?error=1" . ($journal !== "" ? "&journal=" . urlencode($journal) : ""));
    }
    if (!in_array($journal, $settings["journals"], true)) {
        $journal = null;
    }
}

// Not more than 10 messages a day from one reader
$stmt = $conn->prepare("SELECT COUNT(*) AS n FROM reader_feedback WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 DAY");
$stmt->bind_param("i", $user_id);
$stmt->execute();

if ((int)$stmt->get_result()->fetch_assoc()["n"] >= 10) {
    http_response_code(429);
    die("Thank you — you have already sent a lot of feedback today. Please try again tomorrow.");
}

$stmt = $conn->prepare("
    INSERT INTO reader_feedback
        (user_id, kind, submission_id, journal, category, further_research, related_questions,
         applications, future_topics, message, wants_collaboration, share_contact)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("isisssssssii", $user_id, $kind, $submission_id, $journal, $category, $further, $related,
    $applications, $future, $message, $wants_collaboration, $share_contact);
$stmt->execute();

if ($kind === "article") {
    redirect("article.php?id=" . $submission_id . "&feedback=1#comments");
}

redirect("suggest.php?sent=1");
