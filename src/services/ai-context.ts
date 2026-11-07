import { prisma } from '@/lib/prisma';

export type AiSession = {
  userId: string;
  role: string;
  name: string;
  email: string;
};

// ─── Jakarta timezone utilities ─────────────────────────────────────────────

const JAKARTA_TZ = 'Asia/Jakarta';

const HARI_INDONESIA = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
];

const BULAN_INDONESIA = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Informasi tanggal & waktu saat ini di zona waktu Asia/Jakarta.
 * Dihasilkan secara dinamis setiap kali dipanggil — tidak pernah di-cache.
 */
export interface JakartaDateTime {
  /** Tanggal dalam format "DD-MM-YYYY" */
  tanggal: string;
  /** Nama hari dalam bahasa Indonesia, misalnya "Kamis" */
  hari: string;
  /** Waktu dalam format "HH:MM WIB" */
  waktu: string;
  /** Tanggal panjang, misalnya "16 Oktober 2026" */
  tanggalPanjang: string;
  /** Zona waktu yang dipakai */
  zonaWaktu: string;
  /** Awal hari ini (00:00 WIB) sebagai Date UTC — untuk query database */
  startOfToday: Date;
  /** Awal hari besok (00:00 WIB) sebagai Date UTC — untuk query database (exclusive) */
  startOfTomorrow: Date;
  /** Awal kemarin (00:00 WIB) sebagai Date UTC */
  startOfYesterday: Date;
  /** Awal bulan ini (tanggal 1, 00:00 WIB) sebagai Date UTC */
  startOfMonth: Date;
  /** Awal bulan depan (tanggal 1, 00:00 WIB) sebagai Date UTC */
  startOfNextMonth: Date;
}

/**
 * Hitung informasi tanggal dan waktu saat ini di zona waktu Asia/Jakarta.
 *
 * Menggunakan `Date` bawaan Node.js dan `Intl.DateTimeFormat` untuk menentukan
 * komponen tanggal di WIB tanpa library eksternal. Offset WIB selalu +07:00.
 */
export function getJakartaDateTime(): JakartaDateTime {
  const now = new Date();

  // Dapatkan komponen tanggal di Jakarta menggunakan Intl formatter
  const partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = partsFormatter.formatToParts(now);

  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10); // 1-based
  const day = parseInt(parts.find((p) => p.type === 'day')!.value, 10);
  const hour = parts.find((p) => p.type === 'hour')!.value;
  const minute = parts.find((p) => p.type === 'minute')!.value;

  // Nama hari di Jakarta
  const jakartaDow = new Intl.DateTimeFormat('en-US', {
    timeZone: JAKARTA_TZ,
    weekday: 'short',
  }).format(now);
  // Map English weekday abbreviation to day index
  const dowMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayIndex = dowMap[jakartaDow] ?? now.getDay();

  const tanggal = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
  const tanggalPanjang = `${day} ${BULAN_INDONESIA[month - 1]} ${year}`;
  const hari = HARI_INDONESIA[dayIndex];
  const waktu = `${hour}:${minute} WIB`;

  // WIB offset is always UTC+7. Compute day boundaries in UTC.
  // Start of today in Jakarta = midnight WIB = that day at 00:00+07:00 = previous day at 17:00 UTC
  const startOfTodayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 60 * 60 * 1000);
  const startOfTomorrowUTC = new Date(startOfTodayUTC.getTime() + 24 * 60 * 60 * 1000);
  const startOfYesterdayUTC = new Date(startOfTodayUTC.getTime() - 24 * 60 * 60 * 1000);
  const startOfMonthUTC = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - 7 * 60 * 60 * 1000);
  // Start of next month
  const nextMonth = month === 12 ? 1 : month;
  const nextYear = month === 12 ? year + 1 : year;
  const startOfNextMonthUTC = new Date(Date.UTC(nextYear, nextMonth, 1, 0, 0, 0) - 7 * 60 * 60 * 1000);

  return {
    tanggal,
    hari,
    waktu,
    tanggalPanjang,
    zonaWaktu: JAKARTA_TZ,
    startOfToday: startOfTodayUTC,
    startOfTomorrow: startOfTomorrowUTC,
    startOfYesterday: startOfYesterdayUTC,
    startOfMonth: startOfMonthUTC,
    startOfNextMonth: startOfNextMonthUTC,
  };
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type DailyTransactionSummary = {
  jumlahTransaksi: number;
  totalBeratKg: number;
  totalNilai: number;
};

