<?php
// Study Hub: personal planner, study tracker, SAT and IMO preparation, IB grades
// (criteria A–D) and corrections. Only for special-access accounts (users.free_access).
// Every table belongs to one user; nobody else can see the data.
// Loaded by study.php only.

if (!isset($conn)) {
    http_response_code(404);
    exit;
}

// ---------------------------------------------------------------
// Tables (created automatically on first visit; nothing to run by hand)
// ---------------------------------------------------------------

function ensure_study_schema()
{
    global $conn;

    $exists = $conn->query("SHOW TABLES LIKE 'study_settings'");
    if ($exists && $exists->num_rows > 0) {
        return;
    }

    $tables = [
        "study_settings" => "
            user_id INT PRIMARY KEY,
            sat_target INT NULL,
            sat_exam_date DATE NULL,
            weekly_goal_minutes INT NOT NULL DEFAULT 600,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        "study_tasks" => "
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(200) NOT NULL,
            notes TEXT,
            due_date DATE NULL,
            priority VARCHAR(10) NOT NULL DEFAULT 'normal',
            category VARCHAR(20) NOT NULL DEFAULT 'general',
            is_done TINYINT(1) NOT NULL DEFAULT 0,
            done_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (user_id, is_done, due_date)",
        "study_sessions" => "
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_date DATE NOT NULL,
            minutes INT NOT NULL,
            subject VARCHAR(20) NOT NULL DEFAULT 'other',
            note VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (user_id, session_date)",
        "study_topic_progress" => "
            user_id INT NOT NULL,
            track VARCHAR(10) NOT NULL,
            topic_key VARCHAR(60) NOT NULL,
            status TINYINT NOT NULL DEFAULT 0,
            note VARCHAR(255) NULL,
            resource_url VARCHAR(500) NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, track, topic_key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        "study_sat_tests" => "
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            test_date DATE NOT NULL,
            name VARCHAR(120) NOT NULL,
            rw_score INT NOT NULL,
            math_score INT NOT NULL,
            note VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (user_id, test_date)",
        "study_imo_problems" => "
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            area VARCHAR(20) NOT NULL,
            source VARCHAR(150) NOT NULL,
            difficulty TINYINT NOT NULL DEFAULT 3,
            status VARCHAR(10) NOT NULL DEFAULT 'solved',
            key_idea TEXT,
            solved_on DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (user_id, area)",
        "study_ib_subjects" => "
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            level VARCHAR(5) NOT NULL DEFAULT 'SL',
            boundaries VARCHAR(60) NOT NULL DEFAULT '0,6,10,15,19,24,28',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE",
        "study_ib_assessments" => "
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            subject_id INT NOT NULL,
            title VARCHAR(200) NOT NULL,
            kind VARCHAR(20) NOT NULL DEFAULT 'homework',
            due_date DATE NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'todo',
            crit_a TINYINT NULL,
            crit_b TINYINT NULL,
            crit_c TINYINT NULL,
            crit_d TINYINT NULL,
            feedback TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (subject_id) REFERENCES study_ib_subjects(id) ON DELETE CASCADE,
            INDEX (user_id, due_date)",
        "study_corrections" => "
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            subject VARCHAR(60) NOT NULL,
            topic VARCHAR(120) NULL,
            mistake TEXT NOT NULL,
            correction TEXT NOT NULL,
            review_stage TINYINT NOT NULL DEFAULT 0,
            next_review DATE NOT NULL,
            mastered TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (user_id, mastered, next_review)",
    ];

    // study_settings last: it is the marker that everything else exists
    $order = array_merge(array_diff(array_keys($tables), ["study_settings"]), ["study_settings"]);

    foreach ($order as $name) {
        $conn->query("CREATE TABLE IF NOT EXISTS $name ({$tables[$name]}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }
}

ensure_study_schema();


// ---------------------------------------------------------------
// Language: English or Russian, chosen by the user
// ---------------------------------------------------------------

if (isset($_GET["lang"]) && in_array($_GET["lang"], ["en", "ru"], true)) {
    $_SESSION["study_lang"] = $_GET["lang"];
}
$study_lang = $_SESSION["study_lang"] ?? "en";

const STUDY_TEXT = [
    "hub" => ["Study Hub", "Учебный кабинет"],
    "hub_hint" => ["Your personal planner and preparation space. Only you can see it.", "Ваш личный планер и подготовка. Видите только вы."],
    "back" => ["My account", "Мой кабинет"],
    "overview" => ["Overview", "Обзор"],
    "planner" => ["Planner", "Планер"],
    "tracker" => ["Tracker", "Трекер"],
    "sat" => ["SAT", "SAT"],
    "imo" => ["IMO", "IMO"],
    "grades" => ["IB grades", "Оценки IB"],
    "corrections" => ["Corrections", "Работа над ошибками"],
    "no_access_title" => ["Study Hub is available for special-access accounts", "Учебный кабинет доступен только особым аккаунтам"],
    "no_access_text" => ["If you have the special access password, activate it in Account Settings.", "Если у вас есть особый пароль, активируйте его в настройках аккаунта."],
    "account_settings" => ["Account Settings", "Настройки аккаунта"],
    "save" => ["Save", "Сохранить"],
    "add" => ["Add", "Добавить"],
    "delete" => ["Delete", "Удалить"],
    "confirm_delete" => ["Delete this entry?", "Удалить эту запись?"],
    "edit" => ["Edit", "Изменить"],
    "optional" => ["optional", "необязательно"],
    "nothing_yet" => ["Nothing here yet.", "Пока пусто."],
    "today" => ["Today", "Сегодня"],
    "overdue" => ["Overdue", "Просрочено"],
    "this_week" => ["This week", "Эта неделя"],
    "upcoming" => ["Upcoming", "Скоро"],
    "no_date" => ["No date", "Без даты"],
    "done" => ["Done", "Готово"],
    "mark_done" => ["Mark as done", "Отметить готовым"],
    "undo" => ["Undo", "Вернуть"],
    "task" => ["Task", "Задача"],
    "notes" => ["Notes", "Заметки"],
    "due" => ["Due", "Срок"],
    "priority" => ["Priority", "Приоритет"],
    "category" => ["Category", "Категория"],
    "high" => ["High", "Высокий"],
    "normal" => ["Normal", "Обычный"],
    "low" => ["Low", "Низкий"],
    "general" => ["General", "Общее"],
    "other" => ["Other", "Другое"],
    "ib" => ["IB", "IB"],
    "completed" => ["Completed", "Выполнено"],
    "show_completed" => ["Show completed", "Показать выполненные"],
    "week_plan" => ["Week plan", "План на неделю"],
    "minutes" => ["Minutes", "Минуты"],
    "date" => ["Date", "Дата"],
    "subject" => ["Subject", "Предмет"],
    "note" => ["Note", "Заметка"],
    "log_session" => ["Log a study session", "Записать занятие"],
    "weekly_goal" => ["Weekly goal (minutes)", "Цель на неделю (минуты)"],
    "streak" => ["Day streak", "Дней подряд"],
    "week_total" => ["This week", "За неделю"],
    "last_14" => ["Last 14 days", "Последние 14 дней"],
    "by_subject" => ["By subject (30 days)", "По предметам (30 дней)"],
    "recent_sessions" => ["Recent sessions", "Последние занятия"],
    "hours" => ["h", "ч"],
    "min" => ["min", "мин"],
    "sat_goal" => ["Target score and exam date", "Цель и дата экзамена"],
    "target" => ["Target", "Цель"],
    "exam_date" => ["Exam date", "Дата экзамена"],
    "days_left" => ["days left", "дней осталось"],
    "best" => ["Best", "Лучший"],
    "latest" => ["Latest", "Последний"],
    "practice_tests" => ["Practice tests", "Пробные тесты"],
    "add_test" => ["Add a practice test", "Добавить пробный тест"],
    "test_name" => ["Test name (e.g. Bluebook Test 3)", "Название (например, Bluebook Test 3)"],
    "rw" => ["Reading & Writing", "Reading & Writing"],
    "math" => ["Math", "Math"],
    "total" => ["Total", "Итого"],
    "topics" => ["Topics", "Темы"],
    "not_started" => ["Not started", "Не начато"],
    "learning" => ["Learning", "Изучаю"],
    "confident" => ["Confident", "Уверенно"],
    "resource" => ["Link to your material", "Ссылка на ваш материал"],
    "progress" => ["Progress", "Прогресс"],
    "score_chart" => ["Score history", "История баллов"],
    "problems" => ["Problems", "Задачи"],
    "add_problem" => ["Add a problem", "Добавить задачу"],
    "source" => ["Source (e.g. IMO 2019 P1, ISL 2020 A2)", "Источник (например, IMO 2019 P1, ISL 2020 A2)"],
    "area" => ["Area", "Раздел"],
    "difficulty" => ["Difficulty (1–5)", "Сложность (1–5)"],
    "status" => ["Status", "Статус"],
    "solved" => ["Solved", "Решена"],
    "partial" => ["Partially", "Частично"],
    "unsolved" => ["Not solved", "Не решена"],
    "key_idea" => ["Key idea of the solution", "Главная идея решения"],
    "solved_count" => ["solved", "решено"],
    "subjects" => ["Subjects", "Предметы"],
    "add_subject" => ["Add a subject", "Добавить предмет"],
    "subject_name" => ["Subject name", "Название предмета"],
    "level" => ["Level", "Уровень"],
    "boundaries" => ["Grade boundaries: lowest total (0–32) for grades 1–7", "Границы оценок: минимальная сумма (0–32) для оценок 1–7"],
    "assessments" => ["Homework and assessments", "Домашние задания и работы"],
    "add_assessment" => ["Add homework or assessment", "Добавить задание или работу"],
    "title" => ["Title", "Название"],
    "kind" => ["Type", "Тип"],
    "homework" => ["Homework", "Домашнее задание"],
    "test" => ["Test", "Контрольная"],
    "ia" => ["Internal assessment", "Internal assessment"],
    "project" => ["Project", "Проект"],
    "todo" => ["To do", "Нужно сделать"],
    "submitted" => ["Submitted", "Сдано"],
    "graded" => ["Graded", "Оценено"],
    "criteria" => ["Criteria A–D (0–8 each)", "Критерии A–D (0–8 каждый)"],
    "grade" => ["Grade", "Оценка"],
    "feedback" => ["Teacher feedback", "Отзыв учителя"],
    "average" => ["Average grade", "Средняя оценка"],
    "grade_needs_all" => ["The 1–7 grade appears when all four criteria are entered.", "Оценка 1–7 появляется, когда заполнены все четыре критерия."],
    "add_correction" => ["Add a mistake to work on", "Добавить ошибку для разбора"],
    "mistake" => ["What went wrong", "В чём была ошибка"],
    "correction" => ["Correct solution / rule", "Правильное решение / правило"],
    "topic" => ["Topic", "Тема"],
    "due_review" => ["Due for review", "Пора повторить"],
    "remember" => ["I remember it", "Помню"],
    "still_hard" => ["Still difficult", "Пока сложно"],
    "next_review" => ["Next review", "Следующее повторение"],
    "mastered" => ["Mastered", "Усвоено"],
    "in_progress" => ["In progress", "В работе"],
    "spaced_hint" => ["Each successful review moves the next one further away: 1, 3, 7, 14 and 30 days.", "После каждого удачного повторения следующее отодвигается: 1, 3, 7, 14 и 30 дней."],
    "tasks_today" => ["Tasks for today", "Задачи на сегодня"],
    "deadlines" => ["Upcoming deadlines", "Ближайшие дедлайны"],
    "reviews_today" => ["Corrections to review today", "Повторить сегодня"],
    "open" => ["Open", "Открыть"],
    "all_clear" => ["All clear for today.", "На сегодня всё сделано."],
    "ib_grade_table" => ["Grade table", "Таблица оценок"],
    "satcourse" => ["SAT course", "SAT курс"],
    "c_title" => ["SAT course: step-by-step lessons", "SAT курс: уроки шаг за шагом"],
    "c_hint" => ["Lessons go from easy to hard. Each lesson: theory, examples, a warm-up and practice. After every 10 lessons — a unit test; after every 20 — a review test of the two units. A test is passed at 60%, and you can retake it.", "Уроки идут от простого к сложному. В каждом: теория, примеры, разминка и практика. После каждых 10 уроков — тест модуля, после каждых 20 — повторительный тест по двум модулям. Тест засчитывается от 60%, его можно пересдать."],
    "c_unit" => ["Unit", "Модуль"],
    "c_lesson" => ["Lesson", "Урок"],
    "c_lessons_done" => ["Lessons done", "Пройдено уроков"],
    "c_accuracy" => ["Accuracy in practice", "Точность в практике"],
    "c_continue" => ["Continue", "Продолжить"],
    "c_locked" => ["Opens after the previous step", "Откроется после предыдущего шага"],
    "c_test_unit" => ["Unit test", "Тест модуля"],
    "c_test_review" => ["Review test: units", "Повторительный тест: модули"],
    "c_test_final" => ["Final test: units", "Итоговый тест: модули"],
    "c_theory" => ["Theory", "Теория"],
    "c_formulas" => ["Formulas and rules", "Формулы и правила"],
    "c_steps" => ["How to solve", "Как решать"],
    "c_examples" => ["Worked examples", "Разобранные примеры"],
    "c_traps" => ["Traps", "Ловушки"],
    "c_tip" => ["Tip", "Совет"],
    "c_warmup" => ["Warm-up from the task book", "Разминка из задачника"],
    "c_practice" => ["Practice (from easy to hard)", "Практика (от простого к сложному)"],
    "c_lesson_done" => ["Lesson done!", "Урок пройден!"],
    "c_next" => ["Next", "Дальше"],
    "c_back_map" => ["Course map", "Карта курса"],
    "c_questions" => ["questions", "вопросов"],
    "c_pass_at" => ["Passed at 60%. No time limit; answers are shown after you finish.", "Засчитывается от 60%. Без ограничения времени; ответы покажем после сдачи."],
    "c_submit" => ["Finish the test", "Завершить тест"],
    "c_score" => ["Your score", "Ваш результат"],
    "c_passed" => ["Passed — the next unit is open!", "Тест сдан — следующий модуль открыт!"],
    "c_failed" => ["Not yet — review the lessons and try again. You've got this!", "Пока не хватило — повторите уроки и попробуйте ещё раз. У вас получится!"],
    "c_retake" => ["Retake the test", "Пересдать тест"],
    "c_best" => ["Best", "Лучший"],
    "c_your" => ["Your answer", "Ваш ответ"],
    "c_no_answer" => ["no answer", "нет ответа"],
    "c_review_wrong" => ["Review", "Разбор"],
    "k_title" => ["Flashcards", "Карточки"],
    "k_learned" => ["Learned", "Выучено"],
    "k_due" => ["Due today", "На сегодня"],
    "k_due_today" => ["Cards due today", "Карточки на сегодня"],
    "k_flip" => ["Flip the card", "Перевернуть карточку"],
    "k_question" => ["Question", "Вопрос"],
    "k_answer" => ["Answer", "Ответ"],
    "k_hint" => ["Think of the answer, then click the card to flip it (or press Space).", "Вспомните ответ и нажмите на карточку, чтобы перевернуть (или пробел)."],
    "k_again" => ["Again", "Ещё раз"],
    "k_good" => ["Got it", "Знаю"],
    "k_left" => ["cards left", "карточек осталось"],
    "k_done" => ["All cards for today are done! Come back tomorrow — cards return at growing intervals (1, 3, 7, 14, 30 days).", "Все карточки на сегодня пройдены! Приходите завтра — карточки возвращаются через 1, 3, 7, 14, 30 дней."],
    "k_practice_all" => ["Practice all cards again (not saved)", "Повторить все карточки ещё раз (без сохранения)"],
    "k_all" => ["All cards", "Все карточки"],
    "k_review_title" => ["Flashcard review", "Повторение карточек"],
    "k_review_hint" => ["Cards from all open lessons that are due today. \"Got it\" moves a card to a later day; \"Again\" keeps it for today.", "Карточки из всех открытых уроков, которые пора повторить. «Знаю» — карточка вернётся позже, «Ещё раз» — останется на сегодня."],
    "k_none_due" => ["No cards due today. Great job!", "На сегодня карточек нет. Отлично!"],
    "k_review_btn" => ["Review cards", "Повторить карточки"],
    "satbank" => ["SAT tasks", "SAT задачник"],
    "transcript" => ["Transcript & GPA", "Табель и GPA"],
    "tr_title" => ["Grades of all years and GPA", "Оценки за все годы и GPA"],
    "tr_hint" => ["Enter the semester grades (1–7) from your school reports. The current year comes from the forecast on the IB grades tab until you enter the final grades here.", "Внесите семестровые оценки (1–7) из табелей. Текущий год берётся из прогноза во вкладке «Оценки IB», пока вы не внесёте сюда итоговые оценки."],
    "tr_enter" => ["Enter grades", "Внести оценки"],
    "tr_grade" => ["Grade", "Класс"],
    "tr_class" => ["grade", "класс"],
    "tr_sem" => ["sem.", "сем."],
    "tr_mark" => ["Mark 1–7", "Оценка 1–7"],
    "tr_other" => ["Another subject", "Другой предмет"],
    "tr_saved" => ["Saved", "Сохранено"],
    "tr_cumulative" => ["Cumulative GPA, grades 9–12", "Накопительный GPA, 9–12 классы"],
    "tr_cumulative_hint" => ["US universities, Harvard included, look at the grades from grade 9 on. Each subject in each semester counts once.", "Университеты США, в том числе Гарвард, смотрят оценки с 9 класса. Каждый предмет в каждом семестре считается один раз."],
    "tr_by_sem" => ["GPA by semester", "GPA по семестрам"],
    "tr_by_subject" => ["Each subject over the years", "Каждый предмет по годам"],
    "tr_forecast" => ["forecast", "прогноз"],
    "tr_current_grade" => ["I am now in grade", "Сейчас я в классе"],
    "tr_empty" => ["No grades yet — enter the first semester above.", "Оценок пока нет — внесите первый семестр выше."],
    "tr_trend" => ["Trend", "Динамика"],
    "bank_title" => ["SAT task book · modules", "SAT задачник · модули"],
    "bank_hint" => ["Modules of 50 tasks. Type your answer — it is checked automatically. A module opens when 80% of the previous one is answered.", "Модули по 50 заданий. Впишите ответ — он проверяется автоматически. Модуль открывается, когда решено 80% предыдущего."],
    "level" => ["Level", "Уровень"],
    "xp" => ["XP", "XP"],
    "today_goal" => ["Today", "Сегодня"],
    "accuracy" => ["Accuracy", "Точность"],
    "answered" => ["Answered", "Решено"],
    "module" => ["Module", "Модуль"],
    "locked" => ["Locked", "Закрыт"],
    "continue" => ["Continue", "Продолжить"],
    "all_modules" => ["All modules", "Все модули"],
    "your_answer" => ["Your answer", "Ваш ответ"],
    "check" => ["Check", "Проверить"],
    "show_solution" => ["Show solution", "Показать решение"],
    "correct_answer" => ["Answer", "Ответ"],
    "right" => ["Correct", "Верно"],
    "wrong" => ["Not correct", "Неверно"],
    "revealed" => ["Solution viewed", "Решение просмотрено"],
    "try_again" => ["Try again", "Ещё раз"],
    "i_was_right" => ["My answer was right", "Мой ответ был верным"],
    "to_corrections" => ["Add to corrections", "В работу над ошибками"],
    "added" => ["Added", "Добавлено"],
    "prev_module" => ["Previous module", "Предыдущий модуль"],
    "next_module" => ["Next module", "Следующий модуль"],
    "module_locked_text" => ["Answer at least 80% of the previous module to open this one.", "Решите хотя бы 80% предыдущего модуля, чтобы открыть этот."],
    "bank_empty" => ["The task book has not been uploaded yet.", "Задачник ещё не загружен."],
    "bank_import" => ["Upload the task book file (.json)", "Загрузить файл задачника (.json)"],
    "bank_import_hint" => ["Use the file prepared for this site. It is stored only in the site's database, not on GitHub.", "Используйте файл, подготовленный для сайта. Он хранится только в базе сайта, не на GitHub."],
    "bank_imported" => ["Task book uploaded:", "Задачник загружен:"],
    "tasks_word" => ["tasks", "заданий"],
    "upload" => ["Upload", "Загрузить"],
    "stars_hint" => ["Stars: 3 for 90%+ correct, 2 for 75%+, 1 for 50%+ (when the module is finished).", "Звёзды: 3 за 90%+ верных, 2 за 75%+, 1 за 50%+ (когда модуль пройден)."],
    "g_term" => ["Semester", "Семестр"],
    "g_term1" => ["Semester 1", "1 семестр"],
    "g_term2" => ["Semester 2", "2 семестр"],
    "g_year" => ["Whole year", "Весь год"],
    "g_table" => ["Grades and forecast", "Оценки и прогноз"],
    "g_forecast" => ["Forecast", "Прогноз"],
    "g_forecast_hint" => ["Forecast = average level for each criterion A–D across summatives, added up (out of 32) and turned into 1–7 with the subject's grade boundaries. ≈ means some criteria have no marks yet.", "Прогноз = средний уровень по каждому критерию A–D за суммативные работы, сумма (из 32) переводится в оценку 1–7 по границам предмета. ≈ — по некоторым критериям ещё нет оценок."],
    "g_works" => ["Graded", "Оценено"],
    "g_planned" => ["Planned", "Впереди"],
    "g_next" => ["Next", "Ближайшая"],
    "g_to_next" => ["to the next grade", "до следующей оценки"],
    "g_upcoming" => ["Upcoming summatives", "Ближайшие суммативки"],
    "g_add_nis" => ["Add the subjects of grade 10 (NIS, IB track)", "Добавить предметы 10 класса (НИШ, IB)"],
    "g_add_nis_hint" => ["You can rename or delete any of them later, and add your own below.", "Любой предмет потом можно переименовать или удалить, а свой — добавить ниже."],
    "g_gpa_from" => ["Subjects with a forecast:", "Предметов с прогнозом:"],
    "g_gpa_hint" => ["IB 7 = 4.0 (A), 6 = 3.7 (A-), 5 = 3.3 (B+), 4 = 3.0 (B), 3 = 2.0 (C), 2 = 1.0 (D), 1 = 0. A common conversion; universities may recalculate.", "IB 7 = 4.0 (A), 6 = 3.7 (A-), 5 = 3.3 (B+), 4 = 3.0 (B), 3 = 2.0 (C), 2 = 1.0 (D), 1 = 0. Распространённая шкала; университеты могут пересчитать по-своему."],
    "g_gpa_empty" => ["Enter marks for at least one summative and the GPA appears here.", "Поставьте оценки хотя бы за одну суммативную работу — и здесь появится GPA."],
    "g_goal" => ["Goal", "Цель"],
    "g_goal_ok" => ["Goal reached — keep it up!", "Цель достигнута — так держать!"],
    "g_goal_left" => ["to the goal", "до цели"],
    "g_goal_change" => ["Change the goal", "Изменить цель"],
    "g_harvard_note" => ["Harvard has no official minimum GPA; admitted students usually have about 3.9–4.0 unweighted, and grades are only one part of the application (essays, activities, recommendations, SAT matter too).", "У Гарварда нет официального минимального GPA; у поступивших он обычно около 3.9–4.0 (unweighted), и оценки — лишь часть заявки (важны эссе, активности, рекомендации, SAT)."],
    "g_missing" => ["Will be added", "Будут добавлены"],
    "g_edit_subjects" => ["Edit subjects and grade boundaries", "Изменить предметы и границы оценок"],
    "g_add_for" => ["+ work", "+ работа"],
    "g_partial_ok" => ["Fill in only the criteria this work assesses; the others can stay empty.", "Заполняйте только те критерии, которые оценивает эта работа; остальные можно оставить пустыми."],
    "g_auto_term" => ["by date", "по дате"],
    "cover" => ["Cover", "Обложка"],
    "cover_add" => ["Add a cover", "Добавить обложку"],
    "cover_change" => ["Change cover", "Изменить обложку"],
    "cover_photo" => ["Your photo", "Своё фото"],
    "cover_photo_hint" => ["JPG, PNG, WEBP or GIF up to 10 MB. Only you see it.", "JPG, PNG, WEBP или GIF до 10 МБ. Видите только вы."],
    "cover_presets" => ["Ready-made covers", "Готовые обложки"],
    "cover_pos" => ["Which part of the photo to show", "Какую часть фото показывать"],
    "cover_remove" => ["Remove cover", "Убрать обложку"],
    "cover_bad" => ["Please choose a picture (JPG, PNG, WEBP or GIF up to 10 MB).", "Выберите картинку (JPG, PNG, WEBP или GIF до 10 МБ)."],
    "cover_close" => ["Close", "Закрыть"],
    "health" => ["Health", "Здоровье"],
    "h_title" => ["Habits and daily workout", "Привычки и ежедневная тренировка"],
    "h_note" => ["No judging here: just tick what you did. All numbers are yours to change, and a rest day is part of the plan too.", "Здесь без осуждения: просто отмечайте, что получилось. Все цифры можно менять под себя, а день отдыха — тоже часть плана."],
    "h_safety" => ["200 reps or an hour of jumping is a big load: build up gradually, and stop if something hurts.", "200 повторов и час прыжков — большая нагрузка: наращивайте постепенно и остановитесь, если что-то болит."],
    "h_habits" => ["Daily habits", "Привычки на каждый день"],
    "h_workout" => ["Workout checklist", "Чеклист тренировки"],
    "h_streak" => ["days in a row", "дн. подряд"],
    "h_last30" => ["Last 30 days", "Последние 30 дней"],
    "h_week" => ["Workout days this week", "Дней с тренировкой на этой неделе"],
    "h_workout_streak" => ["Workout streak", "Тренировки подряд"],
    "h_done" => ["done", "сделано"],
    "h_today" => ["Today", "Сегодня"],
    "h_prev" => ["Previous day", "Предыдущий день"],
    "h_next" => ["Next day", "Следующий день"],
    "h_all_done" => ["Workout complete — well done!", "Тренировка выполнена — вы молодец!"],
    "h_manage" => ["Edit habits and exercises", "Изменить привычки и упражнения"],
    "h_add_habit" => ["Add a habit", "Добавить привычку"],
    "h_add_ex" => ["Add an exercise", "Добавить упражнение"],
    "h_name" => ["Name", "Название"],
    "h_target" => ["How much (reps, minutes)", "Сколько (повторы, минуты)"],
    "h_weight" => ["Weight / band, kg", "Вес / лента, кг"],
    "h_block" => ["Section", "Раздел"],
    "h_save" => ["Save", "Сохранить"],
    "h_delete" => ["Delete", "Удалить"],
    "h_confirm" => ["Delete it together with its history?", "Удалить вместе с историей отметок?"],
    "h_empty" => ["Nothing here yet — add it below.", "Пока пусто — добавьте ниже."],
    "h_saved" => ["Saved", "Сохранено"],
    "materials_note" => ["Study Hub helps you plan and track; add links to your own materials and practice tests.", "Кабинет помогает планировать и отслеживать; добавляйте ссылки на свои материалы и пробные тесты."],
];

function t($key)
{
    global $study_lang;
    $pair = STUDY_TEXT[$key] ?? [$key, $key];
    return $study_lang === "ru" ? $pair[1] : $pair[0];
}

// Label in the current language from an ["en", "ru"] pair
function tl(array $pair)
{
    global $study_lang;
    return $study_lang === "ru" ? $pair[1] : $pair[0];
}


// ---------------------------------------------------------------
// Preparation topics
// ---------------------------------------------------------------

// Digital SAT skills (College Board content domains)
const SAT_TOPICS = [
    "Reading & Writing — Information and Ideas" => [
        "rw_central" => ["Central Ideas and Details", "Главная мысль и детали"],
        "rw_evidence_text" => ["Command of Evidence: Textual", "Доказательства из текста"],
        "rw_evidence_quant" => ["Command of Evidence: Quantitative", "Доказательства из графиков и таблиц"],
        "rw_inferences" => ["Inferences", "Выводы (inferences)"],
    ],
    "Reading & Writing — Craft and Structure" => [
        "rw_words" => ["Words in Context", "Значение слов в контексте"],
        "rw_structure" => ["Text Structure and Purpose", "Структура и цель текста"],
        "rw_cross" => ["Cross-Text Connections", "Связь двух текстов"],
    ],
    "Reading & Writing — Expression of Ideas" => [
        "rw_synthesis" => ["Rhetorical Synthesis", "Риторический синтез (notes)"],
        "rw_transitions" => ["Transitions", "Связки (transitions)"],
    ],
    "Reading & Writing — Standard English Conventions" => [
        "rw_boundaries" => ["Boundaries (punctuation)", "Границы предложений (пунктуация)"],
        "rw_form" => ["Form, Structure, and Sense", "Форма и согласование"],
    ],
    "Math — Algebra" => [
        "m_lin1" => ["Linear equations in one variable", "Линейные уравнения с одной переменной"],
        "m_linfunc" => ["Linear functions", "Линейные функции"],
        "m_lin2" => ["Linear equations in two variables", "Линейные уравнения с двумя переменными"],
        "m_systems" => ["Systems of two linear equations", "Системы линейных уравнений"],
        "m_ineq" => ["Linear inequalities", "Линейные неравенства"],
    ],
    "Math — Advanced Math" => [
        "m_equiv" => ["Equivalent expressions", "Равносильные выражения"],
        "m_nonlin_eq" => ["Nonlinear equations and systems", "Нелинейные уравнения и системы"],
        "m_nonlin_func" => ["Nonlinear functions", "Нелинейные функции"],
    ],
    "Math — Problem-Solving and Data Analysis" => [
        "m_ratios" => ["Ratios, rates, proportions and units", "Отношения, скорости, пропорции, единицы"],
        "m_percent" => ["Percentages", "Проценты"],
        "m_data1" => ["One-variable data", "Данные с одной переменной"],
        "m_data2" => ["Two-variable data", "Данные с двумя переменными"],
        "m_prob" => ["Probability and conditional probability", "Вероятность и условная вероятность"],
        "m_inference" => ["Inference from sample statistics and margin of error", "Выводы по выборке, погрешность"],
        "m_claims" => ["Evaluating statistical claims", "Оценка статистических утверждений"],
    ],
    "Math — Geometry and Trigonometry" => [
        "m_area" => ["Area and volume", "Площадь и объём"],
        "m_lines" => ["Lines, angles and triangles", "Прямые, углы, треугольники"],
        "m_trig" => ["Right triangles and trigonometry", "Прямоугольные треугольники и тригонометрия"],
        "m_circles" => ["Circles", "Окружности"],
    ],
];

const IMO_AREAS = [
    "algebra" => ["Algebra", "Алгебра"],
    "combinatorics" => ["Combinatorics", "Комбинаторика"],
    "geometry" => ["Geometry", "Геометрия"],
    "number_theory" => ["Number theory", "Теория чисел"],
];

const IMO_TOPICS = [
    "algebra" => [
        "a_ineq" => ["Inequalities (AM–GM, Cauchy–Schwarz, rearrangement)", "Неравенства (о средних, Коши–Буняковского, перестановок)"],
        "a_func" => ["Functional equations", "Функциональные уравнения"],
        "a_poly" => ["Polynomials", "Многочлены"],
        "a_seq" => ["Sequences and recurrences", "Последовательности и рекурренты"],
    ],
    "combinatorics" => [
        "c_count" => ["Counting and bijections", "Подсчёт и биекции"],
        "c_pigeon" => ["Pigeonhole principle", "Принцип Дирихле"],
        "c_invariant" => ["Invariants and monovariants", "Инварианты и полуинварианты"],
        "c_graphs" => ["Graph theory", "Теория графов"],
        "c_extremal" => ["Extremal principle", "Принцип крайнего"],
        "c_games" => ["Games and strategies", "Игры и стратегии"],
    ],
    "geometry" => [
        "g_angles" => ["Angle chasing and cyclic quadrilaterals", "Счёт углов и вписанные четырёхугольники"],
        "g_similar" => ["Similarity and homothety", "Подобие и гомотетия"],
        "g_power" => ["Power of a point and radical axis", "Степень точки и радикальная ось"],
        "g_centres" => ["Triangle centres", "Замечательные точки треугольника"],
        "g_inversion" => ["Inversion", "Инверсия"],
        "g_coords" => ["Coordinates, complex numbers, barycentrics", "Координаты, комплексные числа, барицентрики"],
    ],
    "number_theory" => [
        "n_div" => ["Divisibility and GCD", "Делимость и НОД"],
        "n_mod" => ["Modular arithmetic", "Сравнения по модулю"],
        "n_fermat" => ["Fermat's and Euler's theorems", "Теоремы Ферма и Эйлера"],
        "n_dioph" => ["Diophantine equations", "Диофантовы уравнения"],
        "n_lte" => ["p-adic valuation and LTE", "p-адическая оценка и LTE"],
        "n_orders" => ["Orders and primitive roots", "Порядки и первообразные корни"],
    ],
];

const STUDY_SUBJECTS = ["sat", "imo", "ib", "other"];

// Spaced repetition of corrections: days until the next review after each successful one
const CORRECTION_INTERVALS = [1, 3, 7, 14, 30];


// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function study_date($value)
{
    $value = trim((string)$value);
    $d = DateTime::createFromFormat("Y-m-d", $value);
    return ($d && $d->format("Y-m-d") === $value) ? $value : null;
}

function study_int($value, $min, $max)
{
    if ($value === null || $value === "" || !is_numeric($value)) {
        return null;
    }
    $n = (int)$value;
    return ($n >= $min && $n <= $max) ? $n : null;
}

function study_text($value, $max)
{
    return mb_substr(trim((string)$value), 0, $max);
}

function minutes_label($minutes)
{
    $h = intdiv((int)$minutes, 60);
    $m = (int)$minutes % 60;
    return ($h ? $h . " " . t("hours") . " " : "") . ($m || !$h ? $m . " " . t("min") : "");
}

// IB criteria A–D (0–8 each, total 0–32) → grade 1–7 using the subject's boundaries
function ib_grade($a, $b, $c, $d, $boundaries)
{
    if ($a === null || $b === null || $c === null || $d === null) {
        return null;
    }
    $total = $a + $b + $c + $d;
    $mins = array_map("intval", explode(",", $boundaries));
    $grade = 0;
    foreach ($mins as $i => $min) {
        if ($total >= $min) {
            $grade = $i + 1;
        }
    }
    return $grade;
}

function ib_boundaries_from_input($value)
{
    $parts = array_map("trim", explode(",", (string)$value));
    if (count($parts) !== 7) {
        return null;
    }
    $prev = -1;
    foreach ($parts as $p) {
        if (!ctype_digit($p) || (int)$p > 32 || (int)$p <= $prev) {
            return null;
        }
        $prev = (int)$p;
    }
    return implode(",", array_map("intval", $parts));
}
