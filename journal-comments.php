<?php
// Discussion under a journal page (ai.php, medicine.php, ...): uses the shared
// academic discussion block. Needs $journal and $conn.

if (!isset($journal, $conn)) {
    http_response_code(404);
    exit;
}

$discussion_journal = $journal;
$discussion_article = null;

include __DIR__ . "/discussion.php";
