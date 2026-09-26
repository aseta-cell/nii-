<?php
// Shared helpers for patent application pages.

require_once "config.php";

// Statuses in order, with labels in three languages
$patent_statuses = [
    "Awaiting Payment"  => ["kz" => "Төлем күтілуде",       "ru" => "Ожидает оплаты",        "en" => "Awaiting payment"],
    "Payment Review"    => ["kz" => "Төлем тексерілуде",    "ru" => "Оплата проверяется",    "en" => "Payment under review"],
    "Filed"             => ["kz" => "Өтінім қабылданды",    "ru" => "Заявка принята",        "en" => "Application filed"],
    "Under Examination" => ["kz" => "Сараптамада",          "ru" => "На экспертизе",         "en" => "Under examination"],
    "Granted"           => ["kz" => "Патент берілді",       "ru" => "Патент выдан",          "en" => "Patent granted"],
    "Rejected"          => ["kz" => "Қабылданбады",         "ru" => "Отказано",              "en" => "Rejected"],
];

// Statuses after the fee is paid (or waived)
$patent_paid_statuses = ["Filed", "Under Examination", "Granted", "Rejected"];

function current_user()
{
    global $conn;

    if (!isset($_SESSION["user_id"])) {
        return null;
    }

    $stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->bind_param("i", $_SESSION["user_id"]);
    $stmt->execute();

    return $stmt->get_result()->fetch_assoc();
}

// Loads a patent application the current user may see (owner or editor).
function load_patent($id, $user)
{
    global $conn;

    $stmt = $conn->prepare("SELECT * FROM patents WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $patent = $stmt->get_result()->fetch_assoc();

    if (!$patent || ((int)$patent["user_id"] !== (int)$user["id"] && $user["role"] !== "editor")) {
        http_response_code(404);
        die("Patent application not found.");
    }

    return $patent;
}

function patent_full_name($patent)
{
    return trim($patent["last_name"] . " " . $patent["first_name"] . " " . $patent["patronymic"]);
}

function patent_co_inventors($patent)
{
    $list = json_decode((string)$patent["co_inventors"], true);

    return is_array($list) ? $list : [];
}

function patent_type_label($type, $lang)
{
    global $settings;

    return $settings["patent_types"][$type][$lang] ?? $type;
}

function patent_status_badge($status)
{
    $colors = [
        "Awaiting Payment"  => "bg-blue-100 text-blue-800",
        "Payment Review"    => "bg-yellow-100 text-yellow-800",
        "Filed"             => "bg-green-100 text-green-800",
        "Under Examination" => "bg-purple-100 text-purple-800",
        "Granted"           => "bg-emerald-200 text-emerald-900",
        "Rejected"          => "bg-red-100 text-red-800",
    ];

    return '<span class="px-3 py-1 rounded-full text-sm ' . ($colors[$status] ?? "bg-gray-100") . '">' . e($status) . '</span>';
}
