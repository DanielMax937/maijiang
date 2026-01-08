"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
const Table = dynamic(() => import("@/components/Table").then((mod) => mod.Table), { ssr: false });
import { Onboarding } from "@/components/Onboarding";
import { Region } from "@/lib/mahjong/types";

export default function Home() {
  const [region, setRegion] = useState<Region | null>(null);

  if (!region) {
    return <Onboarding onSelectRegion={setRegion} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <Table region={region} />
    </main>
  );
}
