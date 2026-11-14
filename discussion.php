<?php
// Academic discussion block, shared by the journal pages and article.php.
//
// Before including, set:
//   $discussion_journal  — journal name (as in config.php "journals")
//   $discussion_article  — submissions row of the article, or null for a journal discussion
//
// Reader comments are anonymous: no names, dates or author marks are shown, only a stable
// code such as #2x98039. Editorial questions are always labelled as coming from
// Academia Institute.

if (!isset($conn, $discussion_journal)) {
    http_response_code(404);
    exit;
}

$discussion_article = $discussion_article ?? null;
$d_submission_id = $discussion_article ? (int)$discussion_article["id"] : null;
$d_viewer = (int)($_SESSION["user_id"] ?? 0);
$d_editor = is_editor();
$d_return = strtok($_SERVER["REQUEST_URI"] ?? "", "#");

// ---------- comments of this discussion ----------

$d_public = "'" . implode("','", DISCUSSION_PUBLIC_STATUSES) . "'";

$sql = "
    SELECT c.*,
        (SELECT COUNT(*) FROM comment_reactions r WHERE r.comment_id = c.id AND r.reaction = 'helpful') AS helpful,
        (SELECT COUNT(*) FROM comment_reports p WHERE p.comment_id = c.id AND p.resolved = 0) AS open_reports
    FROM journal_comments c
    WHERE c.journal = ?
    AND " . ($d_submission_id ? "c.submission_id = ?" : "c.submission_id IS NULL") . "
";

if (!$d_editor) {
    $sql .= " AND (c.status IN ($d_public) OR (c.status = 'Pending Review' AND c.user_id = ?)) ";
}

$sql .= " ORDER BY c.created_at ASC, c.id ASC";

$stmt = $conn->prepare($sql);

if ($d_submission_id && !$d_editor) {
    $stmt->bind_param("sii", $discussion_journal, $d_submission_id, $d_viewer);
} elseif ($d_submission_id) {
    $stmt->bind_param("si", $discussion_journal, $d_submission_id);
} elseif (!$d_editor) {
    $stmt->bind_param("si", $discussion_journal, $d_viewer);
} else {
    $stmt->bind_param("s", $discussion_journal);
}

$stmt->execute();
$d_rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// Which comments the viewer already marked as helpful
$d_my_helpful = [];

if ($d_viewer && $d_rows) {
    $ids = implode(",", array_map(fn($r) => (int)$r["id"], $d_rows));
    $res = $conn->query("SELECT comment_id FROM comment_reactions WHERE user_id = $d_viewer AND reaction = 'helpful' AND comment_id IN ($ids)");
    foreach ($res->fetch_all(MYSQLI_ASSOC) as $r) {
        $d_my_helpful[(int)$r["comment_id"]] = true;
    }
}

$d_top = [];
$d_replies = [];

foreach ($d_rows as $r) {
    if (empty($r["parent_id"])) {
        $d_top[] = $r;
    } else {
        $d_replies[(int)$r["parent_id"]][] = $r;
    }
}

// Pinned first, then editorial questions, then editor's selections, then newest
usort($d_top, function ($a, $b) {
    $rank = fn($c) => [
        -(int)$c["is_pinned"],
        $c["kind"] === "prompt" ? 0 : 1,
        $c["status"] === "Featured" ? 0 : 1,
    ];
    return $rank($a) <=> $rank($b) ?: strcmp($b["created_at"], $a["created_at"]) ?: $b["id"] <=> $a["id"];
});

// Questions from the editorial library that fit this article or journal
$d_prompts = pick_discussion_prompts($discussion_journal, $discussion_article, 2);

// ---------- one comment ----------

