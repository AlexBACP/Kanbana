/**
 * ChatBubble — Asistente KanbanaAI flotante.
 *
 * Modos:
 *   collapsed → botón en esquina inferior derecha
 *   bubble    → panel flotante (380px × 540px, redimensionable)
 *   sidebar   → panel lateral derecho (420px × 100vh)
 *
 * Proveedores (toggle en el header):
 *   Gemini  → Google Gemini 2.5 Flash (requiere API key, gratis con free tier)
 *   Ollama  → LLM local (llama3.2 u otro configurado en OLLAMA_MODEL)
 *
 * Features:
 *   - Rate limit local: máx 15 mensajes/minuto para Gemini (sin límite en Ollama)
 *   - Historial: últimos 10 mensajes como contexto
 *   - 6 preguntas rápidas al abrir por primera vez
 *   - Indicador de "pensando" (tres puntos animados)
 *   - Markdown inline: **negrita**, *cursiva*, `código`
 *   - Resize del panel arrastrando el borde izquierdo
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Maximize2, Minimize2, Trash2, Cpu, Zap } from 'lucide-react';
import { useChatStore, ChatMessage, ChatProvider } from '../store/chat.store';
import { chatService, ChatTurn }                  from '../services/chat.service';
import { useAuthStore }                           from '../store/auth.store';
import { useRateLimit }                           from '../hooks/useRateLimit';

// ── Markdown inline ───────────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const segments = text.split(/(\*\*[\s\S]*?\*\*|\*[\s\S]*?\*|`[\s\S]*?`|\n)/);
  return segments.map((seg, i) => {
    if (seg === '\n') return <br key={i} />;
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4)
      return <strong key={i}>{seg.slice(2, -2)}</strong>;
    if (seg.startsWith('*') && seg.endsWith('*') && seg.length > 2)
      return <em key={i}>{seg.slice(1, -1)}</em>;
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2)
      return (
        <code key={i} className="px-1 py-0.5 bg-zinc-700/80 rounded text-[11px] font-mono text-amber-300">
          {seg.slice(1, -1)}
        </code>
      );
    return <span key={i}>{seg}</span>;
  });
}

// ── Preguntas rápidas ─────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  '¿Cuál es el estado de mi proyecto?',
  '¿Qué tareas tengo pendientes?',
  '¿Cuántos días quedan para el módulo activo?',
  '¿Quién está trabajando en qué?',
  '¿Cómo envío mi módulo a revisión?',
  'Explícame el flujo de trabajo de Kanbana',
];

// ── Config visual por proveedor ───────────────────────────────────────────────
const PROVIDER_CFG = {
  gemini: {
    label:      'Gemini',
    sublabel:   'Gemini 2.5 Flash',
    icon:       Zap,
    activeClass: 'bg-blue-600 text-white',
    dotClass:    'bg-blue-500',
    gradFrom:    'from-blue-600',
    gradTo:      'to-indigo-700',
  },
  ollama: {
    label:      'Ollama',
    sublabel:   'Llama · local',
    icon:       Cpu,
    activeClass: 'bg-violet-600 text-white',
    dotClass:    'bg-violet-500',
    gradFrom:    'from-violet-600',
    gradTo:      'to-fuchsia-700',
  },
} as const;

// ── Burbuja de mensaje ────────────────────────────────────────────────────────
const MessageBubble = ({ msg }: { msg: ChatMessage }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : msg.error
              ? 'bg-rose-900/40 border border-rose-500/30 text-rose-300 rounded-bl-sm'
              : 'bg-zinc-800/70 text-zinc-200 border border-zinc-700/40 rounded-bl-sm'
        }`}
        style={{ wordBreak: 'break-word' }}
      >
        {msg.pending ? (
          <span className="flex items-center gap-1 py-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        ) : (
          <span>{renderMarkdown(msg.content)}</span>
        )}
      </div>
    </div>
  );
};

// ── Toggle de proveedor ───────────────────────────────────────────────────────
const ProviderToggle = ({
  current, onChange,
}: { current: ChatProvider; onChange: (p: ChatProvider) => void }) => (
  <div className="flex items-center gap-0.5 bg-zinc-800 rounded-lg p-0.5 border border-zinc-700/60">
    {(['gemini', 'ollama'] as ChatProvider[]).map((p) => {
      const cfg    = PROVIDER_CFG[p];
      const Icon   = cfg.icon;
      const active = current === p;
      return (
        <button
          key={p}
          onClick={() => onChange(p)}
          title={`Usar ${cfg.sublabel}`}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all ${
            active ? cfg.activeClass : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Icon size={9} />
          {cfg.label}
        </button>
      );
    })}
  </div>
);

// ── Panel de chat ─────────────────────────────────────────────────────────────
const ChatPanel = ({
  onClose, onExpand, expanded,
}: {
  onClose:  () => void;
  onExpand: () => void;
  expanded: boolean;
}) => {
  const {
    messages, isStreaming, provider,
    addMessage, resolveLastMessage, errorLastMessage,
    clearMessages, setIsStreaming, setProvider,
  } = useChatStore();
  const { user } = useAuthStore();
  const { canSend, record, msUntilNext, remaining } = useRateLimit();

  const [input,         setInput]         = useState('');
  const [rateLimitMsg,  setRateLimitMsg]  = useState('');
  const [panelWidth,    setPanelWidth]    = useState(380);
  const [elapsedSecs,   setElapsedSecs]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(380);

  const cfg = PROVIDER_CFG[provider];

  // Scroll al fondo en cada mensaje nuevo
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus al abrir
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  // Resize del panel
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (expanded) return;
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = panelWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'ew-resize';
  }, [expanded, panelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newW = Math.max(320, Math.min(600, dragStartW.current + (dragStartX.current - e.clientX)));
      setPanelWidth(newW);
    };
    const onUp = () => {
      isDragging.current             = false;
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  // Enviar mensaje
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    // Rate limit solo para Gemini
    if (provider === 'gemini' && !canSend()) {
      const secs = Math.ceil(msUntilNext() / 1000);
      setRateLimitMsg(`Límite alcanzado. Espera ${secs}s para continuar.`);
      setTimeout(() => setRateLimitMsg(''), 4000);
      return;
    }

    if (provider === 'gemini') record();
    setRateLimitMsg('');
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    addMessage({ id: `u-${Date.now()}`, role: 'user',      content: text });
    addMessage({ id: `a-${Date.now()}`, role: 'assistant', content: '', pending: true });
    setIsStreaming(true);

    // Timer visible solo para Ollama (puede tardar 20-45s)
    setElapsedSecs(0);
    if (provider === 'ollama') {
      timerRef.current = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    }

    // Historial: los últimos 10 mensajes visibles (sin el pending)
    const history: ChatTurn[] = messages
      .filter((m) => !m.pending && (m.role === 'user' || m.role === 'assistant'))
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    history.push({ role: 'user', content: text });

    try {
      const reply = await chatService.sendMessage(history, provider);
      resolveLastMessage(reply);
    } catch (err: any) {
      const is503    = err?.status === 503;
      const isOllama = provider === 'ollama';
      errorLastMessage(
        is503 && isOllama
          ? '⚠️ Ollama no está corriendo. Ejecuta `ollama serve` en una terminal.'
          : is503
            ? '⚠️ Gemini sin configurar. Pega tu API key gratuita en backend/.env → GEMINI_API_KEY=...'
            : `Error al conectar (${err?.message ?? 'desconocido'}). Intenta de nuevo.`,
      );
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setElapsedSecs(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const rem = remaining();

  return (
    <div
      className="flex flex-col bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden relative"
      style={{
        width:        expanded ? '420px' : `${panelWidth}px`,
        height:       expanded ? '100vh' : '540px',
        borderRadius: expanded ? '0'     : '1.25rem',
      }}
    >
      {/* Resize handle */}
      {!expanded && (
        <div
          onMouseDown={onMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-blue-500/30 transition-colors z-10 rounded-l-xl"
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        {/* Icono + nombre */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`w-7 h-7 rounded-xl bg-gradient-to-br ${cfg.gradFrom} ${cfg.gradTo} flex items-center justify-center`}>
            <Bot size={14} className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-black text-zinc-100 leading-none">KanbanaAI</p>
            <p className="text-[9px] uppercase tracking-widest mt-0.5">
              {isStreaming ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass} animate-pulse inline-block`} />
                  Pensando...
                </span>
              ) : (
                <span className="text-zinc-500">{cfg.sublabel}</span>
              )}
              {/* Timer Ollama */}
              {isStreaming && provider === 'ollama' && elapsedSecs > 0 && (
                <span className="text-violet-400/70 text-[9px] ml-1">
                  {elapsedSecs}s…
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Toggle de proveedor (centro) */}
        <div className="flex-1 flex justify-center">
          <ProviderToggle current={provider} onChange={setProvider} />
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 shrink-0">
          {provider === 'gemini' && rem <= 5 && rem > 0 && (
            <span className="text-[9px] font-black text-amber-400 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
              {rem}/15
            </span>
          )}
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              title="Limpiar conversación"
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-all"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={onExpand}
            title={expanded ? 'Minimizar' : 'Expandir al lateral'}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-all"
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── Mensajes ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cfg.gradFrom}/20 ${cfg.gradTo}/20 border border-blue-500/20 flex items-center justify-center mb-4`}>
              <Bot size={26} className="text-blue-400" />
            </div>
            <p className="text-[13px] font-black text-zinc-300 mb-1">
              ¡Hola, {user?.nombre?.split(' ')[0] ?? 'usuario'}!
            </p>
            <p className="text-[11px] text-zinc-500 max-w-[220px] leading-relaxed mb-1">
              Soy KanbanaAI ({cfg.sublabel}).
            </p>
            <p className="text-[10px] text-zinc-600 max-w-[220px] leading-relaxed mb-5">
              Pregúntame sobre tu proyecto, módulo activo o tareas del equipo.
            </p>

            {/* 6 preguntas rápidas */}
            <div className="space-y-1.5 w-full max-w-[290px]">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="w-full text-left px-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-[11px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all leading-snug"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-3 bg-zinc-900 border-t border-zinc-800">
        {rateLimitMsg && (
          <p className="text-[10px] text-amber-400 text-center mb-1.5 leading-tight">
            {rateLimitMsg}
          </p>
        )}
        {/* Aviso Ollama */}
        {provider === 'ollama' && messages.length === 0 && (
          <p className="text-[9px] text-violet-400/70 text-center mb-1.5 uppercase tracking-widest">
            Requiere <span className="font-black">ollama serve</span> corriendo localmente
          </p>
        )}

        <div className="flex items-end gap-2 bg-zinc-800/60 border border-zinc-700/50 rounded-2xl px-3 py-2 focus-within:border-blue-500/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Esperando respuesta...' : 'Escribe tu mensaje...'}
            disabled={isStreaming}
            rows={1}
            className="flex-1 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-600 outline-none resize-none max-h-[120px] leading-relaxed disabled:opacity-50"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-[9px] text-zinc-700 text-center mt-1.5 uppercase tracking-widest">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
};

// ── ChatBubble — componente raíz ──────────────────────────────────────────────
export const ChatBubble = () => {
  const { mode, setMode, provider } = useChatStore();
  const { user }                    = useAuthStore();

  if (!user) return null;

  const cfg         = PROVIDER_CFG[provider];
  const isCollapsed = mode === 'collapsed';
  const isBubble    = mode === 'bubble';
  const isSidebar   = mode === 'sidebar';
  const isOpen      = isBubble || isSidebar;

  return (
    <>
      {/* Overlay sidebar */}
      <AnimatePresence>
        {isSidebar && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMode('bubble')}
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-40"
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key={isSidebar ? 'sidebar' : 'bubble'}
            initial={isSidebar ? { x: '100%', opacity: 0 } : { opacity: 0, scale: 0.92, y: 20 }}
            animate={isSidebar ? { x: 0, opacity: 1 }      : { opacity: 1, scale: 1,    y: 0  }}
            exit={isSidebar    ? { x: '100%', opacity: 0 } : { opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className={`fixed z-50 ${isSidebar ? 'right-0 top-0 bottom-0' : 'bottom-20 right-5'}`}
          >
            <ChatPanel
              expanded={isSidebar}
              onClose={() => setMode('collapsed')}
              onExpand={() => setMode(isSidebar ? 'bubble' : 'sidebar')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        Botón flotante — solo visible en collapsed o bubble.
        En sidebar se oculta: el panel ocupa todo el lateral derecho y el
        botón quedaría encima del área de input, tapando el botón de envío.
        El cierre en sidebar se hace desde el X del propio header del panel.
      */}
      {!isSidebar && (
      <motion.button
        onClick={() => setMode(isCollapsed ? 'bubble' : 'collapsed')}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        style={{ width: 52, height: 52 }}
        className={`fixed bottom-5 right-5 z-50 rounded-full shadow-lg shadow-black/40 flex items-center justify-center transition-all duration-300 ${
          isBubble
            ? 'bg-zinc-800 border border-zinc-700'
            : `bg-gradient-to-br ${cfg.gradFrom} ${cfg.gradTo} border border-white/10`
        }`}
        title={isBubble ? 'Cerrar asistente' : `Abrir KanbanaAI (${cfg.label})`}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0,   opacity: 1 }}
              exit={{ rotate: 90,     opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={20} className="text-zinc-400" />
            </motion.div>
          ) : (
            <motion.div key="bot"
              initial={{ rotate: 90,  opacity: 0 }}
              animate={{ rotate: 0,   opacity: 1 }}
              exit={{ rotate: -90,    opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Bot size={22} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {isCollapsed && (
          <span className={`absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full ${cfg.dotClass} border-2 border-zinc-900`} />
        )}
      </motion.button>
      )}
    </>
  );
};
