<?php
// Patents: information, fee and the signed-in user's applications.

require_once "patent_lib.php";

$user = current_user();
$applications = null;

if ($user) {
    $stmt = $conn->prepare("SELECT * FROM patents WHERE user_id = ? ORDER BY created_at DESC");
    $stmt->bind_param("i", $user["id"]);
    $stmt->execute();
    $applications = $stmt->get_result();
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Patents | <?= e($site_name) ?></title>
<script src="https://cdn.tailwindcss.com"></script>
</head>

<body class="bg-gray-100">

<nav class="bg-white border-b">
    <div class="max-w-5xl mx-auto px-6 py-4 flex flex-wrap gap-6 items-center">
        <a href="about.html" class="font-bold text-lg"><?= e($site_name) ?></a>
        <a href="journals.html" class="text-gray-600 hover:text-black">Journals</a>
        <a href="publish.php" class="text-gray-600 hover:text-black">Publish</a>
        <a href="patents.php" class="font-bold">Patents</a>
        <a href="archive.php" class="text-gray-600 hover:text-black">Archive</a>
        <span class="flex-1"></span>
        <?php if ($user): ?>
            <a href="<?= $user["role"] === "editor" ? "editor-dashboard.php" : ($user["role"] === "reviewer" ? "reviewer-dashboard.php" : "dashboard.php") ?>" class="text-gray-600 hover:text-black">My Account</a>
        <?php else: ?>
            <a href="signin.php" class="bg-blue-700 text-white px-4 py-2 rounded-lg">Sign In</a>
        <?php endif; ?>
    </div>
</nav>

<div class="max-w-5xl mx-auto py-12 px-6">

    <div class="bg-white rounded-xl shadow p-8 md:p-10">

        <h1 class="text-4xl font-bold">Патенттер · Патенты · Patents</h1>

        <p class="text-gray-700 mt-4 leading-7">
            File an application for an invention, utility model or industrial design.
            Fill in the form in Kazakh, Russian and English, pay the application fee, and get an official
            application document with its own number and barcode that you can print or save as PDF.
        </p>

        <div class="grid md:grid-cols-3 gap-4 mt-8">
            <div class="bg-blue-50 rounded-lg p-5">
                <div class="text-2xl font-bold text-blue-700">1</div>
                <p class="mt-1">Fill in the application: inventor, contacts, title in 3 languages.</p>
            </div>
            <div class="bg-blue-50 rounded-lg p-5">
                <div class="text-2xl font-bold text-blue-700">2</div>
                <p class="mt-1">Pay the fee — <strong><?= e(number_format((float)$settings["patent_fee"], 0) . " " . $settings["currency"]) ?></strong> — and upload the receipt.</p>
            </div>
            <div class="bg-blue-50 rounded-lg p-5">
                <div class="text-2xl font-bold text-blue-700">3</div>
                <p class="mt-1">Download the application document with number and barcode.</p>
            </div>
        </div>

        <div class="mt-8">
            <?php if ($user): ?>
                <a href="patent-new.php" class="inline-block bg-blue-700 text-white px-8 py-4 rounded-lg font-bold hover:bg-blue-800">
                    + New patent application
                </a>
                <?php if ($user["free_access"]): ?>
                    <p class="mt-3 text-green-700 font-semibold">Special access — applications are free for you.</p>
                <?php endif; ?>
            <?php else: ?>
                <a href="signin.php" class="inline-block bg-blue-700 text-white px-8 py-4 rounded-lg font-bold">Sign in to apply</a>
                <a href="register.php" class="inline-block ml-3 border border-blue-700 text-blue-700 px-8 py-4 rounded-lg font-bold">Register</a>
            <?php endif; ?>
        </div>

    </div>

    <?php if ($user): ?>

    <div class="bg-white rounded-xl shadow p-8 md:p-10 mt-8">

        <h2 class="text-2xl font-bold mb-4">Менің өтінімдерім · Мои заявки · My applications</h2>

        <?php if ($applications->num_rows === 0): ?>
            <p class="text-gray-500">No applications yet.</p>
        <?php endif; ?>

        <?php while ($p = $applications->fetch_assoc()): ?>
            <a href="patent.php?id=<?= (int)$p["id"] ?>" class="flex flex-wrap justify-between items-center gap-4 border-b py-4 hover:bg-gray-50">
                <div>
                    <p class="font-mono font-bold"><?= e($p["number"]) ?></p>
                    <p><?= e($p["title_ru"]) ?></p>
                    <p class="text-sm text-gray-500"><?= e(patent_type_label($p["patent_type"], "en")) ?> · <?= e(date("d.m.Y", strtotime($p["created_at"]))) ?></p>
                </div>
                <?= patent_status_badge($p["status"]) ?>
            </a>
        <?php endwhile; ?>

    </div>

    <?php endif; ?>

</div>

</body>
</html>
