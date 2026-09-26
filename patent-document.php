<?php
// Printable patent application document (three languages + barcode).
// Use the browser's "Print → Save as PDF" to get a PDF file.

require_once "patent_lib.php";
require_once "barcode_lib.php";

require_login();

$user = current_user();
$patent = load_patent((int)($_GET["id"] ?? 0), $user);
$is_paid = in_array($patent["status"], $patent_paid_statuses, true);
$co_inventors = patent_co_inventors($patent);
$status_labels = $patent_statuses[$patent["status"]] ?? ["kz" => $patent["status"], "ru" => $patent["status"], "en" => $patent["status"]];
?>
<!DOCTYPE html>
<html lang="ru">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($patent["number"]) ?></title>

<style>
    @page { size: A4; margin: 15mm; }

    * { box-sizing: border-box; }

    body {
        font-family: "Times New Roman", Times, serif;
        color: #000;
        background: #e5e7eb;
        margin: 0;
        font-size: 13px;
        line-height: 1.4;
    }

    .page {
        position: relative;
        background: #fff;
        max-width: 210mm;
        margin: 20px auto;
        padding: 15mm;
        box-shadow: 0 2px 10px rgba(0,0,0,.15);
    }

    .toolbar {
        max-width: 210mm;
        margin: 20px auto 0;
        display: flex;
        gap: 10px;
        font-family: Arial, sans-serif;
    }

    .toolbar button, .toolbar a {
        padding: 10px 18px;
        border-radius: 6px;
        border: 1px solid #1d4ed8;
        background: #1d4ed8;
        color: #fff;
        font-size: 14px;
        text-decoration: none;
        cursor: pointer;
    }

    .toolbar a { background: #fff; color: #1d4ed8; }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #000;
        padding-bottom: 10px;
        gap: 20px;
    }

    .org { font-weight: bold; font-size: 14px; text-transform: uppercase; }

    .barcode { text-align: center; }
    .barcode svg { display: block; max-width: 100%; height: auto; }
    .barcode .num { font-family: "Courier New", monospace; font-size: 14px; letter-spacing: 1px; margin-top: 2px; }

    h1 {
        text-align: center;
        font-size: 16px;
        margin: 18px 0 4px;
        text-transform: uppercase;
    }

    .subtitle { text-align: center; margin: 0 0 14px; }

    table { width: 100%; border-collapse: collapse; margin-top: 10px; }

    th, td {
        border: 1px solid #000;
        padding: 6px 8px;
        vertical-align: top;
        text-align: left;
    }

    th { width: 34%; background: #f3f4f6; font-weight: normal; }
    th small { display: block; color: #444; }

    .section { font-weight: bold; background: #e5e7eb; text-align: center; }

    .signature { margin-top: 30px; display: flex; justify-content: space-between; gap: 30px; }
    .signature div { flex: 1; border-top: 1px solid #000; padding-top: 4px; font-size: 11px; text-align: center; }

    .footer { margin-top: 20px; font-size: 10px; color: #444; text-align: center; }

    .draft {
        position: absolute;
        top: 40%;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 90px;
        font-weight: bold;
        color: rgba(220, 38, 38, .15);
        transform: rotate(-30deg);
        pointer-events: none;
    }

    @media print {
        body { background: #fff; }
        .toolbar { display: none; }
        .page { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    }
</style>
</head>

<body>

<div class="toolbar">
    <button onclick="window.print()">🖨 Print / Save as PDF</button>
    <a href="patent.php?id=<?= (int)$patent["id"] ?>">← Back to application</a>
</div>

<div class="page">

    <?php if (!$is_paid): ?>
        <div class="draft">DRAFT</div>
    <?php endif; ?>

    <div class="header">
        <div>
            <div class="org"><?= e($site_name) ?></div>
            <div>Патенттік бөлім · Патентный отдел · Patent Office</div>
            <div><?= e(preg_replace("#^https?://#", "", $site_url)) ?></div>
        </div>

        <div class="barcode">
            <?= code128_svg($patent["number"], 55, 1.6) ?>
            <div class="num"><?= e($patent["number"]) ?></div>
        </div>
    </div>

    <h1>Өтінім · Заявление · Application</h1>
    <p class="subtitle">
        Патент беру туралы · О выдаче патента · For grant of a patent
    </p>

    <table>
        <tr>
            <th>(21) Өтінім нөмірі<small>Номер заявки · Application No.</small></th>
            <td><strong><?= e($patent["number"]) ?></strong></td>
        </tr>
        <tr>
            <th>(22) Берілген күні<small>Дата подачи · Filing date</small></th>
            <td><?= e(date("d.m.Y", strtotime($patent["created_at"]))) ?></td>
        </tr>
        <tr>
            <th>Қорғау түрі<small>Вид охраны · Type of protection</small></th>
            <td>
                <?= e(patent_type_label($patent["patent_type"], "kz")) ?> /
                <?= e(patent_type_label($patent["patent_type"], "ru")) ?> /
                <?= e(patent_type_label($patent["patent_type"], "en")) ?>
            </td>
        </tr>
        <tr>
            <th>Мәртебесі<small>Статус · Status</small></th>
            <td><?= e($status_labels["kz"]) ?> / <?= e($status_labels["ru"]) ?> / <?= e($status_labels["en"]) ?></td>
        </tr>

        <tr><td colspan="2" class="section">(54) Атауы · Название · Title</td></tr>
        <tr>
            <th>Қазақ тілінде<small>На казахском · In Kazakh</small></th>
            <td><?= e($patent["title_kz"]) ?></td>
        </tr>
        <tr>
            <th>Орыс тілінде<small>На русском · In Russian</small></th>
            <td><?= e($patent["title_ru"]) ?></td>
        </tr>
        <tr>
            <th>Ағылшын тілінде<small>На английском · In English</small></th>
            <td><?= e($patent["title_en"]) ?></td>
        </tr>

        <tr><td colspan="2" class="section">(71) Өтініш беруші · Заявитель · Applicant</td></tr>
        <tr>
            <th>Тегі<small>Фамилия · Last name</small></th>
            <td><?= e($patent["last_name"]) ?></td>
        </tr>
        <tr>
            <th>Аты<small>Имя · First name</small></th>
            <td><?= e($patent["first_name"]) ?></td>
        </tr>
        <tr>
            <th>Әкесінің аты<small>Отчество · Patronymic</small></th>
            <td><?= e($patent["patronymic"]) ?: "—" ?></td>
        </tr>
        <?php if ($patent["iin"]): ?>
        <tr>
            <th>ЖСН<small>ИИН · IIN</small></th>
            <td><?= e($patent["iin"]) ?></td>
        </tr>
        <?php endif; ?>
        <tr>
            <th>Телефон<small>Телефон · Phone</small></th>
            <td><?= e($patent["phone"]) ?></td>
        </tr>
        <tr>
            <th>Электрондық пошта<small>Эл. почта · Email</small></th>
            <td><?= e($patent["email"]) ?></td>
        </tr>
        <?php if ($patent["address"]): ?>
        <tr>
            <th>Мекенжай<small>Адрес · Address</small></th>
            <td><?= e($patent["address"]) ?></td>
        </tr>
        <?php endif; ?>

        <tr><td colspan="2" class="section">(72) Авторлар · Авторы · Inventors</td></tr>
        <tr>
            <td colspan="2">
                1. <?= e(patent_full_name($patent)) ?>
                <?php foreach ($co_inventors as $i => $co): ?>
                    <br><?= $i + 2 ?>. <?= e(trim($co["last_name"] . " " . $co["first_name"] . " " . $co["patronymic"])) ?>
                <?php endforeach; ?>
            </td>
        </tr>

        <?php if ($patent["abstract"]): ?>
        <tr><td colspan="2" class="section">(57) Реферат · Реферат · Abstract</td></tr>
        <tr><td colspan="2"><?= nl2br(e($patent["abstract"])) ?></td></tr>
        <?php endif; ?>

        <tr><td colspan="2" class="section">Өтінім алымы · Пошлина · Application fee</td></tr>
        <tr>
            <th>Сомасы<small>Сумма · Amount</small></th>
            <td>
                <?php if ($patent["is_free"]): ?>
                    0 — босатылған / освобождено / waived
                <?php else: ?>
                    <?= e(number_format((float)$patent["fee"], 2) . " " . $patent["currency"]) ?>
                    — <?= $is_paid ? "төленді / оплачено / paid" : "төленбеген / не оплачено / not paid" ?>
                <?php endif; ?>
            </td>
        </tr>
    </table>

    <div class="signature">
        <div>Өтініш берушінің қолы · Подпись заявителя · Applicant's signature</div>
        <div>Күні · Дата · Date</div>
    </div>

    <p class="footer">
        <?= e($site_name) ?> · <?= e($patent["number"]) ?> · generated <?= e(date("d.m.Y H:i")) ?>
    </p>

</div>

</body>
</html>
