<?php

require_once "config.php";

$user = require_role("editor");
$user_id = $user["id"];


// =====================================
// ACTIONS (all forms on this page post here)
// =====================================

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $submission_id = (int)($_POST["submission_id"] ?? 0);
    $content_id = (int)($_POST["content_id"] ?? 0);
    $payment_id = (int)($_POST["payment_id"] ?? 0);

    // Assign reviewer
    if (isset($_POST["assign"])) {

        $reviewer_id = (int)($_POST["reviewer_id"] ?? 0);

        $stmt = $conn->prepare("
            UPDATE submissions
            SET reviewer_id = ?, status = 'Under Review'
            WHERE id = ?
        ");
        $stmt->bind_param("ii", $reviewer_id, $submission_id);
        $stmt->execute();
    }

    // Change status manually
    if (isset($_POST["set_status"])) {

        $allowed = ["Submitted", "Under Review", "Accepted", "Revision", "Rejected", "Payment Pending", "Paid"];
        $status = $_POST["status"] ?? "";

        if (in_array($status, $allowed, true)) {
            $stmt = $conn->prepare("UPDATE submissions SET status = ? WHERE id = ?");
            $stmt->bind_param("si", $status, $submission_id);
            $stmt->execute();
        }
    }

    // Publish article (optionally with DOI)
    if (isset($_POST["publish"])) {

        $doi = trim($_POST["doi"] ?? "");

        $stmt = $conn->prepare("
            UPDATE submissions
            SET status = 'Published', doi = NULLIF(?, '')
            WHERE id = ?
        ");
        $stmt->bind_param("si", $doi, $submission_id);
        $stmt->execute();
    }

    // Confirm payment → article becomes Paid
    if (isset($_POST["confirm_payment"])) {

        $stmt = $conn->prepare("
            UPDATE payments
            SET status = 'Paid', paid_at = NOW()
            WHERE id = ?
        ");
        $stmt->bind_param("i", $payment_id);
        $stmt->execute();

        $stmt = $conn->prepare("
            UPDATE submissions
            SET status = 'Paid'
            WHERE id = (SELECT submission_id FROM payments WHERE id = ?)
            AND status <> 'Published'
        ");
        $stmt->bind_param("i", $payment_id);
        $stmt->execute();
    }

    // Reject payment → author can pay again
    if (isset($_POST["reject_payment"])) {

        $stmt = $conn->prepare("UPDATE payments SET status = 'Rejected' WHERE id = ?");
        $stmt->bind_param("i", $payment_id);
        $stmt->execute();

        $stmt = $conn->prepare("
            UPDATE submissions
            SET status = 'Accepted'
            WHERE id = (SELECT submission_id FROM payments WHERE id = ?)
            AND status = 'Payment Pending'
        ");
        $stmt->bind_param("i", $payment_id);
        $stmt->execute();
    }

    // Patent applications
    $patent_id = (int)($_POST["patent_id"] ?? 0);

    if (isset($_POST["patent_confirm"])) {
        $stmt = $conn->prepare("
            UPDATE patents SET status = 'Filed', paid_at = NOW()
            WHERE id = ? AND status IN ('Awaiting Payment', 'Payment Review')
        ");
        $stmt->bind_param("i", $patent_id);
        $stmt->execute();
    }

    if (isset($_POST["patent_reject_payment"])) {
        $stmt = $conn->prepare("UPDATE patents SET status = 'Awaiting Payment' WHERE id = ? AND status = 'Payment Review'");
        $stmt->bind_param("i", $patent_id);
        $stmt->execute();
    }

    if (isset($_POST["patent_status"])) {
        $new_status = $_POST["new_status"] ?? "";

        // Examination statuses only after the fee is paid
        if (in_array($new_status, ["Filed", "Under Examination", "Granted", "Rejected"], true)) {
            $stmt = $conn->prepare("
                UPDATE patents SET status = ?
                WHERE id = ? AND status IN ('Filed', 'Under Examination', 'Granted', 'Rejected')
            ");
            $stmt->bind_param("si", $new_status, $patent_id);
            $stmt->execute();
        }
    }

    // Create website content
    if (isset($_POST["create_content"])) {

        $type = trim($_POST["type"] ?? "");
        $title = trim($_POST["title"] ?? "");
        $description = trim($_POST["description"] ?? "");
        $content = trim($_POST["content"] ?? "");
        $media_url = trim($_POST["media_url"] ?? "");
        $thumbnail_url = trim($_POST["thumbnail_url"] ?? "");
        $status = ($_POST["status"] ?? "") === "Published" ? "Published" : "Draft";

        // A photo uploaded from the computer is kept on this server (links to other sites can expire)
        $photo = save_upload("thumbnail_file", ["jpg", "jpeg", "png", "webp", "gif"], 10);
        if ($photo !== null) {
            $thumbnail_url = upload_url($photo);
        }

        if ($type === "" || $title === "") {
            die("Title and content type are required.");
        }

        $published_at = $status === "Published" ? date("Y-m-d H:i:s") : null;

        $stmt = $conn->prepare("
            INSERT INTO editorial_content
            (type, title, description, content, media_url, thumbnail_url, status, author_id, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param(
            "sssssssis",
            $type, $title, $description, $content, $media_url, $thumbnail_url, $status, $user_id, $published_at
        );
        $stmt->execute();
    }

    // Publish website content
    if (isset($_POST["publish_content"])) {

        $stmt = $conn->prepare("
            UPDATE editorial_content
            SET status = 'Published', published_at = NOW()
            WHERE id = ?
        ");
        $stmt->bind_param("i", $content_id);
        $stmt->execute();
    }

    // Replace the photo of existing website content
    if (isset($_POST["replace_photo"])) {

        $photo = save_upload("thumbnail_file", ["jpg", "jpeg", "png", "webp", "gif"], 10);

        if ($photo !== null) {
            $thumbnail_url = upload_url($photo);
            $stmt = $conn->prepare("UPDATE editorial_content SET thumbnail_url = ? WHERE id = ?");
            $stmt->bind_param("si", $thumbnail_url, $content_id);
            $stmt->execute();
        }
    }

    // Delete website content
    if (isset($_POST["delete_content"])) {

        $stmt = $conn->prepare("DELETE FROM editorial_content WHERE id = ?");
        $stmt->bind_param("i", $content_id);
        $stmt->execute();
    }

    redirect("editor-dashboard.php");
}


// =====================================
// DATA
// =====================================

$reviewers = $conn->query("
    SELECT id, fullname
    FROM users
    WHERE role = 'reviewer'
    ORDER BY fullname
")->fetch_all(MYSQLI_ASSOC);

$filter = $_GET["status"] ?? "";

$sql = "
SELECT
    submissions.*,
    users.fullname AS author,
    users.email AS author_email,
    users.free_access AS author_free,
    reviewer.fullname AS reviewer_name,
    r.status AS review_status,
    r.comments
FROM submissions
JOIN users
    ON submissions.user_id = users.id
LEFT JOIN users reviewer
    ON submissions.reviewer_id = reviewer.id
LEFT JOIN reviews r
    ON r.id = (SELECT MAX(id) FROM reviews WHERE reviews.submission_id = submissions.id)
";

if ($filter !== "") {
    $sql .= " WHERE submissions.status = ? ";
}

$sql .= " ORDER BY submissions.created_at DESC";

$stmt = $conn->prepare($sql);

if ($filter !== "") {
    $stmt->bind_param("s", $filter);
}

$stmt->execute();
$result = $stmt->get_result();

$payments = $conn->query("
    SELECT
        payments.*,
        users.fullname,
        submissions.title
    FROM payments
    JOIN users ON payments.user_id = users.id
    JOIN submissions ON payments.submission_id = submissions.id
    WHERE payments.status IN ('Pending', 'Awaiting Confirmation')
    ORDER BY payments.created_at DESC
");

$patents = $conn->query("
    SELECT patents.*, users.free_access
    FROM patents
    JOIN users ON patents.user_id = users.id
    ORDER BY
        FIELD(patents.status, 'Payment Review', 'Filed', 'Under Examination', 'Awaiting Payment', 'Granted', 'Rejected'),
        patents.created_at DESC
");

$content_result = $conn->query("
    SELECT
        editorial_content.*,
        users.fullname AS editor_name
    FROM editorial_content
    JOIN users
        ON editorial_content.author_id = users.id
    ORDER BY editorial_content.created_at DESC
");

$statuses = ["Submitted", "Under Review", "Accepted", "Revision", "Rejected", "Payment Pending", "Paid", "Published"];

?>
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Editorial Dashboard | <?= e($site_name) ?></title>

<script src="https://cdn.tailwindcss.com"></script>

</head>

<body class="bg-slate-100 text-slate-900">


<!-- =====================================
     HEADER
===================================== -->

<header class="bg-white border-b px-8 py-5">

    <div class="max-w-7xl mx-auto flex flex-wrap gap-4 justify-between items-center">

        <div>

            <h1 class="text-2xl font-bold">
                Editorial Dashboard
            </h1>

            <p class="text-slate-500">
                Welcome, <?= e($user["fullname"]) ?>
            </p>

        </div>

        <nav class="flex flex-wrap gap-3">

            <a href="about.html" class="px-4 py-2 border rounded-lg">Site</a>
            <a href="archive.php" class="px-4 py-2 border rounded-lg">Archive</a>
            <a href="#patents" class="px-4 py-2 border rounded-lg">Patents</a>
            <a href="discussions-admin.php" class="px-4 py-2 border rounded-lg font-semibold">Discussions</a>
            <a href="account-settings.php" class="px-4 py-2 border rounded-lg">Account</a>
            <a href="logout.php" class="px-4 py-2 bg-slate-900 text-white rounded-lg">Log out</a>

        </nav>

    </div>

</header>


<main class="max-w-7xl mx-auto px-8 py-10">


<!-- =====================================
     PAYMENTS WAITING FOR CONFIRMATION
===================================== -->

<section class="mb-10">

    <h2 class="text-xl font-bold mb-5">
        Payments to Confirm
    </h2>

    <?php if ($payments->num_rows === 0): ?>

        <p class="text-slate-500">No payments waiting.</p>

    <?php endif; ?>

    <div class="space-y-4">

    <?php while ($payment = $payments->fetch_assoc()): ?>

        <div class="bg-white rounded-xl shadow-sm p-6 flex flex-wrap justify-between gap-4">

            <div>

                <p class="font-bold">
                    #<?= (int)$payment["id"] ?> — <?= e($payment["title"]) ?>
                </p>

                <p class="text-slate-600 mt-1">
                    <?= e($payment["fullname"]) ?> ·
                    <?= e(number_format((float)$payment["amount"], 2) . " " . $payment["currency"]) ?> ·
                    <?= e($payment["plan"]) ?> ·
                    <?= e($payment["method"]) ?>
                </p>

                <p class="text-sm mt-1">
                    Status: <strong><?= e($payment["status"]) ?></strong>
                    · <?= e(date("d M Y H:i", strtotime($payment["created_at"]))) ?>
                </p>

                <?php if (!empty($payment["receipt_file"])): ?>
                    <a href="<?= e(upload_url($payment["receipt_file"])) ?>" target="_blank" class="text-blue-700 font-semibold">
                        View receipt →
                    </a>
                <?php else: ?>
                    <span class="text-sm text-slate-500">No receipt uploaded yet</span>
                <?php endif; ?>

            </div>

            <div class="flex gap-2 items-start">

                <form method="POST">
                    <input type="hidden" name="payment_id" value="<?= (int)$payment["id"] ?>">
                    <button type="submit" name="confirm_payment" class="bg-green-600 text-white px-4 py-2 rounded-lg">
                        Confirm payment
                    </button>
                </form>

                <form method="POST">
                    <input type="hidden" name="payment_id" value="<?= (int)$payment["id"] ?>">
                    <button type="submit" name="reject_payment" class="bg-red-600 text-white px-4 py-2 rounded-lg"
                            onclick="return confirm('Reject this payment?')">
                        Reject
                    </button>
                </form>

            </div>

        </div>

    <?php endwhile; ?>

    </div>

</section>


<!-- =====================================
     ARTICLES
===================================== -->

<section class="mb-10">

    <div class="flex flex-wrap justify-between items-center gap-4 mb-5">

        <h2 class="text-xl font-bold">
            Submitted Articles
        </h2>

        <form method="GET">
            <select name="status" onchange="this.form.submit()" class="border rounded-lg px-4 py-2">
                <option value="">All statuses</option>
                <?php foreach ($statuses as $status): ?>
                    <option value="<?= e($status) ?>" <?= $filter === $status ? "selected" : "" ?>><?= e($status) ?></option>
                <?php endforeach; ?>
            </select>
        </form>

    </div>

    <?php if ($result->num_rows === 0): ?>

        <p class="text-slate-500">No articles.</p>

    <?php endif; ?>

    <?php while ($row = $result->fetch_assoc()): ?>

        <div class="bg-white rounded-xl shadow-sm p-6 mb-5">

            <h3 class="text-lg font-bold">
                <?= e($row["title"]) ?>
            </h3>

            <p class="mt-2">
                Author: <?= e($row["author"]) ?>
                <span class="text-slate-500">(<?= e($row["author_email"]) ?>)</span>
                <?php if ($row["author_free"]): ?>
                    <span class="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-800 text-sm">Special access · free</span>
                <?php endif; ?>
            </p>

            <p class="mt-1">
                Journal: <?= e($row["journal"]) ?>
            </p>

            <p class="mt-1">
                Status: <strong><?= e($row["status"]) ?></strong>
            </p>

            <?php include "visibility-buttons.php"; ?>

            <p class="mt-1">
                Reviewer: <?= e($row["reviewer_name"] ?? "Not assigned") ?>
                · Decision: <?= e($row["review_status"] ?? "Waiting for review") ?>
            </p>

            <?php if (!empty($row["comments"])): ?>

                <p class="mt-3 text-slate-600">
                    Reviewer Comment:
                    <?= nl2br(e($row["comments"])) ?>
                </p>

            <?php endif; ?>

            <?php if (!empty($row["filename"])): ?>

                <div class="mt-4">
                    <a href="<?= e(upload_url($row["filename"])) ?>" target="_blank" class="text-blue-700 font-semibold">
                        Open Manuscript →
                    </a>
                </div>

            <?php endif; ?>


            <div class="mt-5 flex flex-wrap gap-6">

                <!-- ASSIGN REVIEWER -->

                <form method="POST" class="flex gap-3">

                    <input type="hidden" name="submission_id" value="<?= (int)$row["id"] ?>">

                    <select name="reviewer_id" required class="border rounded-lg px-4 py-2">

                        <option value="">Choose Reviewer</option>

                        <?php foreach ($reviewers as $reviewer): ?>

                            <option value="<?= (int)$reviewer["id"] ?>" <?= (int)$row["reviewer_id"] === (int)$reviewer["id"] ? "selected" : "" ?>>
                                <?= e($reviewer["fullname"]) ?>
                            </option>

                        <?php endforeach; ?>

                    </select>

                    <button type="submit" name="assign" class="bg-blue-600 text-white px-4 py-2 rounded-lg">
                        Assign Reviewer
                    </button>

                </form>


                <!-- CHANGE STATUS -->

                <form method="POST" class="flex gap-3">

                    <input type="hidden" name="submission_id" value="<?= (int)$row["id"] ?>">

                    <select name="status" class="border rounded-lg px-4 py-2">
                        <?php foreach ($statuses as $status): ?>
                            <?php if ($status !== "Published"): ?>
                                <option value="<?= e($status) ?>" <?= $row["status"] === $status ? "selected" : "" ?>><?= e($status) ?></option>
                            <?php endif; ?>
                        <?php endforeach; ?>
                    </select>

                    <button type="submit" name="set_status" class="border border-slate-400 px-4 py-2 rounded-lg">
                        Set status
                    </button>

                </form>

            </div>


            <!-- PUBLISH -->

            <?php if (in_array($row["status"], ["Accepted", "Payment Pending", "Paid"], true)): ?>

                <form method="POST" class="mt-4 flex flex-wrap gap-3 items-center">

                    <input type="hidden" name="submission_id" value="<?= (int)$row["id"] ?>">

                    <input type="text" name="doi" value="<?= e($row["doi"]) ?>" placeholder="DOI (optional), e.g. 10.1234/abcd"
                           class="border rounded-lg px-4 py-2 w-72">

                    <button type="submit" name="publish" class="bg-green-600 text-white px-5 py-2 rounded-lg"
                            <?php if ($row["status"] !== "Paid"): ?>onclick="return confirm('The fee is not confirmed yet. Publish anyway?')"<?php endif; ?>>
                        Publish Article
                    </button>

                </form>

            <?php elseif ($row["status"] === "Published"): ?>

                <a href="article.php?id=<?= (int)$row["id"] ?>" target="_blank" class="inline-block mt-4 text-green-700 font-semibold">
                    View published article →
                </a>

            <?php endif; ?>

        </div>

    <?php endwhile; ?>

</section>


<!-- =====================================
     PATENT APPLICATIONS
===================================== -->

<section class="mb-10" id="patents">

    <h2 class="text-xl font-bold mb-5">
        Patent Applications
    </h2>

    <?php if ($patents->num_rows === 0): ?>
        <p class="text-slate-500">No patent applications.</p>
    <?php endif; ?>

    <div class="space-y-4">

    <?php while ($p = $patents->fetch_assoc()): ?>

        <div class="bg-white rounded-xl shadow-sm p-6">

            <div class="flex flex-wrap justify-between gap-4">

                <div>
                    <p class="font-mono font-bold"><?= e($p["number"]) ?></p>
                    <p class="font-semibold"><?= e($p["title_ru"]) ?></p>
                    <p class="text-slate-600">
                        <?= e(trim($p["last_name"] . " " . $p["first_name"] . " " . $p["patronymic"])) ?>
                        · <?= e($p["phone"]) ?> · <?= e($p["email"]) ?>
                    </p>
                    <p class="text-sm mt-1">
                        Status: <strong><?= e($p["status"]) ?></strong> ·
                        <?= $p["is_free"] ? '<span class="text-green-700">Special access · free</span>' : e(number_format((float)$p["fee"], 2) . " " . $p["currency"]) ?>
                        · <?= e(date("d.m.Y", strtotime($p["created_at"]))) ?>
                    </p>
                    <div class="mt-2 flex flex-wrap gap-4">
                        <a href="patent.php?id=<?= (int)$p["id"] ?>" class="text-blue-700 font-semibold">Open →</a>
                        <a href="patent-document.php?id=<?= (int)$p["id"] ?>" target="_blank" class="text-blue-700 font-semibold">Document →</a>
                        <?php if ($p["receipt_file"]): ?>
                            <a href="<?= e(upload_url($p["receipt_file"])) ?>" target="_blank" class="text-blue-700 font-semibold">Receipt →</a>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2 items-start">

                    <?php if (in_array($p["status"], ["Awaiting Payment", "Payment Review"], true)): ?>

                        <form method="POST">
                            <input type="hidden" name="patent_id" value="<?= (int)$p["id"] ?>">
                            <button type="submit" name="patent_confirm" class="bg-green-600 text-white px-4 py-2 rounded-lg"
                                    <?php if ($p["status"] === "Awaiting Payment"): ?>onclick="return confirm('No receipt uploaded yet. Confirm payment anyway?')"<?php endif; ?>>
                                Confirm payment
                            </button>
                        </form>

                        <?php if ($p["status"] === "Payment Review"): ?>
                        <form method="POST">
                            <input type="hidden" name="patent_id" value="<?= (int)$p["id"] ?>">
                            <button type="submit" name="patent_reject_payment" class="bg-red-600 text-white px-4 py-2 rounded-lg"
                                    onclick="return confirm('Reject this receipt?')">
                                Reject receipt
                            </button>
                        </form>
                        <?php endif; ?>

                    <?php else: ?>

                        <form method="POST" class="flex gap-2">
                            <input type="hidden" name="patent_id" value="<?= (int)$p["id"] ?>">
                            <select name="new_status" class="border rounded-lg px-3 py-2">
                                <?php foreach (["Filed", "Under Examination", "Granted", "Rejected"] as $s): ?>
                                    <option value="<?= e($s) ?>" <?= $p["status"] === $s ? "selected" : "" ?>><?= e($s) ?></option>
                                <?php endforeach; ?>
                            </select>
                            <button type="submit" name="patent_status" class="border border-slate-400 px-4 py-2 rounded-lg">
                                Set status
                            </button>
                        </form>

                    <?php endif; ?>

                </div>

            </div>

        </div>

    <?php endwhile; ?>

    </div>

</section>


<!-- =====================================
     CREATE NEWS / VIDEO / COURSE
===================================== -->

<section class="bg-white rounded-xl shadow-sm p-8 mb-10">

    <h2 class="text-xl font-bold mb-2">
        Create Website Content
    </h2>

    <p class="text-slate-500 mb-6">
        Publish news, videos, courses and announcements directly to About page.
    </p>

    <form method="POST" enctype="multipart/form-data" class="space-y-5">

        <input type="hidden" name="create_content" value="1">

        <div>
            <label class="block font-semibold mb-2">Content Type</label>
            <select name="type" required class="w-full border rounded-lg px-4 py-3">
                <option value="">Select content type</option>
                <option value="News">📰 News</option>
                <option value="Video">🎥 Video</option>
                <option value="Course">🎓 Course</option>
                <option value="Announcement">📢 Announcement</option>
            </select>
        </div>

        <div>
            <label class="block font-semibold mb-2">Title</label>
            <input type="text" name="title" required placeholder="Content title" class="w-full border rounded-lg px-4 py-3">
        </div>

        <div>
            <label class="block font-semibold mb-2">Short Description</label>
            <textarea name="description" rows="3" placeholder="Short description..." class="w-full border rounded-lg px-4 py-3"></textarea>
        </div>

        <div>
            <label class="block font-semibold mb-2">Content</label>
            <textarea name="content" rows="7" placeholder="Write the full news, course information or announcement..." class="w-full border rounded-lg px-4 py-3"></textarea>
        </div>

        <div>
            <label class="block font-semibold mb-2">Video / Course / External URL</label>
            <input type="url" name="media_url" placeholder="https://..." class="w-full border rounded-lg px-4 py-3">
        </div>

        <div>
            <label class="block font-semibold mb-2">Photo from your computer (recommended)</label>
            <input type="file" name="thumbnail_file" accept=".jpg,.jpeg,.png,.webp,.gif" class="w-full border rounded-lg px-4 py-3">
            <p class="text-sm text-slate-500 mt-1">The photo is stored on this site, so it never disappears. JPG, PNG, WEBP, up to 10 MB.</p>
        </div>

        <div>
            <label class="block font-semibold mb-2">…or Image URL</label>
            <input type="url" name="thumbnail_url" placeholder="https://..." class="w-full border rounded-lg px-4 py-3">
            <p class="text-sm text-slate-500 mt-1">Links from LinkedIn and Instagram stop working after a few weeks — better upload the file.</p>
        </div>

        <div>
            <label class="block font-semibold mb-2">Status</label>
            <select name="status" class="w-full border rounded-lg px-4 py-3">
                <option value="Draft">Draft</option>
                <option value="Published">Publish immediately</option>
            </select>
        </div>

        <button type="submit" class="bg-blue-700 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-800">
            Publish / Save Content
        </button>

    </form>

</section>


<!-- =====================================
     EXISTING WEBSITE CONTENT
===================================== -->

<section class="mb-10">

    <h2 class="text-xl font-bold mb-5">
        News / Videos / Courses
    </h2>

    <div class="space-y-4">

        <?php while ($content = $content_result->fetch_assoc()): ?>

            <div class="bg-white rounded-xl shadow-sm p-6">

                <div class="flex justify-between items-start gap-5">

                    <div>

                        <span class="text-xs font-bold uppercase text-blue-700">
                            <?= e($content["type"]) ?>
                        </span>

                        <h3 class="text-lg font-bold mt-1">
                            <?= e($content["title"]) ?>
                        </h3>

                        <p class="text-slate-500 mt-2">
                            <?= e($content["description"]) ?>
                        </p>

                        <p class="text-sm mt-3">
                            Status: <strong><?= e($content["status"]) ?></strong>
                            · by <?= e($content["editor_name"]) ?>
                        </p>

                        <?php if (!empty($content["thumbnail_url"])): ?>
                            <img src="<?= e($content["thumbnail_url"]) ?>" alt="" class="mt-3 h-24 rounded-lg border"
                                 onerror="this.replaceWith(Object.assign(document.createElement('p'), {className: 'mt-3 text-sm text-red-600 font-semibold', textContent: '⚠ Photo is not loading — upload it again below'}))">
                        <?php endif; ?>

                        <form method="POST" enctype="multipart/form-data" class="mt-3 flex flex-wrap items-center gap-2">
                            <input type="hidden" name="content_id" value="<?= (int)$content["id"] ?>">
                            <input type="file" name="thumbnail_file" accept=".jpg,.jpeg,.png,.webp,.gif" required class="text-sm">
                            <button type="submit" name="replace_photo" class="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                                Replace photo
                            </button>
                        </form>

                    </div>

                    <div class="flex gap-2">

                        <?php if ($content["status"] !== "Published"): ?>

                            <form method="POST">
                                <input type="hidden" name="content_id" value="<?= (int)$content["id"] ?>">
                                <button type="submit" name="publish_content" class="bg-green-600 text-white px-4 py-2 rounded-lg">
                                    Publish
                                </button>
                            </form>

                        <?php endif; ?>

                        <form method="POST">
                            <input type="hidden" name="content_id" value="<?= (int)$content["id"] ?>">
                            <button type="submit" name="delete_content" class="bg-red-600 text-white px-4 py-2 rounded-lg"
                                    onclick="return confirm('Delete this content?')">
                                Delete
                            </button>
                        </form>

                    </div>

                </div>

            </div>

        <?php endwhile; ?>

    </div>

</section>


</main>

</body>
</html>
