'use client';
import { useState, useRef, useEffect } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

export default function ClaudeTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + chunk,
          };
          return updated;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Error: ${msg}`,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-240px)] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-zinc-800">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-bold text-amber-400 uppercase tracking-widest font-mono">Claude AI</span>
        <span className="text-xs text-zinc-600 font-mono">claude-opus-4-6 · Ortiz Command Center</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="text-4xl font-bold text-zinc-800 select-none">⌘</div>
            <p className="text-zinc-500 text-sm font-mono">Ask me anything about your dashboard.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 w-full max-w-lg">
              {[
                "What's my current net worth?",
                "Which bills are due soon?",
                "How do I add a new bill?",
                "Explain how Plaid is connected",
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                  className="text-left text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 hover:border-amber-500/50 hover:text-amber-400 transition font-mono"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-400 text-xs font-bold">C</span>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-amber-500 text-black font-medium'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-100'
              }`}
            >
              {msg.content}
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                <span className="inline-block w-1.5 h-4 bg-amber-400 ml-1 animate-pulse align-middle" />
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-zinc-300 text-xs font-bold">D</span>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2 items-end">
        <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl focus-within:border-amber-500/50 transition">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances, dashboard, or anything else…"
            rows={1}
            disabled={streaming}
            className="w-full bg-transparent text-white text-sm px-4 py-3 resize-none focus:outline-none placeholder-zinc-600 disabled:opacity-50 max-h-32"
            style={{ minHeight: '48px' }}
          />
        </div>
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold px-4 py-3 rounded-xl transition text-sm h-12"
        >
          {streaming ? '…' : '↑'}
        </button>
      </div>
      <p className="text-xs text-zinc-700 mt-2 font-mono text-center">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
