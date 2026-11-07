import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { executeResetMemberPassword } from '../src/app/actions/member';
import { generateTemporaryPassword } from '../src/utils/temporary-password';

// Muat .env.local jika ada
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (value) process.env[m[1]] = value;
  }
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description: string, condition: boolean, extra?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${description} ${extra ? `(${extra})` : ''}`);
  }
}

async function runPasswordManagementTests() {
  console.log('='.repeat(75));
  console.log('PENGUJIAN KOMPREHENSIF: PENGELOLAAN PASSWORD ANGGOTA');
  console.log('='.repeat(75));

  // Ambil Admin dan Manager untuk pengujian penolakan target
  const realAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const realManager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });

  // Buat akun anggota uji terisolasi (TIDAK menyentuh akun nyata seperti Haifa)
  const testEmail = `test_member_${Date.now()}@banksampah.test`;
  const initialOldPassword = 'InitialOldPassword123!';
  const initialSalt = await bcrypt.genSalt(10);
  const initialHash = await bcrypt.hash(initialOldPassword, initialSalt);

  const testMember = await prisma.user.create({
    data: {
      name: 'Test Anggota Password Reset',
      email: testEmail,
      password: initialHash,
      role: 'MEMBER',
      status: 'ACTIVE',
      contact: '08999999999',
      address: 'Jl. Uji Coba No. 99',
      mustChangePassword: false,
    },
  });

  console.log(`\nAkun uji terisolasi dibuat: ${testMember.name} (${testMember.email}, id=${testMember.id})`);

  try {
    // ── TEST 1: Generator Password Sementara Acak ──────────────────────────
    console.log('\n[1] PENGUJIAN GENERATOR PASSWORD SEMENTARA');
    const tempPass = generateTemporaryPassword(12);
    assert('Panjang password sementara 12 karakter', tempPass.length === 12);
    assert('Memuat huruf besar', /[A-Z]/.test(tempPass));
    assert('Memuat huruf kecil', /[a-z]/.test(tempPass));
    assert('Memuat angka', /[0-9]/.test(tempPass));
    assert('Memuat simbol khusus', /[!@#$%*?]/.test(tempPass));

    // ── TEST 2: Validasi Otorisasi Server-Side (Hanya ADMIN) ────────────────
    console.log('\n[2] PENGUJIAN OTORISASI SERVER-SIDE');
    const anonResult = await executeResetMemberPassword(
      { memberId: testMember.id, mode: 'AUTO' },
      undefined // Tidak ada sesi login
    );
    assert('Akses ditolak jika tidak ada sesi login', !anonResult.success && anonResult.message.includes('Unauthorized'));

    const memberActorResult = await executeResetMemberPassword(
      { memberId: testMember.id, mode: 'AUTO' },
      'MEMBER' // Role MEMBER mencoba mereset password
    );
    assert('Akses ditolak jika pemanggil ber-role MEMBER', !memberActorResult.success && memberActorResult.message.includes('Unauthorized'));

    const managerActorResult = await executeResetMemberPassword(
      { memberId: testMember.id, mode: 'AUTO' },
      'MANAGER' // Role MANAGER mencoba mereset password
    );
    assert('Akses ditolak jika pemanggil ber-role MANAGER', !managerActorResult.success && managerActorResult.message.includes('Unauthorized'));

    // ── TEST 3: Penolakan Target Selain Role MEMBER ─────────────────────────
    console.log('\n[3] PENGUJIAN PENOLAKAN TARGET SELAIN ROLE MEMBER');
    if (realAdmin) {
      const resetAdminTarget = await executeResetMemberPassword(
        { memberId: realAdmin.id, mode: 'AUTO' },
        'ADMIN'
      );
      assert('Reset password ditolak jika target adalah ADMIN', !resetAdminTarget.success && resetAdminTarget.message.includes('MEMBER'));
    }

    if (realManager) {
      const resetManagerTarget = await executeResetMemberPassword(
        { memberId: realManager.id, mode: 'AUTO' },
        'ADMIN'
      );
      assert('Reset password ditolak jika target adalah MANAGER', !resetManagerTarget.success && resetManagerTarget.message.includes('MEMBER'));
    }

    const invalidIdResult = await executeResetMemberPassword(
      { memberId: 'non-existent-uuid-12345', mode: 'AUTO' },
      'ADMIN'
    );
    assert('Reset password ditolak jika ID anggota tidak ditemukan', !invalidIdResult.success && invalidIdResult.message.includes('tidak ditemukan'));

    // ── TEST 4: Reset Password Otomatis (AUTO) & Enkripsi Bcrypt ────────────
    console.log('\n[4] PENGUJIAN RESET MODE AUTO (PASSWORD SEMENTARA & BCRYPT)');
    const autoResult = await executeResetMemberPassword(
      { memberId: testMember.id, mode: 'AUTO', mustChangePassword: true },
      'ADMIN'
    );

    assert('Reset mode AUTO berhasil', autoResult.success);
    assert('Password sementara dikembalikan ke admin', Boolean(autoResult.temporaryPassword && autoResult.temporaryPassword.length === 12));
    assert('Password sementara tidak mengandung hash bcrypt', !autoResult.temporaryPassword?.startsWith('$2'));

    // Verifikasi di database
    const dbAfterAuto = await prisma.user.findUnique({ where: { id: testMember.id } });
    assert('Database menyimpan hash bcrypt (berawalan $2)', Boolean(dbAfterAuto?.password.startsWith('$2')));
    assert('Database TIDAK menyimpan plaintext password', dbAfterAuto?.password !== autoResult.temporaryPassword);
    assert('Hash password di database cocok dengan password sementara via bcrypt.compare', await bcrypt.compare(autoResult.temporaryPassword!, dbAfterAuto!.password));
    assert('Flag mustChangePassword bernilai true', dbAfterAuto?.mustChangePassword === true);

    // Integritas data lain tetap utuh
    assert('Email tidak berubah', dbAfterAuto?.email === testEmail);
    assert('Role tetap MEMBER', dbAfterAuto?.role === 'MEMBER');
    assert('Status tetap ACTIVE', dbAfterAuto?.status === 'ACTIVE');
    assert('Kontak tidak berubah', dbAfterAuto?.contact === '08999999999');
    assert('Alamat tidak berubah', dbAfterAuto?.address === 'Jl. Uji Coba No. 99');

    // ── TEST 5: Reset Password Manual (MANUAL) ──────────────────────────────
    console.log('\n[5] PENGUJIAN RESET MODE MANUAL');
    // Coba password manual terlalu pendek (< 6)
    const shortPassResult = await executeResetMemberPassword(
      { memberId: testMember.id, mode: 'MANUAL', manualPassword: '123' },
      'ADMIN'
    );
    assert('Password manual < 6 karakter ditolak', !shortPassResult.success && shortPassResult.message.includes('6 karakter'));

    // Password manual valid dengan mustChangePassword = false
    const validManualPassword = 'ManualPasswordBaru123!';
    const manualResult = await executeResetMemberPassword(
      {
        memberId: testMember.id,
        mode: 'MANUAL',
        manualPassword: validManualPassword,
        mustChangePassword: false,
      },
      'ADMIN'
    );

    assert('Reset mode MANUAL berhasil', manualResult.success);
    assert('Hasil mengembalikan password manual', manualResult.temporaryPassword === validManualPassword);

    const dbAfterManual = await prisma.user.findUnique({ where: { id: testMember.id } });
    assert('Hash password manual di database valid via bcrypt.compare', await bcrypt.compare(validManualPassword, dbAfterManual!.password));
    assert('Password lama tidak lagi valid via bcrypt.compare', !(await bcrypt.compare(initialOldPassword, dbAfterManual!.password)));
    assert('Flag mustChangePassword bernilai false sesuai opsi', dbAfterManual?.mustChangePassword === false);

    // ── TEST 6: Verifikasi Alur Login Menggunakan Password Baru ──────────────
    console.log('\n[6] PENGUJIAN VERIFIKASI KREDENSIAL LOGIN');
    // Pengujian verifikasi email & password yang sama dengan logika loginAction
    const userForLogin = await prisma.user.findUnique({ where: { email: testEmail } });
    assert('User ditemukan saat proses login', Boolean(userForLogin));

    const checkCorrectPassword = await bcrypt.compare(validManualPassword, userForLogin!.password);
    assert('Login berhasil dengan password baru', checkCorrectPassword === true);

    const checkOldPassword = await bcrypt.compare(initialOldPassword, userForLogin!.password);
    assert('Login gagal jika menggunakan password lama', checkOldPassword === false);

    const checkWrongPassword = await bcrypt.compare('PasswordAsalNgawur999', userForLogin!.password);
    assert('Login gagal jika menggunakan password salah', checkWrongPassword === false);

    // ── TEST 7: Integritas Akun Nyata Tidak Pernah Disentuh ─────────────────
    console.log('\n[7] PENGUJIAN INTEGRITAS AKUN NYATA');
    const haifaAccount = await prisma.user.findFirst({ where: { email: 'haifa12345@gmail.com' } });
    assert('Akun Haifa tetap ada dan tidak dimodifikasi', Boolean(haifaAccount && haifaAccount.role === 'MEMBER'));

  } finally {
    // Bersihkan data uji terisolasi
    console.log('\n[8] PEMBERSIHAN DATA PENGUJIAN');
    await prisma.notification.deleteMany({ where: { userId: testMember.id } });
    await prisma.user.delete({ where: { id: testMember.id } });
    const checkDeleted = await prisma.user.findUnique({ where: { id: testMember.id } });
    assert('Akun uji terisolasi berhasil dihapus secara bersih dari database', checkDeleted === null);
  }

  console.log('\n' + '='.repeat(75));
  console.log(`HASIL AKHIR: ${passedTests} DARI ${totalTests} PENGUJIAN LULUS (${failedTests} GAGAL)`);
  console.log('='.repeat(75));

  if (failedTests > 0) {
    process.exitCode = 1;
  }
}

runPasswordManagementTests()
  .catch((err) => {
    console.error('Test crashed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
