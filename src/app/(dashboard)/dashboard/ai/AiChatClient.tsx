'use client';

import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessageAction } from '@/app/actions/ai';
import { MarkdownMessage } from './MarkdownMessage';
import styles from './ai.module.css';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

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

let messageSeq = 0;
function createMessageId(role: 'user' | 'model'): string {
  messageSeq += 1;
  return `${role}-${messageSeq}`;
}

export function AiChatClient({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  // Auto scroll to bottom
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || isSendingRef.current) return;

    isSendingRef.current = true;

    const userMessage: Message = {
      id: createMessageId('user'),
      role: 'user',
      content: text
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      // Prepare history for AI
      const history = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await sendChatMessageAction(text, history);

      if (response.success && response.data) {
        setMessages(prev => [...prev, {
          id: createMessageId('model'),
          role: 'model',
          content: response.data
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: createMessageId('model'),
          role: 'model',
          content: 'Maaf, terjadi kesalahan: ' + (response.error || 'Gagal merespons.')
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: createMessageId('model'),
        role: 'model',
        content: 'Maaf, terjadi kesalahan jaringan atau server.'
      }]);
    } finally {
      isSendingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>🤖 Tanya AI</h2>
        <p className={styles.subtitle}>Asisten AI Bank Sampah Digital</p>
      </div>

      <div className={styles.chatArea} ref={chatAreaRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🌱</div>
            <h3>Halo, {userName}!</h3>
            <p>
              Saya asisten AI Bank Sampah Digital. Tanya saja apa pun tentang fitur
              aplikasi, alur setoran dan penarikan, hak akses tiap menu, data Anda,
              atau pengelolaan sampah.
            </p>
            
            <div className={styles.suggestions}>
              {SUGGESTION_GROUPS.map((group) => (
                <div key={group.title} className={styles.suggestionGroup}>
                  <p className={styles.suggestionGroupTitle}>{group.title}</p>
                  <div className={styles.suggestionGroupChips}>
                    {group.questions.map((q) => (
                      <div
                        key={q}
                        className={styles.suggestionChip}
                        onClick={() => handleSend(q)}
                      >
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div 
              key={msg.id} 
              className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAi}`}
            >
              <div className={styles.messageContent}>
                {msg.role === 'model' ? (
                  <MarkdownMessage content={msg.content} />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className={`${styles.message} ${styles.messageAi}`}>
            <div className={styles.loadingIndicator}>
              <div className={styles.dot}></div>
              <div className={styles.dot}></div>
              <div className={styles.dot}></div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.inputArea}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            className={styles.input}
            placeholder="Tulis pertanyaanmu di sini..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className={styles.sendButton}
            disabled={isLoading || !inputValue.trim()}
          >
            Kirim
          </button>
        </form>
      </div>
    </div>
  );
}