export type AdminOperationsContext = {
  totalAnggotaAktif: number;
  totalAnggotaTerdaftar: number;
  daftarAnggotaAktif: string[];
  totalSampahKg: number;
  totalNilaiSetoranGross: number;
  totalNilaiTabunganBersih: number;
  totalTransaksiSelesai: number;
  penarikanMenungguJumlah: number;
  penarikanMenungguTotalNominal: number;
  aktivitasTransaksiTerbaru: Array<{
    memberName: string;
    categoryName: string;
    weight: number;
    totalValue: number;
    date: string;
  }>;
  /** Ringkasan setoran hari ini */
  setoranHariIni: DailyTransactionSummary;
  /** Ringkasan setoran kemarin */
  setoranKemarin: DailyTransactionSummary;
  /** Ringkasan setoran bulan ini */
  setoranBulanIni: DailyTransactionSummary;
};

export type AiUserContext = {
  name: string;
  role: string;
  roleLabel: string;
  scopeNote: string;
  /** Informasi tanggal & waktu saat ini di WIB, dihitung saat request diproses */
  currentDateTime: JakartaDateTime;
  ownAccount?: {
    saldoTersedia: number;
    totalSetoran: number;
    totalDitarik: number;
    penarikanMenunggu: number;
    totalBeratKg: number;
    jumlahTransaksi: number;
    statusKeanggotaan: string;
    setoranHariIni?: DailyTransactionSummary;
    recentTransactions: Array<{
      id: string;
      categoryName: string;
      weight: number;
      totalValue: number;
      date: string;
    }>;
  };
  adminData?: AdminOperationsContext;
  operations?: {
    totalAnggota: number;
    totalSampahKg: number;
    totalNilaiSetoran: number;
    penarikanMenunggu: number;
  };
  categories?: Array<{ name: string; pricePerKg: number; unit: string }>;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin Sistem',
  MANAGER: 'Pengelola Bank Sampah',
  MEMBER: 'Anggota Bank Sampah',
};

export function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

// ─── Build context ──────────────────────────────────────────────────────────