$d_render = function (array $c, bool $is_reply) use ($d_viewer, $d_editor, $d_return, $d_my_helpful) {
    $mine = $d_viewer && (int)$c["user_id"] === $d_viewer;
    $is_prompt = $c["kind"] === "prompt";
    $visible = in_array($c["status"], DISCUSSION_PUBLIC_STATUSES, true);
    $box = $is_reply ? "ml-5 md:ml-10 pl-4 border-l-2 border-slate-200 mt-4" : "";
    if ($is_prompt) {
        $box .= " bg-slate-50 border border-slate-200 rounded-lg p-4";
    }
    ?>
    <div class="<?= trim($box) ?>" id="comment-<?= (int)$c["id"] ?>">

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <?php if ($is_prompt): ?>
                <span class="font-semibold text-slate-800">Editorial question · Academia Institute</span>
            <?php else: ?>
                <span class="font-mono text-slate-500"><?= e(comment_code($c["id"])) ?></span>
                <span class="text-slate-500"><?= e(DISCUSSION_TOPICS[$c["topic"]] ?? DISCUSSION_TOPICS["general"]) ?></span>
            <?php endif; ?>
            <?php if ($c["is_pinned"]): ?><span class="text-slate-700 font-semibold">Pinned</span><?php endif; ?>
            <?php if ($c["status"] === "Featured"): ?><span class="text-blue-800 font-semibold">Editor's selection</span><?php endif; ?>
            <?php if ($c["status"] === "Pending Review"): ?><span class="text-amber-800 font-semibold">Awaiting editorial review</span><?php endif; ?>
            <?php if ($d_editor && !$visible && $c["status"] !== "Pending Review"): ?><span class="text-red-800 font-semibold"><?= e($c["status"]) ?> — visible to editors only</span><?php endif; ?>
            <?php if ($d_editor && $c["status"] === "Reported"): ?><span class="text-red-800 font-semibold">Reported (<?= (int)$c["open_reports"] ?>)</span><?php endif; ?>
            <?php if ($d_editor && !$is_prompt): ?><span class="text-slate-400" title="Pseudonymous participant code, visible to editors only"><?= e(participant_code($c["user_id"])) ?></span><?php endif; ?>
        </div>

        <p class="mt-2 text-slate-700 leading-7"><?= nl2br(e($c["comment"])) ?></p>

        <div class="mt-2 flex flex-wrap items-start gap-x-5 gap-y-2 text-sm">

            <?php if (!$is_prompt && $visible): ?>
                <?php if ($d_viewer && !$mine): ?>
                <form action="journal_comment.php" method="POST">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="helpful">
                    <input type="hidden" name="comment_id" value="<?= (int)$c["id"] ?>">
                    <input type="hidden" name="return" value="<?= e($d_return) ?>">
                    <button type="submit" class="<?= isset($d_my_helpful[(int)$c["id"]]) ? "text-blue-800 font-semibold" : "text-slate-600 hover:text-blue-800" ?>">
                        Helpful<?= $c["helpful"] ? " · " . (int)$c["helpful"] : "" ?>
                    </button>
                </form>
                <?php elseif ($c["helpful"]): ?>
                <span class="text-slate-500">Helpful · <?= (int)$c["helpful"] ?></span>
                <?php endif; ?>
            <?php endif; ?>

            <?php if ($d_viewer && !$is_reply && $visible): ?>
            <details>
                <summary class="cursor-pointer text-slate-700 font-semibold"><?= $is_prompt ? "Respond" : "Reply" ?></summary>
                <form action="journal_comment.php" method="POST" class="mt-2">
                    <?= csrf_field() ?>
                    <input type="hidden" name="parent_id" value="<?= (int)$c["id"] ?>">
                    <input type="hidden" name="return" value="<?= e($d_return) ?>">
                    <textarea name="comment" required minlength="2" maxlength="5000" rows="3" placeholder="Write a reply..."
                        class="w-full border border-slate-300 bg-white px-3 py-2 rounded-lg"></textarea>
                    <button type="submit" class="mt-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold">Send reply</button>
                </form>
            </details>
            <?php endif; ?>

            <?php if ($mine && !$is_prompt): ?>
            <details>
                <summary class="cursor-pointer text-slate-700 font-semibold">Edit</summary>
                <form action="journal_comment.php" method="POST" class="mt-2">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="edit">
                    <input type="hidden" name="comment_id" value="<?= (int)$c["id"] ?>">
                    <input type="hidden" name="return" value="<?= e($d_return) ?>">
                    <textarea name="comment" required minlength="2" maxlength="5000" rows="3"
                        class="w-full border border-slate-300 bg-white px-3 py-2 rounded-lg"><?= e($c["comment"]) ?></textarea>
                    <button type="submit" class="mt-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold">Save</button>
                </form>
            </details>
            <?php endif; ?>

            <?php if ($mine || $d_editor): ?>
            <form action="journal_comment.php" method="POST"
                  onsubmit="return confirm('<?= $is_reply ? "Delete this reply?" : "Delete this comment and its replies?" ?>')">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="comment_id" value="<?= (int)$c["id"] ?>">
                <input type="hidden" name="return" value="<?= e($d_return) ?>">
                <button type="submit" class="text-red-800 hover:underline">Delete</button>
            </form>
            <?php endif; ?>

            <?php if ($d_viewer && !$mine && !$is_prompt && $visible): ?>
            <details>
                <summary class="cursor-pointer text-slate-500">Report</summary>
                <form action="journal_comment.php" method="POST" class="mt-2 flex flex-wrap gap-2 items-center">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="report">
                    <input type="hidden" name="comment_id" value="<?= (int)$c["id"] ?>">
                    <input type="hidden" name="return" value="<?= e($d_return) ?>">
                    <select name="reason" required class="border border-slate-300 rounded-lg px-2 py-1">
                        <?php foreach (REPORT_REASONS as $key => $label): ?>
                            <option value="<?= e($key) ?>"><?= e($label) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <input type="text" name="details" maxlength="500" placeholder="Details (optional)" class="border border-slate-300 rounded-lg px-2 py-1">
                    <button type="submit" class="border border-slate-400 px-3 py-1 rounded-lg">Send report</button>
                </form>
            </details>
            <?php endif; ?>

            <?php if ($d_editor): ?>
            <form action="journal_comment.php" method="POST" class="flex flex-wrap gap-2">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="moderate">
                <input type="hidden" name="comment_id" value="<?= (int)$c["id"] ?>">
                <input type="hidden" name="return" value="<?= e($d_return) ?>">
                <?php if (!$is_reply): ?>
                    <button name="do" value="<?= $c["is_pinned"] ? "unpin" : "pin" ?>" class="text-slate-600 hover:underline"><?= $c["is_pinned"] ? "Unpin" : "Pin" ?></button>
                <?php endif; ?>
                <?php if (!$is_prompt): ?>
                    <button name="do" value="<?= $c["status"] === "Featured" ? "publish" : "feature" ?>" class="text-slate-600 hover:underline"><?= $c["status"] === "Featured" ? "Remove selection" : "Select as valuable" ?></button>
                <?php endif; ?>
                <?php if ($c["status"] !== "Published" && $c["status"] !== "Featured"): ?>
                    <button name="do" value="publish" class="text-slate-600 hover:underline">Publish</button>
                <?php endif; ?>
                <?php if ($c["status"] !== "Hidden"): ?>
                    <button name="do" value="hide" class="text-slate-600 hover:underline">Hide</button>
                <?php endif; ?>
                <?php if ($c["status"] !== "Archived"): ?>
                    <button name="do" value="archive" class="text-slate-600 hover:underline">Archive</button>
                <?php endif; ?>
            </form>
            <?php endif; ?>

        </div>
    </div>
    <?php
};
?>

