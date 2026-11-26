<?php

// Study Hub (special-access accounts only): planner, tracker, SAT, IMO, IB grades, corrections.

require_once "config.php";

require_login();

$user_id = (int)$_SESSION["user_id"];

$stmt = $conn->prepare("SELECT id, fullname, free_access FROM users WHERE id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$me = $stmt->get_result()->fetch_assoc();

require_once "study_lib.php";
require_once "sat_bank_lib.php";
require_once "sat_course_lib.php";
require_once "health_lib.php";
require_once "cover_lib.php";
require_once "grades_lib.php";
require_once "transcript_lib.php";

$tabs = ["overview", "planner", "tracker", "sat", "satcourse", "satbank", "imo", "grades", "transcript", "corrections", "health"];
$tab = in_array($_GET["tab"] ?? "", $tabs, true) ? $_GET["tab"] : "overview";

// The SAT course is entirely in English, like the SAT itself
if ($tab === "satcourse") {
    $study_lang = "en";
}
$today = date("Y-m-d");

function study_head($title)
{
    global $study_lang;
    ?>
<!DOCTYPE html>
<html lang="<?= $study_lang ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($title) ?></title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-800">
    <?php
}

function lang_switch()
{
    global $study_lang, $tab;
    foreach (["en" => "EN", "ru" => "RU"] as $code => $label) {
        $active = $study_lang === $code;
        echo '<a href="?tab=' . e($tab) . '&lang=' . $code . '" class="px-2 py-1 rounded ' . ($active ? "bg-slate-900 text-white" : "bg-white border") . '">' . $label . '</a>';
    }
}

// ---------- special access only ----------

if (!$me || !$me["free_access"]) {
    http_response_code(403);
    study_head(t("hub"));
    ?>
    <div class="max-w-xl mx-auto py-16 px-6">
        <div class="flex justify-end gap-2 text-sm mb-4"><?php lang_switch(); ?></div>
        <div class="bg-white rounded-xl shadow p-8">
            <h1 class="text-2xl font-bold mb-3"><?= e(t("no_access_title")) ?></h1>
            <p class="text-slate-600 mb-6"><?= e(t("no_access_text")) ?></p>
            <a href="account-settings.php" class="inline-block bg-slate-900 text-white px-5 py-2 rounded-lg"><?= e(t("account_settings")) ?></a>
            <a href="dashboard.php" class="inline-block ml-3 text-blue-700"><?= e(t("back")) ?></a>
        </div>
    </div>
    </body></html>
    <?php
    exit;
}

// ---------- settings row ----------

$conn->query("INSERT IGNORE INTO study_settings (user_id) VALUES ($user_id)");
$settings_row = $conn->query("SELECT * FROM study_settings WHERE user_id = $user_id")->fetch_assoc();
seed_health_for_user($user_id, $study_lang);


// One task of the SAT task book
function render_bank_card(array $t, $p, $just_added = false)
{
    $status = $p["status"] ?? "";
    $border = ["correct" => "border-l-green-600", "wrong" => "border-l-red-600", "revealed" => "border-l-amber-500"][$status] ?? "border-l-slate-300";
    ?>
    <div id="task-<?= (int)$t["no"] ?>" class="bank-card bg-white rounded-lg border border-l-4 <?= $border ?> p-4">
        <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="font-mono font-bold">#<?= (int)$t["no"] ?></span>
            <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600"><?= e($t["area"]) ?> · <?= e($t["topic"]) ?></span>
            <?php if ($status === "correct"): ?><span class="ml-auto font-semibold text-green-700">✓ <?= e(t("right")) ?></span>
            <?php elseif ($status === "wrong"): ?><span class="ml-auto font-semibold text-red-700">✗ <?= e(t("wrong")) ?></span>
            <?php elseif ($status === "revealed"): ?><span class="ml-auto font-semibold text-amber-700"><?= e(t("revealed")) ?></span><?php endif; ?>
        </div>
        <p class="mt-2 leading-7"><?= e($t["question"]) ?></p>

        <?php $answer_form = function ($hidden) use ($t) { ?>
            <div class="bank-retry mt-3 flex flex-wrap gap-2 <?= $hidden ? "hidden" : "" ?>">
                <form method="POST" class="js-bank flex flex-wrap gap-2 flex-1">
                    <?= csrf_field() ?><input type="hidden" name="act" value="bank_check"><input type="hidden" name="no" value="<?= (int)$t["no"] ?>">
                    <input name="answer" required maxlength="100" autocomplete="off" placeholder="<?= e(t("your_answer")) ?>" class="border rounded-lg px-3 py-2 flex-1 min-w-[10rem]">
                    <button class="bg-slate-900 text-white px-4 py-2 rounded-lg"><?= e(t("check")) ?></button>
                </form>
            </div>
        <?php }; ?>

        <?php if (!$p): ?>
            <?php $answer_form(false); ?>
            <form method="POST" class="js-bank mt-2">
                <?= csrf_field() ?><input type="hidden" name="act" value="bank_reveal"><input type="hidden" name="no" value="<?= (int)$t["no"] ?>">
                <button class="text-sm text-slate-500 hover:underline"><?= e(t("show_solution")) ?></button>
            </form>
        <?php else: ?>
            <?php if (!empty($p["my_answer"])): ?>
                <p class="mt-2 text-sm"><span class="text-slate-500"><?= e(t("your_answer")) ?>:</span> <span class="font-mono"><?= e($p["my_answer"]) ?></span></p>
            <?php endif; ?>
            <div class="mt-2 p-3 rounded-lg <?= $status === "correct" ? "bg-green-50" : "bg-slate-50" ?> text-sm">
                <div><span class="font-semibold"><?= e(t("correct_answer")) ?>:</span> <span class="font-mono"><?= e($t["answer"]) ?></span></div>
                <?php if ($t["explanation"]): ?><div class="mt-1 text-slate-700"><?= e($t["explanation"]) ?></div><?php endif; ?>
            </div>
            <?php if ($status !== "correct"): ?>
                <div class="mt-3 flex flex-wrap gap-3 text-sm">
                    <button type="button" onclick="this.closest('.bank-card').querySelector('.bank-retry').classList.remove('hidden'); this.closest('.bank-card').querySelector('.bank-retry input[name=answer]').focus()" class="px-3 py-1 rounded-lg border"><?= e(t("try_again")) ?></button>
                    <?php if ($status === "wrong"): ?>
                        <form method="POST" class="js-bank"><?= csrf_field() ?><input type="hidden" name="act" value="bank_override"><input type="hidden" name="no" value="<?= (int)$t["no"] ?>">
                            <button class="px-3 py-1 rounded-lg border"><?= e(t("i_was_right")) ?></button></form>
                    <?php endif; ?>
                    <?php if ($just_added): ?>
                        <span class="px-3 py-1 text-green-700"><?= e(t("added")) ?> ✓</span>
                    <?php else: ?>
                        <form method="POST" class="js-bank"><?= csrf_field() ?><input type="hidden" name="act" value="bank_to_correction"><input type="hidden" name="no" value="<?= (int)$t["no"] ?>">
                            <button class="px-3 py-1 rounded-lg border"><?= e(t("to_corrections")) ?></button></form>
                    <?php endif; ?>
                </div>
                <?php $answer_form(true); ?>
            <?php endif; ?>
        <?php endif; ?>
    </div>
    <?php
}

// One task of the SAT course (lesson practice or task-book warm-up)
function render_course_item(array $it, $row, $lesson_id, $n)
{
    $status = $row["status"] ?? "";
    $border = ["correct" => "border-l-green-600", "wrong" => "border-l-red-600", "revealed" => "border-l-amber-500"][$status] ?? "border-l-slate-300";
    $id = "ci-" . preg_replace('/[^a-z0-9-]/', '', $it["key"]);
    $hidden = '<input type="hidden" name="key" value="' . e($it["key"]) . '"><input type="hidden" name="lesson" value="' . e($lesson_id) . '">';
    ?>
    <div id="<?= $id ?>" class="course-card bg-white rounded-lg border border-l-4 <?= $border ?> p-4">
        <div class="flex gap-3">
            <span class="text-sm text-slate-400 shrink-0 w-6"><?= (int)$n ?>.</span>
            <div class="flex-1 min-w-0">
                <div class="whitespace-pre-line"><?= e($it["q"]) ?></div>
                <?php if ($status !== "correct" && $status !== "revealed"): ?>
                    <form method="POST" class="js-course mt-3">
                        <?= csrf_field() ?><input type="hidden" name="act" value="course_check"><?= $hidden ?>
                        <?php if (!empty($it["opts"])): ?>
                            <div class="grid sm:grid-cols-2 gap-2">
                                <?php foreach ($it["opts"] as $i => $o): $letter = "ABCD"[$i]; ?>
                                    <button name="answer" value="<?= $letter ?>" class="text-left px-3 py-2 rounded-lg border hover:bg-slate-50 <?= ($row["my_answer"] ?? "") === $letter ? "border-red-400 bg-red-50" : "" ?>"><b><?= $letter ?>)</b> <?= e($o === "" ? "(no punctuation)" : $o) ?></button>
                                <?php endforeach; ?>
                            </div>
                        <?php else: ?>
                            <div class="flex gap-2">
                                <input name="answer" required maxlength="100" autocomplete="off" placeholder="<?= e(t("your_answer")) ?>" class="border rounded-lg px-3 py-2 flex-1 min-w-0">
                                <button class="bg-slate-900 text-white px-4 py-2 rounded-lg"><?= e(t("check")) ?></button>
                            </div>
                        <?php endif; ?>
                    </form>
                    <div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
                        <?php if ($status === "wrong"): ?><span class="text-red-700 font-semibold">✗ <?= e(t("wrong")) ?> (<?= e($row["my_answer"]) ?>) — <?= e(t("try_again")) ?></span><?php endif; ?>
                        <form method="POST" class="js-course"><?= csrf_field() ?><input type="hidden" name="act" value="course_reveal"><?= $hidden ?>
                            <button class="text-slate-500 underline"><?= e(t("show_solution")) ?></button></form>
                    </div>
                <?php else: ?>
                    <div class="mt-3 rounded-lg p-3 text-sm <?= $status === "correct" ? "bg-green-50" : "bg-amber-50" ?>">
                        <div class="font-semibold <?= $status === "correct" ? "text-green-800" : "text-amber-800" ?>">
                            <?= $status === "correct" ? "✓ " . e(t("right")) : e(t("revealed")) ?> · <?= e(t("correct_answer")) ?>: <?= e($it["a"]) ?><?php if (!empty($it["opts"])): ?>) <?= e($it["opts"][strpos("ABCD", $it["a"])] ?: "(no punctuation)") ?><?php endif; ?>
                        </div>
                        <?php if ($it["why"] !== ""): ?><div class="mt-1 whitespace-pre-line text-slate-700"><?= e($it["why"]) ?></div><?php endif; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <?php
}

// Short module title from the book's section names
function bank_module_title($sections)
{
    $parts = array_map(function ($s) {
        $s = preg_replace('/\s*\(\d+\)$/', '', $s);
        return preg_replace('/\s*·\s*\d+\s*questions.*$/i', '', $s);
    }, array_filter(explode("|", (string)$sections)));
    return implode(" + ", array_unique($parts));
}

