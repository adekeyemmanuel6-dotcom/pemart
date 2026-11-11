// Generates placeholder typographic artwork (cream ink, bold condensed type)
// plus supabase/seed/30_designs.sql. The owner replaces these with final art.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

// Text is converted to outlines so the art renders identically everywhere
// (SVGs loaded through <img> cannot use web fonts) and is print-ready.
const load = (f) => { const b = readFileSync(f); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const anton = load('scripts/fonts/Anton-Regular.ttf');
const inter = load('scripts/fonts/Inter-SemiBold.ttf');

/** Lay out a string glyph by glyph (no GSUB shaping needed for caps and digits). */
function layout(font, text, size, track) {
  const scale = size / font.unitsPerEm;
  let x = 0;
  const glyphs = [];
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    glyphs.push({ g, x });
    x += g.advanceWidth * scale + track * size;
  }
  return { glyphs, width: x - track * size, scale };
}
const widthAt = (font, text, size, track) => layout(font, text, size, track).width;

/** A centred line of text as a single outlined <path>, fitted to maxWidth. */
function line(font, text, cx, baseline, size, fill, { track = 0.01, maxWidth = Infinity } = {}) {
  let sz = size;
  const w = widthAt(font, text, sz, track);
  if (w > maxWidth) sz = sz * (maxWidth / w);
  const { glyphs, width } = layout(font, text, sz, track);
  const x0 = cx - width / 2;
  const d = glyphs.map(({ g, x }) => g.getPath(x0 + x, baseline, sz).toPathData(1)).join('');
  return `<path d="${d}" fill="${fill}"/>`;
}

const CREAM = '#F6F1E8';
const INK = '#141414';

