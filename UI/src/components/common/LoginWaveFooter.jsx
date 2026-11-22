import { Headset } from 'lucide-react';

const HELPLINE_NUMBER = '7899005555';
const HELPLINE_DISPLAY = '+91 78990 05555';

const WAVES = [
  ['fill-blue-100/70', 'M0,70 C220,20 420,20 660,70 S1160,110 1440,40 V320 H0Z'],
  ['fill-sky-100', 'M0,120 C260,60 520,150 780,120 S1240,70 1440,100 V320 H0Z'],
  ['fill-blue-200/80', 'M0,160 C240,120 480,200 760,170 S1240,130 1440,160 V320 H0Z'],
];

/** Wave background + "Powered by EduDisk" / helpline footer shared by the login pages. */
export function LoginWaveFooter() {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] min-h-56 w-full"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {WAVES.map(([fill, d]) => <path key={fill} className={fill} d={d} />)}
      </svg>

      <footer className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-7xl items-end justify-between px-4 pb-4 sm:px-10 sm:pb-6">
        <div>
          <span className="text-[11px] text-gray-600 sm:text-sm">Powered by</span>
          {/* multiply blend drops the logo's white background on the wave */}
          <img src="/images/edudisk-logo.png" alt="EduDisk" className="h-9 mix-blend-multiply sm:h-12" />
        </div>

        <a href={`tel:+91${HELPLINE_NUMBER}`} className="flex items-center gap-2 text-gray-900 sm:gap-3">
          <Headset className="h-6 w-6 text-blue-600 sm:h-8 sm:w-8" aria-hidden="true" />
          <span className="leading-tight">
            <span className="block text-[11px] text-gray-600 sm:text-sm">Need Help?</span>
            <span className="text-sm font-semibold whitespace-nowrap sm:text-lg">{HELPLINE_DISPLAY}</span>
          </span>
        </a>
      </footer>
    </>
  );
}
