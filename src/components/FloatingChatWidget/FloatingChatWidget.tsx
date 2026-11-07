'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { sendChatMessageAction } from '@/app/actions/ai';
import { MarkdownMessage } from '@/app/(dashboard)/dashboard/ai/MarkdownMessage';
import styles from './FloatingChatWidget.module.css';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isError?: boolean;
}

interface FloatingChatWidgetProps {
  userName: string;
  userId: string;
  userRole: string;
  initialOpen?: boolean;
}

/** Prefix used to identify all AI chat history keys in sessionStorage */
const STORAGE_PREFIX = 'banksampah_ai_chat_';

/** Key that tracks which user+role owns the current session's chat history */
const ACTIVE_OWNER_KEY = 'banksampah_ai_active_owner';

const SUGGESTION_GROUPS: Array<{ title: string; questions: string[] }> = [
  {
    title: 'Tentang fitur aplikasi',
    questions: [
      'Menu apa saja yang tersedia untuk saya?',
      'Bagaimana cara mengajukan penarikan?',
      'Bagaimana cara saya menyetor sampah?',
      'Berapa lama penarikan saya diproses?',
    ],
  },
  {
    title: 'Tentang sampah',
    questions: [
      'Bagaimana cara memilah sampah di rumah?',
      'Botol plastik termasuk jenis sampah apa?',
      'Bagaimana cara mengurangi sampah plastik?',
      'Apa manfaat bank sampah?',
    ],
  },
];

