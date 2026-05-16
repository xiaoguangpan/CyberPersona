import { AlbumScreen } from "@/components/album/album-screen";

export default function AlbumPage({ params }: { params: { id: string } }) {
  return <AlbumScreen personaId={params.id} />;
}
