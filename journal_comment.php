<?php

// Journal comments: post, reply, edit (author) and delete (author or editor).

require_once "config.php";

require_login();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    redirect("journals.html");
}

$user_id = (int)$_SESSION["user_id"];
$action = $_POST["action"] ?? "add";
$comment = trim($_POST["comment"] ?? "");
$comment_id = (int)($_POST["comment_id"] ?? 0);

$stmt = $conn->prepare("SELECT role FROM users WHERE id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$is_editor = ($stmt->get_result()->fetch_assoc()["role"] ?? "") === "editor";

// Edit or delete an existing comment
if ($action === "edit" || $action === "delete") {

    $stmt = $conn->prepare("SELECT id, user_id, parent_id FROM journal_comments WHERE id = ?");
    $stmt->bind_param("i", $comment_id);
    $stmt->execute();
    $existing = $stmt->get_result()->fetch_assoc();

    $is_owner = $existing && (int)$existing["user_id"] === $user_id;

    if ($action === "edit" && $is_owner && $comment !== "") {
        $stmt = $conn->prepare("UPDATE journal_comments SET comment = ?, updated_at = NOW() WHERE id = ?");
        $stmt->bind_param("si", $comment, $comment_id);
        $stmt->execute();
        redirect_back("journals.html", "#comment-" . $comment_id);
    }

    if ($action === "delete" && ($is_owner || $is_editor)) {
        // Replies go together with the comment they answer
        $stmt = $conn->prepare("DELETE FROM journal_comments WHERE id = ? OR parent_id = ?");
        $stmt->bind_param("ii", $comment_id, $comment_id);
        $stmt->execute();
        redirect_back("journals.html", "#comments");
    }

    http_response_code(403);
    die("You can change only your own comments.");
}

// New comment or reply
$journal = trim($_POST["journal"] ?? "");
$parent_id = (int)($_POST["parent_id"] ?? 0);

if ($journal === "" || $comment === "") {
    die("Invalid comment.");
}

if ($parent_id > 0) {
    // Replies hang under the first comment of the conversation, in the same journal
    $stmt = $conn->prepare("SELECT id, parent_id FROM journal_comments WHERE id = ? AND journal = ? AND status = 'Published'");
    $stmt->bind_param("is", $parent_id, $journal);
    $stmt->execute();
    $parent = $stmt->get_result()->fetch_assoc();

    if (!$parent) {
        die("The comment you are replying to no longer exists.");
    }

    $parent_id = $parent["parent_id"] ? (int)$parent["parent_id"] : (int)$parent["id"];
}

$parent_value = $parent_id > 0 ? $parent_id : null;

$stmt = $conn->prepare("
    INSERT INTO journal_comments (journal, user_id, comment, status, parent_id)
    VALUES (?, ?, ?, 'Published', ?)
");
$stmt->bind_param("sisi", $journal, $user_id, $comment, $parent_value);
$stmt->execute();

redirect_back("journals.html", $parent_value ? "#comment-" . $parent_value : "#comments");
