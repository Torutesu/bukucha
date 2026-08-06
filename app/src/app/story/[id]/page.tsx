"use client";

import { use } from "react";
import { StoryReader } from "@/components/StoryReader";

export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  if (id === "guest") return <StoryReader mode="guest" />;
  return <StoryReader mode="auth" storyId={id} />;
}
