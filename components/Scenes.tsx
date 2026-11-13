// A 晴空出發的插畫場景。每個場景畫在 390×330 的畫布上：
// 總覽頁用整張（hero），旅程卡片封面取中下段（cover）。
import type { ReactNode } from 'react';

const Sky = () => <rect width="390" height="330" fill="#CDEAF7" />;

const Sun = ({ cx, cy, r = 42 }: { cx: number; cy: number; r?: number }) => (
  <>
    <circle cx={cx} cy={cy} r={r * 2.2} fill="#FBE7A8" opacity="0.35" />
    <circle cx={cx} cy={cy} r={r * 1.57} fill="#FBE7A8" opacity="0.6" />
    <circle cx={cx} cy={cy} r={r} fill="#F2B33D" />
  </>
);

const Cloud = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g fill="#FFFFFF" transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="0" rx="34" ry="12" />
    <ellipse cx="22" cy="-10" rx="22" ry="12" />
    <ellipse cx="-18" cy="-8" rx="16" ry="9" />
  </g>
);

const Plane = () => (
  <>
    <path d="M214 74 Q270 40 330 56" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
    <path d="M330 56 l18 -5 l-8 9 l4 9 l-9 -5 l-9 5 z" fill="#FFFFFF" />
  </>
);

function Town() {
  return (
    <>
      <Sky />
      <Sun cx={118} cy={205} />
      <Cloud x={300} y={118} />
      <Cloud x={206} y={160} s={0.65} />
      <Plane />
      <path d="M0 252 L60 192 L120 236 L190 172 L260 242 L330 202 L390 246 L390 330 L0 330 Z" fill="#9CCDB8" />
      <g fill="#1F4E5F">
        <rect x="304.5" y="148" width="3" height="24" />
        <polygon points="284,180 328,180 318,170 294,170" />
        <rect x="296" y="180" width="20" height="10" />
        <polygon points="279,200 333,200 322,190 290,190" />
        <rect x="293" y="200" width="26" height="10" />
        <polygon points="274,220 338,220 326,210 286,210" />
        <rect x="290" y="220" width="32" height="10" />
        <polygon points="269,240 343,240 330,230 282,230" />
        <rect x="287" y="240" width="38" height="10" />
        <polygon points="264,260 348,260 334,250 278,250" />
        <rect x="284" y="260" width="44" height="30" />
      </g>
      <path d="M0 292 Q100 242 200 286 T390 272 L390 330 L0 330 Z" fill="#4F8A3C" />
      <g fill="#F3B9C2">
        <circle cx="226" cy="268" r="13" />
        <circle cx="242" cy="262" r="11" />
        <circle cx="364" cy="262" r="12" />
        <circle cx="56" cy="266" r="12" />
        <circle cx="40" cy="272" r="10" />
      </g>
      <g stroke="#1F4E5F" strokeWidth="3" strokeLinecap="round">
        <path d="M233 276 v14" />
        <path d="M364 270 v12" />
        <path d="M49 276 v14" />
      </g>
      <path d="M0 316 Q120 286 240 318 T390 306 L390 330 L0 330 Z" fill="#3F7A30" />
    </>
  );
}

function Coast() {
  return (
    <>
      <Sky />
      <Sun cx={296} cy={196} />
      <Cloud x={150} y={110} />
      <Cloud x={330} y={96} s={0.6} />
      <Plane />
      <rect y="244" width="390" height="86" fill="#2F7F9E" />
      <g fill="none" stroke="#CDEAF7" strokeWidth="2.5" strokeLinecap="round">
        <path d="M232 264 q9 -7 18 0 t18 0" />
        <path d="M300 286 q9 -7 18 0 t18 0" />
        <path d="M250 308 q9 -7 18 0 t18 0" />
        <path d="M348 258 q9 -7 18 0" />
      </g>
      <path d="M0 330 L0 190 L46 150 L96 204 L138 172 L196 244 L236 300 L262 330 Z" fill="#9CCDB8" />
      <path d="M0 330 L0 232 L52 198 L104 250 L146 236 L204 330 Z" fill="#4F8A3C" />
      <path d="M0 330 L0 282 Q70 262 168 330 Z" fill="#3F7A30" />
    </>
  );
}

