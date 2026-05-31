"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MessagesContainer from "./_components/MessagesContainer";

function MessagesPageContent() {
  const searchParams = useSearchParams();
  const matchId = searchParams.get("match") ?? undefined;
  return <MessagesContainer initialMatchId={matchId} />;
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesPageContent />
    </Suspense>
  );
}
