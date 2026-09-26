<?php
// Author uploads the payment receipt for a patent application fee.

require_once "patent_lib.php";

require_login();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    redirect("patents.php");
}

$id = (int)($_POST["patent_id"] ?? 0);

$stmt = $conn->prepare("
    SELECT id FROM patents
    WHERE id = ? AND user_id = ?
    AND status IN ('Awaiting Payment', 'Payment Review')
");
$stmt->bind_param("ii", $id, $_SESSION["user_id"]);
$stmt->execute();

if ($stmt->get_result()->num_rows === 0) {
    redirect("patents.php");
}

$receipt = save_upload("receipt", ["pdf", "jpg", "jpeg", "png"], 10);

if ($receipt === null) {
    redirect("patent.php?id=" . $id . "&error=receipt");
}

$stmt = $conn->prepare("UPDATE patents SET receipt_file = ?, status = 'Payment Review' WHERE id = ?");
$stmt->bind_param("si", $receipt, $id);
$stmt->execute();

redirect("patent.php?id=" . $id . "&receipt=1");
