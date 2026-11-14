<?php
// Public / not public buttons for one article. Needs $row (a submissions row).
if (!isset($row) || !function_exists("visibility_label")) {
    http_response_code(404);
    exit;
}
$vis = $row["visibility"] ?? "public";
?>
<div class="vis-box" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px">
    <span style="font-size:13px;font-weight:700;padding:4px 10px;border-radius:999px;<?= $vis === "private" ? "background:#fef3c7;color:#92400e" : "background:#dcfce7;color:#166534" ?>">
        <?= e(visibility_label($vis)) ?>
    </span>
    <form method="POST" action="set_visibility.php" style="display:inline">
        <input type="hidden" name="submission_id" value="<?= (int)$row["id"] ?>">
        <input type="hidden" name="visibility" value="public">
        <button type="submit" <?= $vis === "public" ? "disabled" : "" ?>
            style="padding:7px 12px;border-radius:8px;border:1px solid #16a34a;font-size:13px;font-weight:600;<?= $vis === "public" ? "background:#16a34a;color:#fff;opacity:.6;cursor:default" : "background:#fff;color:#166534;cursor:pointer" ?>">
            ✓ Approve public · Публично
        </button>
    </form>
    <form method="POST" action="set_visibility.php" style="display:inline">
        <input type="hidden" name="submission_id" value="<?= (int)$row["id"] ?>">
        <input type="hidden" name="visibility" value="private">
        <button type="submit" <?= $vis === "private" ? "disabled" : "" ?>
            style="padding:7px 12px;border-radius:8px;border:1px solid #b45309;font-size:13px;font-weight:600;<?= $vis === "private" ? "background:#b45309;color:#fff;opacity:.6;cursor:default" : "background:#fff;color:#92400e;cursor:pointer" ?>">
            🔒 Not public · Не публично
        </button>
    </form>
    <?php if (!empty($row["visibility_by"])): ?>
        <span style="font-size:12px;color:#64748b">
            set by <?= e($row["visibility_by"]) ?><?= !empty($row["visibility_at"]) ? ", " . e(date("d.m.Y", strtotime($row["visibility_at"]))) : "" ?>
        </span>
    <?php endif; ?>
</div>
