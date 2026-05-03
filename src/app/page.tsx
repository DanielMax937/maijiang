"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
const Table = dynamic(() => import("@/components/Table").then((mod) => mod.Table), { ssr: false });
import { Onboarding } from "@/components/Onboarding";
import { Region } from "@/lib/mahjong/types";

const regionNames: Record<Region, string> = {
  shengzhou: "嵊州麻将",
  hangzhou: "杭州麻将",
  chinese: "国标麻将",
};

export default function Home() {
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    if (region) {
      document.title = `Mahjong World - ${regionNames[region]}`;
    }
  }, [region]);

  if (!region) {
    return <Onboarding onSelectRegion={setRegion} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <Table region={region} />
    </main>
  );
}
