<?php

// Suggestions for the journal: topics, special issues, events, collaborations, improvements.

require_once "config.php";

$selected_journal = (string)($_GET["journal"] ?? "");
$signed_in = isset($_SESSION["user_id"]);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Suggestions for the Journal | <?= e($site_name) ?></title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 text-slate-800">

<div class="max-w-3xl mx-auto py-12 px-6">

    <a href="journals.html" class="text-blue-700 hover:underline">← Journals</a>

    <div class="bg-white rounded-xl shadow-lg p-8 md:p-10 mt-6">

        <h1 class="text-3xl font-bold mb-3">Suggestions for the Journal</h1>
        <p class="text-slate-600 mb-6">
            Academia Institute is shaped by its readers and authors. Suggest a research topic, a special issue,
            an interdisciplinary theme, an academic event or a collaboration — or tell us how to improve publishing with us.
            Suggestions are read by the editorial office and are not published.
        </p>

        <?php if (isset($_GET["sent"])): ?>
            <p class="mb-6 p-4 rounded-lg bg-green-50 text-green-800">Thank you. Your suggestion has been sent to the editorial office.</p>
        <?php endif; ?>
        <?php if (isset($_GET["error"])): ?>
            <p class="mb-6 p-4 rounded-lg bg-red-50 text-red-800">Please choose a type and write at least a short description.</p>
        <?php endif; ?>

        <?php if (!$signed_in): ?>

            <p class="p-4 rounded-lg bg-slate-50 border">Please <a href="signin.php" class="text-blue-700 font-semibold hover:underline">sign in</a> to send a suggestion.</p>

        <?php else: ?>

        <form action="reader_feedback.php" method="POST" class="space-y-5">
            <?= csrf_field() ?>
            <input type="hidden" name="kind" value="suggestion">

            <label class="block">
                <span class="font-semibold">Type of suggestion</span>
                <select name="category" required class="mt-1 w-full border rounded-lg px-3 py-2">
                    <option value="">Choose…</option>
                    <?php foreach (SUGGESTION_CATEGORIES as $key => $label): ?>
                        <option value="<?= e($key) ?>"><?= e($label) ?></option>
                    <?php endforeach; ?>
                </select>
            </label>

            <label class="block">
                <span class="font-semibold">Journal (optional)</span>
                <select name="journal" class="mt-1 w-full border rounded-lg px-3 py-2">
                    <option value="">Any journal</option>
                    <?php foreach ($settings["journals"] as $name): ?>
                        <option value="<?= e($name) ?>" <?= $selected_journal === $name ? "selected" : "" ?>><?= e($name) ?></option>
                    <?php endforeach; ?>
                </select>
            </label>

            <label class="block">
                <span class="font-semibold">Your suggestion</span>
                <textarea name="message" required minlength="10" maxlength="3000" rows="6" class="mt-1 w-full border rounded-lg px-3 py-2"
                    placeholder="Describe the topic, issue or idea and why it matters."></textarea>
            </label>

            <label class="block text-sm"><input type="checkbox" name="wants_collaboration" value="1"> I would be interested in taking part (e.g. as an author, reviewer or co-organiser)</label>
            <label class="block text-sm"><input type="checkbox" name="share_contact" value="1"> The editors may see my name and email to contact me about this</label>

            <button type="submit" class="bg-slate-900 text-white px-6 py-3 rounded-lg font-semibold">Send suggestion</button>
        </form>

        <?php endif; ?>

    </div>

</div>

</body>
</html>
