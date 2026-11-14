<?php

// Number of comments for every journal, for the journals list (journals.html).

require_once "config.php";

header("Content-Type: application/json; charset=UTF-8");

$counts = [];

$result = $conn->query("
    SELECT journal, COUNT(*) AS total
    FROM journal_comments
    WHERE submission_id IS NULL
    AND kind = 'comment'
    AND status IN ('Published', 'Featured', 'Reported')
    GROUP BY journal
");

while ($row = $result->fetch_assoc()) {
    $counts[$row["journal"]] = (int)$row["total"];
}

// page file => number of comments, e.g. {"ai.php": 3}
$out = [];

foreach ($settings["journals"] as $page => $name) {
    $out[$page] = $counts[$name] ?? 0;
}

echo json_encode($out);
