'use server';

import { getSession } from '@/utils/session';
import { getAIService } from '@/services/ai';
import { buildAiUserContext } from '@/services/ai-context';
import { getQuickAiResponse } from '@/services/ai-quick-response';

export async function sendChatMessageAction(
  message: string,
  history: Array<{ role: 'user' | 'model'; content: string }>
) {
  const correlationId = Math.random().toString(36).substring(2, 10);
  const totalStart = performance.now();

  function logTelemetry(
    stage: string,
    durationMs: number,
    status: 'SUCCESS' | 'FAILED',
    details?: string
  ) {
    const meta = details ? ` | ${details}` : '';
    console.log(
      `[TanyaAI][${correlationId}] Stage: ${stage} | Duration: ${durationMs}ms | Status: ${status}${meta}`
    );
  }

  try {
    // Tahap 1: Verifikasi sesi & identitas pengguna
    const t0 = performance.now();
    const session = await getSession();
    const authDuration = Math.round(performance.now() - t0);

    if (!session || !session.userId) {
      logTelemetry('Auth & Session', authDuration, 'FAILED', 'Unauthorized');
      return { success: false, error: 'Unauthorized' };
    }
    logTelemetry('Auth & Session', authDuration, 'SUCCESS');

    if (!message || message.trim() === '') {
      return { success: false, error: 'Pesan tidak boleh kosong' };
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              (m?.role === 'user' || m?.role === 'model') &&
              typeof m?.content === 'string'
          )
          .slice(-12)
      : [];

    const ROLE_LABELS: Record<string, string> = {
      ADMIN: 'Admin Sistem',
      MANAGER: 'Pengelola Bank Sampah',
      MEMBER: 'Anggota Bank Sampah',
    };

    const userProfile = {
      name: session.name || 'Pengguna',
      role: session.role,
      roleLabel: ROLE_LABELS[session.role] || 'Pengguna',
    };

    // Fast-path Tahap A: Sapaan atau pertanyaan identitas umum tanpa perlu membaca DB
    const tGreeting = performance.now();
    const quickReplyBeforeDb = getQuickAiResponse(message, userProfile);
    if (quickReplyBeforeDb) {
      const greetingDuration = Math.round(performance.now() - tGreeting);
      logTelemetry('Greeting Fast-Path', greetingDuration, 'SUCCESS', 'Handled pre-DB');
      return { success: true, data: quickReplyBeforeDb };
    }

    // Tahap 2: Pengambilan konteks data pengguna melalui Prisma
    const tContext = performance.now();
    let context;
    try {
      context = await buildAiUserContext({
        userId: session.userId,
        role: session.role,
        name: session.name,
        email: session.email,
      });
      const contextDuration = Math.round(performance.now() - tContext);
      logTelemetry('Database Context', contextDuration, 'SUCCESS');
    } catch (dbErr) {
      const contextDuration = Math.round(performance.now() - tContext);
      logTelemetry('Database Context', contextDuration, 'FAILED');
      throw dbErr;
    }

    // Fast-path Tahap B: Pertanyaan berbasis data akun sendiri (saldo, setoran, transaksi)
    const tAccountFast = performance.now();
    const quickReplyWithContext = getQuickAiResponse(message, userProfile, context);
    if (quickReplyWithContext) {
      const fastDuration = Math.round(performance.now() - tAccountFast);
      logTelemetry('Account Data Fast-Path', fastDuration, 'SUCCESS', 'Handled post-DB');
      return { success: true, data: quickReplyWithContext };
    }

    // Tahap 3: Pemanggilan provider AI eksternal untuk pertanyaan analitis / umum lainnya
    const tAi = performance.now();
    try {
      const aiService = getAIService();
      const reply = await aiService.chat(message, safeHistory, context);
      const aiDuration = Math.round(performance.now() - tAi);
      logTelemetry('AI Provider Call', aiDuration, 'SUCCESS');
      return { success: true, data: reply };
    } catch (aiErr) {
      const aiDuration = Math.round(performance.now() - tAi);
      logTelemetry('AI Provider Call', aiDuration, 'FAILED');
      throw aiErr;
    }
  } catch (error) {
    const totalDuration = Math.round(performance.now() - totalStart);
    logTelemetry('Total Request', totalDuration, 'FAILED');
    console.error(`[TanyaAI][${correlationId}] Action error:`, error instanceof Error ? error.message : error);
    const message =
      error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses pesan';
    return { success: false, error: message };
  }
}