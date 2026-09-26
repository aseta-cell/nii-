<?php
// One patent application: details, payment, link to the document.

require_once "patent_lib.php";

require_login();

$user = current_user();
$patent = load_patent((int)($_GET["id"] ?? 0), $user);
$is_paid = in_array($patent["status"], $patent_paid_statuses, true);
$co_inventors = patent_co_inventors($patent);
?>
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($patent["number"]) ?> | <?= e($site_name) ?></title>
<script src="https://cdn.tailwindcss.com"></script>
</head>

<body class="bg-gray-100">

<div class="max-w-4xl mx-auto py-12 px-6">

<a href="<?= $user["role"] === "editor" ? "editor-dashboard.php#patents" : "patents.php" ?>" class="text-blue-600 hover:underline">← Back</a>

<?php if (isset($_GET["created"])): ?>
<p class="mt-6 p-4 rounded bg-green-100 text-green-800">
    Application <?= e($patent["number"]) ?> created.
    <?= $is_paid ? "It is free for you and already filed." : "Please pay the application fee below." ?>
</p>
<?php endif; ?>

<?php if (isset($_GET["receipt"])): ?>
<p class="mt-6 p-4 rounded bg-green-100 text-green-800">Receipt received. The office will confirm your payment soon.</p>
<?php endif; ?>

<?php if (($_GET["error"] ?? "") === "receipt"): ?>
<p class="mt-6 p-4 rounded bg-red-100 text-red-800">Please upload the receipt as PDF, JPG or PNG (max 10 MB).</p>
<?php endif; ?>

<div class="bg-white rounded-xl shadow-lg p-8 md:p-10 mt-6">

    <div class="flex flex-wrap justify-between gap-4 items-start">
        <div>
            <p class="text-sm text-gray-500">Өтінім нөмірі · Номер заявки · Application No.</p>
            <h1 class="text-3xl font-bold font-mono"><?= e($patent["number"]) ?></h1>
            <p class="text-gray-500 mt-1"><?= e(patent_type_label($patent["patent_type"], "ru")) ?> · <?= e(date("d.m.Y", strtotime($patent["created_at"]))) ?></p>
        </div>
        <?= patent_status_badge($patent["status"]) ?>
    </div>

    <div class="mt-6">
        <a href="patent-document.php?id=<?= (int)$patent["id"] ?>" target="_blank"
           class="inline-block bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-blue-800">
            📄 Open application document (print / PDF)
        </a>
        <?php if (!$is_paid): ?>
            <p class="text-sm text-gray-500 mt-2">Until the fee is paid, the document is marked as DRAFT.</p>
        <?php endif; ?>
    </div>

    <hr class="my-8">

    <h2 class="text-xl font-bold mb-3">Атауы · Название · Title</h2>
    <p><span class="text-gray-500">KZ:</span> <?= e($patent["title_kz"]) ?></p>
    <p><span class="text-gray-500">RU:</span> <?= e($patent["title_ru"]) ?></p>
    <p><span class="text-gray-500">EN:</span> <?= e($patent["title_en"]) ?></p>

    <h2 class="text-xl font-bold mt-6 mb-3">Өтініш беруші · Заявитель · Applicant</h2>
    <p><?= e(patent_full_name($patent)) ?><?= $patent["iin"] ? " · IIN " . e($patent["iin"]) : "" ?></p>
    <p><?= e($patent["phone"]) ?> · <?= e($patent["email"]) ?></p>
    <?php if ($patent["address"]): ?><p><?= e($patent["address"]) ?></p><?php endif; ?>

    <?php if ($co_inventors): ?>
        <h2 class="text-xl font-bold mt-6 mb-3">Соавторы · Co-inventors</h2>
        <ul class="list-disc pl-6">
        <?php foreach ($co_inventors as $co): ?>
            <li><?= e(trim($co["last_name"] . " " . $co["first_name"] . " " . $co["patronymic"])) ?></li>
        <?php endforeach; ?>
        </ul>
    <?php endif; ?>

    <?php if ($patent["abstract"]): ?>
        <h2 class="text-xl font-bold mt-6 mb-3">Реферат · Abstract</h2>
        <p class="text-gray-700 leading-7"><?= nl2br(e($patent["abstract"])) ?></p>
    <?php endif; ?>

    <?php if ($patent["filename"]): ?>
        <a href="<?= e(upload_url($patent["filename"])) ?>" target="_blank" class="inline-block mt-4 text-blue-700 font-semibold">Description file →</a>
    <?php endif; ?>

    <hr class="my-8">

    <!-- PAYMENT -->

    <h2 class="text-xl font-bold mb-3">Төлем · Оплата · Payment</h2>

    <?php if ($patent["is_free"]): ?>

        <p class="p-4 rounded bg-green-100 text-green-800">Special access — free application.</p>

    <?php elseif ($is_paid): ?>

        <p class="p-4 rounded bg-green-100 text-green-800">
            Paid: <?= e(number_format((float)$patent["fee"], 2) . " " . $patent["currency"]) ?>
            <?= $patent["paid_at"] ? " · " . e(date("d.m.Y", strtotime($patent["paid_at"]))) : "" ?>
        </p>

    <?php elseif ((int)$patent["user_id"] === (int)$user["id"]): ?>

        <p class="text-lg">Application fee: <strong><?= e(number_format((float)$patent["fee"], 2) . " " . $patent["currency"]) ?></strong></p>

        <div class="border rounded-lg p-6 my-4">
            <h3 class="font-bold mb-2">How to pay</h3>
            <p class="whitespace-pre-line text-gray-700"><?= e($settings["payment_instructions"]) ?></p>
            <p class="mt-3">Payment comment: <strong><?= e($patent["number"]) ?></strong></p>
        </div>

        <?php if ($patent["status"] === "Payment Review"): ?>
            <p class="p-4 rounded bg-yellow-100 text-yellow-800 mb-4">Receipt received — waiting for confirmation. You can upload a new one if needed.</p>
        <?php endif; ?>

        <form action="patent_action.php" method="POST" enctype="multipart/form-data" class="space-y-3">
            <input type="hidden" name="patent_id" value="<?= (int)$patent["id"] ?>">
            <label class="block font-semibold">Upload payment receipt (PDF, JPG or PNG)</label>
            <input type="file" name="receipt" accept=".pdf,.jpg,.jpeg,.png" required class="block w-full border rounded-lg p-3">
            <button type="submit" class="bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-blue-800">Send receipt</button>
        </form>

    <?php else: ?>

        <p>Status: <?= e($patent["status"]) ?></p>
        <?php if ($patent["receipt_file"]): ?>
            <a href="<?= e(upload_url($patent["receipt_file"])) ?>" target="_blank" class="text-blue-700 font-semibold">View receipt →</a>
        <?php endif; ?>

    <?php endif; ?>

</div>

</div>

</body>
</html>
