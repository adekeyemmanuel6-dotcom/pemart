// Neutral SVG placeholders for product types until real photography is uploaded.
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('public/placeholders', { recursive: true });
const SAND = '#E4D8C4', INK = '#141414', LINE = '#C9BCA6', MOCHA = '#7A5A45';
const wrap = (label, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" role="img" aria-label="${label}">
  <rect width="800" height="1000" fill="${SAND}"/>
  ${body}
  <text x="400" y="940" font-family="Inter, Arial, sans-serif" font-size="26" letter-spacing="8" fill="${MOCHA}" text-anchor="middle">PEMART</text>
</svg>
`;
const shapes = {
  tee: `<path d="M270 190 L170 250 L120 380 L205 410 L235 350 L235 800 L565 800 L565 350 L595 410 L680 380 L630 250 L530 190 Q400 260 270 190Z" fill="#CFC0A6" stroke="${LINE}" stroke-width="4"/>`,
  hoodie: `<path d="M280 170 Q400 120 520 170 L640 230 L700 520 L620 540 L585 400 L585 820 L215 820 L215 400 L180 540 L100 520 L160 230Z" fill="#CFC0A6" stroke="${LINE}" stroke-width="4"/><path d="M300 175 Q400 330 500 175" fill="none" stroke="${LINE}" stroke-width="6"/>`,
  frame: `<rect x="190" y="200" width="420" height="560" fill="#F6F1E8" stroke="${INK}" stroke-width="22"/><rect x="250" y="270" width="300" height="420" fill="none" stroke="${LINE}" stroke-width="3"/>`,
  perfume: `<rect x="300" y="380" width="200" height="320" rx="14" fill="#F6F1E8" stroke="${INK}" stroke-width="6"/><rect x="360" y="290" width="80" height="90" fill="${INK}"/>`,
  bracelet: `<circle cx="400" cy="480" r="170" fill="none" stroke="${MOCHA}" stroke-width="34"/><circle cx="400" cy="310" r="22" fill="${INK}"/>`,
  necklace: `<path d="M230 260 Q400 760 570 260" fill="none" stroke="${MOCHA}" stroke-width="8"/><path d="M400 565 l-18 -18 h12 v-30 h12 v30 h12z" fill="${INK}"/><rect x="388" y="540" width="24" height="70" fill="${INK}"/><rect x="368" y="562" width="64" height="22" fill="${INK}"/>`,
  glasses: `<circle cx="280" cy="480" r="100" fill="none" stroke="${INK}" stroke-width="14"/><circle cx="520" cy="480" r="100" fill="none" stroke="${INK}" stroke-width="14"/><path d="M380 470 Q400 440 420 470" fill="none" stroke="${INK}" stroke-width="14"/>`,
  orb: `<circle cx="400" cy="480" r="170" fill="#D9572B" opacity="0.9"/><ellipse cx="400" cy="480" rx="170" ry="50" fill="none" stroke="#F6F1E8" stroke-width="8"/>`,
  'gift-card': `<rect x="150" y="340" width="500" height="300" rx="20" fill="${INK}"/><text x="400" y="510" font-family="Anton, Impact, sans-serif" font-size="80" fill="#F6F1E8" text-anchor="middle">GIFT CARD</text>`,
  'gift-box': `<rect x="200" y="400" width="400" height="320" fill="#CFC0A6" stroke="${LINE}" stroke-width="4"/><rect x="180" y="340" width="440" height="80" fill="${MOCHA}"/><rect x="370" y="340" width="60" height="380" fill="#D9572B"/>`,
  bundle: `<rect x="170" y="330" width="460" height="380" rx="10" fill="#CFC0A6" stroke="${LINE}" stroke-width="4"/><path d="M250 330 L400 230 L550 330" fill="none" stroke="${MOCHA}" stroke-width="10"/>`,
};
for (const [k, v] of Object.entries(shapes)) writeFileSync(`public/placeholders/${k}.svg`, wrap(k, v));
console.log('Wrote', Object.keys(shapes).length, 'placeholders');
