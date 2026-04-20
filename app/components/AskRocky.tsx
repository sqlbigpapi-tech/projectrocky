'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

// Speech synthesis helper
function speakText(text: string, onEnd?: () => void) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 0.95;
  // Prefer a natural-sounding voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Daniel')) // Mac male
    ?? voices.find(v => v.name.includes('Alex')) // Mac male alt
    ?? voices.find(v => v.name.includes('Fred')) // Mac male alt 2
    ?? voices.find(v => v.name.includes('Google UK English Male'))
    ?? voices.find(v => v.name === 'Aaron') // iOS male
    ?? voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('male'))
    ?? voices.find(v => v.lang === 'en-US' && v.localService);
  if (preferred) utterance.voice = preferred;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

const QUICK_PROMPTS = [
  'How am I doing financially?',
  'What debt should I attack first?',
  'How can I improve my savings rate?',
  'Am I on track for my net worth goal?',
  'Analyze my spending this month',
  'What\'s my business margin looking like?',
];

export default function AskRocky({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stop speaking when modal closes
  useEffect(() => {
    if (!open && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [open]);

  // Load voices (needed on some browsers)
  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, reply, loading]);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    const userQ = q.trim();
    setQuestion('');
    setLoading(true);
    setReply('');

    // Add placeholder entry for streaming
    const idx = history.length;
    setHistory(prev => [...prev, { q: userQ, a: '' }]);

    try {
      const res = await fetch('/api/ask-rocky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQ }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.text) {
                  fullText += parsed.text;
                  setHistory(prev => prev.map((h, i) => i === idx ? { ...h, a: fullText } : h));
                }
              } catch {}
            }
          }
        }
      }

      if (!fullText) {
        setHistory(prev => prev.map((h, i) => i === idx ? { ...h, a: 'Something went wrong.' } : h));
      } else if (voiceOn) {
        setSpeaking(true);
        speakText(fullText, () => setSpeaking(false));
      }
    } catch {
      setHistory(prev => prev.map((h, i) => i === idx ? { ...h, a: 'Failed to connect. Try again.' } : h));
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl mx-4 bg-[var(--card)] border border-zinc-800 rounded-2xl shadow-2xl shadow-amber-500/5 overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <span className="text-black font-bold text-xs font-mono">R</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Ask Rocky</h2>
              <p className="text-[10px] text-zinc-600 font-mono">Your personal financial advisor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); }
                setVoiceOn(v => !v);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono border transition-colors ${
                voiceOn
                  ? speaking ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 animate-pulse' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3L5 7H2v6h3l5 4V3z" />
                {voiceOn && <path d="M14 7a4 4 0 010 6M16.5 4.5a8 8 0 010 11" />}
              </svg>
              {speaking ? 'Speaking...' : voiceOn ? 'Voice On' : 'Voice'}
            </button>
            <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors text-lg">×</button>
          </div>
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {history.length === 0 && !loading && (
            <div>
              <p className="text-sm text-zinc-500 mb-3">Ask me anything about your finances. I have access to your net worth, cash flow, business data, and more.</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => ask(p)}
                    className="text-xs font-mono px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {history.map((h, i) => (
            <div key={i} className="space-y-3">
              {/* User question */}
              <div className="flex justify-end">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                  <p className="text-sm text-amber-400">{h.q}</p>
                </div>
              </div>
              {/* Rocky reply */}
              <div className="flex justify-start">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl rounded-bl-sm px-4 py-3 max-w-[90%]">
                  {h.a ? (
                    <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{h.a}</div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                      <span className="text-xs text-zinc-600 font-mono ml-1">Rocky is thinking...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ask(question); }}
              placeholder="Ask Rocky anything..."
              disabled={loading}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={() => ask(question)}
              disabled={loading || !question.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 disabled:opacity-30 transition-all shadow-lg shadow-amber-500/20"
            >
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
