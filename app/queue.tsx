import { useRouter } from "expo-router";
import React from "react";

import { PlaybackQueueView } from "@/components/PlaybackQueueView";

export default function QueueScreen() {
  const router = useRouter();

  return <PlaybackQueueView onBack={() => router.back()} />;
}
