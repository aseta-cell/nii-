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
require_once "health_lib.php";

$tabs = ["overview", "planner", "tracker", "sat", "satbank", "imo", "grades", "corrections", "health"];
$tab = in_array($_GET["tab"] ?? "", $tabs, true) ? $_GET["tab"] : "overview";
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

        case "ib_subject_delete":
            $run("DELETE FROM study_ib_subjects WHERE id = ? AND user_id = ?", "ii", $id, $user_id);
            break;

        case "ib_assess_add":
        case "ib_assess_save":
            $subject_id = (int)($_POST["subject_id"] ?? 0);
            $own = $run("SELECT id FROM study_ib_subjects WHERE id = ? AND user_id = ?", "ii", $subject_id, $user_id)->get_result()->fetch_assoc();
            $title = study_text($_POST["title"] ?? "", 200);
            $kind = in_array($_POST["kind"] ?? "", ["homework", "test", "ia", "project"], true) ? $_POST["kind"] : "homework";
            $due = study_date($_POST["due_date"] ?? "");
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
                    $run("INSERT INTO study_ib_assessments (subject_id, title, kind, due_date, status, crit_a, crit_b, crit_c, crit_d, feedback, user_id)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        "issssiiiisi", $subject_id, $title, $kind, $due, $status, $ca, $cb, $cc, $cd, $feedback, $user_id);
                } else {
                    $run("UPDATE study_ib_assessments SET subject_id = ?, title = ?, kind = ?, due_date = ?, status = ?, crit_a = ?, crit_b = ?, crit_c = ?, crit_d = ?, feedback = ?
                          WHERE id = ? AND user_id = ?",
                        "issssiiiisii", $subject_id, $title, $kind, $due, $status, $ca, $cb, $cc, $cd, $feedback, $id, $user_id);
                }
                $anchor = $id ? "#assess-" . $id : "";
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
        <div class="flex gap-2 text-sm"><?php lang_switch(); ?></div>
    </div>

    <h1 class="text-3xl font-bold mt-4"><?= e(t("hub")) ?></h1>
    <p class="text-slate-600 mb-6"><?= e(t("hub_hint")) ?></p>

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

    $subjects = $q("SELECT * FROM study_ib_subjects WHERE user_id = ? ORDER BY name", "i", $user_id);
    $subjects_by_id = array_column($subjects, null, "id");
    $assessments = $q("SELECT * FROM study_ib_assessments WHERE user_id = ? ORDER BY status = 'graded', due_date IS NULL, due_date, id DESC", "i", $user_id);
    $kinds = ["homework" => t("homework"), "test" => t("test"), "ia" => t("ia"), "project" => t("project")];
    $statuses = ["todo" => t("todo"), "submitted" => t("submitted"), "graded" => t("graded")];

    $grades_per_subject = [];
    foreach ($assessments as $a) {
        $s = $subjects_by_id[$a["subject_id"]] ?? null;
        $g = $s ? ib_grade($a["crit_a"], $a["crit_b"], $a["crit_c"], $a["crit_d"], $s["boundaries"]) : null;
        if ($g) {
            $grades_per_subject[$a["subject_id"]][] = $g;
        }
    }

    $assess_form = function ($a = null) use ($subjects, $kinds, $statuses) {
        ?>
        <select name="subject_id" required class="border rounded-lg px-3 py-2" aria-label="<?= e(t("subject")) ?>">
            <?php foreach ($subjects as $s): ?><option value="<?= (int)$s["id"] ?>" <?= (int)($a["subject_id"] ?? 0) === (int)$s["id"] ? "selected" : "" ?>><?= e($s["name"]) ?> <?= e($s["level"]) ?></option><?php endforeach; ?>
        </select>
        <input name="title" required maxlength="200" value="<?= e($a["title"] ?? "") ?>" placeholder="<?= e(t("title")) ?>" class="border rounded-lg px-3 py-2 md:col-span-2">
        <select name="kind" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("kind")) ?>"><?php foreach ($kinds as $k => $l): ?><option value="<?= $k ?>" <?= ($a["kind"] ?? "homework") === $k ? "selected" : "" ?>><?= e($l) ?></option><?php endforeach; ?></select>
        <input type="date" name="due_date" value="<?= e($a["due_date"] ?? "") ?>" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("due")) ?>">
        <select name="status" class="border rounded-lg px-3 py-2" aria-label="<?= e(t("status")) ?>"><?php foreach ($statuses as $k => $l): ?><option value="<?= $k ?>" <?= ($a["status"] ?? "todo") === $k ? "selected" : "" ?>><?= e($l) ?></option><?php endforeach; ?></select>
        <div class="md:col-span-6 flex flex-wrap items-center gap-2 text-sm">
            <span class="text-slate-600"><?= e(t("criteria")) ?>:</span>
            <?php foreach (["a", "b", "c", "d"] as $c): ?>
                <label class="flex items-center gap-1"><?= strtoupper($c) ?><input type="number" name="crit_<?= $c ?>" min="0" max="8" value="<?= e($a["crit_" . $c] ?? "") ?>" class="border rounded-lg px-2 py-1 w-16"></label>
            <?php endforeach; ?>
        </div>
        <textarea name="feedback" maxlength="3000" rows="2" placeholder="<?= e(t("feedback")) ?> (<?= e(t("optional")) ?>)" class="border rounded-lg px-3 py-2 md:col-span-6"><?= e($a["feedback"] ?? "") ?></textarea>
        <?php
    };
