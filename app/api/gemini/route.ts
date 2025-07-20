import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { relevantData, prompt } = await req.json();
  console.log("Gemini API payload:", { relevantData, prompt });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("Missing Gemini API key");
    return new Response(JSON.stringify({ error: "Missing Gemini API key" }), { status: 500 });
  }
  try {
    const geminiPrompt = `${prompt} ${JSON.stringify(relevantData)}. Only for elements that are very relevant for a tourist, provide a markdown table with the following columns: name of the element, description, best for, insider tips, latitude (mandatory), longitude (mandatory). Latitude and longitude must always be listed for each element. Above the table, write a short summary for tourists. If no elements are relevant, say so and do not provide a table.`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-002:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: geminiPrompt }] }] })
      }
    );
    const data = await res.json();
    console.log("Gemini API response:", JSON.stringify(data, null, 2));
    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No answer.";
    return new Response(JSON.stringify({ answer, candidates: data.candidates }), { status: 200 });
  } catch {
    console.log("Gemini API error");
    return new Response(JSON.stringify({ error: "Gemini API error" }), { status: 500 });
  }
}

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing Gemini API key" }), { status: 500 });
  }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const data = await res.json();
    console.log("Gemini available models:", data);
    return new Response(JSON.stringify(data), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: "Gemini model list error" }), { status: 500 });
  }
}
