<?php

// Notifications for a signed-in user: replies to their comments and new comments on their articles.

require_once "config.php";

require_login();

$user_id = (int)$_SESSION["user_id"];

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    check_csrf();
    $stmt = $conn->prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    redirect("notifications.php");
}

$stmt = $conn->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$unread = count(array_filter($items, fn($n) => !$n["is_read"]));
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Discussion Notifications | <?= e($site_name) ?></title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 text-slate-800">

<div class="max-w-3xl mx-auto py-12 px-6">

    <a href="dashboard.php" class="text-blue-700 hover:underline">← My account</a>

    <div class="bg-white rounded-xl shadow-lg p-8 mt-6">

        <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
            <h1 class="text-3xl font-bold">Discussion Notifications</h1>
            <?php if ($unread): ?>
            <form method="POST">
                <?= csrf_field() ?>
                <button class="border border-slate-400 px-4 py-2 rounded-lg text-sm">Mark all as read</button>
            </form>
            <?php endif; ?>
        </div>

        <?php if (!$items): ?>
            <p class="text-slate-500">No notifications yet. You will see here when readers reply to your comments or discuss your articles.</p>
        <?php endif; ?>

        <div class="divide-y">
            <?php foreach ($items as $n): ?>
                <a href="<?= e($n["link"]) ?>" class="block py-4 hover:bg-slate-50 <?= $n["is_read"] ? "text-slate-500" : "font-semibold" ?>">
                    <?= e($n["message"]) ?>
                    <span class="block text-xs text-slate-400 font-normal mt-1"><?= e(date("d M Y, H:i", strtotime($n["created_at"]))) ?></span>
                </a>
            <?php endforeach; ?>
        </div>

    </div>

</div>

</body>
</html>
