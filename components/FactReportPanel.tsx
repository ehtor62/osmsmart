"use client";

import type { OsmElement } from "../types/osm";

interface FactReportPanelProps {
  open: boolean;
  content: string;
  loading: boolean;
  onClose: () => void;
}

export default function FactReportPanel({ open, content, loading, onClose }: FactReportPanelProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 400,
        maxWidth: '90vw',
        height: '100vh',
        background: '#fff',
        boxShadow: '2px 0 16px rgba(0,0,0,0.12)',
        zIndex: 8000,
        transition: 'left 0.3s cubic-bezier(.4,0,.2,1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ 
        padding: '18px 20px 10px 20px', 
        borderBottom: '1px solid #e5e7eb', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#2563eb' }}>
          Gemini Fact Report
        </span>
        <button
          style={{ 
            background: '#2563eb', 
            color: '#fff', 
            border: 'none', 
            borderRadius: 6, 
            padding: '6px 16px', 
            fontWeight: 600, 
            cursor: 'pointer' 
          }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: 20, 
        fontSize: '0.98rem', 
        color: '#222' 
      }}>
        {loading ? (
          <div style={{ 
            color: '#2563eb', 
            fontWeight: 600, 
            fontSize: '1.05rem', 
            marginTop: 40 
          }}>
            Loading Gemini report…
          </div>
        ) : (
          <div style={{ whiteSpace: 'pre-line' }}>{content}</div>
        )}
      </div>
    </div>
  );
}

// Export the logic hook for handling fact reports
export const useFactReportLogic = () => {
  const handleFactReport = async (
    label: string, 
    osmData: OsmElement[] | null,
    setContent: (content: string) => void,
    setLoading: (loading: boolean) => void,
    setOpen: (open: boolean) => void
  ) => {
    const prompt = `Act as a knowledgeable local expert and provide a comprehensive, authoritative report about: ${label}

Draw upon your full knowledge base to write with confidence and specificity. Include concrete details such as:

ESSENTIAL INFORMATION:
- What this place is and why it matters locally
- Specific historical facts, dates, and stories
- Architectural or natural features worth noting
- Current use and significance in the community

VISITOR GUIDANCE:
- Exact practical details (opening times, access methods, costs)
- What visitors can expect to see and experience
- Specific walking/hiking times and route descriptions
- Best times to visit and what to bring

EXPERT INSIGHTS:
- Interesting historical context and background stories
- Local connections and cultural significance
- Insider tips that only locals would know
- How this place fits into the broader area's character

Write with the authority and enthusiasm of someone who knows this place well. Use specific details, exact timings, and confident statements rather than vague or cautious language. Structure your response as flowing, informative paragraphs that tell the complete story of this place.

FORMATTING: Write in clear paragraphs only - no bullet points, tables, or markdown formatting.`;
    console.debug('[Gemini Fact Report] Prompt sent to Gemini:', prompt);
    
    // Try to find the OSM element that matches the label (by name and description)
    let element = null;
    if (osmData && Array.isArray(osmData)) {
      // Try to extract the name and description from the label
      // label format: Name: Description | Best for: ... | Tip: ...
      const nameMatch = label.match(/^([^:]+):/);
      const descMatch = label.match(/^([^:]+):\s*([^|]+)/);
      const name = nameMatch ? nameMatch[1].trim() : null;
      const description = descMatch ? descMatch[2].trim() : null;
      
      element = osmData.find(el => {
        const elName = el.tags?.name?.trim();
        const elDesc = el.tags?.description?.trim();
        // Try to match name and description if available
        if (name && elName && name === elName) {
          if (!description) return true;
          if (elDesc && elDesc.startsWith(description)) return true;
        }
        // Fallback: match just name
        if (name && elName && name === elName) return true;
        return false;
      });
    }
    
    setOpen(true);
    setLoading(true);
    setContent("");
    
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relevantData: element ? [element] : [],
          prompt,
        }),
      });
      const result = await response.json();
      let content = result.answer || "No summary available.";
      
      // Remove any markdown tables that might have slipped through
      // Remove table headers and separators
      content = content.replace(/\|\s*[^|\n]*\s*\|[\s\S]*?\n\|[-\s|]*\|[\s\S]*?(?=\n\n|$)/g, '');
      // Remove any remaining table-like structures
      content = content.replace(/\|[^|\n]*\|/g, '');
      // Remove multiple consecutive newlines
      content = content.replace(/\n{3,}/g, '\n\n');
      // Trim whitespace
      content = content.trim();
      
      setContent(content);
    } catch {
      setContent("Error retrieving summary.");
    }
    setLoading(false);
  };

  return { handleFactReport };
};
