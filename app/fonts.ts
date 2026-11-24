import localFont from 'next/font/local';

// Optional site fonts (see lib/fonts.ts). preload is off: the browser only downloads a font that a page actually uses.
// (next/font needs the options written out in each call, so they are repeated.)
const bebas = localFont({ src: '../assets/fonts/choices/BebasNeue-Regular.woff2', weight: '400', variable: '--font-bebas', display: 'swap', preload: false });
const oswald = localFont({ src: '../assets/fonts/choices/oswald.woff2', weight: '200 700', variable: '--font-oswald', display: 'swap', preload: false });
const montserrat = localFont({ src: '../assets/fonts/choices/montserrat.woff2', weight: '100 900', variable: '--font-montserrat', display: 'swap', preload: false });
const playfair = localFont({ src: '../assets/fonts/choices/playfair-display.woff2', weight: '400 900', variable: '--font-playfair', display: 'swap', preload: false });
const lora = localFont({ src: '../assets/fonts/choices/lora.woff2', weight: '400 700', variable: '--font-lora', display: 'swap', preload: false });
const inter = localFont({ src: '../assets/fonts/choices/inter.woff2', weight: '100 900', variable: '--font-inter-choice', display: 'swap', preload: false });
const dmsans = localFont({ src: '../assets/fonts/choices/dm-sans.woff2', weight: '100 1000', variable: '--font-dmsans', display: 'swap', preload: false });
const poppins = localFont({
  src: [
    { path: '../assets/fonts/choices/Poppins-400.woff2', weight: '400' }, { path: '../assets/fonts/choices/Poppins-500.woff2', weight: '500' },
    { path: '../assets/fonts/choices/Poppins-600.woff2', weight: '600' }, { path: '../assets/fonts/choices/Poppins-700.woff2', weight: '700' },
  ],
  variable: '--font-poppins', display: 'swap', preload: false,
});

export const optionalFontClasses = [bebas, oswald, montserrat, playfair, lora, inter, dmsans, poppins].map((f) => f.variable).join(' ');
