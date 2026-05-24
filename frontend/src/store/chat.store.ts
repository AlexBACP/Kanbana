/**
 * chat.store.ts — Estado del asistente KanbanaAI.
 *
 * El proveedor elegido (gemini | ollama) se persiste en localStorage
 * de forma directa para evitar dependencias de middleware (Zustand v5).
 */
import { create } from 'zustand';

export type ChatMode     = 'collapsed' | 'bubble' | 'sidebar';
export type ChatProvider = 'gemini' | 'ollama';

export interface ChatMessage {
  id:       string;
  role:     'user' | 'assistant';
  content:  string;
  pending?: boolean; // true mientras espera respuesta
  error?:   boolean;
}

const PROVIDER_KEY = 'kanbana-ai-provider';

function readProvider(): ChatProvider {
  try {
    const v = localStorage.getItem(PROVIDER_KEY);
    if (v === 'gemini' || v === 'ollama') return v;
  } catch { /* sin acceso a localStorage */ }
  return 'gemini';
}

interface ChatStore {
  mode:        ChatMode;
  provider:    ChatProvider;
  messages:    ChatMessage[];
  isStreaming: boolean;

  setMode:            (mode: ChatMode)   => void;
  setProvider:        (p: ChatProvider)  => void;
  toggleBubble:       ()                 => void;
  addMessage:         (msg: ChatMessage) => void;
  resolveLastMessage: (content: string)  => void;
  errorLastMessage:   (text: string)     => void;
  clearMessages:      ()                 => void;
  setIsStreaming:     (v: boolean)       => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  mode:        'collapsed',
  provider:    readProvider(),
  messages:    [],
  isStreaming: false,

  setMode: (mode) => set({ mode }),

  setProvider: (provider) => {
    try { localStorage.setItem(PROVIDER_KEY, provider); } catch { /* ignorar */ }
    // Limpiar historial al cambiar de modelo para evitar mezclar contextos
    set({ provider, messages: [] });
  },

  toggleBubble: () => {
    const { mode } = get();
    set({ mode: mode === 'collapsed' ? 'bubble' : 'collapsed' });
  },

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  resolveLastMessage: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content, pending: false };
      }
      return { messages: msgs, isStreaming: false };
    }),

  errorLastMessage: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: text, pending: false, error: true };
      }
      return { messages: msgs, isStreaming: false };
    }),

  clearMessages:  ()  => set({ messages: [] }),
  setIsStreaming: (v) => set({ isStreaming: v }),
}));
