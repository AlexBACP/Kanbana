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
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence }  from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bot, X, Send, Maximize2, Minimize2, Trash2, Cpu, Zap,
  KanbanSquare, Layers, Calendar, User, LayoutGrid, ArrowRight,
  MessageSquare, Folder, BookOpen, ListTodo, HelpCircle,
} from 'lucide-react';
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

// ── Acciones rápidas inteligentes ────────────────────────────────────────────
// Cada acción es o bien una navegación directa (type:'nav') o una pregunta
// para el AI (type:'chat'). Se generan dinámicamente en base a la ruta actual
// y al rol del usuario para ser siempre contextuales y útiles.

type ActionKind = 'nav' | 'chat';

interface QuickAction {
  label:   string;
  desc:    string;
  icon:    React.ElementType;
  kind:    ActionKind;
  to?:     string;     // kind === 'nav'
  prompt?: string;     // kind === 'chat'
  color:   string;     // clase Tailwind de color del acento izquierdo
}

function buildQuickActions(user: any, pathname: string): QuickAction[] {
  const rol     = user?.rol ?? '';
  const esLider = rol === 'aprendiz' && user?.es_lider_tecnico;

  // Extrae el proyecto ID de la ruta si existe (/projects/:id/...)
  const projMatch = pathname.match(/\/projects\/(\d+)/);
  const projId    = projMatch ? projMatch[1] : null;

  const actions: QuickAction[] = [];

  // ── Acciones contextuales de RUTA ───────────────────────────────────────

  // Dentro de un proyecto
  if (projId) {
    if (!pathname.endsWith('/kanban')) {
      actions.push({
        label: 'Tablero Kanban',
        desc:  'Ver las tareas del módulo activo',
        icon:  KanbanSquare,
        kind:  'nav',
        to:    `/projects/${projId}/kanban`,
        color: 'border-blue-500/60 bg-blue-500/5',
      });
    }
    if (!pathname.endsWith('/backlog')) {
      actions.push({
        label: 'Cola de trabajo',
        desc:  'Ver y gestionar el backlog del proyecto',
        icon:  Layers,
        kind:  'nav',
        to:    `/projects/${projId}/backlog`,
        color: 'border-indigo-500/60 bg-indigo-500/5',
      });
    }
    if (!pathname.endsWith(`/projects/${projId}`)) {
      actions.push({
        label: 'Vista del proyecto',
        desc:  'Trimestres, módulos y progreso general',
        icon:  Folder,
        kind:  'nav',
        to:    `/projects/${projId}`,
        color: 'border-blue-500/60 bg-blue-500/5',
      });
    }
  }

  // Ruta de ticket — sugiere volver al tablero
  if (pathname.startsWith('/tickets/') && projId === null) {
    actions.push({
      label: 'Ir al dashboard',
      desc:  'Volver a tu panel principal',
      icon:  LayoutGrid,
      kind:  'nav',
      to:    rol === 'aprendiz' && !esLider ? '/kanban' : '/dashboard',
      color: 'border-primary-500/60 bg-primary-500/5',
    });
  }

  // ── Acciones globales según el rol ───────────────────────────────────────

  if (rol === 'aprendiz' && !esLider) {
    // Aprendiz: acceso rápido a su tablero personal
    if (pathname !== '/kanban') {
      actions.push({
        label: 'Mi tablero',
        desc:  'Tus tareas y módulo activo',
        icon:  KanbanSquare,
        kind:  'nav',
        to:    '/kanban',
        color: 'border-emerald-500/60 bg-emerald-500/5',
      });
    }
    actions.push({
      label: '¿Cómo marco mi tarea como lista?',
      desc:  'Flujo de revisión del líder técnico',
      icon:  MessageSquare,
      kind:  'chat',
      prompt: '¿Cómo marco una tarea como lista para revisión y qué pasa después?',
      color: 'border-zinc-600/60',
    });
    actions.push({
      label: 'Tengo una tarea bloqueada',
      desc:  'Qué hacer cuando una tarea es rechazada',
      icon:  HelpCircle,
      kind:  'chat',
      prompt: 'Mi tarea aparece en rojo como rechazada. ¿Qué debo hacer?',
      color: 'border-zinc-600/60',
    });
  }

  if (esLider) {
    if (!projId) {
      actions.push({
        label: 'Mi proyecto',
        desc:  'Ir al dashboard de líder técnico',
        icon:  LayoutGrid,
        kind:  'nav',
        to:    '/dashboard',
        color: 'border-blue-500/60 bg-blue-500/5',
      });
    }
    actions.push({
      label: '¿Puedo enviar el módulo a revisión?',
      desc:  'Condiciones para cerrar el sprint',
      icon:  MessageSquare,
      kind:  'chat',
      prompt: '¿Cuándo y cómo envío el módulo a revisión del instructor?',
      color: 'border-zinc-600/60',
    });
    actions.push({
      label: 'Tareas en revisión',
      desc:  'Ver qué tareas esperan tu aprobación',
      icon:  ListTodo,
      kind:  'chat',
      prompt: '¿Cuántas tareas están en estado "En revisión" esperando mi aprobación?',
      color: 'border-amber-500/60 bg-amber-500/5',
    });
  }

  if (rol === 'instructor' || rol === 'coordinador') {
    if (pathname !== '/dashboard') {
      actions.push({
        label: 'Dashboard',
        desc:  'Ver proyectos, fichas y equipo',
        icon:  LayoutGrid,
        kind:  'nav',
        to:    '/dashboard',
        color: 'border-primary-500/60 bg-primary-500/5',
      });
    }
    actions.push({
      label: '¿Hay módulos pendientes de revisión?',
      desc:  'Sprints esperando que los cierres',
      icon:  BookOpen,
      kind:  'chat',
      prompt: '¿Hay módulos enviados por líderes que estén esperando mi revisión o aprobación?',
      color: 'border-amber-500/60 bg-amber-500/5',
    });
    actions.push({
      label: '¿Qué proyectos están atrasados?',
      desc:  'Estado de avance del equipo',
      icon:  MessageSquare,
      kind:  'chat',
      prompt: '¿Cuáles proyectos tienen módulos vencidos o con bajo porcentaje de avance?',
      color: 'border-zinc-600/60',
    });
  }

  // ── Acciones universales (si no están ya en la lista) ────────────────────

  if (pathname !== '/calendar') {
    actions.push({
      label: 'Calendario',
      desc:  'Ver tareas y fechas límite',
      icon:  Calendar,
      kind:  'nav',
      to:    '/calendar',
      color: 'border-emerald-500/60 bg-emerald-500/5',
    });
  }
  if (pathname !== '/profile') {
    actions.push({
      label: 'Mi perfil',
      desc:  'Datos, avatar y seguridad',
      icon:  User,
      kind:  'nav',
      to:    '/profile',
      color: 'border-zinc-600/60',
    });
  }

  // Limitar a 6 acciones máximo para no saturar la pantalla
  return actions.slice(0, 6);
}

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
    activeClass: 'bg-indigo-600 text-white',
    dotClass:    'bg-indigo-500',
    gradFrom:    'from-indigo-600',
    gradTo:      'to-blue-700',
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
  const { user }  = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { canSend, record, msUntilNext, remaining } = useRateLimit();

  // Acciones rápidas generadas dinámicamente según ruta + rol
  const quickActions = useMemo(
    () => buildQuickActions(user, location.pathname),
    [user, location.pathname],
  );

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
                <span className="text-indigo-400/70 text-[9px] ml-1">
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
          <div className="flex flex-col h-full py-4">
            {/* Saludo */}
            <div className="flex items-center gap-3 px-1 mb-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradFrom}/20 ${cfg.gradTo}/20 border border-blue-500/20 flex items-center justify-center shrink-0`}>
                <Bot size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[13px] font-black text-zinc-200 leading-tight">
                  ¡Hola, {user?.nombre?.split(' ')[0] ?? 'usuario'}!
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
                  ¿A dónde quieres ir o qué quieres saber?
                </p>
              </div>
            </div>

            {/* Acciones rápidas inteligentes */}
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-0.5">
              {quickActions.map((action) => {
                const Icon = action.icon;
                const isNav = action.kind === 'nav';
                return (
                  <button
                    key={action.label}
                    onClick={() => {
                      if (isNav && action.to) {
                        navigate(action.to);
                        // No cerramos el chat — persiste al navegar
                      } else if (action.prompt) {
                        setInput(action.prompt);
                        inputRef.current?.focus();
                      }
                    }}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 bg-zinc-800/40 hover:bg-zinc-800/80 border-l-2 rounded-r-xl rounded-l-sm transition-all group ${action.color}`}
                  >
                    <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                      isNav ? 'bg-zinc-700/60 group-hover:bg-zinc-700' : 'bg-zinc-800 group-hover:bg-zinc-700'
                    } transition-colors`}>
                      <Icon size={13} className={isNav ? 'text-zinc-300' : 'text-zinc-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-zinc-300 group-hover:text-white transition-colors truncate">
                        {action.label}
                      </p>
                      <p className="text-[10px] text-zinc-600 group-hover:text-zinc-500 transition-colors truncate">
                        {action.desc}
                      </p>
                    </div>
                    {isNav
                      ? <ArrowRight size={11} className="shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      : <MessageSquare size={10} className="shrink-0 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                    }
                  </button>
                );
              })}
            </div>

            {/* Separador */}
            <div className="flex items-center gap-2 mt-4 mb-1 px-1">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[9px] uppercase tracking-widest text-zinc-700 font-black">o escribe tu pregunta</span>
              <div className="flex-1 h-px bg-zinc-800" />
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
          <p className="text-[9px] text-indigo-400/70 text-center mb-1.5 uppercase tracking-widest">
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
