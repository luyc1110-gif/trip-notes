import TripApp from '@/components/TripApp';

// 這一頁只是外殼：旅程資料由瀏覽器向 /api 取得並存在手機裡，所以外殼可以被離線快取
export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return (
    <TripApp
      tripId={tripId}
      mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? ''}
    />
  );
}