// =================================================================
// ACTIONS
// =================================================================

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    check_csrf();

    $act = (string)($_POST["act"] ?? "");
    $id = (int)($_POST["id"] ?? 0);
    $anchor = "";

    // Run a prepared statement that always includes "AND user_id = ?" last
    $run = function ($sql, $types, ...$params) use ($conn) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        return $stmt;
    };

    // ----- SAT course: answers by fetch() (JSON back), tests -----
    if ($act === "course_check" || $act === "course_reveal") {
        $key = (string)($_POST["key"] ?? "");
        $lesson = course_lesson((string)($_POST["lesson"] ?? ""));
        $item = course_item($key);
        $ajax = ($_SERVER["HTTP_X_REQUESTED_WITH"] ?? "") === "fetch";
        [$answers, $tests] = course_progress($user_id);
        $step = null;
        if ($lesson) {
            foreach (course_state($lesson["track"], $answers, $tests) as $s) {
                if ($s["id"] === $lesson["id"]) { $step = $s; }
            }
        }
        // Only practice and warm-up tasks of an open lesson (test tasks are answered in tests)
        $allowed = $item && $step && $step["open"] && (in_array($key, array_column($lesson["practice"], "key"), true)
            || in_array($key, array_column(course_warmup($lesson), "key"), true));
        if (!$allowed) {
            http_response_code(403);
            die(e(t("c_locked")));
        }
        $row = $answers[$key] ?? null;
        if ($act === "course_check" && (!$row || $row["status"] === "wrong")) {
            $given = study_text($_POST["answer"] ?? "", 100);
            if ($given !== "") {
                $status = sat_check_answer($given, $item["a"]) ? "correct" : "wrong";
                $run("INSERT INTO study_course_answers (user_id, item_key, status, attempts, my_answer) VALUES (?, ?, ?, 1, ?)
                      ON DUPLICATE KEY UPDATE status = VALUES(status), attempts = attempts + 1, my_answer = VALUES(my_answer)", "isss", $user_id, $key, $status, $given);
            }
        } elseif ($act === "course_reveal" && (!$row || $row["status"] === "wrong")) {
            $run("INSERT INTO study_course_answers (user_id, item_key, status, attempts) VALUES (?, ?, 'revealed', 0)
                  ON DUPLICATE KEY UPDATE status = 'revealed'", "is", $user_id, $key);
        }
        if ($ajax) {
            [$answers, $tests] = course_progress($user_id);
            $state = null;
            foreach (course_state($lesson["track"], $answers, $tests) as $s) {
                if ($s["id"] === $lesson["id"]) { $state = $s; }
            }
            $n = (int)($_POST["n"] ?? 0);
            ob_start();
            render_course_item($item, $answers[$key] ?? null, $lesson["id"], $n);
            header("Content-Type: application/json; charset=UTF-8");
            echo json_encode(["id" => "ci-" . preg_replace('/[^a-z0-9-]/', '', $key), "html" => ob_get_clean(),
                              "answered" => $state["answered"], "correct" => $state["correct"], "total" => $state["total"], "done" => $state["done"]]);
            exit;
        }
        redirect("study.php?tab=satcourse&lesson=" . $lesson["id"] . "#ci-" . preg_replace('/[^a-z0-9-]/', '', $key));
    }

    if ($act === "course_test") {
        $test_id = (string)($_POST["test"] ?? "");
        $track = str_starts_with($test_id, "m-") ? "math" : "english";
        [$answers, $tests] = course_progress($user_id);
        $step = null;
        foreach (course_state($track, $answers, $tests) as $s) {
            if ($s["id"] === $test_id && $s["type"] === "test") { $step = $s; }
        }
        if (!$step || !$step["open"]) {
            http_response_code(403);
            die(e(t("c_locked")));
        }
        $given = [];
        $score = 0;
        foreach ($step["items"] as $key) {
            $g = study_text(((array)($_POST["ans"] ?? []))[$key] ?? "", 100);
            $given[$key] = $g;
            $score += ($g !== "" && sat_check_answer($g, course_item($key)["a"])) ? 1 : 0;
        }
        $total = count($step["items"]);
        $json = json_encode($given, JSON_UNESCAPED_UNICODE);
        $run("INSERT INTO study_course_tests (user_id, test_key, last_score, best_score, total, attempts, answers) VALUES (?, ?, ?, ?, ?, 1, ?)
              ON DUPLICATE KEY UPDATE last_score = VALUES(last_score), best_score = GREATEST(best_score, VALUES(best_score)), total = VALUES(total), attempts = attempts + 1, answers = VALUES(answers)",
            "isiiis", $user_id, $test_id, $score, $score, $total, $json);
        redirect("study.php?tab=satcourse&test=" . rawurlencode($test_id));
    }

    // ----- SAT task book (answers may come by fetch() and get JSON back) -----
    if (str_starts_with($act, "bank_")) {
        $no = (int)($_POST["no"] ?? 0);
        $ajax = ($_SERVER["HTTP_X_REQUESTED_WITH"] ?? "") === "fetch";

        if ($act === "bank_import") {
            $allowed = sat_bank_count() === 0 || current_user_role() === "editor";
            $file = $_FILES["bank_file"] ?? null;
            if (!$allowed) {
                $_SESSION["bank_flash"] = "Only editors can replace the task book.";
            } elseif (!$file || $file["error"] !== UPLOAD_ERR_OK || $file["size"] > 10 * 1024 * 1024) {
                $_SESSION["bank_flash"] = "Please choose the task book file (up to 10 MB).";
            } else {
                $result = sat_import_bank(file_get_contents($file["tmp_name"]));
                $_SESSION["bank_flash"] = is_int($result) ? t("bank_imported") . " " . $result . " " . t("tasks_word") : $result;
            }
            redirect("study.php?tab=satbank");
        }

        $task = $run("SELECT * FROM sat_bank WHERE no = ?", "i", $no)->get_result()->fetch_assoc();
        if (!$task) {
            http_response_code(404);
            die("Task not found.");
        }

        $modules = sat_modules($user_id);
        if (empty($modules[sat_module_of($no)]["unlocked"])) {
            http_response_code(403);
            die(e(t("module_locked_text")));
        }

        $row = $run("SELECT * FROM study_sat_bank_progress WHERE user_id = ? AND task_no = ?", "ii", $user_id, $no)->get_result()->fetch_assoc();

        if ($act === "bank_check") {
            $given = study_text($_POST["answer"] ?? "", 100);
            if ($given !== "" && (!$row || $row["status"] !== "correct")) {
                $correct = sat_check_answer($given, $task["answer"]);
                $status = $correct ? "correct" : "wrong";
                // XP: 10 for the first try, 5 after a mistake, none after viewing the solution
                $xp = !$correct ? 0 : (!$row ? SAT_XP_FIRST_TRY : ($row["status"] === "wrong" ? SAT_XP_LATER : 0));
                $run("INSERT INTO study_sat_bank_progress (user_id, task_no, status, attempts, my_answer, xp) VALUES (?, ?, ?, 1, ?, ?)
                      ON DUPLICATE KEY UPDATE status = VALUES(status), attempts = attempts + 1, my_answer = VALUES(my_answer), xp = xp + VALUES(xp)",
                    "iissi", $user_id, $no, $status, $given, $xp);
            }
        } elseif ($act === "bank_reveal" && !$row) {
            $run("INSERT INTO study_sat_bank_progress (user_id, task_no, status, attempts, xp) VALUES (?, ?, 'revealed', 0, 0)", "ii", $user_id, $no);
        } elseif ($act === "bank_override" && $row && $row["status"] === "wrong") {
            $xp = SAT_XP_LATER;
            $run("UPDATE study_sat_bank_progress SET status = 'correct', xp = xp + ? WHERE user_id = ? AND task_no = ?", "iii", $xp, $user_id, $no);
        } elseif ($act === "bank_to_correction" && $row && $row["status"] !== "correct") {
            $mistake = "SAT #" . $no . ": " . $task["question"] . ($row["my_answer"] ? "\n" . t("your_answer") . ": " . $row["my_answer"] : "");
            $exists = $run("SELECT COUNT(*) AS n FROM study_corrections WHERE user_id = ? AND mistake LIKE CONCAT(?, '%')", "is", $user_id, "SAT #" . $no . ":")->get_result()->fetch_assoc()["n"];
            if (!$exists) {
                $subject = "SAT " . $task["area"];
                $correction = t("correct_answer") . ": " . $task["answer"] . "\n" . $task["explanation"];
                $next = date("Y-m-d", strtotime("+1 day"));
                $run("INSERT INTO study_corrections (subject, topic, mistake, correction, next_review, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                    "sssssi", $subject, $task["topic"], $mistake, $correction, $next, $user_id);
            }
        }

        if ($ajax) {
            $row = $run("SELECT * FROM study_sat_bank_progress WHERE user_id = ? AND task_no = ?", "ii", $user_id, $no)->get_result()->fetch_assoc();
            $player = sat_player($user_id);
            $module = sat_modules($user_id)[sat_module_of($no)];
            ob_start();
            render_bank_card($task, $row, $act === "bank_to_correction");
            header("Content-Type: application/json; charset=UTF-8");
            echo json_encode([
                "no" => $no,
                "status" => $row["status"] ?? "",
                "html" => ob_get_clean(),
                "xp" => (int)$player["xp"],
                "level" => (int)$player["level"],
                "level_xp" => (int)$player["level_xp"],
                "today" => (int)$player["today"],
                "answered" => (int)$module["answered"],
                "correct" => (int)$module["correct"],
            ]);
            exit;
        }

        redirect("study.php?tab=satbank&module=" . sat_module_of($no) . "#task-" . $no);
    }

    // ----- Cover at the top of the hub (own photo or a ready-made one) -----
    if (str_starts_with($act, "cover_")) {
        $old = $settings_row["cover_file"] ?? null;
        if ($act === "cover_upload") {
            $file = save_cover_upload();
            if ($file) {
                $pos = array_key_exists($_POST["cover_pos"] ?? "", COVER_POSITIONS) ? $_POST["cover_pos"] : "center";
                $run("UPDATE study_settings SET cover_file = ?, cover_preset = NULL, cover_pos = ? WHERE user_id = ?", "ssi", $file, $pos, $user_id);
                delete_cover_file($old);
            } else {
                $_SESSION["cover_flash"] = t("cover_bad");
            }
        } elseif ($act === "cover_preset" && isset(COVER_PRESETS[$_POST["preset"] ?? ""])) {
            $preset = $_POST["preset"];
            $run("UPDATE study_settings SET cover_file = NULL, cover_preset = ? WHERE user_id = ?", "si", $preset, $user_id);
            delete_cover_file($old);
        } elseif ($act === "cover_pos" && array_key_exists($_POST["cover_pos"] ?? "", COVER_POSITIONS)) {
            $pos = $_POST["cover_pos"];
            $run("UPDATE study_settings SET cover_pos = ? WHERE user_id = ?", "si", $pos, $user_id);
        } elseif ($act === "cover_remove") {
            $run("UPDATE study_settings SET cover_file = NULL, cover_preset = NULL WHERE user_id = ?", "i", $user_id);
            delete_cover_file($old);
        }
        redirect("study.php?tab=" . $tab);
    }

    // ----- Health: habits and workout checklist (ticks may come by fetch() and get JSON back) -----
    if (str_starts_with($act, "health_")) {
        $day = health_day($_POST["day"] ?? "");
        $ajax = ($_SERVER["HTTP_X_REQUESTED_WITH"] ?? "") === "fetch";
        $is_habit = ($_POST["kind"] ?? "") === "habit";
        $table = $is_habit ? "study_habits" : "study_exercises";
        $log = $is_habit ? "study_habit_log" : "study_exercise_log";
        $column = $is_habit ? "habit_id" : "exercise_id";
        $block = array_key_exists($_POST["block"] ?? "", WORKOUT_BLOCKS) ? $_POST["block"] : "core";
        $name = study_text($_POST["name"] ?? "", 120);
        $target = study_text($_POST["target"] ?? "", 60);
        $weight = study_text($_POST["weight"] ?? "", 30);
        $owned = $id > 0 && $run("SELECT id FROM $table WHERE id = ? AND user_id = ?", "ii", $id, $user_id)->get_result()->fetch_assoc();
        $result = [];

        if ($act === "health_tick" && $owned) {
            $done = $run("DELETE FROM $log WHERE $column = ? AND log_date = ? AND user_id = ?", "isi", $id, $day, $user_id)->affected_rows === 0;
            if ($done) {
                $run("INSERT IGNORE INTO $log ($column, log_date, user_id) VALUES (?, ?, ?)", "isi", $id, $day, $user_id);
            }
            $dates = array_column($run("SELECT log_date FROM $log WHERE $column = ? AND user_id = ?", "ii", $id, $user_id)->get_result()->fetch_all(MYSQLI_ASSOC), "log_date");
            $result = ["id" => $id, "kind" => $is_habit ? "habit" : "exercise", "done" => $done, "streak" => health_streak($dates, date("Y-m-d"))];
            if (!$is_habit) {
                $result["ex_done"] = (int)$run("SELECT COUNT(*) AS n FROM study_exercise_log WHERE log_date = ? AND user_id = ?", "si", $day, $user_id)->get_result()->fetch_assoc()["n"];
                $result["ex_total"] = (int)$run("SELECT COUNT(*) AS n FROM study_exercises WHERE user_id = ?", "i", $user_id)->get_result()->fetch_assoc()["n"];
            }
            $anchor = "#" . $result["kind"] . "-" . $id;
        } elseif ($act === "health_weight" && $owned && !$is_habit) {
            $run("UPDATE study_exercises SET weight = ? WHERE id = ? AND user_id = ?", "sii", $weight, $id, $user_id);
            $result = ["id" => $id, "weight" => $weight];
            $anchor = "#exercise-" . $id;
        } elseif ($act === "health_add" && $name !== "") {
            $sort = (int)$run("SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM $table WHERE user_id = ?", "i", $user_id)->get_result()->fetch_assoc()["n"];
            if ($is_habit) {
                $run("INSERT INTO study_habits (name, sort, user_id) VALUES (?, ?, ?)", "sii", $name, $sort, $user_id);
            } else {
                $run("INSERT INTO study_exercises (block, name, target, weight, sort, user_id) VALUES (?, ?, ?, ?, ?, ?)", "ssssii", $block, $name, $target, $weight, $sort, $user_id);
            }
            $anchor = "#manage";
        } elseif ($act === "health_save" && $owned && $name !== "") {
            if ($is_habit) {
                $run("UPDATE study_habits SET name = ? WHERE id = ? AND user_id = ?", "sii", $name, $id, $user_id);
            } else {
                $run("UPDATE study_exercises SET block = ?, name = ?, target = ?, weight = ? WHERE id = ? AND user_id = ?", "ssssii", $block, $name, $target, $weight, $id, $user_id);
            }
            $anchor = "#manage";
        } elseif ($act === "health_delete" && $owned) {
            $run("DELETE FROM $table WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            $anchor = "#manage";
        }

        if ($ajax) {
            header("Content-Type: application/json; charset=UTF-8");
            echo json_encode($result ?: ["error" => true]);
            exit;
        }

        redirect("study.php?tab=health" . ($day !== date("Y-m-d") ? "&day=" . $day : "") . $anchor);
    }

    switch ($act) {

        // ----- planner -----
        case "task_add":
        case "task_save":
            $title = study_text($_POST["title"] ?? "", 200);
            $notes = study_text($_POST["notes"] ?? "", 2000);
            $due = study_date($_POST["due_date"] ?? "");
            $priority = in_array($_POST["priority"] ?? "", ["high", "normal", "low"], true) ? $_POST["priority"] : "normal";
            $category = in_array($_POST["category"] ?? "", ["general", "sat", "imo", "ib", "other"], true) ? $_POST["category"] : "general";
            if ($title !== "") {
                if ($act === "task_add") {
                    $run("INSERT INTO study_tasks (title, notes, due_date, priority, category, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                        "sssssi", $title, $notes, $due, $priority, $category, $user_id);
                } else {
                    $run("UPDATE study_tasks SET title = ?, notes = ?, due_date = ?, priority = ?, category = ? WHERE id = ? AND user_id = ?",
                        "sssssii", $title, $notes, $due, $priority, $category, $id, $user_id);
                }
            }
            break;

        case "task_toggle":
            $run("UPDATE study_tasks SET is_done = 1 - is_done, done_at = IF(is_done = 1, NULL, NOW()) WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            break;

        case "task_delete":
            $run("DELETE FROM study_tasks WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            break;

        // ----- tracker -----
        case "session_add":
            $date = study_date($_POST["session_date"] ?? "") ?? $today;
            $minutes = study_int($_POST["minutes"] ?? "", 1, 1440);
            $subject = in_array($_POST["subject"] ?? "", STUDY_SUBJECTS, true) ? $_POST["subject"] : "other";
            $note = study_text($_POST["note"] ?? "", 255);
            if ($minutes && $date <= $today) {
                $run("INSERT INTO study_sessions (session_date, minutes, subject, note, user_id) VALUES (?, ?, ?, ?, ?)",
                    "sissi", $date, $minutes, $subject, $note, $user_id);
            }
            break;

        case "session_delete":
            $run("DELETE FROM study_sessions WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            break;

        case "goal_save":
            $goal = study_int($_POST["weekly_goal_minutes"] ?? "", 30, 10080);
            if ($goal) {
                $run("UPDATE study_settings SET weekly_goal_minutes = ? WHERE user_id = ?", "ii", $goal, $user_id);
            }
            break;

        // ----- SAT -----
        case "sat_goal_save":
            $target = study_int($_POST["sat_target"] ?? "", 400, 1600);
            $exam = study_date($_POST["sat_exam_date"] ?? "");
            $run("UPDATE study_settings SET sat_target = ?, sat_exam_date = ? WHERE user_id = ?", "isi", $target, $exam, $user_id);
            break;

        case "sat_test_add":
            $date = study_date($_POST["test_date"] ?? "") ?? $today;
            $name = study_text($_POST["name"] ?? "", 120);
            $rw = study_int($_POST["rw_score"] ?? "", 200, 800);
            $math = study_int($_POST["math_score"] ?? "", 200, 800);
            $note = study_text($_POST["note"] ?? "", 255);
            if ($name !== "" && $rw && $math) {
                $run("INSERT INTO study_sat_tests (test_date, name, rw_score, math_score, note, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                    "ssiisi", $date, $name, $rw, $math, $note, $user_id);
            }
            break;

        case "sat_test_delete":
            $run("DELETE FROM study_sat_tests WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            break;

        // ----- topic progress (SAT and IMO) -----
        case "topic_save":
            $track = ($_POST["track"] ?? "") === "imo" ? "imo" : "sat";
            $key = (string)($_POST["topic_key"] ?? "");
            $all = $track === "sat" ? array_merge(...array_values(SAT_TOPICS)) : array_merge(...array_values(IMO_TOPICS));
            $status = study_int($_POST["status"] ?? "", 0, 2) ?? 0;
            $note = study_text($_POST["note"] ?? "", 255);
            $url = study_text($_POST["resource_url"] ?? "", 500);
            if ($url !== "" && !preg_match('~^https?://~i', $url)) {
                $url = "";
            }
            if (isset($all[$key])) {
                $run("INSERT INTO study_topic_progress (user_id, track, topic_key, status, note, resource_url) VALUES (?, ?, ?, ?, ?, ?)
                      ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), resource_url = VALUES(resource_url)",
                    "ississ", $user_id, $track, $key, $status, $note, $url);
                $anchor = "#topic-" . $key;
            }
            break;

        // ----- IMO problems -----
        case "imo_add":
            $area = isset(IMO_AREAS[$_POST["area"] ?? ""]) ? $_POST["area"] : "algebra";
            $source = study_text($_POST["source"] ?? "", 150);
            $difficulty = study_int($_POST["difficulty"] ?? "", 1, 5) ?? 3;
            $status = in_array($_POST["status"] ?? "", ["solved", "partial", "unsolved"], true) ? $_POST["status"] : "solved";
            $idea = study_text($_POST["key_idea"] ?? "", 3000);
            $solved_on = study_date($_POST["solved_on"] ?? "") ?? $today;
            if ($source !== "") {
                $run("INSERT INTO study_imo_problems (area, source, difficulty, status, key_idea, solved_on, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "ssisssi", $area, $source, $difficulty, $status, $idea, $solved_on, $user_id);
            }
            break;

        case "imo_status":
            $status = in_array($_POST["status"] ?? "", ["solved", "partial", "unsolved"], true) ? $_POST["status"] : "solved";
            $run("UPDATE study_imo_problems SET status = ? WHERE id = ? AND user_id = ?", "sii", $status, $id, $user_id);
            break;

        case "imo_delete":
            $run("DELETE FROM study_imo_problems WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            break;

        // ----- IB subjects and assessments -----
        case "ib_subject_add":
        case "ib_subject_save":
            $name = study_text($_POST["name"] ?? "", 100);
            $level = ($_POST["level"] ?? "") === "HL" ? "HL" : "SL";
            $bounds = ib_boundaries_from_input($_POST["boundaries"] ?? "") ?? "0,6,10,15,19,24,28";
            if ($name !== "") {
                if ($act === "ib_subject_add") {
                    $run("INSERT INTO study_ib_subjects (name, level, boundaries, user_id) VALUES (?, ?, ?, ?)", "sssi", $name, $level, $bounds, $user_id);
                } else {
                    $run("UPDATE study_ib_subjects SET name = ?, level = ?, boundaries = ? WHERE id = ? AND user_id = ?", "sssii", $name, $level, $bounds, $id, $user_id);
                }
            }
            break;

        // ----- transcript: finished semester grades of all years -----
        case "tr_save":
            $g = (int)($_POST["grade_level"] ?? 0);
            $sem = (int)($_POST["semester"] ?? 0);
            if (in_array($g, TRANSCRIPT_GRADES, true) && in_array($sem, [1, 2], true)) {
                foreach ((array)($_POST["subj"] ?? []) as $i => $subject) {
                    $subject = study_text($subject, 100);
                    $mark = study_int(((array)($_POST["mark"] ?? []))[$i] ?? "", 1, 7);
                    if ($subject === "") {
                        continue;
                    }
                    if ($mark === null) {
                        $run("DELETE FROM study_past_grades WHERE grade_level = ? AND semester = ? AND subject = ? AND user_id = ?", "iisi", $g, $sem, $subject, $user_id);
                    } else {
                        $run("INSERT INTO study_past_grades (grade_level, semester, subject, mark, user_id) VALUES (?, ?, ?, ?, ?)
                              ON DUPLICATE KEY UPDATE mark = VALUES(mark)", "iisii", $g, $sem, $subject, $mark, $user_id);
                    }
                }
                $anchor = "&g=" . $g . "&s=" . $sem . "#enter";
            }
            break;

        case "tr_current":
            $g = (int)($_POST["current_grade"] ?? 10);
            if (in_array($g, TRANSCRIPT_GRADES, true)) {
                $run("UPDATE study_settings SET current_grade = ? WHERE user_id = ?", "ii", $g, $user_id);
            }
            break;

        case "gpa_goal":
            $goal = round(min(4, max(0, (float)str_replace(",", ".", (string)($_POST["gpa_goal"] ?? "3.9")))), 2);
            $goal_name = study_text($_POST["gpa_goal_name"] ?? "", 60);
            $goal_name = $goal_name !== "" ? $goal_name : "Harvard";
            $run("UPDATE study_settings SET gpa_goal = ?, gpa_goal_name = ? WHERE user_id = ?", "dsi", $goal, $goal_name, $user_id);
            $anchor = "&term=" . (in_array($_POST["term"] ?? "", ["0", "1", "2"], true) ? $_POST["term"] : "1");
            break;

        case "ib_seed_nis":
            $names = array_column($run("SELECT name FROM study_ib_subjects WHERE user_id = ?", "i", $user_id)->get_result()->fetch_all(MYSQLI_ASSOC), "name");
            foreach (nis_missing_subjects($names) as $pair) {
                $name = tl($pair);
                $run("INSERT INTO study_ib_subjects (name, level, user_id) VALUES (?, 'SL', ?)", "si", $name, $user_id);
            }
            break;

        case "ib_subject_delete":
            $run("DELETE FROM study_ib_subjects WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            break;

        case "ib_assess_add":
        case "ib_assess_save":
            $subject_id = (int)($_POST["subject_id"] ?? 0);
            $own = $run("SELECT id FROM study_ib_subjects WHERE id = ? AND user_id = ?", "ii", $subject_id, $user_id)->get_result()->fetch_assoc();
            $title = study_text($_POST["title"] ?? "", 200);
            $kind = isset(IB_KINDS[$_POST["kind"] ?? ""]) ? $_POST["kind"] : "summative";
            $due = study_date($_POST["due_date"] ?? "");
            $term = in_array($_POST["term"] ?? "", ["1", "2"], true) ? (int)$_POST["term"] : ib_term_of($due);
            $status = in_array($_POST["status"] ?? "", ["todo", "submitted", "graded"], true) ? $_POST["status"] : "todo";
            $ca = study_int($_POST["crit_a"] ?? "", 0, 8);
            $cb = study_int($_POST["crit_b"] ?? "", 0, 8);
            $cc = study_int($_POST["crit_c"] ?? "", 0, 8);
            $cd = study_int($_POST["crit_d"] ?? "", 0, 8);
            $feedback = study_text($_POST["feedback"] ?? "", 3000);
            if ($ca !== null || $cb !== null || $cc !== null || $cd !== null) {
                $status = "graded";
            }
            if ($own && $title !== "") {
                if ($act === "ib_assess_add") {
                    $run("INSERT INTO study_ib_assessments (subject_id, title, kind, due_date, term, status, crit_a, crit_b, crit_c, crit_d, feedback, user_id)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        "isssisiiiisi", $subject_id, $title, $kind, $due, $term, $status, $ca, $cb, $cc, $cd, $feedback, $user_id);
                    $anchor = "&term=" . $term;
                } else {
                    $run("UPDATE study_ib_assessments SET subject_id = ?, title = ?, kind = ?, due_date = ?, term = ?, status = ?, crit_a = ?, crit_b = ?, crit_c = ?, crit_d = ?, feedback = ?
                          WHERE id = ? AND user_id = ?",
                        "isssisiiiisii", $subject_id, $title, $kind, $due, $term, $status, $ca, $cb, $cc, $cd, $feedback, $id, $user_id);
                    $anchor = "&term=" . $term . "#assess-" . $id;
                }
            }
            break;

        case "ib_assess_delete":
            $run("DELETE FROM study_ib_assessments WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            break;

        // ----- corrections -----
        case "corr_add":
            $subject = study_text($_POST["subject"] ?? "", 60);
            $topic = study_text($_POST["topic"] ?? "", 120);
            $mistake = study_text($_POST["mistake"] ?? "", 3000);
            $correction = study_text($_POST["correction"] ?? "", 3000);
            $next = date("Y-m-d", strtotime("+1 day"));
            if ($subject !== "" && $mistake !== "" && $correction !== "") {
                $run("INSERT INTO study_corrections (subject, topic, mistake, correction, next_review, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                    "sssssi", $subject, $topic, $mistake, $correction, $next, $user_id);
            }
            break;

        case "corr_review":
            $row = $run("SELECT review_stage FROM study_corrections WHERE id = ? AND user_id = ?", "ii", $id, $user_id)->get_result()->fetch_assoc();
            if ($row) {
                if (($_POST["result"] ?? "") === "ok") {
                    $stage = (int)$row["review_stage"] + 1;
                    $mastered = $stage >= count(CORRECTION_INTERVALS) ? 1 : 0;
                    $days = CORRECTION_INTERVALS[min($stage, count(CORRECTION_INTERVALS) - 1)];
                } else {
                    $stage = 0;
                    $mastered = 0;
                    $days = 1;
                }
                $next = date("Y-m-d", strtotime("+$days day"));
                $run("UPDATE study_corrections SET review_stage = ?, mastered = ?, next_review = ? WHERE id = ? AND user_id = ?",
                    "iisii", $stage, $mastered, $next, $id, $user_id);
            }
            break;

        case "corr_delete":
            $run("DELETE FROM study_corrections WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            break;
    }

    redirect("study.php?tab=" . $tab . $anchor);
}


// =================================================================
// DATA used on several tabs
// =================================================================

$q = function ($sql, $types = "", ...$params) use ($conn) {
    $stmt = $conn->prepare($sql);
    if ($types !== "") {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
};

$week_start = date("Y-m-d", strtotime("monday this week"));
$week_minutes = (int)($q("SELECT COALESCE(SUM(minutes), 0) AS m FROM study_sessions WHERE user_id = ? AND session_date >= ?", "is", $user_id, $week_start)[0]["m"]);
$goal = (int)$settings_row["weekly_goal_minutes"];

// Streak: days in a row with a study session, ending today (or yesterday if nothing yet today)
$days = array_column($q("SELECT DISTINCT session_date FROM study_sessions WHERE user_id = ? AND session_date > ? - INTERVAL 400 DAY ORDER BY session_date DESC", "is", $user_id, $today), "session_date");
$streak = 0;
$cursor = in_array($today, $days, true) ? $today : date("Y-m-d", strtotime("-1 day"));
$day_set = array_flip($days);
while (isset($day_set[$cursor])) {
    $streak++;
    $cursor = date("Y-m-d", strtotime($cursor . " -1 day"));
}

$subject_names = ["sat" => "SAT", "imo" => "IMO", "ib" => "IB", "other" => t("other"), "general" => t("general")];

$card = "bg-white rounded-xl border p-5";
$input = "border rounded-lg px-3 py-2 w-full";
$btn = "bg-slate-900 text-white px-4 py-2 rounded-lg";

study_head(t("hub") . " · " . $site_name);
?>

<div class="max-w-6xl mx-auto py-8 px-4 md:px-6">

    <div class="flex flex-wrap justify-between items-center gap-3">
        <a href="dashboard.php" class="text-blue-700 hover:underline">← <?= e(t("back")) ?></a>
        <div class="flex gap-2 text-sm"><?php if ($tab !== "satcourse") { lang_switch(); } ?></div>
    </div>

    <?php $cover = cover_background($settings_row); $cover_flash = $_SESSION["cover_flash"] ?? null; unset($_SESSION["cover_flash"]); ?>
    <?php if ($cover): ?>
        <header id="hub-cover" class="relative mt-4 mb-6 rounded-2xl overflow-hidden h-44 md:h-60 shadow-sm" style="background: <?= e($cover) ?>">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
            <button type="button" onclick="document.getElementById('cover-dialog').showModal()" class="absolute top-3 right-3 bg-white/85 backdrop-blur text-slate-900 text-sm px-3 py-1.5 rounded-full shadow hover:bg-white">✎ <?= e(t("cover_change")) ?></button>
            <div class="absolute bottom-0 left-0 right-0 p-5 md:p-7 text-white">
                <h1 class="text-3xl md:text-4xl font-bold drop-shadow"><?= e(t("hub")) ?></h1>
                <p class="text-white/85 drop-shadow"><?= e(t("hub_hint")) ?></p>
            </div>
        </header>
    <?php else: ?>
        <div class="flex flex-wrap justify-between items-end gap-3 mt-4 mb-6">
            <div>
                <h1 class="text-3xl font-bold"><?= e(t("hub")) ?></h1>
                <p class="text-slate-600"><?= e(t("hub_hint")) ?></p>
            </div>
            <button type="button" onclick="document.getElementById('cover-dialog').showModal()" class="text-sm px-3 py-1.5 rounded-full border bg-white hover:bg-slate-50">🖼 <?= e(t("cover_add")) ?></button>
        </div>
    <?php endif; ?>
    <?php if ($cover_flash): ?><p class="mb-4 text-red-700"><?= e($cover_flash) ?></p><?php endif; ?>

    <dialog id="cover-dialog" class="rounded-2xl p-0 w-[min(36rem,calc(100vw-2rem))] backdrop:bg-black/50">
        <div class="p-5 space-y-5">
            <div class="flex justify-between items-center">
                <h2 class="font-bold text-lg"><?= e(t("cover")) ?></h2>
                <form method="dialog"><button class="text-slate-500 px-2" aria-label="<?= e(t("cover_close")) ?>">✕</button></form>
            </div>

            <div id="cover-preview" class="h-32 rounded-xl border bg-slate-100" style="<?= $cover ? "background: " . e($cover) : "" ?>"></div>

            <form method="POST" enctype="multipart/form-data" class="space-y-3">
                <?= csrf_field() ?><input type="hidden" name="act" value="cover_upload">
                <div class="font-medium"><?= e(t("cover_photo")) ?></div>
                <input type="file" name="cover_file" id="cover-file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" required class="w-full border rounded-lg px-3 py-2">
                <div class="text-xs text-slate-500"><?= e(t("cover_photo_hint")) ?></div>
                <div class="text-sm"><?= e(t("cover_pos")) ?>:
                    <?php foreach (COVER_POSITIONS as $key => $label): ?>
                        <label class="ml-2 whitespace-nowrap"><input type="radio" name="cover_pos" value="<?= $key ?>" <?= ($settings_row["cover_pos"] ?? "center") === $key ? "checked" : "" ?>> <?= e(tl($label)) ?></label>
                    <?php endforeach; ?>
                </div>
                <button class="<?= $btn ?>"><?= e(t("upload")) ?></button>
            </form>

            <?php if (!empty($settings_row["cover_file"])): ?>
                <form method="POST" class="flex flex-wrap items-center gap-2 text-sm">
                    <?= csrf_field() ?><input type="hidden" name="act" value="cover_pos">
                    <span><?= e(t("cover_pos")) ?>:</span>
                    <?php foreach (COVER_POSITIONS as $key => $label): ?>
                        <button name="cover_pos" value="<?= $key ?>" class="px-3 py-1 rounded-full border <?= $settings_row["cover_pos"] === $key ? "bg-slate-900 text-white" : "bg-white" ?>"><?= e(tl($label)) ?></button>
                    <?php endforeach; ?>
                </form>
            <?php endif; ?>

            <div>
                <div class="font-medium mb-2"><?= e(t("cover_presets")) ?></div>
                <form method="POST" class="grid grid-cols-4 gap-2">
                    <?= csrf_field() ?><input type="hidden" name="act" value="cover_preset">
                    <?php foreach (COVER_PRESETS as $key => $p): ?>
                        <button name="preset" value="<?= $key ?>" title="<?= e(tl([$p[0], $p[1]])) ?>" class="h-16 rounded-xl text-xs font-medium text-white flex items-end p-1.5 <?= ($settings_row["cover_preset"] ?? "") === $key && empty($settings_row["cover_file"]) ? "ring-2 ring-offset-2 ring-slate-900" : "" ?>" style="background: <?= $p[2] ?>"><span class="drop-shadow"><?= e(tl([$p[0], $p[1]])) ?></span></button>
                    <?php endforeach; ?>
                </form>
            </div>

            <?php if ($cover): ?>
                <form method="POST">
                    <?= csrf_field() ?><input type="hidden" name="act" value="cover_remove">
                    <button class="text-red-700 text-sm"><?= e(t("cover_remove")) ?></button>
                </form>
            <?php endif; ?>
        </div>
    </dialog>

    <nav class="flex flex-wrap gap-2 mb-8">
        <?php foreach ($tabs as $key): ?>
            <a href="?tab=<?= $key ?>" class="px-4 py-2 rounded-lg border <?= $tab === $key ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50" ?>"><?= e(t($key)) ?></a>
        <?php endforeach; ?>
    </nav>

<?php
// =================================================================
// OVERVIEW
// =================================================================
if ($tab === "overview"):

    $tasks_today = $q("SELECT * FROM study_tasks WHERE user_id = ? AND is_done = 0 AND due_date IS NOT NULL AND due_date <= ? ORDER BY due_date, FIELD(priority, 'high', 'normal', 'low')", "is", $user_id, $today);
    $deadlines = $q("SELECT a.*, s.name AS subject_name FROM study_ib_assessments a JOIN study_ib_subjects s ON s.id = a.subject_id
                     WHERE a.user_id = ? AND a.status = 'todo' AND a.due_date IS NOT NULL AND a.due_date <= ? + INTERVAL 14 DAY ORDER BY a.due_date", "is", $user_id, $today);
    $reviews_due = (int)$q("SELECT COUNT(*) AS n FROM study_corrections WHERE user_id = ? AND mastered = 0 AND next_review <= ?", "is", $user_id, $today)[0]["n"];
    $sat = $q("SELECT MAX(rw_score + math_score) AS best FROM study_sat_tests WHERE user_id = ?", "i", $user_id)[0];
    $imo_solved = (int)$q("SELECT COUNT(*) AS n FROM study_imo_problems WHERE user_id = ? AND status = 'solved'", "i", $user_id)[0]["n"];
    $exam_days = $settings_row["sat_exam_date"] ? (int)ceil((strtotime($settings_row["sat_exam_date"]) - strtotime($today)) / 86400) : null;
    $bank_player = sat_bank_count() ? sat_player($user_id) : null;
    $health_habits_total = (int)$q("SELECT COUNT(*) AS n FROM study_habits WHERE user_id = ?", "i", $user_id)[0]["n"];
    $health_habits_today = (int)$q("SELECT COUNT(*) AS n FROM study_habit_log WHERE user_id = ? AND log_date = ?", "is", $user_id, $today)[0]["n"];
?>

    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <a href="?tab=tracker" class="<?= $card ?>">
            <div class="text-sm text-slate-500"><?= e(t("week_total")) ?></div>
            <div class="text-2xl font-bold"><?= e(minutes_label($week_minutes)) ?></div>
            <div class="h-2 bg-slate-200 rounded mt-2"><div class="h-2 bg-slate-800 rounded" style="width: <?= min(100, round($week_minutes / max(1, $goal) * 100)) ?>%"></div></div>
            <div class="text-xs text-slate-500 mt-1"><?= e(t("target")) ?>: <?= e(minutes_label($goal)) ?></div>
        </a>
        <a href="?tab=tracker" class="<?= $card ?>">
            <div class="text-sm text-slate-500"><?= e(t("streak")) ?></div>
            <div class="text-2xl font-bold"><?= $streak ?></div>
        </a>
        <a href="?tab=sat" class="<?= $card ?>">
            <div class="text-sm text-slate-500">SAT · <?= e(t("best")) ?></div>
            <div class="text-2xl font-bold"><?= $sat["best"] ? (int)$sat["best"] : "—" ?><?php if ($settings_row["sat_target"]): ?><span class="text-base text-slate-500"> / <?= (int)$settings_row["sat_target"] ?></span><?php endif; ?></div>
            <?php if ($exam_days !== null && $exam_days >= 0): ?><div class="text-xs text-slate-500 mt-1"><?= $exam_days ?> <?= e(t("days_left")) ?></div><?php endif; ?>
        </a>
        <a href="?tab=satbank" class="<?= $card ?>">
            <div class="text-sm text-slate-500"><?= e(t("satbank")) ?></div>
            <?php if ($bank_player): ?>
                <div class="text-2xl font-bold"><?= e(t("level")) ?> <?= (int)$bank_player["level"] ?></div>
                <div class="text-xs text-slate-500 mt-1"><?= e(t("today_goal")) ?>: <?= (int)$bank_player["today"] ?> / <?= SAT_DAILY_GOAL ?></div>
            <?php else: ?>
                <div class="text-2xl font-bold">—</div>
            <?php endif; ?>
        </a>
        <a href="?tab=imo" class="<?= $card ?>">
            <div class="text-sm text-slate-500">IMO</div>
            <div class="text-2xl font-bold"><?= $imo_solved ?></div>
            <div class="text-xs text-slate-500 mt-1"><?= e(t("solved_count")) ?></div>
        </a>
        <a href="?tab=health" class="<?= $card ?>">
            <div class="text-sm text-slate-500"><?= e(t("health")) ?></div>
            <div class="text-2xl font-bold"><?= $health_habits_today ?> / <?= $health_habits_total ?></div>
            <div class="text-xs text-slate-500 mt-1"><?= e(t("h_habits")) ?> · <?= e(t("h_today")) ?></div>
        </a>
    </div>

    <div class="grid md:grid-cols-3 gap-6">
        <section class="<?= $card ?>">
            <h2 class="font-bold text-lg mb-3"><?= e(t("tasks_today")) ?></h2>
            <?php if (!$tasks_today): ?><p class="text-slate-500"><?= e(t("all_clear")) ?></p><?php endif; ?>
            <?php foreach ($tasks_today as $task): ?>
                <form method="POST" class="flex items-start gap-2 py-1">
                    <?= csrf_field() ?><input type="hidden" name="act" value="task_toggle"><input type="hidden" name="id" value="<?= (int)$task["id"] ?>">
                    <button title="<?= e(t("mark_done")) ?>" class="mt-1 w-4 h-4 border-2 border-slate-500 rounded shrink-0"></button>
                    <span><?= e($task["title"]) ?><?php if ($task["due_date"] < $today): ?> <span class="text-red-700 text-sm">· <?= e(t("overdue")) ?></span><?php endif; ?></span>
                </form>
            <?php endforeach; ?>
            <a href="?tab=planner" class="text-sm text-blue-700 mt-3 inline-block"><?= e(t("planner")) ?> →</a>
        </section>

        <section class="<?= $card ?>">
            <h2 class="font-bold text-lg mb-3"><?= e(t("deadlines")) ?></h2>
            <?php if (!$deadlines): ?><p class="text-slate-500"><?= e(t("nothing_yet")) ?></p><?php endif; ?>
            <?php foreach ($deadlines as $a): ?>
                <div class="py-1"><span class="<?= $a["due_date"] < $today ? "text-red-700" : "text-slate-500" ?> text-sm"><?= e(date("d.m", strtotime($a["due_date"]))) ?></span> <?= e($a["subject_name"]) ?> — <?= e($a["title"]) ?></div>
            <?php endforeach; ?>
            <a href="?tab=grades" class="text-sm text-blue-700 mt-3 inline-block"><?= e(t("grades")) ?> →</a>
        </section>

        <section class="<?= $card ?>">
            <h2 class="font-bold text-lg mb-3"><?= e(t("reviews_today")) ?></h2>
            <div class="text-3xl font-bold"><?= $reviews_due ?></div>
            <a href="?tab=corrections" class="text-sm text-blue-700 mt-3 inline-block"><?= e(t("corrections")) ?> →</a>
        </section>
    </div>

<?php
// =================================================================
// PLANNER
// =================================================================
elseif ($tab === "planner"):

    $open = $q("SELECT * FROM study_tasks WHERE user_id = ? AND is_done = 0 ORDER BY due_date IS NULL, due_date, FIELD(priority, 'high', 'normal', 'low'), id", "i", $user_id);
    $done = $q("SELECT * FROM study_tasks WHERE user_id = ? AND is_done = 1 ORDER BY done_at DESC LIMIT 50", "i", $user_id);
    $week_end = date("Y-m-d", strtotime($week_start . " +6 day"));
    $groups = ["overdue" => [], "today" => [], "this_week" => [], "upcoming" => [], "no_date" => []];
    foreach ($open as $task) {
        $d = $task["due_date"];
        $g = !$d ? "no_date" : ($d < $today ? "overdue" : ($d === $today ? "today" : ($d <= $week_end ? "this_week" : "upcoming")));
        $groups[$g][] = $task;
    }
    $priority_color = ["high" => "border-l-red-600", "normal" => "border-l-slate-400", "low" => "border-l-slate-200"];

    $task_form = function ($task = null) use ($input, $btn, $subject_names) {
        ?>
        <input name="title" required maxlength="200" value="<?= e($task["title"] ?? "") ?>" placeholder="<?= e(t("task")) ?>" class="border rounded-lg px-3 py-2 md:col-span-2">
        <input type="date" name="due_date" value="<?= e($task["due_date"] ?? "") ?>" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("due")) ?>">
        <select name="priority" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("priority")) ?>">
            <?php foreach (["high", "normal", "low"] as $p): ?><option value="<?= $p ?>" <?= ($task["priority"] ?? "normal") === $p ? "selected" : "" ?>><?= e(t($p)) ?></option><?php endforeach; ?>
        </select>
        <select name="category" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("category")) ?>">
            <?php foreach (["general", "sat", "imo", "ib", "other"] as $c): ?><option value="<?= $c ?>" <?= ($task["category"] ?? "general") === $c ? "selected" : "" ?>><?= e($subject_names[$c]) ?></option><?php endforeach; ?>
        </select>
        <textarea name="notes" maxlength="2000" rows="2" placeholder="<?= e(t("notes")) ?> (<?= e(t("optional")) ?>)" class="border rounded-lg px-3 py-2 md:col-span-5"><?= e($task["notes"] ?? "") ?></textarea>
        <?php
    };
?>

    <form method="POST" class="<?= $card ?> grid md:grid-cols-5 gap-3 mb-6">
        <?= csrf_field() ?><input type="hidden" name="act" value="task_add">
        <?php $task_form(); ?>
        <button class="<?= $btn ?> justify-self-start"><?= e(t("add")) ?></button>
    </form>

    <?php foreach ($groups as $group => $items): if (!$items) continue; ?>
        <h2 class="font-bold text-lg mt-6 mb-2 <?= $group === "overdue" ? "text-red-700" : "" ?>"><?= e(t($group)) ?> (<?= count($items) ?>)</h2>
        <div class="space-y-2">
        <?php foreach ($items as $task): ?>
            <div class="bg-white rounded-lg border border-l-4 <?= $priority_color[$task["priority"]] ?> p-3">
                <div class="flex items-start gap-3">
                    <form method="POST"><?= csrf_field() ?><input type="hidden" name="act" value="task_toggle"><input type="hidden" name="id" value="<?= (int)$task["id"] ?>">
                        <button title="<?= e(t("mark_done")) ?>" class="mt-1 w-5 h-5 border-2 border-slate-500 rounded"></button></form>
                    <div class="flex-1">
                        <div class="font-semibold"><?= e($task["title"]) ?></div>
                        <div class="text-sm text-slate-500">
                            <?= e($subject_names[$task["category"]] ?? "") ?>
                            <?php if ($task["due_date"]): ?> · <?= e(date("d.m.Y", strtotime($task["due_date"]))) ?><?php endif; ?>
                        </div>
                        <?php if ($task["notes"]): ?><p class="text-sm mt-1 whitespace-pre-line"><?= e($task["notes"]) ?></p><?php endif; ?>
                        <details class="mt-1 text-sm">
                            <summary class="cursor-pointer text-slate-500"><?= e(t("edit")) ?></summary>
                            <form method="POST" class="grid md:grid-cols-5 gap-2 mt-2">
                                <?= csrf_field() ?><input type="hidden" name="act" value="task_save"><input type="hidden" name="id" value="<?= (int)$task["id"] ?>">
                                <?php $task_form($task); ?>
                                <button class="<?= $btn ?> justify-self-start"><?= e(t("save")) ?></button>
                            </form>
                            <form method="POST" class="mt-2" onsubmit="return confirm('<?= e(t("confirm_delete")) ?>')">
                                <?= csrf_field() ?><input type="hidden" name="act" value="task_delete"><input type="hidden" name="id" value="<?= (int)$task["id"] ?>">
                                <button class="text-red-700"><?= e(t("delete")) ?></button>
                            </form>
                        </details>
                    </div>
                </div>
            </div>
        <?php endforeach; ?>
        </div>
    <?php endforeach; ?>

    <?php if (!$open): ?><p class="text-slate-500"><?= e(t("all_clear")) ?></p><?php endif; ?>

    <?php if ($done): ?>
    <details class="mt-8">
        <summary class="cursor-pointer font-semibold"><?= e(t("completed")) ?> (<?= count($done) ?>)</summary>
        <div class="space-y-1 mt-2">
        <?php foreach ($done as $task): ?>
            <form method="POST" class="flex items-center gap-3 bg-white rounded-lg border p-2 text-slate-500">
                <?= csrf_field() ?><input type="hidden" name="act" value="task_toggle"><input type="hidden" name="id" value="<?= (int)$task["id"] ?>">
                <span class="line-through flex-1"><?= e($task["title"]) ?></span>
                <button class="text-sm text-blue-700"><?= e(t("undo")) ?></button>
            </form>
        <?php endforeach; ?>
        </div>
    </details>
    <?php endif; ?>

<?php
// =================================================================
// TRACKER
// =================================================================
elseif ($tab === "tracker"):

    $from = date("Y-m-d", strtotime("-13 day"));
    $per_day = [];
    for ($i = 13; $i >= 0; $i--) {
        $per_day[date("Y-m-d", strtotime("-$i day"))] = 0;
    }
    foreach ($q("SELECT session_date, SUM(minutes) AS m FROM study_sessions WHERE user_id = ? AND session_date >= ? GROUP BY session_date", "is", $user_id, $from) as $r) {
        $per_day[$r["session_date"]] = (int)$r["m"];
    }
    $max_day = max(30, max($per_day));
    $by_subject = $q("SELECT subject, SUM(minutes) AS m FROM study_sessions WHERE user_id = ? AND session_date > ? - INTERVAL 30 DAY GROUP BY subject ORDER BY m DESC", "is", $user_id, $today);
    $recent = $q("SELECT * FROM study_sessions WHERE user_id = ? ORDER BY session_date DESC, id DESC LIMIT 30", "i", $user_id);
?>

    <div class="grid md:grid-cols-3 gap-6 mb-6">
        <form method="POST" class="<?= $card ?> space-y-3 md:col-span-2">
            <?= csrf_field() ?><input type="hidden" name="act" value="session_add">
            <h2 class="font-bold text-lg"><?= e(t("log_session")) ?></h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input type="date" name="session_date" value="<?= $today ?>" max="<?= $today ?>" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("date")) ?>">
                <input type="number" name="minutes" min="1" max="1440" required placeholder="<?= e(t("minutes")) ?>" class="border rounded-lg px-3 py-2">
                <select name="subject" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("subject")) ?>">
                    <?php foreach (STUDY_SUBJECTS as $s): ?><option value="<?= $s ?>"><?= e($subject_names[$s]) ?></option><?php endforeach; ?>
                </select>
                <input name="note" maxlength="255" placeholder="<?= e(t("note")) ?>" class="border rounded-lg px-3 py-2">
            </div>
            <button class="<?= $btn ?>"><?= e(t("add")) ?></button>
        </form>

        <div class="<?= $card ?>">
            <div class="text-sm text-slate-500"><?= e(t("week_total")) ?></div>
            <div class="text-2xl font-bold"><?= e(minutes_label($week_minutes)) ?> <span class="text-base text-slate-500">/ <?= e(minutes_label($goal)) ?></span></div>
            <div class="h-2 bg-slate-200 rounded mt-2"><div class="h-2 bg-slate-800 rounded" style="width: <?= min(100, round($week_minutes / max(1, $goal) * 100)) ?>%"></div></div>
            <div class="mt-3 text-sm"><?= e(t("streak")) ?>: <strong><?= $streak ?></strong></div>
            <form method="POST" class="flex gap-2 mt-3">
                <?= csrf_field() ?><input type="hidden" name="act" value="goal_save">
                <input type="number" name="weekly_goal_minutes" min="30" max="10080" value="<?= $goal ?>" class="border rounded-lg px-3 py-2 w-28" aria-label="<?= e(t("weekly_goal")) ?>">
                <button class="border rounded-lg px-3 text-sm"><?= e(t("save")) ?></button>
            </form>
            <div class="text-xs text-slate-500 mt-1"><?= e(t("weekly_goal")) ?></div>
        </div>
    </div>

    <div class="grid md:grid-cols-3 gap-6">
        <section class="<?= $card ?> md:col-span-2">
            <h2 class="font-bold text-lg mb-3"><?= e(t("last_14")) ?></h2>
            <div class="flex items-end gap-1 h-40">
                <?php foreach ($per_day as $d => $m): ?>
                    <div class="flex-1 flex flex-col items-center justify-end h-full" title="<?= e($d) ?>: <?= e(minutes_label($m)) ?>">
                        <span class="text-[10px] text-slate-500"><?= $m ?: "" ?></span>
                        <div class="w-full rounded-t <?= $d === $today ? "bg-blue-700" : "bg-slate-700" ?>" style="height: <?= round($m / $max_day * 100) ?>%; min-height: 1px"></div>
                        <span class="text-[10px] text-slate-500 mt-1"><?= date("d", strtotime($d)) ?></span>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>
        <section class="<?= $card ?>">
            <h2 class="font-bold text-lg mb-3"><?= e(t("by_subject")) ?></h2>
            <?php if (!$by_subject): ?><p class="text-slate-500"><?= e(t("nothing_yet")) ?></p><?php endif; ?>
            <?php foreach ($by_subject as $r): ?>
                <div class="flex justify-between py-1 border-b"><span><?= e($subject_names[$r["subject"]] ?? $r["subject"]) ?></span><span class="font-semibold"><?= e(minutes_label($r["m"])) ?></span></div>
            <?php endforeach; ?>
        </section>
    </div>

    <section class="mt-6">
        <h2 class="font-bold text-lg mb-3"><?= e(t("recent_sessions")) ?></h2>
        <?php if (!$recent): ?><p class="text-slate-500"><?= e(t("nothing_yet")) ?></p><?php endif; ?>
        <div class="space-y-1">
        <?php foreach ($recent as $s): ?>
            <div class="flex flex-wrap items-center gap-3 bg-white rounded-lg border px-3 py-2">
                <span class="text-sm text-slate-500 w-20"><?= e(date("d.m.Y", strtotime($s["session_date"]))) ?></span>
                <span class="font-semibold w-24"><?= e(minutes_label($s["minutes"])) ?></span>
                <span class="w-16"><?= e($subject_names[$s["subject"]] ?? "") ?></span>
                <span class="flex-1 text-slate-600"><?= e($s["note"]) ?></span>
                <form method="POST" onsubmit="return confirm('<?= e(t("confirm_delete")) ?>')"><?= csrf_field() ?><input type="hidden" name="act" value="session_delete"><input type="hidden" name="id" value="<?= (int)$s["id"] ?>"><button class="text-sm text-red-700"><?= e(t("delete")) ?></button></form>
            </div>
        <?php endforeach; ?>
        </div>
    </section>

<?php
// =================================================================
// SAT and IMO topic lists share one renderer
// =================================================================
elseif ($tab === "satbank"):

    $bank_total = sat_bank_count();
    $flash = $_SESSION["bank_flash"] ?? "";
    unset($_SESSION["bank_flash"]);
    $can_import = $bank_total === 0 || current_user_role() === "editor";
?>
    <?php if ($flash): ?><p class="mb-4 p-3 rounded-lg bg-blue-50 text-blue-900"><?= e($flash) ?></p><?php endif; ?>

    <?php if ($bank_total === 0): ?>
        <p class="<?= $card ?> mb-4 text-slate-600"><?= e(t("bank_empty")) ?></p>
    <?php else:
        $modules = sat_modules($user_id);
        $player = sat_player($user_id);
        $module_no = (int)($_GET["module"] ?? 0);
        $continue = null;
        foreach ($modules as $m => $mod) {
            if ($mod["unlocked"] && !$mod["complete"]) { $continue = $m; break; }
        }
    ?>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="<?= $card ?>">
                <div class="text-sm text-slate-500"><?= e(t("level")) ?></div>
                <div class="text-3xl font-bold" id="bank-level"><?= (int)$player["level"] ?></div>
                <div class="h-2 bg-slate-200 rounded mt-2"><div id="bank-level-bar" class="h-2 bg-amber-500 rounded" style="width: <?= round($player["level_xp"] / SAT_XP_PER_LEVEL * 100) ?>%"></div></div>
                <div class="text-xs text-slate-500 mt-1"><span id="bank-xp"><?= (int)$player["xp"] ?></span> <?= e(t("xp")) ?></div>
            </div>
            <div class="<?= $card ?>">
                <div class="text-sm text-slate-500"><?= e(t("today_goal")) ?></div>
                <div class="text-3xl font-bold"><span id="bank-today"><?= (int)$player["today"] ?></span><span class="text-base text-slate-500"> / <?= SAT_DAILY_GOAL ?></span></div>
                <div class="h-2 bg-slate-200 rounded mt-2"><div id="bank-today-bar" class="h-2 bg-blue-700 rounded" style="width: <?= min(100, round($player["today"] / SAT_DAILY_GOAL * 100)) ?>%"></div></div>
            </div>
            <div class="<?= $card ?>">
                <div class="text-sm text-slate-500"><?= e(t("answered")) ?></div>
                <div class="text-3xl font-bold"><?= (int)$player["answered"] ?><span class="text-base text-slate-500"> / <?= $bank_total ?></span></div>
            </div>
            <div class="<?= $card ?>">
                <div class="text-sm text-slate-500"><?= e(t("accuracy")) ?></div>
                <div class="text-3xl font-bold"><?= $player["answered"] ? round($player["correct"] / $player["answered"] * 100) . "%" : "—" ?></div>
            </div>
        </div>

        <?php if ($module_no && isset($modules[$module_no])):
            $mod = $modules[$module_no];
            $tasks = $q("SELECT * FROM sat_bank WHERE no BETWEEN ? AND ? ORDER BY no", "ii", $mod["first_no"], $mod["last_no"]);
            $done = [];
            foreach ($q("SELECT * FROM study_sat_bank_progress WHERE user_id = ? AND task_no BETWEEN ? AND ?", "iii", $user_id, $mod["first_no"], $mod["last_no"]) as $r) {
                $done[(int)$r["task_no"]] = $r;
            }
            $cell = ["correct" => "bg-green-600 text-white", "wrong" => "bg-red-600 text-white", "revealed" => "bg-amber-400"];
        ?>
            <div class="flex flex-wrap items-center gap-3 mb-4">
                <a href="?tab=satbank" class="text-blue-700">← <?= e(t("all_modules")) ?></a>
                <h2 class="text-2xl font-bold flex-1"><?= e(t("module")) ?> <?= $module_no ?> · <?= e(bank_module_title($mod["sections"])) ?></h2>
                <?php if (isset($modules[$module_no - 1])): ?><a href="?tab=satbank&module=<?= $module_no - 1 ?>" class="px-3 py-1 border rounded-lg bg-white">← <?= e(t("prev_module")) ?></a><?php endif; ?>
                <?php if (isset($modules[$module_no + 1]) && $modules[$module_no + 1]["unlocked"]): ?><a href="?tab=satbank&module=<?= $module_no + 1 ?>" class="px-3 py-1 border rounded-lg bg-white"><?= e(t("next_module")) ?> →</a><?php endif; ?>
            </div>

            <?php if (!$mod["unlocked"]): ?>
                <p class="<?= $card ?> text-slate-600"><?= e(t("module_locked_text")) ?></p>
            <?php else: ?>
                <div class="<?= $card ?> mb-4 sticky top-0 z-10">
                    <div class="text-sm mb-2"><?= e(t("answered")) ?>: <strong id="mod-answered"><?= (int)$mod["answered"] ?></strong> / <?= (int)$mod["total"] ?> · <?= e(t("right")) ?>: <strong id="mod-correct"><?= (int)$mod["correct"] ?></strong></div>
                    <div class="flex flex-wrap gap-1">
                        <?php foreach ($tasks as $tk): $st = $done[(int)$tk["no"]]["status"] ?? ""; ?>
                            <a href="#task-<?= (int)$tk["no"] ?>" id="cell-<?= (int)$tk["no"] ?>" title="#<?= (int)$tk["no"] ?>"
                               class="w-7 h-7 rounded text-[10px] flex items-center justify-center border <?= $cell[$st] ?? "bg-white" ?>"><?= (int)$tk["no"] - (int)$mod["first_no"] + 1 ?></a>
                        <?php endforeach; ?>
                    </div>
                </div>
                <div class="space-y-3">
                    <?php foreach ($tasks as $tk) { render_bank_card($tk, $done[(int)$tk["no"]] ?? null); } ?>
                </div>
                <?php if (isset($modules[$module_no + 1])): ?>
                    <div class="mt-6 text-center"><a href="?tab=satbank&module=<?= $module_no + 1 ?>" class="inline-block bg-slate-900 text-white px-6 py-3 rounded-lg"><?= e(t("next_module")) ?> →</a></div>
                <?php endif; ?>
            <?php endif; ?>

        <?php else: ?>
            <div class="flex flex-wrap items-center gap-3 mb-2">
                <h2 class="text-xl font-bold flex-1"><?= e(t("bank_title")) ?></h2>
                <?php if ($continue): ?><a href="?tab=satbank&module=<?= $continue ?>" class="bg-slate-900 text-white px-5 py-2 rounded-lg"><?= e(t("continue")) ?>: <?= e(t("module")) ?> <?= $continue ?> →</a><?php endif; ?>
            </div>
            <p class="text-sm text-slate-500 mb-1"><?= e(t("bank_hint")) ?></p>
            <p class="text-sm text-slate-500 mb-4"><?= e(t("stars_hint")) ?></p>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <?php foreach ($modules as $m => $mod): $pct = round($mod["answered"] / max(1, $mod["total"]) * 100); ?>
                    <?php if ($mod["unlocked"]): ?>
                    <a href="?tab=satbank&module=<?= $m ?>" class="bg-white rounded-xl border p-4 hover:border-slate-900 <?= $m === $continue ? "ring-2 ring-blue-700" : "" ?>">
                    <?php else: ?>
                    <div class="bg-slate-200 rounded-xl border p-4 text-slate-500">
                    <?php endif; ?>
                        <div class="flex justify-between items-center">
                            <span class="font-bold"><?= e(t("module")) ?> <?= $m ?></span>
                            <span class="text-amber-500 tracking-tight" aria-label="<?= (int)$mod["stars"] ?> stars"><?= str_repeat("★", (int)$mod["stars"]) ?><span class="text-slate-300"><?= str_repeat("★", 3 - (int)$mod["stars"]) ?></span></span>
                        </div>
                        <div class="text-xs mt-1 truncate" title="<?= e(bank_module_title($mod["sections"])) ?>"><?= e(bank_module_title($mod["sections"])) ?></div>
                        <div class="text-xs text-slate-500">#<?= (int)$mod["first_no"] ?>–<?= (int)$mod["last_no"] ?></div>
                        <?php if ($mod["unlocked"]): ?>
                            <div class="h-2 bg-slate-200 rounded mt-2"><div class="h-2 <?= $mod["complete"] ? "bg-green-600" : "bg-blue-700" ?> rounded" style="width: <?= $pct ?>%"></div></div>
                            <div class="text-xs text-slate-500 mt-1"><?= (int)$mod["answered"] ?>/<?= (int)$mod["total"] ?></div>
                        <?php else: ?>
                            <div class="text-xs mt-3">🔒 <?= e(t("locked")) ?></div>
                        <?php endif; ?>
                    <?php if ($mod["unlocked"]): ?></a><?php else: ?></div><?php endif; ?>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    <?php endif; ?>

    <?php if ($can_import && empty($_GET["module"])): ?>
        <form method="POST" enctype="multipart/form-data" class="<?= $card ?> mt-8 space-y-2">
            <?= csrf_field() ?><input type="hidden" name="act" value="bank_import">
            <div class="font-semibold"><?= e(t("bank_import")) ?></div>
            <p class="text-sm text-slate-500"><?= e(t("bank_import_hint")) ?></p>
            <input type="file" name="bank_file" accept=".json,application/json" required class="block">
            <button class="<?= $btn ?>"><?= e(t("upload")) ?></button>
        </form>
    <?php endif; ?>

<?php
elseif ($tab === "sat" || $tab === "imo"):

    $track = $tab;
    $progress = [];
    foreach ($q("SELECT * FROM study_topic_progress WHERE user_id = ? AND track = ?", "is", $user_id, $track) as $r) {
        $progress[$r["topic_key"]] = $r;
    }
    $groups = $track === "sat" ? SAT_TOPICS : array_combine(array_map(fn($k) => tl(IMO_AREAS[$k]), array_keys(IMO_TOPICS)), array_values(IMO_TOPICS));
    $all_topics = array_merge(...array_values($groups));
    $confident = count(array_filter($progress, fn($p) => (int)$p["status"] === 2 && isset($all_topics[$p["topic_key"]])));
    $status_style = [0 => "bg-slate-100 text-slate-600", 1 => "bg-amber-100 text-amber-900", 2 => "bg-green-100 text-green-900"];

    $render_topics = function () use ($groups, $progress, $track, $status_style, $card, $btn) {
        foreach ($groups as $group => $topics): ?>
            <h3 class="font-semibold mt-5 mb-2"><?= e($group) ?></h3>
            <div class="space-y-2">
            <?php foreach ($topics as $key => $label):
                $p = $progress[$key] ?? ["status" => 0, "note" => "", "resource_url" => ""];
                $s = (int)$p["status"]; ?>
                <details class="bg-white rounded-lg border" id="topic-<?= e($key) ?>">
                    <summary class="cursor-pointer flex flex-wrap items-center gap-3 px-4 py-3">
                        <span class="flex-1"><?= e(tl($label)) ?></span>
                        <span class="text-xs px-2 py-1 rounded <?= $status_style[$s] ?>"><?= e(t([0 => "not_started", 1 => "learning", 2 => "confident"][$s])) ?></span>
                    </summary>
                    <form method="POST" class="px-4 pb-4 grid md:grid-cols-4 gap-2">
                        <?= csrf_field() ?><input type="hidden" name="act" value="topic_save"><input type="hidden" name="track" value="<?= $track ?>"><input type="hidden" name="topic_key" value="<?= e($key) ?>">
                        <select name="status" class="border rounded-lg px-3 py-2">
                            <?php foreach ([0 => "not_started", 1 => "learning", 2 => "confident"] as $v => $k): ?><option value="<?= $v ?>" <?= $s === $v ? "selected" : "" ?>><?= e(t($k)) ?></option><?php endforeach; ?>
                        </select>
                        <input name="note" maxlength="255" value="<?= e($p["note"]) ?>" placeholder="<?= e(t("note")) ?>" class="border rounded-lg px-3 py-2 md:col-span-3">
                        <input type="url" name="resource_url" maxlength="500" value="<?= e($p["resource_url"]) ?>" placeholder="<?= e(t("resource")) ?> (https://...)" class="border rounded-lg px-3 py-2 md:col-span-3">
                        <button class="<?= $btn ?>"><?= e(t("save")) ?></button>
                        <?php if ($p["resource_url"]): ?><a href="<?= e($p["resource_url"]) ?>" target="_blank" rel="noopener" class="text-sm text-blue-700 md:col-span-4"><?= e(t("open")) ?>: <?= e($p["resource_url"]) ?></a><?php endif; ?>
                    </form>
                </details>
            <?php endforeach; ?>
            </div>
        <?php endforeach;
    };
?>

    <?php if ($track === "sat"):
        $tests = $q("SELECT * FROM study_sat_tests WHERE user_id = ? ORDER BY test_date, id", "i", $user_id);
        $best = $tests ? max(array_map(fn($t) => $t["rw_score"] + $t["math_score"], $tests)) : null;
        $last = $tests ? end($tests) : null;
        $exam_days = $settings_row["sat_exam_date"] ? (int)ceil((strtotime($settings_row["sat_exam_date"]) - strtotime($today)) / 86400) : null;
    ?>
        <div class="grid md:grid-cols-3 gap-6 mb-6">
            <form method="POST" class="<?= $card ?> space-y-2">
                <?= csrf_field() ?><input type="hidden" name="act" value="sat_goal_save">
                <h2 class="font-bold text-lg"><?= e(t("sat_goal")) ?></h2>
                <label class="block text-sm"><?= e(t("target")) ?> (400–1600)<input type="number" name="sat_target" min="400" max="1600" step="10" value="<?= e($settings_row["sat_target"]) ?>" class="<?= $input ?>"></label>
                <label class="block text-sm"><?= e(t("exam_date")) ?><input type="date" name="sat_exam_date" value="<?= e($settings_row["sat_exam_date"]) ?>" class="<?= $input ?>"></label>
                <button class="<?= $btn ?>"><?= e(t("save")) ?></button>
                <?php if ($exam_days !== null && $exam_days >= 0): ?><p class="text-sm font-semibold"><?= $exam_days ?> <?= e(t("days_left")) ?></p><?php endif; ?>
            </form>
            <div class="<?= $card ?>">
                <div class="text-sm text-slate-500"><?= e(t("best")) ?></div>
                <div class="text-3xl font-bold"><?= $best ?? "—" ?><?php if ($settings_row["sat_target"]): ?><span class="text-base text-slate-500"> / <?= (int)$settings_row["sat_target"] ?></span><?php endif; ?></div>
                <?php if ($last): ?><div class="text-sm text-slate-500 mt-3"><?= e(t("latest")) ?>: <strong><?= $last["rw_score"] + $last["math_score"] ?></strong> (<?= e(t("rw")) ?> <?= (int)$last["rw_score"] ?>, <?= e(t("math")) ?> <?= (int)$last["math_score"] ?>)</div><?php endif; ?>
            </div>
            <div class="<?= $card ?>">
                <div class="text-sm text-slate-500"><?= e(t("topics")) ?> · <?= e(t("confident")) ?></div>
                <div class="text-3xl font-bold"><?= $confident ?> / <?= count($all_topics) ?></div>
                <div class="h-2 bg-slate-200 rounded mt-2"><div class="h-2 bg-green-700 rounded" style="width: <?= round($confident / max(1, count($all_topics)) * 100) ?>%"></div></div>
            </div>
        </div>

        <section class="<?= $card ?> mb-6">
            <h2 class="font-bold text-lg mb-3"><?= e(t("score_chart")) ?></h2>
            <?php if (count($tests) >= 2):
                $w = 700; $h = 200; $n = count($tests);
                $pt = fn($i, $v) => round(30 + $i * ($w - 60) / ($n - 1)) . "," . round($h - 20 - ($v - 400) / 1200 * ($h - 40));
                $line = implode(" ", array_map(fn($i) => $pt($i, $tests[$i]["rw_score"] + $tests[$i]["math_score"]), array_keys($tests)));
            ?>
                <svg viewBox="0 0 <?= $w ?> <?= $h ?>" class="w-full h-48" role="img" aria-label="<?= e(t("score_chart")) ?>">
                    <?php foreach ([400, 800, 1200, 1600] as $g): $y = round($h - 20 - ($g - 400) / 1200 * ($h - 40)); ?>
                        <line x1="30" x2="<?= $w - 30 ?>" y1="<?= $y ?>" y2="<?= $y ?>" stroke="#e2e8f0"/><text x="0" y="<?= $y + 4 ?>" font-size="11" fill="#64748b"><?= $g ?></text>
                    <?php endforeach; ?>
                    <?php if ($settings_row["sat_target"]): $y = round($h - 20 - ($settings_row["sat_target"] - 400) / 1200 * ($h - 40)); ?>
                        <line x1="30" x2="<?= $w - 30 ?>" y1="<?= $y ?>" y2="<?= $y ?>" stroke="#15803d" stroke-dasharray="6 4"/>
                    <?php endif; ?>
                    <polyline points="<?= $line ?>" fill="none" stroke="#1e3a8a" stroke-width="3"/>
                    <?php foreach ($tests as $i => $t): [$x, $y] = explode(",", $pt($i, $t["rw_score"] + $t["math_score"])); ?>
                        <circle cx="<?= $x ?>" cy="<?= $y ?>" r="4" fill="#1e3a8a"><title><?= e($t["name"]) ?>: <?= $t["rw_score"] + $t["math_score"] ?></title></circle>
                    <?php endforeach; ?>
                </svg>
            <?php else: ?>
                <p class="text-slate-500 text-sm"><?= e(t("nothing_yet")) ?></p>
            <?php endif; ?>
        </section>

        <section class="mb-6">
            <h2 class="font-bold text-lg mb-3"><?= e(t("practice_tests")) ?></h2>
            <form method="POST" class="<?= $card ?> grid md:grid-cols-6 gap-2 mb-3">
                <?= csrf_field() ?><input type="hidden" name="act" value="sat_test_add">
                <input type="date" name="test_date" value="<?= $today ?>" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("date")) ?>">
                <input name="name" required maxlength="120" placeholder="<?= e(t("test_name")) ?>" class="border rounded-lg px-3 py-2 md:col-span-2">
                <input type="number" name="rw_score" required min="200" max="800" step="10" placeholder="<?= e(t("rw")) ?>" class="border rounded-lg px-3 py-2">
                <input type="number" name="math_score" required min="200" max="800" step="10" placeholder="<?= e(t("math")) ?>" class="border rounded-lg px-3 py-2">
                <button class="<?= $btn ?>"><?= e(t("add")) ?></button>
            </form>
            <?php foreach (array_reverse($tests) as $t): ?>
                <div class="flex flex-wrap items-center gap-4 bg-white rounded-lg border px-4 py-2 mb-1">
                    <span class="text-sm text-slate-500 w-24"><?= e(date("d.m.Y", strtotime($t["test_date"]))) ?></span>
                    <span class="flex-1"><?= e($t["name"]) ?></span>
                    <span class="text-sm"><?= e(t("rw")) ?> <?= (int)$t["rw_score"] ?> · <?= e(t("math")) ?> <?= (int)$t["math_score"] ?></span>
                    <span class="font-bold w-16 text-right"><?= $t["rw_score"] + $t["math_score"] ?></span>
                    <form method="POST" onsubmit="return confirm('<?= e(t("confirm_delete")) ?>')"><?= csrf_field() ?><input type="hidden" name="act" value="sat_test_delete"><input type="hidden" name="id" value="<?= (int)$t["id"] ?>"><button class="text-sm text-red-700"><?= e(t("delete")) ?></button></form>
                </div>
            <?php endforeach; ?>
        </section>

        <h2 class="font-bold text-lg"><?= e(t("topics")) ?></h2>
        <p class="text-sm text-slate-500"><?= e(t("materials_note")) ?></p>
        <?php $render_topics(); ?>

    <?php else:
        $problems = $q("SELECT * FROM study_imo_problems WHERE user_id = ? ORDER BY COALESCE(solved_on, DATE(created_at)) DESC, id DESC", "i", $user_id);
        $per_area = [];
        foreach ($problems as $p) {
            $per_area[$p["area"]][$p["status"]] = ($per_area[$p["area"]][$p["status"]] ?? 0) + 1;
        }
        $status_label = ["solved" => t("solved"), "partial" => t("partial"), "unsolved" => t("unsolved")];
    ?>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <?php foreach (IMO_AREAS as $key => $label): ?>
                <div class="<?= $card ?>">
                    <div class="text-sm text-slate-500"><?= e(tl($label)) ?></div>
                    <div class="text-2xl font-bold"><?= (int)($per_area[$key]["solved"] ?? 0) ?></div>
                    <div class="text-xs text-slate-500"><?= e(t("solved_count")) ?><?php if (!empty($per_area[$key]["partial"])): ?> · <?= (int)$per_area[$key]["partial"] ?> <?= e(mb_strtolower(t("partial"))) ?><?php endif; ?></div>
                </div>
            <?php endforeach; ?>
        </div>

        <section class="mb-6">
            <h2 class="font-bold text-lg mb-3"><?= e(t("problems")) ?></h2>
            <form method="POST" class="<?= $card ?> grid md:grid-cols-6 gap-2 mb-3">
                <?= csrf_field() ?><input type="hidden" name="act" value="imo_add">
                <input name="source" required maxlength="150" placeholder="<?= e(t("source")) ?>" class="border rounded-lg px-3 py-2 md:col-span-2">
                <select name="area" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("area")) ?>"><?php foreach (IMO_AREAS as $k => $l): ?><option value="<?= $k ?>"><?= e(tl($l)) ?></option><?php endforeach; ?></select>
                <select name="difficulty" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("difficulty")) ?>"><?php for ($i = 1; $i <= 5; $i++): ?><option value="<?= $i ?>" <?= $i === 3 ? "selected" : "" ?>><?= e(t("difficulty")) ?>: <?= $i ?></option><?php endfor; ?></select>
                <select name="status" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("status")) ?>"><?php foreach ($status_label as $k => $l): ?><option value="<?= $k ?>"><?= e($l) ?></option><?php endforeach; ?></select>
                <input type="date" name="solved_on" value="<?= $today ?>" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("date")) ?>">
                <textarea name="key_idea" maxlength="3000" rows="2" placeholder="<?= e(t("key_idea")) ?>" class="border rounded-lg px-3 py-2 md:col-span-5"></textarea>
                <button class="<?= $btn ?>"><?= e(t("add")) ?></button>
            </form>
            <?php foreach ($problems as $p): ?>
                <div class="bg-white rounded-lg border px-4 py-3 mb-2">
                    <div class="flex flex-wrap items-center gap-3">
                        <span class="font-semibold flex-1"><?= e($p["source"]) ?></span>
                        <span class="text-sm text-slate-500"><?= e(tl(IMO_AREAS[$p["area"]] ?? ["", ""])) ?> · <?= str_repeat("★", (int)$p["difficulty"]) ?></span>
                        <form method="POST" class="flex gap-1">
                            <?= csrf_field() ?><input type="hidden" name="act" value="imo_status"><input type="hidden" name="id" value="<?= (int)$p["id"] ?>">
                            <select name="status" onchange="this.form.submit()" class="border rounded px-2 py-1 text-sm"><?php foreach ($status_label as $k => $l): ?><option value="<?= $k ?>" <?= $p["status"] === $k ? "selected" : "" ?>><?= e($l) ?></option><?php endforeach; ?></select>
                        </form>
                        <form method="POST" onsubmit="return confirm('<?= e(t("confirm_delete")) ?>')"><?= csrf_field() ?><input type="hidden" name="act" value="imo_delete"><input type="hidden" name="id" value="<?= (int)$p["id"] ?>"><button class="text-sm text-red-700"><?= e(t("delete")) ?></button></form>
                    </div>
                    <?php if ($p["key_idea"]): ?><p class="text-sm mt-1 text-slate-700 whitespace-pre-line"><?= e($p["key_idea"]) ?></p><?php endif; ?>
                </div>
            <?php endforeach; ?>
        </section>

        <h2 class="font-bold text-lg"><?= e(t("topics")) ?> · <?= $confident ?> / <?= count($all_topics) ?> <?= e(mb_strtolower(t("confident"))) ?></h2>
        <p class="text-sm text-slate-500"><?= e(t("materials_note")) ?></p>
        <?php $render_topics(); ?>
    <?php endif; ?>

<?php
// =================================================================
// IB GRADES
// =================================================================
elseif ($tab === "grades"):

    merge_algebra_geometry($user_id);

    $term = in_array($_GET["term"] ?? "", ["0", "1", "2"], true) ? (int)$_GET["term"] : ib_term_of($today);
    $subjects = $q("SELECT * FROM study_ib_subjects WHERE user_id = ? ORDER BY id", "i", $user_id);
    $subjects_by_id = array_column($subjects, null, "id");
    $all = $q("SELECT * FROM study_ib_assessments WHERE user_id = ? ORDER BY status = 'graded', due_date IS NULL, due_date, id DESC", "i", $user_id);
    // Works without a semester (added before semesters existed) go by their date
    foreach ($all as &$a) {
        $a["term"] = $a["term"] ? (int)$a["term"] : ib_term_of($a["due_date"]);
    }
    unset($a);
    $assessments = $term ? array_values(array_filter($all, fn($a) => $a["term"] === $term)) : $all;
    $kinds = array_map(fn($k) => tl([$k[1], $k[2]]), IB_KINDS);
    $statuses = ["todo" => t("todo"), "submitted" => t("submitted"), "graded" => t("graded")];
    $preselect = (int)($_GET["add"] ?? 0);

    $per_subject = [];
    foreach ($assessments as $a) {
        $per_subject[$a["subject_id"]][] = $a;
    }
    $upcoming = array_values(array_filter($assessments, fn($a) => $a["status"] !== "graded" && !empty(IB_KINDS[$a["kind"]][0]) && (!$a["due_date"] || $a["due_date"] >= $today)));

    $assess_form = function ($a = null) use ($subjects, $kinds, $statuses, $term, $preselect) {
        $sel = (int)($a["subject_id"] ?? $preselect);
        $a_term = $a["term"] ?? ($term ?: "");
        ?>
        <select name="subject_id" required class="min-w-0 w-full border rounded-lg px-3 py-2 md:col-span-2" aria-label="<?= e(t("subject")) ?>">
            <?php foreach ($subjects as $s): ?><option value="<?= (int)$s["id"] ?>" <?= $sel === (int)$s["id"] ? "selected" : "" ?>><?= e($s["name"]) ?></option><?php endforeach; ?>
        </select>
        <input name="title" required maxlength="200" value="<?= e($a["title"] ?? "") ?>" placeholder="<?= e(t("title")) ?>" class="min-w-0 w-full border rounded-lg px-3 py-2 md:col-span-2">
        <select name="kind" class="min-w-0 w-full border rounded-lg px-3 py-2 md:col-span-2" aria-label="<?= e(t("kind")) ?>"><?php foreach ($kinds as $k => $l): ?><option value="<?= $k ?>" <?= ($a["kind"] ?? "summative") === $k ? "selected" : "" ?>><?= e($l) ?></option><?php endforeach; ?></select>
        <input type="date" name="due_date" value="<?= e($a["due_date"] ?? "") ?>" class="min-w-0 w-full border rounded-lg px-3 py-2 md:col-span-2" aria-label="<?= e(t("due")) ?>">
        <select name="term" class="min-w-0 w-full border rounded-lg px-3 py-2" aria-label="<?= e(t("g_term")) ?>">
            <option value="" <?= $a_term === "" ? "selected" : "" ?>><?= e(t("g_term")) ?>: <?= e(t("g_auto_term")) ?></option>
            <option value="1" <?= (string)$a_term === "1" ? "selected" : "" ?>><?= e(t("g_term1")) ?></option>
            <option value="2" <?= (string)$a_term === "2" ? "selected" : "" ?>><?= e(t("g_term2")) ?></option>
        </select>
        <select name="status" class="min-w-0 w-full border rounded-lg px-3 py-2" aria-label="<?= e(t("status")) ?>"><?php foreach ($statuses as $k => $l): ?><option value="<?= $k ?>" <?= ($a["status"] ?? "todo") === $k ? "selected" : "" ?>><?= e($l) ?></option><?php endforeach; ?></select>
        <div class="md:col-span-6 flex flex-wrap items-center gap-2 text-sm">
            <span class="text-slate-600"><?= e(t("criteria")) ?>:</span>
            <?php foreach (["a", "b", "c", "d"] as $c): ?>
                <label class="flex items-center gap-1"><?= strtoupper($c) ?><input type="number" name="crit_<?= $c ?>" min="0" max="8" value="<?= e($a["crit_" . $c] ?? "") ?>" class="border rounded-lg px-2 py-1 w-16"></label>
            <?php endforeach; ?>
            <span class="text-xs text-slate-500"><?= e(t("g_partial_ok")) ?></span>
        </div>
        <textarea name="feedback" maxlength="3000" rows="2" placeholder="<?= e(t("feedback")) ?> (<?= e(t("optional")) ?>)" class="min-w-0 w-full border rounded-lg px-3 py-2 md:col-span-6"><?= e($a["feedback"] ?? "") ?></textarea>
        <?php
    };
    $grade_color = fn($g) => $g >= 6 ? "bg-green-600 text-white" : ($g >= 4 ? "bg-amber-400 text-slate-900" : "bg-red-600 text-white");
?>

    <div class="flex flex-wrap items-center gap-2 mb-5">
        <?php foreach ([1 => t("g_term1"), 2 => t("g_term2"), 0 => t("g_year")] as $k => $label): ?>
            <a href="?tab=grades&term=<?= $k ?>" class="px-4 py-2 rounded-full border <?= $term === $k ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50" ?>"><?= e($label) ?></a>
        <?php endforeach; ?>
    </div>

    <?php $missing_nis = nis_missing_subjects(array_column($subjects, "name")); if ($missing_nis): ?>
        <form method="POST" class="<?= $card ?> mb-6 flex flex-wrap items-center gap-3">
            <?= csrf_field() ?><input type="hidden" name="act" value="ib_seed_nis">
            <button class="<?= $btn ?>">📚 <?= e(t("g_add_nis")) ?></button>
            <span class="text-sm text-slate-600"><?= e(t("g_missing")) ?>: <?= e(implode(", ", array_map("tl", $missing_nis))) ?></span>
            <span class="text-sm text-slate-500 w-full"><?= e(t("g_add_nis_hint")) ?></span>
        </form>
    <?php endif; ?>

    <?php if ($subjects):
        $estimates = [];
        foreach ($subjects as $s) {
            $estimates[$s["id"]] = ib_estimate($per_subject[$s["id"]] ?? [], $s["boundaries"]);
        }
        $gpa = gpa_from_estimates($estimates);
        [$gpa_words, $gpa_color] = gpa_rating($gpa[0] ?? 0);
        $fill = $gpa ? $gpa[0] / 4 : 0;
        $goal = (float)($settings_row["gpa_goal"] ?? 3.9);
        $goal_name = (string)($settings_row["gpa_goal_name"] ?? "Harvard"); ?>
    <section class="<?= $card ?> mb-6 flex flex-wrap items-center gap-6">
        <svg viewBox="0 0 80 200" class="w-16 h-40 shrink-0" role="img" aria-label="GPA <?= $gpa ? number_format($gpa[0], 2) : "—" ?> / 4.0">
            <defs><clipPath id="flask"><path d="M28 6 h24 v104 a34 34 0 1 1 -24 0 z"/></clipPath></defs>
            <g clip-path="url(#flask)">
                <rect x="0" y="0" width="80" height="200" fill="#e2e8f0"/>
                <rect x="0" y="<?= round(6 + 192 * (1 - $fill), 1) ?>" width="80" height="200" fill="<?= $gpa_color ?>"/>
            </g>
            <path d="M28 6 h24 v104 a34 34 0 1 1 -24 0 z" fill="none" stroke="#334155" stroke-width="3"/>
            <path d="M22 6 h36" stroke="#334155" stroke-width="4" stroke-linecap="round"/>
            <?php foreach ([1, 2, 3] as $m): $y = round(6 + 192 * (1 - $m / 4)); ?><path d="M52 <?= $y ?> h-8" stroke="#334155" stroke-width="2"/><?php endforeach; ?>
            <?php $goal_y = round(6 + 192 * (1 - $goal / 4), 1); ?>
            <path d="M14 <?= $goal_y ?> H66" stroke="#b91c1c" stroke-width="3" stroke-dasharray="5 3"/>
            <text x="68" y="<?= $goal_y + 4 ?>" font-size="12" fill="#b91c1c" font-weight="bold">★</text>
        </svg>
        <div class="flex-1 min-w-[14rem]">
            <div class="text-sm text-slate-500">GPA (4.0) · <?= e($term ? t("g_term" . $term) : t("g_year")) ?></div>
            <?php if ($gpa): ?>
                <div class="text-5xl font-bold" style="color: <?= $gpa_color ?>"><?= $gpa[2] ? "≈" : "" ?><?= number_format($gpa[0], 2) ?><span class="text-xl text-slate-400"> / 4.0</span></div>
                <div class="text-lg font-semibold mt-1"><?= e(tl($gpa_words)) ?></div>
                <div class="text-xs text-slate-500 mt-1"><?= e(t("g_gpa_from")) ?> <?= $gpa[1] ?> / <?= count($subjects) ?> · <?= e(t("g_gpa_hint")) ?></div>
            <?php else: ?>
                <div class="text-5xl font-bold text-slate-300">— <span class="text-xl">/ 4.0</span></div>
                <div class="text-sm text-slate-500 mt-1"><?= e(t("g_gpa_empty")) ?></div>
            <?php endif; ?>
        </div>
        <div class="w-full lg:w-80 rounded-xl border-2 border-red-200 bg-red-50 p-4">
            <div class="text-sm text-red-800 font-semibold">★ <?= e(t("g_goal")) ?>: <?= e($goal_name) ?> · GPA <?= number_format($goal, 2) ?>+</div>
            <?php if ($gpa): $gap = round($goal - $gpa[0], 2); ?>
                <div class="text-2xl font-bold mt-1 <?= $gap <= 0 ? "text-green-700" : "text-red-800" ?>">
                    <?= $gap <= 0 ? "✓ " . e(t("g_goal_ok")) : "+" . number_format($gap, 2) . " " . e(t("g_goal_left")) ?>
                </div>
            <?php endif; ?>
            <?php if (preg_match('/harvard|гарвард/iu', $goal_name)): ?>
                <p class="text-xs text-red-900/80 mt-2"><?= e(t("g_harvard_note")) ?></p>
            <?php endif; ?>
            <details class="mt-2 text-sm">
                <summary class="cursor-pointer text-red-800"><?= e(t("g_goal_change")) ?></summary>
                <form method="POST" class="flex flex-wrap gap-2 mt-2">
                    <?= csrf_field() ?><input type="hidden" name="act" value="gpa_goal"><input type="hidden" name="term" value="<?= $term ?>">
                    <input name="gpa_goal_name" value="<?= e($goal_name) ?>" maxlength="60" class="border rounded-lg px-2 py-1 flex-1 min-w-0" aria-label="<?= e(t("g_goal")) ?>">
                    <input name="gpa_goal" type="number" step="0.01" min="0" max="4" value="<?= number_format($goal, 2) ?>" class="border rounded-lg px-2 py-1 w-20" aria-label="GPA">
                    <button class="bg-red-800 text-white px-3 py-1 rounded-lg"><?= e(t("save")) ?></button>
                </form>
            </details>
        </div>
    </section>

    <section class="<?= $card ?> mb-6 overflow-x-auto">
        <h2 class="font-bold text-lg mb-1"><?= e(t("g_table")) ?> · <?= e($term ? t("g_term" . $term) : t("g_year")) ?></h2>
        <p class="text-xs text-slate-500 mb-3"><?= e(t("g_forecast_hint")) ?></p>
        <table class="w-full text-sm min-w-[48rem]">
            <thead>
                <tr class="text-left text-slate-500 border-b">
                    <th class="py-2 pr-2"><?= e(t("subject")) ?></th>
                    <?php foreach (["A", "B", "C", "D"] as $c): ?><th class="py-2 px-1 text-center w-12"><?= $c ?></th><?php endforeach; ?>
                    <th class="py-2 px-2 text-center"><?= e(t("g_works")) ?></th>
                    <th class="py-2 px-2"><?= e(t("g_next")) ?></th>
                    <th class="py-2 px-2 text-center"><?= e(t("g_forecast")) ?></th>
                    <th class="py-2 px-2 text-center">GPA</th>
                    <th class="py-2 pl-2"></th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($subjects as $s):
                $list = $per_subject[$s["id"]] ?? [];
                $est = $estimates[$s["id"]];
                $next = null;
                foreach ($list as $a) {
                    if ($a["status"] !== "graded" && !empty(IB_KINDS[$a["kind"]][0]) && $a["due_date"] && $a["due_date"] >= $today && (!$next || $a["due_date"] < $next["due_date"])) {
                        $next = $a;
                    }
                }
                $planned = count(array_filter($list, fn($a) => $a["status"] !== "graded" && !empty(IB_KINDS[$a["kind"]][0]))); ?>
                <tr class="border-b last:border-b-0">
                    <td class="py-2 pr-2 font-medium"><?= e($s["name"]) ?></td>
                    <?php foreach (["a", "b", "c", "d"] as $c): $v = $est["avg"][$c] ?? null; ?>
                        <td class="py-2 px-1 text-center <?= $v === null ? "text-slate-300" : "" ?>"><?= $v === null ? "–" : rtrim(rtrim(number_format($v, 1), "0"), ".") ?></td>
                    <?php endforeach; ?>
                    <td class="py-2 px-2 text-center"><?= $est["count"] ?? 0 ?><?php if ($planned): ?> <span class="text-slate-400">+<?= $planned ?></span><?php endif; ?></td>
                    <td class="py-2 px-2 text-xs"><?php if ($next): ?><span class="<?= strtotime($next["due_date"]) - strtotime($today) <= 7 * 86400 ? "text-red-700 font-semibold" : "text-slate-600" ?>"><?= e(date("d.m", strtotime($next["due_date"]))) ?></span> <?= e(mb_strimwidth($next["title"], 0, 28, "…")) ?><?php else: ?><span class="text-slate-300">—</span><?php endif; ?></td>
                    <td class="py-2 px-2 text-center whitespace-nowrap">
                        <?php if ($est): ?>
                            <span class="inline-block min-w-[2.5rem] px-2 py-1 rounded-lg font-bold text-base <?= $grade_color($est["grade"]) ?>"><?= $est["approx"] ? "≈" : "" ?><?= $est["grade"] ?></span>
                            <div class="text-[11px] text-slate-500"><?= $est["total"] ?>/32<?php if ($est["to_next"] !== null): ?> · +<?= $est["to_next"] ?> <?= e(t("g_to_next")) ?><?php endif; ?></div>
                        <?php else: ?><span class="text-slate-300">—</span><?php endif; ?>
                    </td>
                    <td class="py-2 px-2 text-center whitespace-nowrap"><?php if ($est): ?><span class="font-semibold"><?= number_format(IB_TO_GPA[$est["grade"]][0], 1) ?></span> <span class="text-xs text-slate-500"><?= IB_TO_GPA[$est["grade"]][1] ?></span><?php else: ?><span class="text-slate-300">—</span><?php endif; ?></td>
                    <td class="py-2 pl-2 text-right"><a href="?tab=grades&term=<?= $term ?>&add=<?= (int)$s["id"] ?>#add-work" class="text-blue-700 whitespace-nowrap"><?= e(t("g_add_for")) ?></a></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </section>
    <?php endif; ?>

    <?php if ($upcoming): ?>
    <section class="<?= $card ?> mb-6">
        <h2 class="font-bold text-lg mb-2"><?= e(t("g_upcoming")) ?></h2>
        <?php foreach (array_slice($upcoming, 0, 12) as $a): $s = $subjects_by_id[$a["subject_id"]] ?? null; ?>
            <div class="flex flex-wrap gap-3 py-1 text-sm">
                <span class="w-24 <?= $a["due_date"] && strtotime($a["due_date"]) - strtotime($today) <= 7 * 86400 ? "text-red-700 font-semibold" : "text-slate-500" ?>"><?= $a["due_date"] ? e(date("d.m.Y", strtotime($a["due_date"]))) : "—" ?></span>
                <span class="font-medium"><?= e($s["name"] ?? "") ?></span>
                <span><?= e($a["title"]) ?></span>
                <span class="text-slate-500">· <?= e($kinds[$a["kind"]] ?? "") ?></span>
            </div>
        <?php endforeach; ?>
    </section>
    <?php endif; ?>

    <section>
        <h2 class="font-bold text-lg mb-3" id="add-work"><?= e(t("assessments")) ?></h2>
        <?php if ($subjects): ?>
        <form method="POST" class="<?= $card ?> grid grid-cols-1 md:grid-cols-6 gap-2 mb-4 <?= $preselect ? "ring-2 ring-blue-700" : "" ?>">
            <?= csrf_field() ?><input type="hidden" name="act" value="ib_assess_add">
            <div class="md:col-span-6 font-semibold"><?= e(t("add_assessment")) ?></div>
            <?php $assess_form(); ?>
            <button class="<?= $btn ?> justify-self-start"><?= e(t("add")) ?></button>
        </form>
        <?php endif; ?>

        <?php if (!$assessments): ?><p class="text-slate-500"><?= e(t("nothing_yet")) ?></p><?php endif; ?>
        <?php foreach ($assessments as $a):
            $s = $subjects_by_id[$a["subject_id"]] ?? null;
            $g = $s ? ib_grade($a["crit_a"], $a["crit_b"], $a["crit_c"], $a["crit_d"], $s["boundaries"]) : null;
            $late = $a["status"] === "todo" && $a["due_date"] && $a["due_date"] < $today; ?>
            <div class="bg-white rounded-lg border px-4 py-3 mb-2" id="assess-<?= (int)$a["id"] ?>">
                <div class="flex flex-wrap items-center gap-3">
                    <span class="flex-1"><span class="font-semibold"><?= e($a["title"]) ?></span> <span class="text-sm text-slate-500">· <?= e($s["name"] ?? "") ?> · <?= e($kinds[$a["kind"]] ?? "") ?> · <?= e(t("g_term" . $a["term"])) ?></span></span>
                    <?php if ($a["due_date"]): ?><span class="text-sm <?= $late ? "text-red-700 font-semibold" : "text-slate-500" ?>"><?= e(date("d.m.Y", strtotime($a["due_date"]))) ?></span><?php endif; ?>
                    <span class="text-sm"><?= e($statuses[$a["status"]] ?? "") ?></span>
                    <span class="text-sm text-slate-600">
                        <?php foreach (["a", "b", "c", "d"] as $c): ?><?= strtoupper($c) ?>:<?= $a["crit_" . $c] === null ? "–" : (int)$a["crit_" . $c] ?> <?php endforeach; ?>
                    </span>
                    <span class="w-14 text-right"><?php if ($g): ?><span class="text-xl font-bold"><?= $g ?></span><span class="text-xs text-slate-500">/7</span><?php endif; ?></span>
                </div>
                <?php if ($a["feedback"]): ?><p class="text-sm mt-1 text-slate-700 whitespace-pre-line"><?= e($a["feedback"]) ?></p><?php endif; ?>
                <details class="mt-1 text-sm">
                    <summary class="cursor-pointer text-slate-500"><?= e(t("edit")) ?></summary>
                    <form method="POST" class="grid grid-cols-1 md:grid-cols-6 gap-2 mt-2">
                        <?= csrf_field() ?><input type="hidden" name="act" value="ib_assess_save"><input type="hidden" name="id" value="<?= (int)$a["id"] ?>">
                        <?php $assess_form($a); ?>
                        <button class="<?= $btn ?> justify-self-start"><?= e(t("save")) ?></button>
                    </form>
                    <form method="POST" class="mt-2" onsubmit="return confirm('<?= e(t("confirm_delete")) ?>')"><?= csrf_field() ?><input type="hidden" name="act" value="ib_assess_delete"><input type="hidden" name="id" value="<?= (int)$a["id"] ?>"><button class="text-red-700"><?= e(t("delete")) ?></button></form>
                </details>
            </div>
        <?php endforeach; ?>
    </section>

    <details class="<?= $card ?> mt-6">
        <summary class="cursor-pointer font-bold text-lg"><?= e(t("g_edit_subjects")) ?></summary>
        <div class="grid md:grid-cols-3 gap-4 mt-4">
            <?php foreach ($subjects as $s): ?>
                <div class="border rounded-lg p-3 text-sm">
                    <form method="POST" class="space-y-2">
                        <?= csrf_field() ?><input type="hidden" name="act" value="ib_subject_save"><input type="hidden" name="id" value="<?= (int)$s["id"] ?>">
                        <input name="name" required maxlength="100" value="<?= e($s["name"]) ?>" class="<?= $input ?>">
                        <select name="level" class="<?= $input ?>"><option <?= $s["level"] === "SL" ? "selected" : "" ?>>SL</option><option <?= $s["level"] === "HL" ? "selected" : "" ?>>HL</option></select>
                        <label class="block text-xs text-slate-500"><?= e(t("boundaries")) ?><input name="boundaries" value="<?= e($s["boundaries"]) ?>" class="<?= $input ?>"></label>
                        <button class="<?= $btn ?>"><?= e(t("save")) ?></button>
                    </form>
                    <form method="POST" class="mt-2" onsubmit="return confirm('<?= e(t("confirm_delete")) ?>')"><?= csrf_field() ?><input type="hidden" name="act" value="ib_subject_delete"><input type="hidden" name="id" value="<?= (int)$s["id"] ?>"><button class="text-red-700"><?= e(t("delete")) ?></button></form>
                </div>
            <?php endforeach; ?>
            <form method="POST" class="border rounded-lg p-3 space-y-2 text-sm">
                <?= csrf_field() ?><input type="hidden" name="act" value="ib_subject_add">
                <div class="font-semibold"><?= e(t("add_subject")) ?></div>
                <input name="name" required maxlength="100" placeholder="<?= e(t("subject_name")) ?>" class="<?= $input ?>">
                <select name="level" class="<?= $input ?>"><option>SL</option><option>HL</option></select>
                <label class="block text-xs text-slate-500"><?= e(t("boundaries")) ?><input name="boundaries" value="0,6,10,15,19,24,28" class="<?= $input ?>"></label>
                <button class="<?= $btn ?>"><?= e(t("add")) ?></button>
            </form>
        </div>
    </details>

<?php
// =================================================================
// TRANSCRIPT: grades of all years, GPA by semester, cumulative GPA
// =================================================================
elseif ($tab === "transcript"):

    $current_grade = (int)($settings_row["current_grade"] ?? 10);
    $goal = (float)($settings_row["gpa_goal"] ?? 3.9);
    $goal_name = (string)($settings_row["gpa_goal_name"] ?? "Harvard");
    $subjects = $q("SELECT * FROM study_ib_subjects WHERE user_id = ? ORDER BY id", "i", $user_id);
    $past = $q("SELECT * FROM study_past_grades WHERE user_id = ? ORDER BY grade_level, semester, id", "i", $user_id);

    // Semesters: "grade-sem" => [marks: key => mark, names: key => name, forecast: bool]
    $sems = [];
    $names = [];
    foreach ($past as $r) {
        $k = $r["grade_level"] . "-" . $r["semester"];
        $key = subject_key($r["subject"]);
        $sems[$k]["marks"][$key] = (int)$r["mark"];
        $sems[$k]["forecast"] = false;
        $names[$key] = $names[$key] ?? $r["subject"];
    }
    // The current year: the forecast from the IB grades tab, unless final grades are entered
    $all_assess = $q("SELECT * FROM study_ib_assessments WHERE user_id = ?", "i", $user_id);
    foreach ([1, 2] as $sem) {
        $k = $current_grade . "-" . $sem;
        if (isset($sems[$k])) {
            continue;
        }
        foreach ($subjects as $s) {
            $list = array_filter($all_assess, fn($a) => (int)$a["subject_id"] === (int)$s["id"] && ($a["term"] ? (int)$a["term"] : ib_term_of($a["due_date"])) === $sem);
            $est = ib_estimate(array_values($list), $s["boundaries"]);
            if ($est) {
                $key = subject_key($s["name"]);
                $sems[$k]["marks"][$key] = $est["grade"];
                $sems[$k]["forecast"] = true;
                $names[$key] = $names[$key] ?? $s["name"];
            }
        }
    }
    uksort($sems, fn($a, $b) => array_map("intval", explode("-", $a)) <=> array_map("intval", explode("-", $b)));
    foreach ($subjects as $s) {
        $names[subject_key($s["name"])] = $names[subject_key($s["name"])] ?? $s["name"];
    }

    $points = [];
    $cum_marks = [];
    $cum_forecast = false;
    foreach ($sems as $k => $data) {
        [$g, $sm] = array_map("intval", explode("-", $k));
        $gpa_value = gpa_of_marks($data["marks"]);
        if ($gpa_value === null) {
            continue;
        }
        $points[] = ["key" => $k, "grade" => $g, "sem" => $sm, "gpa" => $gpa_value, "forecast" => $data["forecast"], "n" => count($data["marks"])];
        if ($g >= TRANSCRIPT_FROM_GRADE) {
            $cum_marks = array_merge($cum_marks, array_values($data["marks"]));
            $cum_forecast = $cum_forecast || $data["forecast"];
        }
    }
    $cumulative = gpa_of_marks($cum_marks);
    [$cum_words, $cum_color] = gpa_rating($cumulative ?? 0);

    // Entry form: which grade and semester
    $eg = in_array((int)($_GET["g"] ?? 0), TRANSCRIPT_GRADES, true) ? (int)$_GET["g"] : max(7, min(12, $current_grade - 1));
    $es = ($_GET["s"] ?? "") === "2" ? 2 : 1;
    $entered = [];
    foreach ($past as $r) {
        if ((int)$r["grade_level"] === $eg && (int)$r["semester"] === $es) {
            $entered[subject_key($r["subject"])] = $r;
        }
    }
    $form_rows = [];
    foreach ($subjects as $s) {
        $form_rows[subject_key($s["name"])] = $s["name"];
    }
    foreach ($entered as $key => $r) {
        $form_rows[$key] = $form_rows[$key] ?? $r["subject"];
    }
    $mark_class = fn($m) => $m >= 6 ? "bg-green-600 text-white" : ($m >= 4 ? "bg-amber-300 text-slate-900" : "bg-red-600 text-white");
    $sem_label = fn($g, $s) => $g . "·" . $s;
?>

    <h2 class="text-2xl font-bold"><?= e(t("tr_title")) ?></h2>
    <p class="text-slate-600 mt-1 mb-5"><?= e(t("tr_hint")) ?></p>

    <div class="grid lg:grid-cols-3 gap-6 mb-6">
        <section class="<?= $card ?>">
            <div class="text-sm text-slate-500"><?= e(t("tr_cumulative")) ?></div>
            <?php if ($cumulative !== null): $gap = round($goal - $cumulative, 2); ?>
                <div class="text-5xl font-bold mt-1" style="color: <?= $cum_color ?>"><?= $cum_forecast ? "≈" : "" ?><?= number_format($cumulative, 2) ?><span class="text-xl text-slate-400"> / 4.0</span></div>
                <div class="text-lg font-semibold"><?= e(tl($cum_words)) ?></div>
                <div class="mt-3 rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm">
                    <div class="font-semibold text-red-800">★ <?= e($goal_name) ?> · <?= number_format($goal, 2) ?>+</div>
                    <div class="text-xl font-bold <?= $gap <= 0 ? "text-green-700" : "text-red-800" ?>"><?= $gap <= 0 ? "✓ " . e(t("g_goal_ok")) : "+" . number_format($gap, 2) . " " . e(t("g_goal_left")) ?></div>
                </div>
            <?php else: ?>
                <div class="text-5xl font-bold text-slate-300 mt-1">—</div>
            <?php endif; ?>
            <p class="text-xs text-slate-500 mt-3"><?= e(t("tr_cumulative_hint")) ?></p>
            <form method="POST" class="flex items-center gap-2 text-sm mt-3">
                <?= csrf_field() ?><input type="hidden" name="act" value="tr_current">
                <label for="cur-grade"><?= e(t("tr_current_grade")) ?></label>
                <select id="cur-grade" name="current_grade" onchange="this.form.submit()" class="border rounded-lg pl-3 pr-8 py-1 min-w-[4.5rem]">
                    <?php foreach (TRANSCRIPT_GRADES as $g): ?><option value="<?= $g ?>" <?= $g === $current_grade ? "selected" : "" ?>><?= $g ?></option><?php endforeach; ?>
                </select>
            </form>
        </section>

        <section class="<?= $card ?> lg:col-span-2">
            <h3 class="font-bold text-lg mb-2"><?= e(t("tr_by_sem")) ?></h3>
            <?php if (!$points): ?>
                <p class="text-slate-500"><?= e(t("tr_empty")) ?></p>
            <?php else:
                $W = 640; $H = 240; $L = 34; $R = 20; $T = 14; $B = 46;
                $n = count($points);
                $x = fn($i) => $n === 1 ? ($L + ($W - $L - $R) / 2) : $L + $i * ($W - $L - $R) / ($n - 1);
                $y = fn($v) => $T + (4 - $v) / 4 * ($H - $T - $B);
                $line = [];
                foreach ($points as $i => $p) { $line[] = round($x($i), 1) . "," . round($y($p["gpa"]), 1); } ?>
                <svg viewBox="0 0 <?= $W ?> <?= $H ?>" class="w-full h-auto" role="img" aria-label="<?= e(t("tr_by_sem")) ?>">
                    <?php foreach ([0, 1, 2, 3, 4] as $v): ?>
                        <line x1="<?= $L ?>" x2="<?= $W - $R ?>" y1="<?= $y($v) ?>" y2="<?= $y($v) ?>" stroke="#e2e8f0" stroke-width="1"/>
                        <text x="<?= $L - 8 ?>" y="<?= $y($v) + 4 ?>" font-size="11" fill="#64748b" text-anchor="end"><?= $v ?>.0</text>
                    <?php endforeach; ?>
                    <line x1="<?= $L ?>" x2="<?= $W - $R ?>" y1="<?= $y($goal) ?>" y2="<?= $y($goal) ?>" stroke="#b91c1c" stroke-width="1.5" stroke-dasharray="6 4"/>
                    <text x="<?= $W - $R ?>" y="<?= $y($goal) - 5 ?>" font-size="11" fill="#b91c1c" text-anchor="end">★ <?= e($goal_name) ?> <?= number_format($goal, 2) ?></text>
                    <polyline points="<?= implode(" ", $line) ?>" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>
                    <?php foreach ($points as $i => $p): $px = round($x($i), 1); $py = round($y($p["gpa"]), 1); ?>
                        <g>
                            <title><?= $p["grade"] ?> <?= e(t("tr_class")) ?>, <?= $p["sem"] ?> <?= e(t("tr_sem")) ?><?= $p["forecast"] ? " (" . e(t("tr_forecast")) . ")" : "" ?>: GPA <?= number_format($p["gpa"], 2) ?> · <?= $p["n"] ?> <?= e(t("subjects")) ?></title>
                            <circle cx="<?= $px ?>" cy="<?= $py ?>" r="12" fill="transparent"/>
                            <circle cx="<?= $px ?>" cy="<?= $py ?>" r="5" fill="<?= $p["forecast"] ? "#fff" : "#2563eb" ?>" stroke="#2563eb" stroke-width="2"/>
                        </g>
                        <text x="<?= $px ?>" y="<?= $H - $B + 18 ?>" font-size="11" fill="#334155" text-anchor="middle"><?= $sem_label($p["grade"], $p["sem"]) ?><?= $p["forecast"] ? "*" : "" ?></text>
                        <text x="<?= $px ?>" y="<?= $H - $B + 34 ?>" font-size="11" fill="#64748b" text-anchor="middle"><?= number_format($p["gpa"], 2) ?></text>
                    <?php endforeach; ?>
                </svg>
                <p class="text-xs text-slate-500">9·1 = <?= e(t("tr_grade")) ?> 9, 1 <?= e(t("tr_sem")) ?> · * <?= e(t("tr_forecast")) ?> (○)</p>
            <?php endif; ?>
        </section>
    </div>

    <?php if ($points): ?>
    <section class="<?= $card ?> mb-6 overflow-x-auto">
        <h3 class="font-bold text-lg mb-3"><?= e(t("tr_by_subject")) ?></h3>
        <table class="text-sm min-w-full">
            <thead><tr class="text-slate-500 border-b">
                <th class="text-left py-2 pr-3"><?= e(t("subject")) ?></th>
                <?php foreach ($points as $p): ?><th class="py-2 px-1 text-center whitespace-nowrap"><?= $sem_label($p["grade"], $p["sem"]) ?><?= $p["forecast"] ? "*" : "" ?></th><?php endforeach; ?>
                <th class="py-2 pl-3 text-left"><?= e(t("tr_trend")) ?></th>
            </tr></thead>
            <tbody>
            <?php foreach ($names as $key => $name):
                $row = array_map(fn($p) => $sems[$p["key"]]["marks"][$key] ?? null, $points);
                if (!array_filter($row)) continue;
                $vals = array_values(array_filter($row, fn($v) => $v !== null)); ?>
                <tr class="border-b last:border-b-0">
                    <td class="py-1.5 pr-3 font-medium whitespace-nowrap"><?= e($name) ?></td>
                    <?php foreach ($row as $m): ?>
                        <td class="py-1.5 px-1 text-center"><?php if ($m): ?><span class="inline-block w-7 py-0.5 rounded font-semibold <?= $mark_class($m) ?>"><?= $m ?></span><?php else: ?><span class="text-slate-300">–</span><?php endif; ?></td>
                    <?php endforeach; ?>
                    <td class="py-1.5 pl-3">
                        <?php if (count($vals) > 1): $sw = 110; $sh = 28; $cnt = count($vals); ?>
                            <svg viewBox="0 0 <?= $sw ?> <?= $sh ?>" width="<?= $sw ?>" height="<?= $sh ?>" role="img" aria-label="<?= e($name) ?>: <?= implode(", ", $vals) ?>">
                                <polyline fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round" points="<?= implode(" ", array_map(fn($i, $v) => round(4 + $i * ($sw - 8) / ($cnt - 1), 1) . "," . round(4 + (7 - $v) / 6 * ($sh - 8), 1), array_keys($vals), $vals)) ?>"/>
                                <circle cx="<?= $sw - 4 ?>" cy="<?= round(4 + (7 - end($vals)) / 6 * ($sh - 8), 1) ?>" r="3" fill="#2563eb"/>
                            </svg>
                        <?php else: ?><span class="text-slate-300">—</span><?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </section>
    <?php endif; ?>

    <section class="<?= $card ?>" id="enter">
        <h3 class="font-bold text-lg mb-3"><?= e(t("tr_enter")) ?></h3>
        <div class="flex flex-wrap gap-2 mb-4">
            <?php foreach (TRANSCRIPT_GRADES as $g): foreach ([1, 2] as $s2): $has = isset($sems[$g . "-" . $s2]) && empty($sems[$g . "-" . $s2]["forecast"]); ?>
                <a href="?tab=transcript&g=<?= $g ?>&s=<?= $s2 ?>#enter" class="px-3 py-1 rounded-full border text-sm <?= $g === $eg && $s2 === $es ? "bg-slate-900 text-white border-slate-900" : ($has ? "bg-green-50 border-green-300" : "bg-white") ?>"><?= $sem_label($g, $s2) ?><?= $has ? " ✓" : "" ?></a>
            <?php endforeach; endforeach; ?>
        </div>
        <form method="POST">
            <?= csrf_field() ?><input type="hidden" name="act" value="tr_save"><input type="hidden" name="grade_level" value="<?= $eg ?>"><input type="hidden" name="semester" value="<?= $es ?>">
            <div class="font-semibold mb-2"><?= $eg ?> <?= e(t("tr_class")) ?>, <?= $es ?> <?= e(t("tr_sem")) ?></div>
            <div class="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                <?php $i = 0; foreach ($form_rows as $key => $name): ?>
                    <label class="flex items-center gap-2 py-1 border-b">
                        <input type="hidden" name="subj[<?= $i ?>]" value="<?= e($name) ?>">
                        <span class="flex-1 min-w-0"><?= e($name) ?></span>
                        <input type="number" name="mark[<?= $i ?>]" min="1" max="7" value="<?= isset($entered[$key]) ? (int)$entered[$key]["mark"] : "" ?>" class="border rounded-lg px-2 py-1 w-16 text-center" aria-label="<?= e($name) ?>: <?= e(t("tr_mark")) ?>">
                    </label>
                <?php $i++; endforeach; ?>
                <?php for ($j = 0; $j < 3; $j++): ?>
                    <div class="flex items-center gap-2 py-1 border-b">
                        <input name="subj[<?= $i ?>]" maxlength="100" placeholder="<?= e(t("tr_other")) ?>" class="border rounded-lg px-2 py-1 flex-1 min-w-0">
                        <input type="number" name="mark[<?= $i ?>]" min="1" max="7" class="border rounded-lg px-2 py-1 w-16 text-center" aria-label="<?= e(t("tr_mark")) ?>">
                    </div>
                <?php $i++; endfor; ?>
            </div>
            <button class="<?= $btn ?> mt-4"><?= e(t("save")) ?></button>
        </form>
    </section>

<?php
// =================================================================
// SAT COURSE: lessons, unit tests, review tests
// =================================================================
elseif ($tab === "satcourse"):

    [$answers, $tests] = course_progress($user_id);
    $lesson_id = (string)($_GET["lesson"] ?? "");
    $test_id = (string)($_GET["test"] ?? "");
    $lesson = $lesson_id !== "" ? course_lesson($lesson_id) : null;
    $track = $lesson["track"] ?? (str_starts_with($test_id, "m-") ? "math" : (str_starts_with($test_id, "e-") ? "english" : (($_GET["track"] ?? "") === "english" ? "english" : "math")));
    $state = course_state($track, $answers, $tests);
    $by_id = array_column($state, null, "id");
    $test_label = function ($s) {
        if ($s["kind"] === "unit") return t("c_test_unit") . " " . $s["unit"];
        return t($s["kind"] === "review" ? "c_test_review" : "c_test_final") . " " . $s["from"] . "–" . $s["unit"];
    };
    $next_open = null;
    foreach ($state as $s) { if ($s["open"] && !$s["done"]) { $next_open = $s; break; } }
    $step_link = fn($s) => "?tab=satcourse&" . ($s["type"] === "lesson" ? "lesson=" : "test=") . rawurlencode($s["id"]);
?>
    <div class="flex flex-wrap items-center gap-2 mb-5">
        <?php foreach (["math", "english"] as $tr): ?>
            <a href="?tab=satcourse&track=<?= $tr ?>" class="px-4 py-2 rounded-full border <?= $track === $tr ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50" ?>"><?= e(tl(course_track($tr)["title"])) ?></a>
        <?php endforeach; ?>
    </div>

<?php if ($lesson): $step = $by_id[$lesson["id"]]; ?>

    <a href="?tab=satcourse&track=<?= $track ?>" class="text-blue-700">← <?= e(t("c_back_map")) ?></a>
    <?php if (!$step["open"]): ?>
        <div class="<?= $card ?> mt-4">🔒 <?= e(t("c_locked")) ?></div>
    <?php else: $warm = course_warmup($lesson); ?>
        <div class="mt-3 mb-6">
            <div class="text-sm text-slate-500"><?= e(t("c_unit")) ?> <?= (int)$lesson["unit"] ?> · <?= e(t("c_lesson")) ?> <?= $lesson["index"] + 1 ?> · <?= e($lesson["grade"]) ?></div>
            <h2 class="text-3xl font-bold"><?= e($lesson["title"]) ?></h2>
        </div>

        <div class="grid lg:grid-cols-3 gap-6 mb-6">
            <section class="<?= $card ?> lg:col-span-2 space-y-4">
                <div><h3 class="font-bold text-lg mb-1"><?= e(t("c_theory")) ?></h3><p><?= e($lesson["intro"]) ?></p></div>
                <div><h3 class="font-bold mb-1"><?= e(t("c_formulas")) ?></h3>
                    <ul class="space-y-1"><?php foreach ($lesson["formulas"] as $f): ?><li class="bg-slate-50 rounded px-3 py-1.5 font-medium"><?= e($f) ?></li><?php endforeach; ?></ul></div>
                <div><h3 class="font-bold mb-1"><?= e(t("c_steps")) ?></h3>
                    <ol class="list-decimal pl-6 space-y-0.5"><?php foreach ($lesson["steps"] as $st): ?><li><?= e($st) ?></li><?php endforeach; ?></ol></div>
                <?php if ($lesson["examples"]): ?>
                <div><h3 class="font-bold mb-1"><?= e(t("c_examples")) ?></h3>
                    <?php foreach ($lesson["examples"] as $ex): ?>
                        <div class="border-l-4 border-blue-600 bg-blue-50 rounded-r px-3 py-2 mb-2"><div class="font-medium"><?= e($ex["q"]) ?></div><div class="text-slate-700">→ <?= e($ex["a"]) ?></div></div>
                    <?php endforeach; ?></div>
                <?php endif; ?>
            </section>
            <aside class="space-y-4">
                <section class="<?= $card ?> border-amber-300 bg-amber-50">
                    <h3 class="font-bold mb-1">⚠ <?= e(t("c_traps")) ?></h3>
                    <ul class="list-disc pl-5 space-y-1 text-sm"><?php foreach ($lesson["traps"] as $tr2): ?><li><?= e($tr2) ?></li><?php endforeach; ?></ul>
                </section>
                <?php if ($lesson["tip"]): ?><section class="<?= $card ?>"><h3 class="font-bold mb-1">💡 <?= e(t("c_tip")) ?></h3><p class="text-sm"><?= e($lesson["tip"]) ?></p></section><?php endif; ?>
                <section class="<?= $card ?>">
                    <div class="text-sm text-slate-500"><?= e(t("c_practice")) ?></div>
                    <div class="text-2xl font-bold"><span id="c-answered"><?= $step["answered"] ?></span> / <?= $step["total"] ?></div>
                    <div class="h-2 bg-slate-200 rounded mt-2"><div id="c-bar" class="h-2 bg-green-600 rounded" style="width: <?= round($step["answered"] / max(1, $step["total"]) * 100) ?>%"></div></div>
                    <div class="text-xs text-slate-500 mt-1">✓ <span id="c-correct"><?= $step["correct"] ?></span></div>
                </section>
            </aside>
        </div>

        <?php if ($warm): ?>
            <h3 class="font-bold text-lg mb-2"><?= e(t("c_warmup")) ?></h3>
            <div class="space-y-3 mb-6"><?php foreach ($warm as $i => $it) { render_course_item($it, $answers[$it["key"]] ?? null, $lesson["id"], $i + 1); } ?></div>
        <?php endif; ?>

        <h3 class="font-bold text-lg mb-2"><?= e(t("c_practice")) ?></h3>
        <div class="space-y-3"><?php foreach ($lesson["practice"] as $i => $it) { render_course_item($it, $answers[$it["key"]] ?? null, $lesson["id"], $i + 1); } ?></div>

        <?php $after = null; foreach ($state as $i2 => $s) { if ($s["id"] === $lesson["id"]) { $after = $state[$i2 + 1] ?? null; } } ?>
        <div id="c-next" class="mt-6 text-center <?= $step["done"] ? "" : "hidden" ?>">
            <div class="text-green-700 font-bold text-lg mb-2">🎉 <?= e(t("c_lesson_done")) ?></div>
            <?php if ($after): ?><a href="<?= $step_link($after) ?>" class="inline-block bg-slate-900 text-white px-6 py-3 rounded-lg"><?= e(t("c_next")) ?>: <?= e($after["type"] === "lesson" ? $after["lesson"]["title"] : $test_label($after)) ?> →</a><?php endif; ?>
        </div>
    <?php endif; ?>

<?php elseif ($test_id !== "" && isset($by_id[$test_id]) && $by_id[$test_id]["type"] === "test"): $step = $by_id[$test_id]; $row = $step["row"]; $retake = isset($_GET["retake"]); ?>

    <a href="?tab=satcourse&track=<?= $track ?>" class="text-blue-700">← <?= e(t("c_back_map")) ?></a>
    <h2 class="text-3xl font-bold mt-3"><?= e($test_label($step)) ?></h2>
    <p class="text-slate-600 mb-5"><?= count($step["items"]) ?> <?= e(t("c_questions")) ?> · <?= e(t("c_pass_at")) ?></p>

    <?php if (!$step["open"]): ?>
        <div class="<?= $card ?>">🔒 <?= e(t("c_locked")) ?></div>
    <?php elseif ($row && !$retake): $given = json_decode((string)$row["answers"], true) ?: []; $passed = $row["last_score"] / max(1, $row["total"]) >= course_data()["pass_share"]; ?>
        <section class="<?= $card ?> mb-6 <?= $passed ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50" ?>">
            <div class="text-sm text-slate-600"><?= e(t("c_score")) ?></div>
            <div class="text-4xl font-bold"><?= (int)$row["last_score"] ?> / <?= (int)$row["total"] ?> <span class="text-lg text-slate-500">(<?= round($row["last_score"] / max(1, $row["total"]) * 100) ?>%)</span></div>
            <div class="font-semibold mt-1"><?= e(t($passed ? "c_passed" : "c_failed")) ?></div>
            <div class="text-sm text-slate-500 mt-1"><?= e(t("c_best")) ?>: <?= (int)$row["best_score"] ?> / <?= (int)$row["total"] ?></div>
            <div class="flex flex-wrap gap-3 mt-3">
                <a href="?tab=satcourse&test=<?= rawurlencode($test_id) ?>&retake=1" class="px-4 py-2 rounded-lg border bg-white"><?= e(t("c_retake")) ?></a>
                <?php if ($next_open): ?><a href="<?= $step_link($next_open) ?>" class="bg-slate-900 text-white px-4 py-2 rounded-lg"><?= e(t("c_continue")) ?> →</a><?php endif; ?>
            </div>
        </section>
        <h3 class="font-bold text-lg mb-2"><?= e(t("c_review_wrong")) ?></h3>
        <div class="space-y-3">
        <?php foreach ($step["items"] as $i => $key): $it = course_item($key); $g = $given[$key] ?? ""; $ok = $g !== "" && sat_check_answer($g, $it["a"]); ?>
            <div class="bg-white rounded-lg border border-l-4 <?= $ok ? "border-l-green-600" : "border-l-red-600" ?> p-4">
                <div class="whitespace-pre-line"><span class="text-slate-400"><?= $i + 1 ?>.</span> <?= e($it["q"]) ?></div>
                <?php if (!empty($it["opts"])): ?><div class="text-sm text-slate-600 mt-1"><?php foreach ($it["opts"] as $j => $o): ?><span class="mr-3"><b><?= "ABCD"[$j] ?>)</b> <?= e($o === "" ? "(no punctuation)" : $o) ?></span><?php endforeach; ?></div><?php endif; ?>
                <div class="text-sm mt-2"><?= $ok ? "✓" : "✗" ?> <?= e(t("c_your")) ?>: <b><?= $g === "" ? e(t("c_no_answer")) : e($g) ?></b> · <?= e(t("correct_answer")) ?>: <b><?= e($it["a"]) ?></b></div>
                <?php if (!$ok && $it["why"] !== ""): ?><div class="text-sm text-slate-700 mt-1 bg-slate-50 rounded p-2"><?= e($it["why"]) ?></div><?php endif; ?>
            </div>
        <?php endforeach; ?>
        </div>
    <?php else: ?>
        <form method="POST" class="space-y-3">
            <?= csrf_field() ?><input type="hidden" name="act" value="course_test"><input type="hidden" name="test" value="<?= e($test_id) ?>">
            <?php foreach ($step["items"] as $i => $key): $it = course_item($key); ?>
                <fieldset class="bg-white rounded-lg border p-4">
                    <legend class="sr-only"><?= $i + 1 ?></legend>
                    <div class="whitespace-pre-line"><span class="text-slate-400"><?= $i + 1 ?>.</span> <?= e($it["q"]) ?></div>
                    <?php if (!empty($it["opts"])): ?>
                        <div class="grid sm:grid-cols-2 gap-2 mt-3">
                            <?php foreach ($it["opts"] as $j => $o): ?>
                                <label class="flex gap-2 items-start px-3 py-2 rounded-lg border cursor-pointer has-[:checked]:bg-slate-900 has-[:checked]:text-white"><input type="radio" name="ans[<?= e($key) ?>]" value="<?= "ABCD"[$j] ?>" class="mt-1"> <span><b><?= "ABCD"[$j] ?>)</b> <?= e($o === "" ? "(no punctuation)" : $o) ?></span></label>
                            <?php endforeach; ?>
                        </div>
                    <?php else: ?>
                        <input name="ans[<?= e($key) ?>]" maxlength="100" autocomplete="off" placeholder="<?= e(t("your_answer")) ?>" class="border rounded-lg px-3 py-2 mt-3 w-full sm:w-64">
                    <?php endif; ?>
                </fieldset>
            <?php endforeach; ?>
            <button class="<?= $btn ?> text-lg px-6 py-3"><?= e(t("c_submit")) ?></button>
        </form>
    <?php endif; ?>

<?php else:
    $lessons_total = count(array_filter($state, fn($s) => $s["type"] === "lesson"));
    $lessons_done = count(array_filter($state, fn($s) => $s["type"] === "lesson" && $s["done"]));
    $ans = array_sum(array_column(array_filter($state, fn($s) => $s["type"] === "lesson"), "answered"));
    $cor = array_sum(array_column(array_filter($state, fn($s) => $s["type"] === "lesson"), "correct"));
    $units = [];
    foreach ($state as $s) { $units[$s["unit"]][] = $s; }
    $unit_names = ["math" => [1 => ["Basics · grade 7", "База · 7 класс"], 2 => ["Algebra · grade 8", "Алгебра · 8 класс"], 3 => ["Advanced algebra and geometry · grade 9", "Сложная алгебра и геометрия · 9 класс"], 4 => ["Hardest SAT topics · grade 10", "Самые сложные темы SAT · 10 класс"]],
                   "english" => [1 => ["Grammar and punctuation", "Грамматика и пунктуация"], 2 => ["Expression of ideas and vocabulary", "Логика текста и лексика"], 3 => ["Reading and evidence", "Чтение и доказательства"]]];
?>
    <h2 class="text-2xl font-bold"><?= e(t("c_title")) ?></h2>
    <p class="text-slate-600 mt-1 mb-5"><?= e(t("c_hint")) ?></p>

    <div class="grid sm:grid-cols-3 gap-4 mb-6">
        <div class="<?= $card ?>"><div class="text-sm text-slate-500"><?= e(t("c_lessons_done")) ?></div><div class="text-3xl font-bold"><?= $lessons_done ?> / <?= $lessons_total ?></div>
            <div class="h-2 bg-slate-200 rounded mt-2"><div class="h-2 bg-green-600 rounded" style="width: <?= round($lessons_done / max(1, $lessons_total) * 100) ?>%"></div></div></div>
        <div class="<?= $card ?>"><div class="text-sm text-slate-500"><?= e(t("c_accuracy")) ?></div><div class="text-3xl font-bold"><?= $ans ? round($cor / $ans * 100) . "%" : "—" ?></div></div>
        <div class="<?= $card ?> flex items-center">
            <?php if ($next_open): ?><a href="<?= $step_link($next_open) ?>" class="w-full text-center bg-slate-900 text-white px-4 py-3 rounded-lg font-semibold"><?= e(t("c_continue")) ?>: <?= e($next_open["type"] === "lesson" ? $next_open["lesson"]["title"] : $test_label($next_open)) ?> →</a><?php else: ?><div class="text-green-700 font-bold">🏆 100%</div><?php endif; ?>
        </div>
    </div>

    <?php foreach ($units as $u => $steps): ?>
        <section class="mb-8">
            <h3 class="font-bold text-lg mb-3"><?= e(t("c_unit")) ?> <?= $u ?> · <?= e(tl($unit_names[$track][$u] ?? ["", ""])) ?></h3>
            <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <?php foreach ($steps as $s):
                    $cls = !$s["open"] ? "bg-slate-100 text-slate-400 border-dashed" : ($s["done"] ? "bg-green-50 border-green-300" : "bg-white ring-2 ring-blue-600");
                    if ($s["type"] === "lesson"): ?>
                        <a href="<?= $s["open"] ? $step_link($s) : "#" ?>" class="rounded-xl border p-3 <?= $cls ?> <?= $s["open"] ? "hover:shadow" : "pointer-events-none" ?>" <?= $s["open"] ? "" : 'aria-disabled="true" title="' . e(t("c_locked")) . '"' ?>>
                            <div class="text-xs"><?= e(t("c_lesson")) ?> <?= $s["lesson"]["index"] + 1 ?><?= !$s["open"] ? " · 🔒" : ($s["done"] ? " · ✓" : "") ?></div>
                            <div class="font-semibold leading-snug"><?= e($s["lesson"]["title"]) ?></div>
                            <?php if ($s["open"]): ?><div class="text-xs text-slate-500 mt-1"><?= $s["answered"] ?>/<?= $s["total"] ?> · ✓<?= $s["correct"] ?></div><?php endif; ?>
                        </a>
                    <?php else: $r = $s["row"]; ?>
                        <a href="<?= $s["open"] ? $step_link($s) : "#" ?>" class="rounded-xl border-2 p-3 <?= $cls ?> <?= $s["open"] ? "hover:shadow" : "pointer-events-none" ?> sm:col-span-2 lg:col-span-5" <?= $s["open"] ? "" : 'aria-disabled="true"' ?>>
                            <div class="font-bold">📝 <?= e($test_label($s)) ?> · <?= count($s["items"]) ?> <?= e(t("c_questions")) ?><?= !$s["open"] ? " · 🔒" : "" ?></div>
                            <?php if ($r): ?><div class="text-sm"><?= e(t("c_best")) ?>: <?= (int)$r["best_score"] ?>/<?= (int)$r["total"] ?> <?= $s["done"] ? "✓" : "" ?></div><?php endif; ?>
                        </a>
                    <?php endif; ?>
                <?php endforeach; ?>
            </div>
        </section>
    <?php endforeach; ?>
<?php endif; ?>

<?php
// =================================================================
// CORRECTIONS
// =================================================================
elseif ($tab === "corrections"):

    $due = $q("SELECT * FROM study_corrections WHERE user_id = ? AND mastered = 0 AND next_review <= ? ORDER BY next_review, id", "is", $user_id, $today);
    $later = $q("SELECT * FROM study_corrections WHERE user_id = ? AND mastered = 0 AND next_review > ? ORDER BY next_review, id", "is", $user_id, $today);
    $mastered = $q("SELECT * FROM study_corrections WHERE user_id = ? AND mastered = 1 ORDER BY id DESC LIMIT 100", "i", $user_id);

    $render_correction = function ($c, $reviewable) {
        ?>
        <div class="bg-white rounded-lg border p-4 mb-2">
            <div class="text-sm text-slate-500"><?= e($c["subject"]) ?><?= $c["topic"] ? " · " . e($c["topic"]) : "" ?></div>
            <div class="grid md:grid-cols-2 gap-3 mt-2">
                <div><div class="text-xs text-red-700 font-semibold"><?= e(t("mistake")) ?></div><p class="whitespace-pre-line"><?= e($c["mistake"]) ?></p></div>
                <?php if ($reviewable): ?>
                    <details><summary class="cursor-pointer text-xs text-green-800 font-semibold"><?= e(t("correction")) ?></summary><p class="whitespace-pre-line mt-1"><?= e($c["correction"]) ?></p></details>
                <?php else: ?>
                    <div><div class="text-xs text-green-800 font-semibold"><?= e(t("correction")) ?></div><p class="whitespace-pre-line"><?= e($c["correction"]) ?></p></div>
                <?php endif; ?>
            </div>
            <div class="flex flex-wrap items-center gap-3 mt-3 text-sm">
                <?php if ($reviewable): ?>
                    <?php foreach (["ok" => ["remember", "bg-green-700 text-white"], "hard" => ["still_hard", "border"]] as $result => [$label, $style]): ?>
                        <form method="POST"><?= csrf_field() ?><input type="hidden" name="act" value="corr_review"><input type="hidden" name="id" value="<?= (int)$c["id"] ?>"><input type="hidden" name="result" value="<?= $result ?>">
                            <button class="px-3 py-1 rounded-lg <?= $style ?>"><?= e(t($label)) ?></button></form>
                    <?php endforeach; ?>
                <?php elseif (!$c["mastered"]): ?>
                    <span class="text-slate-500"><?= e(t("next_review")) ?>: <?= e(date("d.m.Y", strtotime($c["next_review"]))) ?></span>
                <?php endif; ?>
                <form method="POST" class="ml-auto" onsubmit="return confirm('<?= e(t("confirm_delete")) ?>')"><?= csrf_field() ?><input type="hidden" name="act" value="corr_delete"><input type="hidden" name="id" value="<?= (int)$c["id"] ?>"><button class="text-red-700"><?= e(t("delete")) ?></button></form>
            </div>
        </div>
        <?php
    };
?>

    <form method="POST" class="<?= $card ?> grid md:grid-cols-2 gap-2 mb-6">
        <?= csrf_field() ?><input type="hidden" name="act" value="corr_add">
        <div class="md:col-span-2 font-semibold"><?= e(t("add_correction")) ?></div>
        <input name="subject" required maxlength="60" placeholder="<?= e(t("subject")) ?> (SAT Math, IB Physics…)" class="border rounded-lg px-3 py-2">
        <input name="topic" maxlength="120" placeholder="<?= e(t("topic")) ?> (<?= e(t("optional")) ?>)" class="border rounded-lg px-3 py-2">
        <textarea name="mistake" required maxlength="3000" rows="3" placeholder="<?= e(t("mistake")) ?>" class="border rounded-lg px-3 py-2"></textarea>
        <textarea name="correction" required maxlength="3000" rows="3" placeholder="<?= e(t("correction")) ?>" class="border rounded-lg px-3 py-2"></textarea>
        <button class="<?= $btn ?> justify-self-start"><?= e(t("add")) ?></button>
    </form>
    <p class="text-sm text-slate-500 mb-4"><?= e(t("spaced_hint")) ?></p>

    <h2 class="font-bold text-lg mb-2"><?= e(t("due_review")) ?> (<?= count($due) ?>)</h2>
    <?php if (!$due): ?><p class="text-slate-500 mb-4"><?= e(t("all_clear")) ?></p><?php endif; ?>
    <?php foreach ($due as $c) { $render_correction($c, true); } ?>

    <?php if ($later): ?>
        <h2 class="font-bold text-lg mt-6 mb-2"><?= e(t("in_progress")) ?> (<?= count($later) ?>)</h2>
        <?php foreach ($later as $c) { $render_correction($c, false); } ?>
    <?php endif; ?>

    <?php if ($mastered): ?>
        <details class="mt-6">
            <summary class="cursor-pointer font-bold text-lg"><?= e(t("mastered")) ?> (<?= count($mastered) ?>)</summary>
            <div class="mt-2"><?php foreach ($mastered as $c) { $render_correction($c, false); } ?></div>
        </details>
    <?php endif; ?>

<?php
// =================================================================
// HEALTH: habits and workout checklist
// =================================================================
elseif ($tab === "health"):

    $day = health_day($_GET["day"] ?? "");
    $is_today = $day === $today;
    $prev_day = date("Y-m-d", strtotime($day . " -1 day"));
    $next_day = date("Y-m-d", strtotime($day . " +1 day"));
    $habits = $q("SELECT * FROM study_habits WHERE user_id = ? ORDER BY sort, id", "i", $user_id);
    $exercises = $q("SELECT * FROM study_exercises WHERE user_id = ? ORDER BY sort, id", "i", $user_id);

    $habit_dates = [];
    foreach ($q("SELECT habit_id, log_date FROM study_habit_log WHERE user_id = ? AND log_date > ? - INTERVAL 400 DAY", "is", $user_id, $today) as $r) {
        $habit_dates[(int)$r["habit_id"]][] = $r["log_date"];
    }
    $ex_done = array_flip(array_map("intval", array_column($q("SELECT exercise_id FROM study_exercise_log WHERE user_id = ? AND log_date = ?", "is", $user_id, $day), "exercise_id")));
    $workout_dates = array_column($q("SELECT DISTINCT log_date FROM study_exercise_log WHERE user_id = ? AND log_date > ? - INTERVAL 400 DAY", "is", $user_id, $today), "log_date");
    $week_workouts = count(array_filter($workout_dates, fn($d) => $d >= $week_start && $d <= $today));
    $last30 = [];
    for ($i = 29; $i >= 0; $i--) {
        $last30[] = date("Y-m-d", strtotime($today . " -$i day"));
    }
    $by_block = [];
    foreach ($exercises as $x) {
        $by_block[$x["block"]][] = $x;
    }
    $ex_total = count($exercises);
    $ex_count = count(array_intersect_key($ex_done, array_flip(array_map("intval", array_column($exercises, "id")))));
    $tick_on = "bg-green-600 border-green-600 text-white";
    $tick_off = "bg-white border-slate-400 text-transparent";
?>

    <h2 class="text-2xl font-bold"><?= e(t("h_title")) ?></h2>
    <p class="text-slate-600 mt-1"><?= e(t("h_note")) ?></p>
    <p class="text-sm text-amber-800 mt-1"><?= e(t("h_safety")) ?></p>

    <div class="flex flex-wrap items-center gap-2 my-5">
        <a href="?tab=health&day=<?= $prev_day ?>" class="px-3 py-1 border rounded-lg bg-white" title="<?= e(t("h_prev")) ?>">←</a>
        <span class="font-bold text-lg px-2"><?= e(date("d.m.Y", strtotime($day))) ?><?php if ($is_today): ?> · <?= e(t("h_today")) ?><?php endif; ?></span>
        <?php if (!$is_today): ?>
            <a href="?tab=health&day=<?= $next_day ?>" class="px-3 py-1 border rounded-lg bg-white" title="<?= e(t("h_next")) ?>">→</a>
            <a href="?tab=health" class="px-3 py-1 border rounded-lg bg-white"><?= e(t("h_today")) ?></a>
        <?php endif; ?>
    </div>

    <div class="grid lg:grid-cols-5 gap-6">

        <section class="<?= $card ?> lg:col-span-2 self-start">
            <h3 class="font-bold text-lg mb-3"><?= e(t("h_habits")) ?></h3>
            <?php if (!$habits): ?><p class="text-slate-500"><?= e(t("h_empty")) ?></p><?php endif; ?>
            <?php foreach ($habits as $h): $hid = (int)$h["id"]; $dates = $habit_dates[$hid] ?? []; $set = array_flip($dates); $done = isset($set[$day]); ?>
                <div id="habit-<?= $hid ?>" class="py-3 border-b last:border-b-0">
                    <form method="POST" class="js-health flex items-center gap-3">
                        <?= csrf_field() ?><input type="hidden" name="act" value="health_tick"><input type="hidden" name="kind" value="habit"><input type="hidden" name="id" value="<?= $hid ?>"><input type="hidden" name="day" value="<?= $day ?>">
                        <button class="js-tick w-7 h-7 rounded-md border-2 shrink-0 font-bold <?= $done ? $tick_on : $tick_off ?>" aria-pressed="<?= $done ? "true" : "false" ?>">✓</button>
                        <span class="font-medium flex-1"><?= e($h["name"]) ?></span>
                        <span class="text-sm text-slate-500 whitespace-nowrap">🔥 <span class="js-streak"><?= health_streak($dates, $today) ?></span> <?= e(t("h_streak")) ?></span>
                    </form>
                    <div class="flex gap-[3px] mt-2" title="<?= e(t("h_last30")) ?>">
                        <?php foreach ($last30 as $d): ?><span data-day="<?= $d ?>" class="h-3 flex-1 rounded-sm <?= isset($set[$d]) ? "bg-green-600" : "bg-slate-200" ?>"></span><?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
            <p class="text-xs text-slate-500 mt-2"><?= e(t("h_last30")) ?></p>
        </section>

        <section class="<?= $card ?> lg:col-span-3">
            <div class="flex flex-wrap justify-between items-end gap-3 mb-2">
                <h3 class="font-bold text-lg"><?= e(t("h_workout")) ?></h3>
                <div class="text-sm text-slate-600"><?= e(t("h_week")) ?>: <b><?= $week_workouts ?></b> / 7 · <?= e(t("h_workout_streak")) ?>: <b><?= health_streak($workout_dates, $today) ?></b></div>
            </div>
            <div class="h-3 bg-slate-200 rounded"><div id="ex-bar" class="h-3 bg-green-600 rounded transition-all" style="width: <?= $ex_total ? round($ex_count / $ex_total * 100) : 0 ?>%"></div></div>
            <div class="text-sm text-slate-600 mt-1"><span id="ex-done"><?= $ex_count ?></span> / <span id="ex-total"><?= $ex_total ?></span> <?= e(t("h_done")) ?>
                <span id="ex-complete" class="text-green-700 font-bold <?= $ex_total && $ex_count >= $ex_total ? "" : "hidden" ?>"> · <?= e(t("h_all_done")) ?></span></div>

            <?php if (!$exercises): ?><p class="text-slate-500 mt-4"><?= e(t("h_empty")) ?></p><?php endif; ?>
            <?php foreach (WORKOUT_BLOCKS as $block => $label): if (empty($by_block[$block])) continue; ?>
                <h4 class="font-bold mt-5 mb-1 text-slate-700"><?= e(tl($label)) ?></h4>
                <?php foreach ($by_block[$block] as $x): $xid = (int)$x["id"]; $done = isset($ex_done[$xid]); ?>
                    <div id="exercise-<?= $xid ?>" class="flex flex-wrap items-center gap-3 py-2 border-b last:border-b-0">
                        <form method="POST" class="js-health">
                            <?= csrf_field() ?><input type="hidden" name="act" value="health_tick"><input type="hidden" name="kind" value="exercise"><input type="hidden" name="id" value="<?= $xid ?>"><input type="hidden" name="day" value="<?= $day ?>">
                            <button class="js-tick w-7 h-7 rounded-md border-2 font-bold <?= $done ? $tick_on : $tick_off ?>" aria-pressed="<?= $done ? "true" : "false" ?>">✓</button>
                        </form>
                        <span class="flex-1 min-w-[10rem]"><?= e($x["name"]) ?> <span class="text-slate-500">· <?= e($x["target"]) ?></span></span>
                        <form method="POST" class="js-health flex items-center gap-1 text-sm">
                            <?= csrf_field() ?><input type="hidden" name="act" value="health_weight"><input type="hidden" name="kind" value="exercise"><input type="hidden" name="id" value="<?= $xid ?>"><input type="hidden" name="day" value="<?= $day ?>">
                            <input name="weight" value="<?= e($x["weight"]) ?>" maxlength="30" placeholder="<?= e(t("h_weight")) ?>" class="border rounded px-2 py-1 w-32">
                            <button class="px-2 py-1 border rounded bg-white">✓</button>
                        </form>
                    </div>
                <?php endforeach; ?>
            <?php endforeach; ?>
        </section>
    </div>

    <details id="manage" class="<?= $card ?> mt-6">
        <summary class="cursor-pointer font-bold text-lg"><?= e(t("h_manage")) ?></summary>

        <h4 class="font-bold mt-4 mb-2"><?= e(t("h_habits")) ?></h4>
        <?php foreach ($habits as $h): ?>
            <div class="flex flex-wrap gap-2 py-1">
                <form method="POST" class="flex gap-2 flex-1 min-w-[16rem]">
                    <?= csrf_field() ?><input type="hidden" name="act" value="health_save"><input type="hidden" name="kind" value="habit"><input type="hidden" name="id" value="<?= (int)$h["id"] ?>">
                    <input name="name" value="<?= e($h["name"]) ?>" maxlength="120" required class="<?= $input ?>">
                    <button class="<?= $btn ?>"><?= e(t("h_save")) ?></button>
                </form>
                <form method="POST" onsubmit="return confirm('<?= e(t("h_confirm")) ?>')">
                    <?= csrf_field() ?><input type="hidden" name="act" value="health_delete"><input type="hidden" name="kind" value="habit"><input type="hidden" name="id" value="<?= (int)$h["id"] ?>">
                    <button class="px-3 py-2 border rounded-lg text-red-700"><?= e(t("h_delete")) ?></button>
                </form>
            </div>
        <?php endforeach; ?>
        <form method="POST" class="flex gap-2 mt-2">
            <?= csrf_field() ?><input type="hidden" name="act" value="health_add"><input type="hidden" name="kind" value="habit">
            <input name="name" maxlength="120" required placeholder="<?= e(t("h_add_habit")) ?>" class="<?= $input ?>">
            <button class="<?= $btn ?> whitespace-nowrap">+ <?= e(t("h_add_habit")) ?></button>
        </form>

        <h4 class="font-bold mt-6 mb-2"><?= e(t("h_workout")) ?></h4>
        <?php $block_select = function ($current) { ?>
            <select name="block" class="border rounded-lg px-2 py-2">
                <?php foreach (WORKOUT_BLOCKS as $key => $label): ?><option value="<?= $key ?>" <?= $key === $current ? "selected" : "" ?>><?= e(tl($label)) ?></option><?php endforeach; ?>
            </select>
        <?php }; ?>
        <?php foreach ($exercises as $x): ?>
            <div class="flex flex-wrap gap-2 py-1 border-b">
                <form method="POST" class="flex flex-wrap gap-2 flex-1">
                    <?= csrf_field() ?><input type="hidden" name="act" value="health_save"><input type="hidden" name="kind" value="exercise"><input type="hidden" name="id" value="<?= (int)$x["id"] ?>">
                    <?php $block_select($x["block"]); ?>
                    <input name="name" value="<?= e($x["name"]) ?>" maxlength="120" required title="<?= e(t("h_name")) ?>" class="border rounded-lg px-3 py-2 flex-1 min-w-[12rem]">
                    <input name="target" value="<?= e($x["target"]) ?>" maxlength="60" title="<?= e(t("h_target")) ?>" placeholder="<?= e(t("h_target")) ?>" class="border rounded-lg px-3 py-2 w-36">
                    <input name="weight" value="<?= e($x["weight"]) ?>" maxlength="30" title="<?= e(t("h_weight")) ?>" placeholder="<?= e(t("h_weight")) ?>" class="border rounded-lg px-3 py-2 w-32">
                    <button class="<?= $btn ?>"><?= e(t("h_save")) ?></button>
                </form>
                <form method="POST" onsubmit="return confirm('<?= e(t("h_confirm")) ?>')">
                    <?= csrf_field() ?><input type="hidden" name="act" value="health_delete"><input type="hidden" name="kind" value="exercise"><input type="hidden" name="id" value="<?= (int)$x["id"] ?>">
                    <button class="px-3 py-2 border rounded-lg text-red-700"><?= e(t("h_delete")) ?></button>
                </form>
            </div>
        <?php endforeach; ?>
        <form method="POST" class="flex flex-wrap gap-2 mt-3">
            <?= csrf_field() ?><input type="hidden" name="act" value="health_add"><input type="hidden" name="kind" value="exercise">
            <?php $block_select("core"); ?>
            <input name="name" maxlength="120" required placeholder="<?= e(t("h_name")) ?>" class="border rounded-lg px-3 py-2 flex-1 min-w-[12rem]">
            <input name="target" maxlength="60" placeholder="<?= e(t("h_target")) ?>" class="border rounded-lg px-3 py-2 w-36">
            <input name="weight" maxlength="30" placeholder="<?= e(t("h_weight")) ?>" class="border rounded-lg px-3 py-2 w-32">
            <button class="<?= $btn ?> whitespace-nowrap">+ <?= e(t("h_add_ex")) ?></button>
        </form>
    </details>

<?php endif; ?>

</div>

<script>
// SAT course: check answers without reloading the page
document.addEventListener("submit", async function (e) {
    const form = e.target;
    if (!form.classList.contains("js-course")) return;
    e.preventDefault();
    const data = new FormData(form);
    if (e.submitter && e.submitter.name) data.set(e.submitter.name, e.submitter.value);
    const card = form.closest(".course-card");
    data.set("n", card ? (parseInt(card.querySelector("span").textContent) || 0) : 0);
    form.querySelectorAll("button").forEach(b => b.disabled = true);
    try {
        const res = await fetch(location.href, { method: "POST", body: data, headers: { "X-Requested-With": "fetch" } });
        if (!res.ok) throw new Error(res.status);
        const d = await res.json();
        const el = document.getElementById(d.id);
        if (el) el.outerHTML = d.html;
        const set = (id, v) => { const x = document.getElementById(id); if (x) x.textContent = v; };
        set("c-answered", d.answered); set("c-correct", d.correct);
        const bar = document.getElementById("c-bar"); if (bar) bar.style.width = Math.round(d.answered / Math.max(1, d.total) * 100) + "%";
        if (d.done) { const n = document.getElementById("c-next"); if (n) n.classList.remove("hidden"); }
    } catch (err) {
        form.submit();
    }
});

// Cover: preview the chosen photo before uploading
document.getElementById("cover-file")?.addEventListener("change", function () {
    const f = this.files && this.files[0];
    if (f) document.getElementById("cover-preview").style.background = "url('" + URL.createObjectURL(f) + "') center / cover no-repeat";
});

// SAT task book: check answers without reloading the page
document.addEventListener("submit", async function (e) {
    const form = e.target;
    if (!form.classList.contains("js-bank")) return;
    e.preventDefault();
    const button = form.querySelector("button");
    if (button) button.disabled = true;
    try {
        const res = await fetch(location.href, { method: "POST", body: new FormData(form), headers: { "X-Requested-With": "fetch" } });
        if (!res.ok) throw new Error(res.status);
        const d = await res.json();
        const card = document.getElementById("task-" + d.no);
        if (card) card.outerHTML = d.html;
        const cell = document.getElementById("cell-" + d.no);
        if (cell) {
            cell.className = cell.className.replace(/bg-\S+|text-white/g, "").trim() + " " +
                ({ correct: "bg-green-600 text-white", wrong: "bg-red-600 text-white", revealed: "bg-amber-400" }[d.status] || "bg-white");
        }
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set("bank-xp", d.xp); set("bank-level", d.level); set("bank-today", d.today);
        set("mod-answered", d.answered); set("mod-correct", d.correct);
        const lb = document.getElementById("bank-level-bar"); if (lb) lb.style.width = Math.round(d.level_xp / <?= SAT_XP_PER_LEVEL ?> * 100) + "%";
        const tb = document.getElementById("bank-today-bar"); if (tb) tb.style.width = Math.min(100, Math.round(d.today / <?= SAT_DAILY_GOAL ?> * 100)) + "%";
    } catch (err) {
        form.submit();
    }
});
</script>

<script>
// Health: tick habits and exercises without reloading the page
document.addEventListener("submit", async function (e) {
    const form = e.target;
    if (!form.classList.contains("js-health")) return;
    e.preventDefault();
    const button = form.querySelector("button");
    if (button) button.disabled = true;
    try {
        const res = await fetch(location.href, { method: "POST", body: new FormData(form), headers: { "X-Requested-With": "fetch" } });
        if (!res.ok) throw new Error(res.status);
        const d = await res.json();
        if (d.error) throw new Error("error");
        if ("done" in d) {
            const tick = form.querySelector(".js-tick");
            tick.className = tick.className.replace(/bg-\S+|border-(green|slate)-\d+|text-(white|transparent)/g, "").trim() + " " +
                (d.done ? "<?= "bg-green-600 border-green-600 text-white" ?>" : "<?= "bg-white border-slate-400 text-transparent" ?>");
            tick.setAttribute("aria-pressed", d.done ? "true" : "false");
            const streak = form.querySelector(".js-streak");
            if (streak) streak.textContent = d.streak;
            const cell = document.querySelector("#habit-" + d.id + " [data-day='" + form.elements.day.value + "']");
            if (cell) cell.className = cell.className.replace(/bg-\S+/, d.done ? "bg-green-600" : "bg-slate-200");
            if ("ex_done" in d) {
                document.getElementById("ex-done").textContent = d.ex_done;
                document.getElementById("ex-bar").style.width = (d.ex_total ? Math.round(d.ex_done / d.ex_total * 100) : 0) + "%";
                document.getElementById("ex-complete").classList.toggle("hidden", !(d.ex_total && d.ex_done >= d.ex_total));
            }
        } else if (button) {
            button.textContent = "<?= e(t("h_saved")) ?>";
            setTimeout(() => { button.textContent = "✓"; }, 1500);
        }
    } catch (err) {
        form.submit();
    }
    if (button) button.disabled = false;
});
</script>

</body>
</html>
