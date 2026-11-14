<?php
// Comments under a journal: replies, edit and delete.
// Included by the journal pages (ai.php, medicine.php, ...); needs $journal, $user_id, $conn.

if (!isset($journal, $conn)) {
    http_response_code(404);
    exit;
}

$viewer_id = (int)($user_id ?? 0);
$viewer_is_editor = false;

if ($viewer_id) {
    $stmt = $conn->prepare("SELECT role FROM users WHERE id = ?");
    $stmt->bind_param("i", $viewer_id);
    $stmt->execute();
    $viewer_is_editor = ($stmt->get_result()->fetch_assoc()["role"] ?? "") === "editor";
}

$stmt = $conn->prepare("
    SELECT journal_comments.*, users.fullname
    FROM journal_comments
    JOIN users ON journal_comments.user_id = users.id
    WHERE journal_comments.journal = ?
    AND journal_comments.status = 'Published'
    ORDER BY journal_comments.created_at ASC, journal_comments.id ASC
");
$stmt->bind_param("s", $journal);
$stmt->execute();

$top = [];
$replies = [];

foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $c) {
    if (empty($c["parent_id"])) {
        $top[] = $c;
    } else {
        $replies[(int)$c["parent_id"]][] = $c;
    }
}

$top = array_reverse($top); // newest conversations first

$render_comment = function (array $c, bool $is_reply) use ($viewer_id, $viewer_is_editor, $journal) {
    $mine = $viewer_id && (int)$c["user_id"] === $viewer_id;
    ?>
    <div class="<?= $is_reply ? "ml-6 md:ml-10 pl-4 border-l-2 border-outline-variant mt-4" : "" ?>" id="comment-<?= (int)$c["id"] ?>">

        <div class="flex justify-between gap-4">
            <strong><?= e($c["fullname"]) ?></strong>
            <span class="text-sm text-on-surface-variant">
                <?= date("d M Y", strtotime($c["created_at"])) ?>
                <?php if (!empty($c["updated_at"])): ?> · edited<?php endif; ?>
            </span>
        </div>

        <p class="mt-2 text-on-surface-variant"><?= nl2br(e($c["comment"])) ?></p>

        <div class="mt-2 flex flex-wrap items-start gap-4 text-sm">

            <?php if ($viewer_id && !$is_reply): ?>
            <details>
                <summary class="cursor-pointer text-secondary font-bold">Reply · Ответить</summary>
                <form action="journal_comment.php" method="POST" class="mt-2">
                    <input type="hidden" name="journal" value="<?= e($journal) ?>">
                    <input type="hidden" name="parent_id" value="<?= (int)$c["id"] ?>">
                    <textarea name="comment" required rows="3" placeholder="Write a reply..."
                        class="w-full border border-outline-variant bg-surface px-3 py-2 rounded-lg"></textarea>
                    <button type="submit" class="mt-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold">Send reply</button>
                </form>
            </details>
            <?php endif; ?>

            <?php if ($mine): ?>
            <details>
                <summary class="cursor-pointer text-secondary font-bold">Edit · Изменить</summary>
                <form action="journal_comment.php" method="POST" class="mt-2">
                    <input type="hidden" name="action" value="edit">
                    <input type="hidden" name="comment_id" value="<?= (int)$c["id"] ?>">
                    <textarea name="comment" required rows="3"
                        class="w-full border border-outline-variant bg-surface px-3 py-2 rounded-lg"><?= e($c["comment"]) ?></textarea>
                    <button type="submit" class="mt-2 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold">Save</button>
                </form>
            </details>
            <?php endif; ?>

            <?php if ($mine || $viewer_is_editor): ?>
            <form action="journal_comment.php" method="POST"
                  onsubmit="return confirm('<?= $is_reply ? "Delete this reply?" : "Delete this comment and its replies?" ?>')">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="comment_id" value="<?= (int)$c["id"] ?>">
                <button type="submit" class="text-red-700 font-bold hover:underline">Delete · Удалить</button>
            </form>
            <?php endif; ?>

        </div>
    </div>
    <?php
};
?>

    <div class="space-y-5">

        <?php if ($top): ?>

            <?php foreach ($top as $c): ?>
                <div class="border-b border-outline-variant pb-5">
                    <?php $render_comment($c, false); ?>
                    <?php foreach ($replies[(int)$c["id"]] ?? [] as $r): ?>
                        <?php $render_comment($r, true); ?>
                    <?php endforeach; ?>
                </div>
            <?php endforeach; ?>

        <?php else: ?>

            <p class="text-on-surface-variant">
                No comments yet. Be the first to comment.
            </p>

        <?php endif; ?>

    </div>
