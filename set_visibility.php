<?php

// Make an article public or not public.
// Allowed: editors (any article) and the reviewer assigned to the article.

require_once "config.php";

require_login();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    redirect("dashboard.php");
}

$stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
$stmt->bind_param("i", $_SESSION["user_id"]);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

$submission_id = (int)($_POST["submission_id"] ?? 0);
$visibility = $_POST["visibility"] ?? "";

if (!$user || !in_array($visibility, ["public", "private"], true)) {
    http_response_code(400);
    die("Bad request");
}

$stmt = $conn->prepare("SELECT id, reviewer_id FROM submissions WHERE id = ?");
$stmt->bind_param("i", $submission_id);
$stmt->execute();
$article = $stmt->get_result()->fetch_assoc();

$is_editor = $user["role"] === "editor";
$is_reviewer = $user["role"] === "reviewer" && $article && (int)$article["reviewer_id"] === (int)$user["id"];

if (!$article || (!$is_editor && !$is_reviewer)) {
    http_response_code(403);
    die("Access denied");
}

$stmt = $conn->prepare("
    UPDATE submissions
    SET visibility = ?, visibility_by = ?, visibility_at = NOW()
    WHERE id = ?
");
$stmt->bind_param("ssi", $visibility, $user["fullname"], $submission_id);
$stmt->execute();

redirect_back($is_editor ? "editor-dashboard.php" : "reviewer-dashboard.php");
