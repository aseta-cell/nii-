<?php
// New patent application form.

require_once "patent_lib.php";

require_login();

$user = current_user();
$errors = [];

$fields = ["patent_type", "last_name", "first_name", "patronymic", "iin", "phone", "email", "address",
           "title_kz", "title_ru", "title_en", "abstract"];

$data = [];

foreach ($fields as $field) {
    $data[$field] = trim($_POST[$field] ?? "");
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    // Prefill from the profile
    $parts = preg_split("/\\s+/", trim($user["fullname"]));
    $data["last_name"] = $parts[0] ?? "";
    $data["first_name"] = $parts[1] ?? "";
    $data["patronymic"] = $parts[2] ?? "";
    $data["email"] = $user["email"];
    $data["patent_type"] = "invention";
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    foreach (["last_name", "first_name", "phone", "title_kz", "title_ru", "title_en"] as $required) {
        if ($data[$required] === "") {
            $errors[] = "Please fill in all required fields (*).";
            break;
        }
    }

    if (!filter_var($data["email"], FILTER_VALIDATE_EMAIL)) {
        $errors[] = "Please enter a valid email.";
    }

    if (!isset($settings["patent_types"][$data["patent_type"]])) {
        $errors[] = "Please choose the type of protection.";
    }

    if ($data["iin"] !== "" && !preg_match("/^\\d{12}$/", $data["iin"])) {
        $errors[] = "IIN must be 12 digits.";
    }

    // Co-inventors: rows with at least a last name
    $co_inventors = [];

    foreach ($_POST["co_last_name"] ?? [] as $i => $last) {
        $last = trim($last);

        if ($last !== "") {
            $co_inventors[] = [
                "last_name"  => $last,
                "first_name" => trim($_POST["co_first_name"][$i] ?? ""),
                "patronymic" => trim($_POST["co_patronymic"][$i] ?? ""),
            ];
        }
    }

    // Optional description file
    $filename = null;

    if (isset($_FILES["description_file"]) && $_FILES["description_file"]["error"] !== UPLOAD_ERR_NO_FILE) {
        $filename = save_upload("description_file", ["pdf", "doc", "docx"]);

        if ($filename === null) {
            $errors[] = "Description file must be PDF, DOC or DOCX (max 20 MB).";
        }
    }

    if (!$errors) {

        $is_free = (int)$user["free_access"];
        $fee = $is_free ? 0 : $settings["patent_fee"];
        $currency = $settings["currency"];
        $status = $is_free ? "Filed" : "Awaiting Payment";
        $paid_at = $is_free ? date("Y-m-d H:i:s") : null;
        $co_json = json_encode($co_inventors, JSON_UNESCAPED_UNICODE);

        $stmt = $conn->prepare("
            INSERT INTO patents
            (user_id, patent_type, last_name, first_name, patronymic, iin, phone, email, address, co_inventors,
             title_kz, title_ru, title_en, abstract, filename, fee, currency, is_free, status, paid_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->bind_param(
            "issssssssssssssdsiss",
            $user["id"], $data["patent_type"], $data["last_name"], $data["first_name"], $data["patronymic"],
            $data["iin"], $data["phone"], $data["email"], $data["address"], $co_json,
            $data["title_kz"], $data["title_ru"], $data["title_en"], $data["abstract"], $filename,
            $fee, $currency, $is_free, $status, $paid_at
        );
        $stmt->execute();

        $id = $conn->insert_id;

        // Application number, e.g. NII-PAT-2026-00001
        $number = sprintf("%s-%s-%05d", $settings["patent_prefix"], date("Y"), $id);

        $stmt = $conn->prepare("UPDATE patents SET number = ? WHERE id = ?");
        $stmt->bind_param("si", $number, $id);
        $stmt->execute();

        redirect("patent.php?id=" . $id . "&created=1");
    }
}

$co_rows = [];

foreach ($_POST["co_last_name"] ?? [] as $i => $last) {
    $co_rows[] = [
        "last_name"  => $last,
        "first_name" => $_POST["co_first_name"][$i] ?? "",
        "patronymic" => $_POST["co_patronymic"][$i] ?? "",
    ];
}

if (!$co_rows) {
    $co_rows[] = ["last_name" => "", "first_name" => "", "patronymic" => ""];
}

function field($name, $label, $data, $required = false, $type = "text", $extra = "")
{
    return '<div>
        <label class="block font-semibold mb-1">' . $label . ($required ? ' <span class="text-red-600">*</span>' : '') . '</label>
        <input type="' . $type . '" name="' . $name . '" value="' . e($data[$name]) . '" ' . ($required ? "required " : "") . $extra . '
               class="w-full border rounded-lg px-4 py-3">
    </div>';
}
?>
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Patent Application | <?= e($site_name) ?></title>
<script src="https://cdn.tailwindcss.com"></script>
</head>

<body class="bg-gray-100">

<div class="max-w-4xl mx-auto py-12 px-6">

<a href="patents.php" class="text-blue-600 hover:underline">← Patents</a>

<div class="bg-white rounded-xl shadow-lg p-8 md:p-10 mt-6">

<h1 class="text-3xl font-bold">Патентке өтінім · Заявка на патент · Patent Application</h1>

<p class="text-gray-600 mt-2">
    <?php if ($user["free_access"]): ?>
        <span class="text-green-700 font-semibold">Special access — the application fee is free for you.</span>
    <?php else: ?>
        Application fee: <strong><?= e(number_format((float)$settings["patent_fee"], 2) . " " . $settings["currency"]) ?></strong>
    <?php endif; ?>
</p>

<?php foreach ($errors as $error): ?>
<p class="mt-4 p-3 rounded bg-red-100 text-red-800"><?= e($error) ?></p>
<?php endforeach; ?>

<form method="POST" enctype="multipart/form-data" class="space-y-8 mt-8">

<!-- TYPE -->
<section>
    <h2 class="text-xl font-bold mb-4 border-b pb-2">1. Қорғау түрі · Вид охраны · Type of protection</h2>

    <div class="grid md:grid-cols-3 gap-3">
    <?php foreach ($settings["patent_types"] as $key => $labels): ?>
        <label class="border rounded-lg p-4 cursor-pointer flex gap-3 items-start">
            <input type="radio" name="patent_type" value="<?= e($key) ?>" <?= $data["patent_type"] === $key ? "checked" : "" ?> required>
            <span>
                <strong><?= e($labels["ru"]) ?></strong><br>
                <span class="text-sm text-gray-600"><?= e($labels["kz"]) ?> · <?= e($labels["en"]) ?></span>
            </span>
        </label>
    <?php endforeach; ?>
    </div>
</section>

<!-- APPLICANT -->
<section>
    <h2 class="text-xl font-bold mb-4 border-b pb-2">2. Өтініш беруші · Заявитель (автор) · Applicant (inventor)</h2>

    <div class="grid md:grid-cols-3 gap-4">
        <?= field("last_name", "Тегі · Фамилия · Last name", $data, true) ?>
        <?= field("first_name", "Аты · Имя · First name", $data, true) ?>
        <?= field("patronymic", "Әкесінің аты · Отчество · Patronymic", $data) ?>
    </div>

    <div class="grid md:grid-cols-3 gap-4 mt-4">
        <?= field("iin", "ЖСН · ИИН · IIN", $data, false, "text", 'inputmode="numeric" maxlength="12" pattern="\\d{12}"') ?>
        <?= field("phone", "Телефон · Phone", $data, true, "tel", 'placeholder="+7 7XX XXX XX XX"') ?>
        <?= field("email", "Email · Эл. почта", $data, true, "email") ?>
    </div>

    <div class="mt-4">
        <?= field("address", "Мекенжай · Адрес · Address", $data) ?>
    </div>
</section>

<!-- CO-INVENTORS -->
<section>
    <h2 class="text-xl font-bold mb-1 border-b pb-2">3. Бірлескен авторлар · Соавторы · Co-inventors</h2>
    <p class="text-sm text-gray-500 mb-4">Optional. Leave empty if you are the only inventor.</p>

    <div id="coRows" class="space-y-3">
    <?php foreach ($co_rows as $row): ?>
        <div class="grid md:grid-cols-3 gap-3 co-row">
            <input name="co_last_name[]" value="<?= e($row["last_name"]) ?>" placeholder="Фамилия · Last name" class="border rounded-lg px-4 py-3">
            <input name="co_first_name[]" value="<?= e($row["first_name"]) ?>" placeholder="Имя · First name" class="border rounded-lg px-4 py-3">
            <input name="co_patronymic[]" value="<?= e($row["patronymic"]) ?>" placeholder="Отчество · Patronymic" class="border rounded-lg px-4 py-3">
        </div>
    <?php endforeach; ?>
    </div>

    <button type="button" onclick="addCoRow()" class="mt-3 text-blue-700 font-semibold">+ Add co-inventor</button>
</section>

<!-- TITLES -->
<section>
    <h2 class="text-xl font-bold mb-4 border-b pb-2">4. Атауы · Название · Title</h2>

    <div class="space-y-4">
        <?= field("title_kz", "Қазақ тілінде · На казахском · In Kazakh", $data, true) ?>
        <?= field("title_ru", "Орыс тілінде · На русском · In Russian", $data, true) ?>
        <?= field("title_en", "Ағылшын тілінде · На английском · In English", $data, true) ?>
    </div>
</section>

<!-- DESCRIPTION -->
<section>
    <h2 class="text-xl font-bold mb-4 border-b pb-2">5. Сипаттама · Описание · Description</h2>

    <label class="block font-semibold mb-1">Реферат · Abstract</label>
    <textarea name="abstract" rows="6" class="w-full border rounded-lg px-4 py-3"
              placeholder="Short description of the invention"><?= e($data["abstract"]) ?></textarea>

    <label class="block font-semibold mt-4 mb-1">Description file (PDF, DOC, DOCX) — optional</label>
    <input type="file" name="description_file" accept=".pdf,.doc,.docx" class="block w-full border rounded-lg p-3">
</section>

<button type="submit" class="bg-blue-700 text-white px-8 py-4 rounded-lg font-bold hover:bg-blue-800">
    Өтінімді жіберу · Подать заявку · Submit application
</button>

</form>

</div>

</div>

<script>
function addCoRow() {
    const rows = document.getElementById("coRows");
    const row = rows.querySelector(".co-row").cloneNode(true);
    row.querySelectorAll("input").forEach(input => input.value = "");
    rows.appendChild(row);
}
</script>

</body>
</html>