// slug, name, collection, lines (big type), reference, verse/story (KJV for scripture)
const designs = [
  // Kingdom (8)
  ['seek-first', 'Seek First', 'kingdom', ['SEEK', 'FIRST'], 'Matthew 6:33', 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.'],
  ['all-things', 'All Things', 'kingdom', ['ALL', 'THINGS'], 'Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
  ['i-shall-not-want', 'I Shall Not Want', 'kingdom', ['I SHALL', 'NOT WANT'], 'Psalm 23:1', 'The LORD is my shepherd; I shall not want.'],
  ['be-still', 'Be Still', 'kingdom', ['BE', 'STILL'], 'Psalm 46:10', 'Be still, and know that I am God.'],
  ['substance-of-faith', 'Substance of Faith', 'kingdom', ['FAITH IS', 'THE', 'SUBSTANCE'], 'Hebrews 11:1', 'Now faith is the substance of things hoped for, the evidence of things not seen.'],
  ['nothing-impossible', 'Nothing Impossible', 'kingdom', ['NOTHING', 'IMPOSSIBLE'], 'Luke 1:37', 'For with God nothing shall be impossible.'],
  ['let-your-light', 'Let Your Light', 'kingdom', ['LET YOUR', 'LIGHT', 'SHINE'], 'Matthew 5:16', 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.'],
  ['trust-in-the-lord', 'Trust in the Lord', 'kingdom', ['TRUST', 'IN THE', 'LORD'], 'Proverbs 3:5', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.'],
  // Word (4)
  ['the-word', 'The Word', 'word', ['IN THE', 'BEGINNING', 'WAS THE', 'WORD'], 'John 1:1', 'In the beginning was the Word, and the Word was with God, and the Word was God.'],
  ['lamp-unto-my-feet', 'Lamp Unto My Feet', 'word', ['THY WORD', 'IS A LAMP'], 'Psalm 119:105', 'Thy word is a lamp unto my feet, and a light unto my path.'],
  ['let-there-be-light', 'Let There Be Light', 'word', ['LET THERE', 'BE LIGHT'], 'Genesis 1:3', 'And God said, Let there be light: and there was light.'],
  ['it-is-written', 'It Is Written', 'word', ['IT IS', 'WRITTEN'], 'Matthew 4:4', 'It is written, Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.'],
  // Naija Mood (3)
  ['god-dey', 'God Dey', 'naija-mood', ['GOD', 'DEY'], '', 'Naija mood, every day. He is present, He is faithful, and we are not shaken.'],
  ['grace-dey-load', 'Grace Dey Load', 'naija-mood', ['GRACE', 'DEY', 'LOAD'], '', 'When it looks like the data is finished, grace is still loading.'],
  ['no-shaking', 'No Shaking', 'naija-mood', ['NO', 'SHAKING'], '', 'Calm. Covered. Not moved by the noise.'],
  // Two of Us (3 matching designs, worn as a pair)
  ['two-are-better', 'Two Are Better', 'two-of-us', ['TWO ARE', 'BETTER', 'THAN ONE'], 'Ecclesiastes 4:9', 'Two are better than one; because they have a good reward for their labour.'],
  ['my-beloved', "I Am My Beloved's", 'two-of-us', ['I AM MY', "BELOVED'S"], 'Song of Solomon 6:3', 'I am my beloved\'s, and my beloved is mine.'],
  ['better-together', 'Better Together', 'two-of-us', ['BETTER', 'TOGETHER'], '', 'His and hers. Same heart, matching fit.'],
  // Christmas Drop (2)
  ['unto-us', 'Unto Us', 'christmas-drop', ['UNTO US', 'A CHILD', 'IS BORN'], 'Isaiah 9:6', 'For unto us a child is born, unto us a son is given.'],
  ['glory-highest', 'Glory in the Highest', 'christmas-drop', ['GLORY TO', 'GOD IN THE', 'HIGHEST'], 'Luke 2:14', 'Glory to God in the highest, and on earth peace, good will toward men.'],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
const sq = (s) => s.replace(/'/g, "''");

function bigType(lines, w, h, fill) {
  const maxSize = 250;
  const capRatio = anton.tables.os2.sCapHeight / anton.unitsPerEm;
  const sizes = lines.map((l) => {
    const natural = widthAt(anton, l, 100, 0.01) / 100; // width per 1px font-size
    return Math.min(maxSize, (w * 0.86) / natural);
  });
  const gap = 0.16; // space between lines, as a share of cap height
  const heights = sizes.map((z) => z * capRatio);
  const total = heights.reduce((a, b) => a + b, 0) + gap * heights.reduce((a, b) => a + b, 0) / heights.length * (lines.length - 1);
  let y = (h - total) / 2;
  return lines.map((l, i) => {
    y += heights[i];
    const out = line(anton, l, w / 2, Math.round(y), sizes[i], fill);
    y += (gap * heights[i]);
    return out;
  }).join('\n  ');
}

mkdirSync('public/designs', { recursive: true });
mkdirSync('supabase/seed', { recursive: true });

const collectionNames = { kingdom: 'Kingdom', word: 'Word', 'naija-mood': 'Naija Mood', 'two-of-us': 'Two of Us', 'christmas-drop': 'Christmas Drop' };
let sql = `-- GENERATED by scripts/generate-art.mjs. Do not edit by hand.\n-- KJV wording for full verses. Artwork is placeholder; replace in admin.\n`;
sql += `insert into public.designs (slug, name, story_or_verse, verse_reference, collection_id, artwork_front, artwork_back, preview_image, allowed_product_types, is_customisable, customisable_fields) values\n`;
const rows = [];

for (const [slug, name, coll, lines, ref, verse] of designs) {
  // Back artwork: the main big print (transparent, cream ink).
  writeFileSync(`public/designs/${slug}-back.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1200" role="img" aria-label="${esc(name)} back print">\n  ${bigType(lines, 1000, ref ? 1020 : 1100, CREAM)}\n  ${ref ? line(inter, ref.toUpperCase(), 500, 1120, 44, CREAM, { track: 0.18, maxWidth: 860 }) : ''}\n</svg>\n`);
  // Front artwork: small left-chest mark.
  writeFileSync(`public/designs/${slug}-front.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" role="img" aria-label="${esc(name)} front chest print">\n  ${line(anton, name.toUpperCase(), 200, 105, 86, CREAM, { maxWidth: 360 })}
  ${line(inter, 'PEMART', 200, 160, 26, CREAM, { track: 0.3 })}\n</svg>\n`);
  // Display card on ink background.
  writeFileSync(`public/designs/${slug}-card.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1250" role="img" aria-label="${esc(name)}">\n  <rect width="1000" height="1250" fill="${INK}"/>\n  <g transform="translate(0 30)">${bigType(lines, 1000, ref ? 1050 : 1120, CREAM)}</g>\n  ${ref ? line(inter, ref.toUpperCase(), 500, 1180, 40, '#E4D8C4', { track: 0.18, maxWidth: 860 }) : ''}\n</svg>\n`);

  const customisable = ['kingdom', 'word', 'two-of-us'].includes(coll);
  const fields = coll === 'two-of-us' ? '["name","date"]' : coll === 'naija-mood' ? '[]' : '["name","verse"]';
  rows.push(`  ('${slug}', '${sq(name)}', '${sq(verse)}', ${ref ? `'${sq(ref)}'` : 'null'}, (select id from public.collections where slug='${coll}'), '/designs/${slug}-front.svg', '/designs/${slug}-back.svg', '/designs/${slug}-card.svg', '{tee,hoodie,frame}', ${customisable}, '${fields}'::jsonb)`);
}
sql += rows.join(',\n') + ';\n';
writeFileSync('supabase/seed/30_designs.sql', sql);
console.log(`Wrote ${designs.length} designs (3 SVGs each) and supabase/seed/30_designs.sql`);