export function FloatingChatWidget({ userName, userId, userRole, initialOpen = false }: FloatingChatWidgetProps) {
  /** Unique storage key per user+role so histories never leak across accounts */
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}${userId}_${userRole}`,
    [userId, userRole]
  );

  const [isOpen, setIsOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const chatAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSendingRef = useRef(false);

  // Sync initialOpen when prop changes (e.g. route change)
  useEffect(() => {
    if (initialOpen) {
      setIsOpen(true);
    }
  }, [initialOpen]);

  // Read stored messages from sessionStorage on mount safely.
  // Also detect account switches: if the active owner changed, clear stale keys.
  useEffect(() => {
    setHasMounted(true);
    try {
      const currentOwner = `${userId}_${userRole}`;
      const previousOwner = sessionStorage.getItem(ACTIVE_OWNER_KEY);

      // If the owner changed (different user or role logged in on same tab),
      // remove all chat history keys from the previous owner to prevent leaks.
      if (previousOwner && previousOwner !== currentOwner) {
        const staleKey = `${STORAGE_PREFIX}${previousOwner}`;
        sessionStorage.removeItem(staleKey);
      }

      // Mark current owner
      sessionStorage.setItem(ACTIVE_OWNER_KEY, currentOwner);

      // Load only the history that belongs to this user+role
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      // Ignore sessionStorage read errors
    }
  }, [userId, userRole, storageKey]);

  // Sync messages to sessionStorage using the user-specific key
  useEffect(() => {
    if (!hasMounted) return;
    try {
      if (messages.length > 0) {
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore storage write errors
    }
  }, [messages, hasMounted, storageKey]);

  // Scroll to bottom when messages or loading state change
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape key and listen to custom "open-ai-chat" event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = (e: Event) => {
      setIsOpen(true);
      const customEvent = e as CustomEvent<{ message?: string }>;
      if (customEvent.detail?.message) {
        handleSend(customEvent.detail.message);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-ai-chat', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-ai-chat', handleCustomOpen);
    };
  }, [isOpen]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || isSendingRef.current) return;

      isSendingRef.current = true;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: trimmed,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInputValue('');
      setIsLoading(true);

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      try {
        const history = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await sendChatMessageAction(trimmed, history.slice(0, -1));

        if (response.success && response.data) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'model',
              content: response.data!,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'model',
              content:
                'Maaf, terjadi kesalahan: ' +
                (response.error || 'Gagal merespons. Silakan coba lagi.'),
              isError: true,
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: 'Maaf, terjadi kesalahan jaringan atau server. Pastikan koneksi internet stabil.',
            isError: true,
          },
        ]);
      } finally {
        isSendingRef.current = false;
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
  };

  const handleClearChat = () => {
    if (messages.length === 0) return;
    if (window.confirm('Hapus seluruh riwayat percakapan dengan Asisten AI?')) {
      setMessages([]);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
    }
  };

  return (
    <div className={styles.widgetWrapper}>
      {/* Floating Chat Bubble Button */}
      <div className={styles.bubbleContainer}>
        {!isOpen && (
          <div className={styles.bubbleTooltip} aria-hidden="true">
            <span className={styles.bubbleTooltipDot}></span>
            <span>Tanya AI</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`${styles.bubbleButton} ${isOpen ? styles.bubbleButtonOpen : ''}`}
          aria-label={isOpen ? 'Tutup Asisten AI' : 'Buka Tanya AI Asisten'}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          title={isOpen ? 'Tutup chat' : 'Tanya AI Asisten'}
        >
          <div className={styles.bubbleIconWrapper}>
            {isOpen ? (
              <svg
                className={styles.bubbleIcon}
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                stroke="currentColor"
                fill="none"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className={styles.bubbleIcon} viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.1 21.2a1 1 0 001.2 1.2l4.2-.738A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-3 8.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 1.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-1.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* Floating Chat Panel */}
      {isOpen && (
        <section
          className={styles.panel}
          role="dialog"
          aria-label="Asisten AI Bank Sampah"
          aria-modal="false"
        >
          {/* Header */}
          <header className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.headerAvatar} aria-hidden="true">
                🤖
              </div>
              <div className={styles.headerTexts}>
                <h3 className={styles.headerTitle}>Asisten AI Bank Sampah</h3>
                <div className={styles.headerStatus}>
                  <span className={styles.pulseDot} aria-hidden="true"></span>
                  <span>Online • Siap membantu</span>
                </div>
              </div>
            </div>

            <div className={styles.headerActions}>
              {messages.length > 0 && (
                <button
                  type="button"
                  className={styles.headerBtn}
                  onClick={handleClearChat}
                  title="Hapus riwayat percakapan"
                  aria-label="Hapus riwayat percakapan"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              )}
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => setIsOpen(false)}
                title="Tutup panel chat"
                aria-label="Tutup panel chat"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </header>

          {/* Chat Messages Area */}
          <div className={styles.chatArea} ref={chatAreaRef}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon} aria-hidden="true">
                  🌱
                </div>
                <h4 className={styles.emptyTitle}>Halo, {userName}!</h4>
                <p className={styles.emptyDesc}>
                  Saya asisten AI Bank Sampah Digital. Tanya saja apa pun tentang fitur aplikasi,
                  alur setoran dan penarikan, hak akses tiap menu, data Anda, atau pengelolaan sampah.
                </p>

                <div className={styles.suggestions}>
                  {SUGGESTION_GROUPS.map((group) => (
                    <div key={group.title} className={styles.suggestionGroup}>
                      <p className={styles.suggestionGroupTitle}>{group.title}</p>
                      <div className={styles.suggestionChips}>
                        {group.questions.map((q) => (
                          <button
                            type="button"
                            key={q}
                            className={styles.suggestionChip}
                            onClick={() => handleSend(q)}
                            disabled={isLoading}
                          >
                            <span>{q}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.messageRow} ${
                    msg.role === 'user' ? styles.messageRowUser : styles.messageRowAi
                  }`}
                >
                  {msg.role === 'model' && (
                    <div className={styles.aiAvatar} aria-hidden="true">
                      🤖
                    </div>
                  )}
                  <div
                    className={`${
                      msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi
                    } ${msg.isError ? styles.bubbleAiError : ''}`}
                  >
                    {msg.role === 'model' ? (
                      <MarkdownMessage content={msg.content} customStyles={styles} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className={`${styles.messageRow} ${styles.messageRowAi}`}>
                <div className={styles.aiAvatar} aria-hidden="true">
                  🤖
                </div>
                <div className={styles.loadingBubble}>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                  <div className={styles.dot}></div>
                  <span className={styles.loadingText}>Mengetik...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className={styles.inputArea}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                placeholder="Tulis pertanyaanmu di sini... (Enter untuk kirim)"
                value={inputValue}
                onChange={handleTextareaInput}
                onKeyDown={handleTextareaKeyDown}
                disabled={isLoading}
                rows={1}
                aria-label="Pesan untuk asisten AI"
              />
              <button
                type="submit"
                className={styles.sendButton}
                disabled={isLoading || !inputValue.trim()}
                title="Kirim pesan"
                aria-label="Kirim pesan"
              >
                <svg className={styles.sendIcon} viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </form>
            <p className={styles.inputFooterNote}>Didukung Asisten AI Bank Sampah Digital</p>
          </div>
        </section>
      )}
    </div>
  );
}
