<?php
// Study Hub cover: each user sets their own picture at the top of the hub,
// like a phone wallpaper: an uploaded photo or one of the ready-made gradients.
// Loaded by study.php after study_lib.php.

if (!isset($conn)) {
    http_response_code(404);
    exit;
}

function ensure_cover_columns()
{
    global $conn;

    $columns = [
        "cover_file" => "VARCHAR(80) NULL",
        "cover_preset" => "VARCHAR(20) NULL",
        "cover_pos" => "VARCHAR(10) NOT NULL DEFAULT 'center'",
    ];

    foreach ($columns as $name => $definition) {
        $has = $conn->query("SHOW COLUMNS FROM study_settings LIKE '$name'");
        if ($has && $has->num_rows === 0) {
            $conn->query("ALTER TABLE study_settings ADD COLUMN $name $definition");
        }
    }
}

ensure_cover_columns();

// Ready-made covers ("wallpapers")
const COVER_PRESETS = [
    "sunset"   => ["Sunset", "Закат", "linear-gradient(135deg, #fbc2a4 0%, #f38181 50%, #a3547d 100%)"],
    "sage"     => ["Sage", "Шалфей", "linear-gradient(135deg, #d8e8c8 0%, #8fb996 50%, #4d7c6b 100%)"],
    "ocean"    => ["Ocean", "Океан", "linear-gradient(135deg, #a1e3f9 0%, #4a90c2 50%, #1d3e72 100%)"],
    "lavender" => ["Lavender", "Лаванда", "linear-gradient(135deg, #f3e7ff 0%, #c3a6e8 50%, #7b5ea7 100%)"],
    "peach"    => ["Peach", "Персик", "linear-gradient(135deg, #fff1e0 0%, #ffc99e 50%, #ff9a76 100%)"],
    "night"    => ["Night", "Ночь", "linear-gradient(135deg, #2b2d42 0%, #3d2c5e 50%, #0f1020 100%)"],
    "lime"     => ["Energy", "Энергия", "linear-gradient(135deg, #111827 0%, #1f2937 45%, #a3e635 100%)"],
    "rose"     => ["Rose", "Роза", "linear-gradient(135deg, #ffe4ec 0%, #f9a8c4 50%, #d9467a 100%)"],
];

const COVER_POSITIONS = ["top" => ["Top", "Верх"], "center" => ["Center", "Центр"], "bottom" => ["Bottom", "Низ"]];

// CSS background for the user's cover, or null when no cover is set
function cover_background(array $settings)
{
    if (!empty($settings["cover_file"])) {
        $pos = array_key_exists($settings["cover_pos"] ?? "", COVER_POSITIONS) ? $settings["cover_pos"] : "center";
        return "url('" . upload_url($settings["cover_file"]) . "') center " . $pos . " / cover no-repeat";
    }
    if (!empty($settings["cover_preset"]) && isset(COVER_PRESETS[$settings["cover_preset"]])) {
        return COVER_PRESETS[$settings["cover_preset"]][2];
    }
    return null;
}

function delete_cover_file($file)
{
    global $upload_dir;
    if ($file && preg_match('/^[0-9]{14}_[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$/', $file)) {
        @unlink(__DIR__ . "/" . $upload_dir . $file);
    }
}

// Saves an uploaded cover photo; returns the file name or null
function save_cover_upload()
{
    global $upload_dir;

    $name = save_upload("cover_file", ["jpg", "jpeg", "png", "webp", "gif"], 10);
    if ($name === null) {
        return null;
    }

    // Only real pictures
    $info = @getimagesize(__DIR__ . "/" . $upload_dir . $name);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
        delete_cover_file($name);
        return null;
    }

    return $name;
}