export async function buildAiUserContext(session: AiSession): Promise<AiUserContext> {
  const roleLabel = ROLE_LABEL[session.role] ?? 'Pengguna';
  const jkt = getJakartaDateTime();

  // 1. Role MEMBER: Hanya data pribadi sendiri, tidak dapat mengakses data anggota lain
  if (session.role === 'MEMBER') {
    const [txAgg, withdrawals, user, categories, todayTxAgg, recentTxs] = await Promise.all([
      prisma.wasteTransaction.aggregate({
        where: { memberId: session.userId, status: 'COMPLETED' },
        _sum: { weight: true, totalValue: true },
        _count: true,
      }),
      prisma.withdrawal.groupBy({
        by: ['status'],
        where: { memberId: session.userId },
        _sum: { amount: true },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { status: true },
      }),
      prisma.wasteCategory.findMany({
        where: { isActive: true },
        select: { name: true, pricePerKg: true, unit: true },
        orderBy: { name: 'asc' },
      }),
      // Setoran milik anggota ini hari ini
      prisma.wasteTransaction.aggregate({
        where: {
          memberId: session.userId,
          status: 'COMPLETED',
          date: { gte: jkt.startOfToday, lt: jkt.startOfTomorrow },
        },
        _sum: { weight: true, totalValue: true },
        _count: true,
      }),
      // Riwayat transaksi setoran terakhir
      prisma.wasteTransaction.findMany({
        where: { memberId: session.userId, status: 'COMPLETED' },
        orderBy: { date: 'desc' },
        take: 5,
        select: {
          id: true,
          weight: true,
          totalValue: true,
          date: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    const totalDeposits = txAgg._sum.totalValue ?? 0;
    let totalWithdrawn = 0;
    let totalPending = 0;
    withdrawals.forEach((w) => {
      if (w.status === 'COMPLETED') totalWithdrawn += (w._sum.amount ?? 0);
      if (w.status === 'PENDING') totalPending += (w._sum.amount ?? 0);
    });
    const availableBalance = totalDeposits - totalWithdrawn - totalPending;

    const dateFormatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const recentTransactions = recentTxs.map((tx) => ({
      id: tx.id,
      categoryName: tx.category?.name ?? 'Sampah',
      weight: tx.weight,
      totalValue: tx.totalValue,
      date: dateFormatter.format(new Date(tx.date)),
    }));

    return {
      name: session.name,
      role: session.role,
      roleLabel,
      currentDateTime: jkt,
      scopeNote:
        'Kamu hanya menerima data milik pengguna yang sedang login di atas. Kamu tidak memiliki akses ke data anggota lain dan tidak boleh menebak, memperkirakan, atau membuat data anggota lain.',
      ownAccount: {
        saldoTersedia: availableBalance,
        totalSetoran: totalDeposits,
        totalDitarik: totalWithdrawn,
        penarikanMenunggu: totalPending,
        totalBeratKg: txAgg._sum.weight ?? 0,
        jumlahTransaksi: txAgg._count,
        statusKeanggotaan: user?.status ?? 'ACTIVE',
        setoranHariIni: {
          jumlahTransaksi: todayTxAgg._count,
          totalBeratKg: todayTxAgg._sum.weight ?? 0,
          totalNilai: todayTxAgg._sum.totalValue ?? 0,
        },
        recentTransactions,
      },
      categories: categories.map((c) => ({
        name: c.name,
        pricePerKg: c.pricePerKg,
        unit: c.unit,
      })),
    };
  }

  // 2. Role ADMIN: Berhak mengakses ringkasan operasional dan daftar nama anggota aktif dari database
  if (session.role === 'ADMIN') {
    const [
      activeMembersCount,
      allMembersCount,
      activeMembers,
      transactionAgg,
      totalWithdrawn,
      pendingWithdrawals,
      recentActivity,
      categories,
      todayTxAgg,
      yesterdayTxAgg,
      monthTxAgg,
    ] = await Promise.all([
      // Total anggota aktif
      prisma.user.count({
        where: { role: 'MEMBER', status: 'ACTIVE' },
      }),
      // Total seluruh anggota terdaftar
      prisma.user.count({
        where: { role: 'MEMBER' },
      }),
      // Daftar nama anggota aktif dari database (hanya field name)
      prisma.user.findMany({
        where: { role: 'MEMBER', status: 'ACTIVE' },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      // Total sampah & nilai transaksi setoran gross & total transaksi selesai
      prisma.wasteTransaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { weight: true, totalValue: true },
        _count: true,
      }),
      // Total penarikan yang sudah selesai (untuk menghitung saldo bersih seluruh anggota)
      prisma.withdrawal.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      // Penarikan berstatus PENDING
      prisma.withdrawal.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      // 10 aktivitas transaksi terbaru
      prisma.wasteTransaction.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { date: 'desc' },
        take: 10,
        include: {
          member: { select: { name: true } },
          category: { select: { name: true } },
        },
      }),
      // Kategori sampah terdaftar
      prisma.wasteCategory.findMany({
        where: { isActive: true },
        select: { name: true, pricePerKg: true, unit: true },
        orderBy: { name: 'asc' },
      }),
      // Setoran hari ini (seluruh anggota)
      prisma.wasteTransaction.aggregate({
        where: {
          status: 'COMPLETED',
          date: { gte: jkt.startOfToday, lt: jkt.startOfTomorrow },
        },
        _sum: { weight: true, totalValue: true },
        _count: true,
      }),
      // Setoran kemarin (seluruh anggota)
      prisma.wasteTransaction.aggregate({
        where: {
          status: 'COMPLETED',
          date: { gte: jkt.startOfYesterday, lt: jkt.startOfToday },
        },
        _sum: { weight: true, totalValue: true },
        _count: true,
      }),
      // Setoran bulan ini (seluruh anggota)
      prisma.wasteTransaction.aggregate({
        where: {
          status: 'COMPLETED',
          date: { gte: jkt.startOfMonth, lt: jkt.startOfNextMonth },
        },
        _sum: { weight: true, totalValue: true },
        _count: true,
      }),
    ]);

    const totalSavingsGross = transactionAgg._sum.totalValue ?? 0;
    const totalWithdrawnAmount = totalWithdrawn._sum.amount ?? 0;
    const totalNetSavings = totalSavingsGross - totalWithdrawnAmount;

    return {
      name: session.name,
      role: session.role,
      roleLabel,
      currentDateTime: jkt,
      scopeNote:
        'Sebagai Admin Sistem, Anda memiliki wewenang penuh melihat ringkasan operasional dan daftar nama anggota aktif sistem.',
      adminData: {
        totalAnggotaAktif: activeMembersCount,
        totalAnggotaTerdaftar: allMembersCount,
        daftarAnggotaAktif: activeMembers.map((m) => m.name),
        totalSampahKg: transactionAgg._sum.weight ?? 0,
        totalNilaiSetoranGross: totalSavingsGross,
        totalNilaiTabunganBersih: totalNetSavings,
        totalTransaksiSelesai: transactionAgg._count,
        penarikanMenungguJumlah: pendingWithdrawals._count,
        penarikanMenungguTotalNominal: pendingWithdrawals._sum.amount ?? 0,
        aktivitasTransaksiTerbaru: recentActivity.map((tx) => ({
          memberName: tx.member.name,
          categoryName: tx.category.name,
          weight: tx.weight,
          totalValue: tx.totalValue,
          date: tx.date.toLocaleDateString('id-ID', {
            timeZone: JAKARTA_TZ,
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
        })),
        setoranHariIni: {
          jumlahTransaksi: todayTxAgg._count,
          totalBeratKg: todayTxAgg._sum.weight ?? 0,
          totalNilai: todayTxAgg._sum.totalValue ?? 0,
        },
        setoranKemarin: {
          jumlahTransaksi: yesterdayTxAgg._count,
          totalBeratKg: yesterdayTxAgg._sum.weight ?? 0,
          totalNilai: yesterdayTxAgg._sum.totalValue ?? 0,
        },
        setoranBulanIni: {
          jumlahTransaksi: monthTxAgg._count,
          totalBeratKg: monthTxAgg._sum.weight ?? 0,
          totalNilai: monthTxAgg._sum.totalValue ?? 0,
        },
      },
      operations: {
        totalAnggota: activeMembersCount,
        totalSampahKg: transactionAgg._sum.weight ?? 0,
        totalNilaiSetoran: totalSavingsGross,
        penarikanMenunggu: pendingWithdrawals._count,
      },
      categories: categories.map((c) => ({
        name: c.name,
        pricePerKg: c.pricePerKg,
        unit: c.unit,
      })),
    };
  }

  // 3. Role MANAGER / Pengelola: Pertahankan izin dan ringkasan agregat yang sudah berlaku
  const [totalMembers, txAgg, pendingWithdrawals] = await Promise.all([
    prisma.user.count({ where: { role: 'MEMBER', status: 'ACTIVE' } }),
    prisma.wasteTransaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { weight: true, totalValue: true },
    }),
    prisma.withdrawal.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const categories = await prisma.wasteCategory.findMany({
    where: { isActive: true },
    select: { name: true, pricePerKg: true, unit: true },
    orderBy: { name: 'asc' },
  });

  return {
    name: session.name,
    role: session.role,
    roleLabel,
    currentDateTime: jkt,
    scopeNote:
      'Kamu hanya menerima data agregat di bawah. Kamu tidak memiliki akses ke data pribadi maupun saldo anggota individual, jadi jangan pernah menampilkan data anggota individual.',
    operations: {
      totalAnggota: totalMembers,
      totalSampahKg: txAgg._sum.weight ?? 0,
      totalNilaiSetoran: txAgg._sum.totalValue ?? 0,
      penarikanMenunggu: pendingWithdrawals._count,
    },
    categories: categories.map((c) => ({
      name: c.name,
      pricePerKg: c.pricePerKg,
      unit: c.unit,
    })),
  };
}