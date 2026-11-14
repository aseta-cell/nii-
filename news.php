<?php
// One news item (news.php?id=5) or the list of all news (news.php).

require_once "config.php";

$id = (int)($_GET["id"] ?? 0);

// YouTube watch / youtu.be / shorts links → embeddable player; other links as they are
function news_embed_url($url)
{
    if (preg_match('~(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([A-Za-z0-9_-]{6,})~', $url, $m)) {
        return "https://www.youtube.com/embed/" . $m[1];
    }
    return preg_match('~^https?://~i', $url) ? $url : "";
}

// Text with line breaks and clickable links, safely escaped
function news_text($text)
{
    $html = e($text);
    $html = preg_replace('~(https?://[^\s<]+)~i', '<a href="$1" target="_blank" rel="noopener">$1</a>', $html);
    return nl2br($html);
}

function news_date($row)
{
    $date = $row["published_at"] ?: $row["created_at"];
    return $date ? date("d.m.Y", strtotime($date)) : "";
}

$item = null;

if ($id > 0) {
    $stmt = $conn->prepare("SELECT * FROM editorial_content WHERE id = ? AND status = 'Published'");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $item = $stmt->get_result()->fetch_assoc();

    if (!$item) {
        http_response_code(404);
    }
}

// Other news: the full list, or "more news" under an article
$others = $conn->query("
    SELECT id, type, title, description, thumbnail_url, published_at, created_at
    FROM editorial_content
    WHERE status = 'Published'
    ORDER BY published_at DESC, id DESC
")->fetch_all(MYSQLI_ASSOC);

if ($item) {
    $others = array_values(array_filter($others, fn($o) => (int)$o["id"] !== (int)$item["id"]));
    $others = array_slice($others, 0, 3);
}

$page_title = $item ? $item["title"] : ($id > 0 ? "News not found" : "News");
$embed = $item && $item["type"] === "Video" && !empty($item["media_url"]) ? news_embed_url($item["media_url"]) : "";
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?= e($page_title) ?> · ARAI</title>
<?php if ($item): ?>
<meta name="description" content="<?= e(mb_substr((string)($item["description"] ?: $item["content"]), 0, 160)) ?>">
<meta property="og:title" content="<?= e($item["title"]) ?>">
<?php if (!empty($item["thumbnail_url"])): ?><meta property="og:image" content="<?= e($item["thumbnail_url"]) ?>"><?php endif; ?>
<?php endif; ?>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<style>
  :root{--navy:#0f2a5f;--blue:#1e3a8a;--sky:#2b7bb9;--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--bg:#f8fafc}
  *{box-sizing:border-box}
  body{margin:0;font:400 17px/1.75 Inter,system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--bg)}
  a{color:var(--blue)}
  img{max-width:100%;display:block}
  .wrap{max-width:860px;margin:0 auto;padding:0 20px}
  .wide{max-width:1160px}
  .top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
  .top .wrap{display:flex;align-items:center;justify-content:space-between;height:66px;max-width:1160px}
  .brand{text-decoration:none;line-height:1.1;color:var(--blue)}
  .brand b{display:block;font-size:22px}
  .brand small{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
  .top nav{display:flex;gap:18px;font-size:14px;font-weight:600}
  .top nav a{text-decoration:none;color:var(--muted)}
  .top nav a:hover{color:var(--blue)}
  .badge{display:inline-block;font:700 12px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--sky)}
  .date{color:var(--muted);font-size:14px;margin-left:10px}
  h1{font:700 clamp(30px,5vw,46px)/1.15 "Playfair Display",Georgia,serif;color:var(--navy);margin:12px 0 16px}
  .lead{font-size:20px;color:var(--muted);margin:0 0 26px}
  .hero{border-radius:18px;overflow:hidden;margin:0 0 30px;box-shadow:0 18px 40px rgba(15,42,95,.15);background:#e2e8f0}
  .hero img{width:100%;max-height:520px;object-fit:cover}
  .video{position:relative;padding-top:56.25%;border-radius:18px;overflow:hidden;margin:0 0 30px;background:#000}
  .video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
  .body{font-size:18px}
  .btn{display:inline-block;background:var(--blue);color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:12px;margin-top:24px}
  .back{display:inline-block;margin:28px 0 8px;font-weight:600;text-decoration:none}
  .more{margin:56px 0 64px}
  .more h2,.list h1{font:700 30px/1.2 "Playfair Display",Georgia,serif;color:var(--navy)}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
  @media (max-width:860px){.grid{grid-template-columns:1fr}.top nav{display:none}}
  .card{display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;transition:transform .2s,box-shadow .2s}
  .card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(15,42,95,.12)}
  .card .pic{height:180px;background:linear-gradient(135deg,var(--navy),var(--blue));overflow:hidden}
  .card .pic img{width:100%;height:100%;object-fit:cover}
  .card .txt{padding:16px 18px 20px}
  .card h3{font-size:18px;line-height:1.35;margin:8px 0 6px;color:var(--navy)}
  .card p{margin:0;font-size:15px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .empty{padding:60px 0;text-align:center;color:var(--muted)}
  footer{border-top:1px solid var(--line);padding:24px 0;text-align:center;font-size:13px;color:var(--muted)}
</style>
</head>
<body>

<header class="top">
  <div class="wrap">
    <a href="about.html" class="brand"><b>ARAI</b><small>Academic Research AI</small></a>
    <nav>
      <a href="about.html">About</a>
      <a href="news.php">News</a>
      <a href="journals.html">Journals</a>
      <a href="archive.php">Archive</a>
      <a href="mashstroy.html">MashStroy</a>
    </nav>
  </div>
</header>

<?php if ($item): ?>

<main class="wrap">
  <a class="back" href="news.php">← All news</a>
  <div>
    <span class="badge"><?= e($item["type"]) ?></span><span class="date"><?= e(news_date($item)) ?></span>
  </div>
  <h1><?= e($item["title"]) ?></h1>
  <?php if (!empty($item["description"])): ?>
    <p class="lead"><?= e($item["description"]) ?></p>
  <?php endif; ?>

  <?php if ($embed !== ""): ?>
    <div class="video"><iframe src="<?= e($embed) ?>" allowfullscreen loading="lazy" title="<?= e($item["title"]) ?>"></iframe></div>
  <?php elseif (!empty($item["thumbnail_url"])): ?>
    <figure class="hero"><img src="<?= e($item["thumbnail_url"]) ?>" alt="<?= e($item["title"]) ?>" onerror="this.closest('figure').remove()"></figure>
  <?php endif; ?>

  <?php if (!empty($item["content"])): ?>
    <div class="body"><?= news_text($item["content"]) ?></div>
  <?php endif; ?>

  <?php if (!empty($item["media_url"]) && $embed === "" && preg_match('~^https?://~i', $item["media_url"])): ?>
    <a class="btn" href="<?= e($item["media_url"]) ?>" target="_blank" rel="noopener">
      <?= $item["type"] === "Course" ? "Open course →" : "Read more →" ?>
    </a>
  <?php endif; ?>

  <?php if ($others): ?>
  <section class="more">
    <h2>More news</h2>
    <div class="grid">
      <?php foreach ($others as $o): ?>
        <a class="card" href="news.php?id=<?= (int)$o["id"] ?>">
          <div class="pic"><?php if (!empty($o["thumbnail_url"])): ?><img src="<?= e($o["thumbnail_url"]) ?>" alt="" loading="lazy" onerror="this.remove()"><?php endif; ?></div>
          <div class="txt"><span class="badge"><?= e($o["type"]) ?></span><h3><?= e($o["title"]) ?></h3><p><?= e($o["description"]) ?></p></div>
        </a>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>
</main>

<?php elseif ($id > 0): ?>

<main class="wrap empty">
  <h1>News not found</h1>
  <p>This news item does not exist or is not published.</p>
  <a class="btn" href="news.php">All news</a>
</main>

<?php else: ?>

<main class="wrap wide list">
  <h1 style="margin:40px 0 24px">News, Videos &amp; Courses</h1>
  <?php if (!$others): ?>
    <p class="empty">No news yet.</p>
  <?php endif; ?>
  <div class="grid" style="margin-bottom:64px">
    <?php foreach ($others as $o): ?>
      <a class="card" href="news.php?id=<?= (int)$o["id"] ?>">
        <div class="pic"><?php if (!empty($o["thumbnail_url"])): ?><img src="<?= e($o["thumbnail_url"]) ?>" alt="" loading="lazy" onerror="this.remove()"><?php endif; ?></div>
        <div class="txt"><span class="badge"><?= e($o["type"]) ?></span> <span class="date" style="margin:0"><?= e(news_date($o)) ?></span><h3><?= e($o["title"]) ?></h3><p><?= e($o["description"]) ?></p></div>
      </a>
    <?php endforeach; ?>
  </div>
</main>

<?php endif; ?>

<footer>© <?= date("Y") ?> ARAI — Academic Research AI · <a href="about.html">Home</a></footer>

</body>
</html>
