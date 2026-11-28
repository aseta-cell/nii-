// Иконки: имена SF Symbols из iOS-приложения → эмодзи (без внешних библиотек).
const RULES: [RegExp, string][] = [
  [/^apple\.logo/, ''], [/graduationcap/, '🎓'], [/person\.2|person\.3|figure\.2/, '👥'], [/figure\.roll/, '♿'],
  [/heart\.text|stethoscope|cross\.case/, '🩺'], [/heart/, '❤️'], [/brain/, '🧠'], [/sparkles|wand/, '✨'],
  [/lightbulb/, '💡'], [/hammer|wrench|screwdriver/, '🛠️'], [/gearshape|gear/, '⚙️'], [/cpu|desktopcomputer|laptop/, '💻'],
  [/globe|network/, '🌍'], [/building\.columns/, '🏛️'], [/building/, '🏢'], [/house/, '🏠'], [/handshake/, '🤝'],
  [/calendar/, '📅'], [/clock|timer|hourglass/, '⏰'], [/bell/, '🔔'], [/bubble|message|ellipsis\.message/, '💬'],
  [/envelope/, '✉️'], [/paperplane/, '📨'], [/video\.badge|video\.fill|video|camera|web\.camera/, '🎥'],
  [/play\.rectangle|play\.circle|play\.fill|film/, '▶️'], [/mic/, '🎤'], [/music/, '🎵'], [/photo/, '🖼️'],
  [/paintpalette|paintbrush/, '🎨'], [/book|text\.book|character\.book/, '📘'], [/books\.vertical/, '📚'],
  [/doc\.text|doc\.richtext|doc\.plaintext|text\.document/, '📄'], [/doc\.badge|doc\.on|doc/, '📄'], [/folder|tray|archivebox/, '🗂️'],
  [/list|checklist|text\.alignleft/, '📋'], [/square\.and\.pencil|pencil|highlighter|signature/, '✏️'],
  [/checkmark\.seal|rosette|medal|seal/, '🏅'], [/trophy|crown/, '🏆'], [/star/, '⭐'], [/flag/, '🚩'],
  [/checkmark/, '✅'], [/xmark/, '❌'], [/exclamationmark\.(triangle|shield)/, '⚠️'], [/exclamationmark/, '❗'],
  [/questionmark/, '❓'], [/info/, 'ℹ️'], [/shield|lock\.shield/, '🛡️'], [/lock\.open/, '🔓'], [/lock|key/, '🔒'],
  [/hand\.raised/, '✋'], [/eye/, '👁️'], [/magnifyingglass|scope/, '🔍'], [/chart\.line\.down/, '📉'],
  [/chart|waveform|gauge/, '📊'], [/arrow\.down\.right|arrow\.down/, '⬇️'], [/arrow\.up/, '⬆️'], [/arrow\.triangle|arrow\.clockwise|arrow\.2/, '🔄'],
  [/arrow/, '➡️'], [/dollarsign|banknote|creditcard|rublesign|tengesign|eurosign/, '💳'], [/cart|bag|basket/, '🛒'],
  [/tag/, '🏷️'], [/gift/, '🎁'], [/megaphone|speaker/, '📣'], [/map|location|mappin/, '📍'], [/leaf|tree/, '🌿'],
  [/atom/, '⚛️'], [/function|x\.squareroot|sum|plus\.forwardslash/, '➗'], [/testtube|flask/, '🧪'], [/puzzlepiece/, '🧩'],
  [/cube|shippingbox/, '📦'], [/ruler|compass/, '📐'], [/textformat|character|abc/, '🔤'], [/accessibility/, '♿'],
  [/icloud|cloud/, '☁️'], [/iphone|ipad/, '📱'], [/link/, '🔗'], [/paperclip/, '📎'], [/square\.grid|rectangle\.grid|circle\.grid/, '🧭'],
  [/square\.and\.arrow\.up/, '📤'], [/square\.and\.arrow\.down|arrow\.down\.circle/, '📥'], [/trash/, '🗑️'], [/plus/, '➕'],
  [/minus/, '➖'], [/person\.crop\.circle\.badge|person\.badge/, '🧑‍💼'], [/person/, '👤'], [/figure/, '🧒'],
  [/bolt/, '⚡'], [/flame/, '🔥'], [/sun/, '☀️'], [/moon/, '🌙'], [/drop/, '💧'], [/car|bus|tram/, '🚌'],
  [/point\.topleft|arrow\.triangle\.branch|map/, '🗺️'], [/tablecells|slider/, '🗓️'], [/briefcase/, '💼'], [/hand\.thumbsup|party/, '👍'],
  [/storefront/, '🏬'], [/rectangle\.on\.rectangle/, '🗂️'], [/^k\.circle/, '🟥'], [/^h\.circle/, '🟩'], [/cup/, '☕'], [/note/, '📝'],
  [/circle\.lefthalf/, '🌓'], [/^circle/, '⚪'],
  [/printer/, '🖨️'], [/qrcode|barcode/, '🔳'], [/target|scope/, '🎯'], [/rectangle\.stack|square\.stack|stack/, '🗃️'],
];

export function emojiFor(name?: string): string {
  if (!name) return '•';
  for (const [re, emoji] of RULES) if (re.test(name)) return emoji || '';
  return '•';
}

export function Icon({ name, size, label }: { name?: string; size?: number; label?: string }) {
  return (
    <span className="icon" style={size ? { fontSize: size } : undefined} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined}>
      {emojiFor(name)}
    </span>
  );
}