<div class="space-y-6">

    <?php if ($d_prompts): ?>
    <div class="border border-slate-200 rounded-lg p-5 bg-white">
        <p class="text-sm font-semibold text-slate-800 mb-2">Questions for discussion · Academia Institute editorial office</p>
        <ul class="list-disc pl-5 space-y-1 text-slate-700">
            <?php foreach ($d_prompts as $p): ?>
                <li><?= e($p["text"]) ?> <span class="text-xs text-slate-500">(<?= e(PROMPT_CATEGORIES[$p["category"]] ?? "") ?>)</span></li>
            <?php endforeach; ?>
        </ul>
        <p class="text-xs text-slate-500 mt-3">These are editorial prompts, not reader comments. Responding is entirely optional.</p>
    </div>
    <?php endif; ?>

    <?php if ($d_viewer): ?>

        <form action="journal_comment.php" method="POST" class="space-y-3">
            <?= csrf_field() ?>
            <input type="hidden" name="journal" value="<?= e($discussion_journal) ?>">
            <?php if ($d_submission_id): ?><input type="hidden" name="submission_id" value="<?= $d_submission_id ?>"><?php endif; ?>
            <input type="hidden" name="return" value="<?= e($d_return) ?>">

            <textarea name="comment" required minlength="2" maxlength="5000" rows="4"
                placeholder="<?= $d_submission_id ? "Share a question, interpretation or suggestion about this article..." : "Share your perspective on research in this journal..." ?>"
                class="w-full border border-slate-300 bg-white px-4 py-3 rounded-lg"></textarea>

            <div class="flex flex-wrap items-center gap-3">
                <label class="text-sm text-slate-600" for="d-topic-<?= (int)$d_submission_id ?>">Subject</label>
                <select id="d-topic-<?= (int)$d_submission_id ?>" name="topic" class="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <?php foreach (DISCUSSION_TOPICS as $key => $label): ?>
                        <option value="<?= e($key) ?>"><?= e($label) ?></option>
                    <?php endforeach; ?>
                </select>
                <button type="submit" class="bg-slate-900 text-white px-6 py-2 rounded-lg font-semibold">Post comment</button>
            </div>

            <p class="text-xs text-slate-500">Comments are published without your name. Comments containing links are reviewed by the editors first.</p>
        </form>

        <?php if ($d_editor): ?>
        <details class="border border-slate-200 rounded-lg p-4">
            <summary class="cursor-pointer font-semibold text-slate-800">Editor: open a discussion with an editorial question</summary>
            <form action="journal_comment.php" method="POST" class="mt-3 space-y-2">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="prompt">
                <input type="hidden" name="journal" value="<?= e($discussion_journal) ?>">
                <?php if ($d_submission_id): ?><input type="hidden" name="submission_id" value="<?= $d_submission_id ?>"><?php endif; ?>
                <input type="hidden" name="return" value="<?= e($d_return) ?>">
                <textarea name="comment" required minlength="10" maxlength="2000" rows="3" class="w-full border border-slate-300 bg-white px-3 py-2 rounded-lg"
                    placeholder="The question is shown as 'Editorial question · Academia Institute'. You can copy one from the prompts above or from the library."></textarea>
                <label class="text-sm text-slate-700"><input type="checkbox" name="pin" value="1" checked> Pin at the top</label>
                <button type="submit" class="block bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold">Publish editorial question</button>
            </form>
        </details>
        <?php endif; ?>

    <?php else: ?>

        <div class="bg-slate-50 border border-slate-200 p-5 rounded-lg">
            <p class="text-slate-700">Please sign in to take part in the discussion.</p>
            <a href="signin.php" class="font-semibold text-blue-800 hover:underline">Sign in</a>
        </div>

    <?php endif; ?>

    <details class="text-sm text-slate-600">
        <summary class="cursor-pointer font-semibold text-slate-700">Community standards</summary>
        <div class="mt-2 space-y-2 leading-6">
            <p>This is a space for professional academic discussion. Respectful disagreement and constructive criticism are welcome; please support your points with reasoning or evidence.</p>
            <p>Please do not post personal attacks, harassment, advertising, unsupported medical or scientific claims, plagiarised text or fabricated citations, or misrepresent published research.</p>
            <p>Comments are shown without names. Editors may pin, select, hide or archive comments, and review content reported by readers.</p>
        </div>
    </details>

    <?php if ($d_top): ?>

        <div class="space-y-5">
            <?php foreach ($d_top as $c): ?>
                <div class="border-b border-slate-200 pb-5">
                    <?php $d_render($c, false); ?>
                    <?php foreach ($d_replies[(int)$c["id"]] ?? [] as $r): ?>
                        <?php $d_render($r, true); ?>
                    <?php endforeach; ?>
                </div>
            <?php endforeach; ?>
        </div>

    <?php else: ?>

        <p class="text-slate-500">No comments yet. You are welcome to start the discussion.</p>

    <?php endif; ?>

    <div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <?php if ($d_viewer && $d_submission_id): ?>
            <a href="#reader-perspective" onclick="document.getElementById('reader-perspective').open = true" class="font-semibold text-blue-800 hover:underline">Share your perspective privately with the editors</a>
        <?php endif; ?>
        <a href="suggest.php?journal=<?= urlencode($discussion_journal) ?>" class="font-semibold text-blue-800 hover:underline">Suggest a research topic or special issue</a>
    </div>

    <?php if ($d_viewer && $d_submission_id): ?>
    <details id="reader-perspective" class="border border-slate-200 rounded-lg p-5">
        <summary class="cursor-pointer font-semibold text-slate-800">Reader perspective (private, seen only by the editors)</summary>
        <form action="reader_feedback.php" method="POST" class="mt-4 space-y-4">
            <?= csrf_field() ?>
            <input type="hidden" name="kind" value="article">
            <input type="hidden" name="submission_id" value="<?= $d_submission_id ?>">
            <input type="hidden" name="return" value="<?= e($d_return) ?>">
            <p class="text-sm text-slate-600">All questions are optional. Your answers are not published.</p>
            <?php
            $questions = [
                "further_research"  => "Which aspect of this research deserves further investigation?",
                "related_questions" => "What related research questions would you suggest?",
                "applications"      => "What potential applications do you see?",
                "future_topics"     => "Which aspects of this topic would you like to explore in future publications?",
                "message"           => "Any other observation or constructive feedback",
            ];
            foreach ($questions as $field => $label): ?>
                <label class="block">
                    <span class="text-sm text-slate-700"><?= e($label) ?></span>
                    <textarea name="<?= e($field) ?>" rows="2" maxlength="3000" class="mt-1 w-full border border-slate-300 bg-white px-3 py-2 rounded-lg"></textarea>
                </label>
            <?php endforeach; ?>
            <label class="block text-sm text-slate-700"><input type="checkbox" name="wants_collaboration" value="1"> I would be interested in collaborating on this subject</label>
            <label class="block text-sm text-slate-700"><input type="checkbox" name="share_contact" value="1"> The editors may see my name and email to contact me about this</label>
            <button type="submit" class="bg-slate-900 text-white px-5 py-2 rounded-lg font-semibold">Send to the editors</button>
        </form>
    </details>
    <?php endif; ?>

</div>
