"use client";

import { useState } from "react";
import { Table } from "@/components/Table";
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
