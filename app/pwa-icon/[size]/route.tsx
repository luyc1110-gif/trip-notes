import { ImageResponse } from 'next/og';

// 主畫面圖示：晴空、太陽與兩層山丘。名稱定案前先用這個，之後可換成正式圖示。
export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const s = [180, 192, 512].includes(Number(size)) ? Number(size) : 192;
  const circle = (left: number, top: number, d: number, background: string) => ({
    position: 'absolute' as const,
    left: s * left,
    top: s * top,
    width: s * d,
    height: s * d,
    borderRadius: '50%',
    background,
    display: 'flex',
  });
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#CDEAF7', overflow: 'hidden' }}>
        <div style={circle(0.19, 0.2, 0.62, '#FBE7A8')} />
        <div style={circle(0.31, 0.32, 0.38, '#F2B33D')} />
        <div style={circle(-0.42, 0.62, 1.15, '#4F8A3C')} />
        <div style={circle(0.22, 0.74, 1.2, '#3F7A30')} />
      </div>
    ),
    { width: s, height: s },
  );
}