?>

    <section class="mb-6">
        <h2 class="font-bold text-lg mb-3"><?= e(t("subjects")) ?></h2>
        <div class="grid md:grid-cols-3 gap-4">
            <?php foreach ($subjects as $s):
                $gs = $grades_per_subject[$s["id"]] ?? [];
                $avg = $gs ? round(array_sum($gs) / count($gs), 1) : null; ?>
                <div class="<?= $card ?>">
                    <div class="flex justify-between"><span class="font-semibold"><?= e($s["name"]) ?></span><span class="text-sm text-slate-500"><?= e($s["level"]) ?></span></div>
                    <div class="text-3xl font-bold mt-1"><?= $avg ?? "—" ?></div>
                    <div class="text-xs text-slate-500"><?= e(t("average")) ?> (1–7) · <?= count($gs) ?></div>
                    <details class="mt-2 text-sm">
                        <summary class="cursor-pointer text-slate-500"><?= e(t("edit")) ?> · <?= e(t("ib_grade_table")) ?></summary>
                        <form method="POST" class="space-y-2 mt-2">
                            <?= csrf_field() ?><input type="hidden" name="act" value="ib_subject_save"><input type="hidden" name="id" value="<?= (int)$s["id"] ?>">
                            <input name="name" required maxlength="100" value="<?= e($s["name"]) ?>" class="<?= $input ?>">
                            <select name="level" class="<?= $input ?>"><option <?= $s["level"] === "SL" ? "selected" : "" ?>>SL</option><option <?= $s["level"] === "HL" ? "selected" : "" ?>>HL</option></select>
                            <label class="block text-xs text-slate-500"><?= e(t("boundaries")) ?><input name="boundaries" value="<?= e($s["boundaries"]) ?>" class="<?= $input ?>"></label>
                            <button class="<?= $btn ?>"><?= e(t("save")) ?></button>
                        </form>
                        <form method="POST" class="mt-2" onsubmit="return confirm('<?= e(t("confirm_delete")) ?>')"><?= csrf_field() ?><input type="hidden" name="act" value="ib_subject_delete"><input type="hidden" name="id" value="<?= (int)$s["id"] ?>"><button class="text-red-700"><?= e(t("delete")) ?></button></form>
                    </details>
                </div>
            <?php endforeach; ?>
            <form method="POST" class="<?= $card ?> space-y-2">
                <?= csrf_field() ?><input type="hidden" name="act" value="ib_subject_add">
                <div class="font-semibold"><?= e(t("add_subject")) ?></div>
                <input name="name" required maxlength="100" placeholder="<?= e(t("subject_name")) ?>" class="<?= $input ?>">
                <select name="level" class="<?= $input ?>"><option>SL</option><option>HL</option></select>
                <label class="block text-xs text-slate-500"><?= e(t("boundaries")) ?><input name="boundaries" value="0,6,10,15,19,24,28" class="<?= $input ?>"></label>
                <button class="<?= $btn ?>"><?= e(t("add")) ?></button>
            </form>
        </div>
    </section>

    <section>
        <h2 class="font-bold text-lg mb-1"><?= e(t("assessments")) ?></h2>
        <p class="text-sm text-slate-500 mb-3"><?= e(t("grade_needs_all")) ?></p>
        <?php if ($subjects): ?>
        <form method="POST" class="<?= $card ?> grid md:grid-cols-6 gap-2 mb-4">
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
                    <span class="flex-1"><span class="font-semibold"><?= e($a["title"]) ?></span> <span class="text-sm text-slate-500">· <?= e($s["name"] ?? "") ?> · <?= e($kinds[$a["kind"]] ?? "") ?></span></span>
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
                    <form method="POST" class="grid md:grid-cols-6 gap-2 mt-2">
                        <?= csrf_field() ?><input type="hidden" name="act" value="ib_assess_save"><input type="hidden" name="id" value="<?= (int)$a["id"] ?>">
                        <?php $assess_form($a); ?>
                        <button class="<?= $btn ?> justify-self-start"><?= e(t("save")) ?></button>
                    </form>
                    <form method="POST" class="mt-2" onsubmit="return confirm('<?= e(t("confirm_delete")) ?>')"><?= csrf_field() ?><input type="hidden" name="act" value="ib_assess_delete"><input type="hidden" name="id" value="<?= (int)$a["id"] ?>"><button class="text-red-700"><?= e(t("delete")) ?></button></form>
                </details>
            </div>
        <?php endforeach; ?>
    </section>

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
