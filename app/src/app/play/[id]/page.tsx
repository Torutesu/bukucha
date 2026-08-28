"use client";

import { use } from "react";
import { Reader } from "@/components/Reader";

export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  if (id === "guest") return <Reader mode="guest" />;
  return <Reader mode="auth" routeId={id} />;
}
