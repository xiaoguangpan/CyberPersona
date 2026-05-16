import { PersonaHistoryScreen } from "@/components/profile/persona-history-screen";

export default function PersonaHistoryPage({ params }: { params: { id: string } }) {
  return <PersonaHistoryScreen personaId={params.id} />;
}
