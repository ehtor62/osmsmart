
"use client";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("../components/Map"), { ssr: false });

import { useState } from "react";
import GeminiResult from "../components/GeminiResult";

export default function Home() {
  // Replace with actual Gemini result fetching logic as needed
  const [geminiResult] = useState("");
  return (
    <>
      <GeminiResult result={geminiResult} loading={false} />
      <Map />
    </>
  );
}
