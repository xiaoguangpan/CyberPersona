"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthScreen } from "@/components/auth/auth-screen";
import { ChatScreen } from "@/components/chat/chat-screen";
import { fetchCurrentUser } from "@/lib/services";

export default function Home() {
  const queryClient = useQueryClient();
  const user = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser });

  if (user.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-sm text-text-muted">加载中</p>
      </main>
    );
  }

  if (!user.data) {
    return <AuthScreen onAuthed={() => queryClient.invalidateQueries({ queryKey: ["me"] })} />;
  }

  return <ChatScreen />;
}