function Beach() {
  return (
    <>
      <Sky />
      <Sun cx={122} cy={214} />
      <Cloud x={250} y={112} />
      <Cloud x={84} y={96} s={0.6} />
      <Plane />
      <rect y="236" width="390" height="94" fill="#8CC0D6" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round">
        <path d="M30 256 q9 -7 18 0 t18 0" />
        <path d="M170 250 q9 -7 18 0 t18 0" />
        <path d="M96 276 q9 -7 18 0 t18 0" />
      </g>
      <path d="M262 330 L262 262 Q320 226 390 232 L390 330 Z" fill="#4F8A3C" />
      <g>
        <rect x="312" y="176" width="18" height="70" fill="#FFFFFF" />
        <rect x="308" y="168" width="26" height="10" fill="#1F4E5F" />
        <polygon points="310,168 321,154 332,168" fill="#1F4E5F" />
        <rect x="317" y="196" width="8" height="11" fill="#1F4E5F" />
        <rect x="317" y="222" width="8" height="11" fill="#1F4E5F" />
      </g>
      <path d="M0 330 L0 300 Q130 268 250 302 T390 288 L390 330 Z" fill="#FBE7A8" />
    </>
  );
}

function City() {
  return (
    <>
      <Sky />
      <Sun cx={110} cy={200} />
      <Cloud x={296} y={110} />
      <Cloud x={196} y={150} s={0.6} />
      <Plane />
      <g fill="#9CCDB8">
        <rect x="14" y="214" width="34" height="90" />
        <rect x="56" y="196" width="28" height="110" />
        <rect x="150" y="204" width="36" height="100" />
        <rect x="336" y="208" width="40" height="96" />
      </g>
      <g fill="#1F4E5F">
        <rect x="92" y="184" width="44" height="120" />
        <rect x="196" y="160" width="38" height="144" />
        <rect x="242" y="206" width="30" height="98" />
        <rect x="296" y="146" width="6" height="64" />
        <polygon points="284,214 314,214 306,196 292,196" />
        <rect x="290" y="214" width="18" height="90" />
      </g>
      <g fill="#F2B33D">
        <rect x="100" y="196" width="8" height="8" />
        <rect x="120" y="196" width="8" height="8" />
        <rect x="100" y="216" width="8" height="8" />
        <rect x="120" y="236" width="8" height="8" />
        <rect x="204" y="172" width="8" height="8" />
        <rect x="218" y="192" width="8" height="8" />
        <rect x="204" y="212" width="8" height="8" />
        <rect x="218" y="232" width="8" height="8" />
        <rect x="250" y="218" width="7" height="7" />
        <rect x="250" y="240" width="7" height="7" />
      </g>
      <path d="M0 300 Q100 276 200 298 T390 290 L390 330 L0 330 Z" fill="#4F8A3C" />
      <path d="M0 320 Q120 300 240 322 T390 312 L390 330 L0 330 Z" fill="#3F7A30" />
    </>
  );
}

const SCENES: Record<string, () => ReactNode> = { town: Town, coast: Coast, beach: Beach, city: City };

export function Scene({ kind, crop = 'hero' }: { kind: string; crop?: 'hero' | 'cover' | 'tall' }) {
  const Art = SCENES[kind] ?? Town;
  // tall：畫面比插畫高很多時（登入頁），整張貼齊底部，上方留給天空
  const fit = crop === 'cover' ? 'xMidYMid slice' : crop === 'tall' ? 'xMidYMax meet' : 'xMidYMax slice';
  return (
    <svg
      aria-hidden="true"
      viewBox={crop === 'cover' ? '0 176 390 107' : '0 0 390 330'}
      preserveAspectRatio={fit}
    >
      <Art />
    </svg>
  );
}

/** 內頁頂部的小片天空 */
export function SkyBand() {
  return (
    <svg aria-hidden="true" viewBox="0 0 390 124" preserveAspectRatio="xMaxYMax slice">
      <rect width="390" height="124" fill="#CDEAF7" />
      <circle cx="330" cy="50" r="58" fill="#FBE7A8" opacity="0.4" />
      <circle cx="330" cy="50" r="40" fill="#FBE7A8" opacity="0.7" />
      <circle cx="330" cy="50" r="25" fill="#F2B33D" />
      <g fill="#FFFFFF">
        <ellipse cx="238" cy="88" rx="30" ry="10" />
        <ellipse cx="256" cy="80" rx="18" ry="10" />
      </g>
      <path d="M0 124 L0 112 Q100 96 200 114 T390 106 L390 124 Z" fill="#4F8A3C" />
    </svg>
  );
}
