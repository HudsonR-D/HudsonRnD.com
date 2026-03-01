'use client';

import { useState, useRef } from "react";

const MODELS = [
  {
    id: "claude",
    label: "Claude",
    vendor: "Anthropic",
    icon: "◆",
    color: "#e2a84b",
    hint: "Loves XML structure, reasoning chains, explicit constraints"
  },
  {
    id: "gpt",
    label: "ChatGPT / o1",
    vendor: "OpenAI",
    icon: "●",
    color: "#10b981",
    hint: "Strong role definition, markdown structure, step-by-step chain of thought"
  },
  {
    id: "grok",
    label: "Grok",
    vendor: "xAI",
    icon: "✦",
    color: "#8b5cf6",
    hint: "Direct, fewer guardrails, strong verbs, minimal fluff"
  },
  {
    id: "gemini",
    label: "Gemini",
    vendor: "Google",
    icon: "✿",
    color: "#3b82f6",
    hint: "Markdown-first, explicit multi-step reasoning, context-rich framing"
  }
];

export default function PromptWizard() {
  const [selectedModel, setSelectedModel] = useState("claude");
  const [rawPrompt, setRawPrompt] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const model = MODELS.find(m => m.id === selectedModel)!;

  const runWizard = async () => {
    if (!rawPrompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawPrompt, selectedModel })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.enhanced_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      color: "#e8e8e8",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      padding: "0"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: rgba(226,168,75,0.3); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        textarea:focus, button:focus { outline: none; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .model-card { transition: all 0.15s ease; cursor: pointer; }
        .model-card:hover { transform: translateY(-1px); }
        .enhance-btn { transition: all 0.12s ease; }
        .enhance-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .enhance-btn:active:not(:disabled) { transform: translateY(0); }
        .result-block { animation: slide-up 0.3s ease; }
        .tech-badge { font-size: 10px; letter-spacing: 0.05em; padding: 2px 8px; border-radius: 2px; font-family: 'DM Mono', monospace; }
        .copy-btn { transition: all 0.12s ease; }
        .copy-btn:hover { opacity: 0.8; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "22px", color: "#e2a84b" }}>⬡</span>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "15px", letterSpacing: "0.08em", color: "#fff" }}>
            PROMPT WIZARD
          </span>
          <span style={{ fontSize: "11px", color: "#444", letterSpacing: "0.1em" }}>v3.0</span>
        </div>
        <div style={{ fontSize: "11px", color: "#333", letterSpacing: "0.08em" }}>
          NO STORAGE · NO LOGS · DIES ON REFRESH
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "48px 32px" }}>

        {/* Hero */}
        <div style={{ marginBottom: "52px" }}>
          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#fff",
            marginBottom: "16px"
          }}>
            Your prompt<br />
            <span style={{ color: "#e2a84b" }}>deserves surgery,</span><br />
            not a template.
          </div>
          <p style={{ color: "#555", fontSize: "15px", maxWidth: "460px", lineHeight: 1.6, fontFamily: "'Syne', sans-serif", fontWeight: 400 }}>
            Paste any rough idea, shower thought, or half-baked request. Get back a precision-engineered prompt tuned for your model — using real best practices, not XML cargo cult.
          </p>
        </div>

        {/* Model Selector */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#444", marginBottom: "12px" }}>TARGET MODEL</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            {MODELS.map(m => (
              <div
                key={m.id}
                className="model-card"
                onClick={() => setSelectedModel(m.id)}
                style={{
                  padding: "14px",
                  border: selectedModel === m.id ? `1px solid ${m.color}` : "1px solid #1c1c1c",
                  borderRadius: "6px",
                  background: selectedModel === m.id ? `${m.color}08` : "#0e0e0e",
                }}
              >
                <div style={{ fontSize: "20px", color: selectedModel === m.id ? m.color : "#333", marginBottom: "6px", transition: "color 0.15s" }}>
                  {m.icon}
                </div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "13px", color: selectedModel === m.id ? "#fff" : "#555", marginBottom: "2px", transition: "color 0.15s" }}>
                  {m.label}
                </div>
                <div style={{ fontSize: "10px", color: "#333" }}>{m.vendor}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "10px", fontSize: "11px", color: "#383838", fontStyle: "italic" }}>
            ↳ {model.hint}
          </div>
        </div>

        {/* Input */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#444", marginBottom: "10px" }}>RAW PROMPT</div>
          <textarea
            value={rawPrompt}
            onChange={e => setRawPrompt(e.target.value)}
            placeholder="Dump it here. Half-baked ideas, 2am ramblings, vague shower thoughts. The messier the better — that's the point."
            rows={8}
            style={{
              width: "100%",
              background: "#0c0c0c",
              border: "1px solid #1c1c1c",
              borderRadius: "6px",
              padding: "20px",
              color: "#ccc",
              fontSize: "14px",
              lineHeight: 1.7,
              resize: "vertical",
              fontFamily: "'DM Mono', monospace",
            }}
            onFocus={e => e.target.style.borderColor = "#2a2a2a"}
            onBlur={e => e.target.style.borderColor = "#1c1c1c"}
          />
          <div style={{ textAlign: "right", fontSize: "10px", color: "#2d2d2d", marginTop: "6px" }}>
            {rawPrompt.length} chars
          </div>
        </div>

        {/* CTA */}
        <button
          className="enhance-btn"
          onClick={runWizard}
          disabled={loading || !rawPrompt.trim()}
          style={{
            width: "100%",
            padding: "18px",
            background: loading ? "#111" : rawPrompt.trim() ? "#e2a84b" : "#151515",
            color: loading ? "#333" : rawPrompt.trim() ? "#080808" : "#2d2d2d",
            border: "none",
            borderRadius: "6px",
            fontFamily: "'Syne', sans-serif",
            fontWeight: 700,
            fontSize: "15px",
            letterSpacing: "0.06em",
            cursor: loading || !rawPrompt.trim() ? "not-allowed" : "pointer",
            marginBottom: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px"
          }}
        >
          {loading ? (
            <>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: "16px" }}>⬡</span>
              ANALYZING & REBUILDING...
            </>
          ) : "ENHANCE THIS PROMPT →"}
        </button>

        {/* Error */}
        {error && (
          <div style={{
            padding: "16px 20px",
            background: "#1a0a0a",
            border: "1px solid #3a1515",
            borderRadius: "6px",
            color: "#cc5555",
            fontSize: "13px",
            marginBottom: "24px"
          }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="result-block" ref={outputRef}>

            {/* Diagnosis */}
            <div style={{
              padding: "16px 20px",
              background: "#0e0e0e",
              border: "1px solid #1c1c1c",
              borderLeft: `3px solid ${model.color}`,
              borderRadius: "4px",
              marginBottom: "24px",
            }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#444", marginBottom: "8px" }}>DIAGNOSIS</div>
              <div style={{ fontSize: "13px", color: "#888", lineHeight: 1.7, fontStyle: "italic" }}>
                "{result.diagnosis}"
              </div>
            </div>

            {/* Split view */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              <div>
                <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#333", marginBottom: "10px" }}>ORIGINAL (weak)</div>
                <div style={{
                  background: "#0c0c0c",
                  border: "1px solid #161616",
                  borderRadius: "6px",
                  padding: "20px",
                  fontSize: "12px",
                  color: "#3d3d3d",
                  lineHeight: 1.8,
                  whiteSpace: "pre-wrap",
                  minHeight: "200px",
                  maxHeight: "360px",
                  overflowY: "auto",
                  fontFamily: "'DM Mono', monospace"
                }}>
                  {rawPrompt}
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: model.color }}>
                    ENHANCED ({model.label})
                  </div>
                  <button
                    className="copy-btn"
                    onClick={copy}
                    style={{
                      fontSize: "10px",
                      letterSpacing: "0.1em",
                      color: copied ? "#4ade80" : "#555",
                      background: "transparent",
                      border: "1px solid #1c1c1c",
                      borderRadius: "3px",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontFamily: "'DM Mono', monospace"
                    }}
                  >
                    {copied ? "✓ COPIED" : "COPY"}
                  </button>
                </div>
                <div style={{
                  background: "#0c0c0c",
                  border: `1px solid ${model.color}22`,
                  borderRadius: "6px",
                  padding: "20px",
                  fontSize: "12px",
                  color: "#bbb",
                  lineHeight: 1.8,
                  whiteSpace: "pre-wrap",
                  minHeight: "200px",
                  maxHeight: "360px",
                  overflowY: "auto",
                  fontFamily: "'DM Mono', monospace"
                }}>
                  {result.enhanced_prompt}
                </div>
              </div>
            </div>

            {/* Improvements */}
            <div style={{ background: "#0e0e0e", border: "1px solid #1a1a1a", borderRadius: "6px", padding: "24px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.15em", color: "#444", marginBottom: "16px" }}>WHAT CHANGED & WHY</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {result.improvements?.map((imp: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <span style={{ color: model.color, fontSize: "12px", marginTop: "1px", flexShrink: 0 }}>→</span>
                    <span style={{ fontSize: "13px", color: "#666", lineHeight: 1.6 }}>{imp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Technique badges */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "10px", color: "#333", letterSpacing: "0.1em" }}>APPLIED:</span>
              {result.techniques_applied?.map((t: string, i: number) => (
                <span key={i} className="tech-badge" style={{ background: `${model.color}10`, border: `1px solid ${model.color}30`, color: model.color }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: "80px", paddingTop: "24px", borderTop: "1px solid #111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "11px", color: "#282828" }}>Best practices updated continuously</div>
          <div style={{ fontSize: "11px", color: "#282828" }}>No logs · No storage · Key never leaves server</div>
        </div>
      </div>
    </div>
  );
}