'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/session';

export async function createCategoryAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { success: false, message: 'Unauthorized' };
  }

  const name = formData.get('name') as string;
  const unit = formData.get('unit') as string;
  const priceStr = formData.get('pricePerKg') as string;

  if (!name || name.trim() === '') {
    return { success: false, message: 'Nama jenis sampah wajib diisi.' };
  }

  const pricePerKg = parseFloat(priceStr);
  if (isNaN(pricePerKg) || pricePerKg < 0) {
    return { success: false, message: 'Harga per satuan tidak valid atau negatif.' };
  }

  try {
    const existing = await prisma.wasteCategory.findFirst({
      where: { name: { equals: name.trim() } },
    });
    if (existing) {
      return { success: false, message: 'Jenis sampah dengan nama tersebut sudah ada.' };
    }

    await prisma.wasteCategory.create({
      data: {
        name: name.trim(),
        unit: unit.trim() || 'kg',
        pricePerKg,
      },
    });

    revalidatePath('/admin/kategori');
    return { success: true, message: 'Jenis sampah berhasil ditambahkan.' };
  } catch (error) {
    console.error('Error creating category:', error);
    return { success: false, message: 'Terjadi kesalahan sistem.' };
  }
}

export async function updateCategoryAction(id: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { success: false, message: 'Unauthorized' };
  }

  const name = formData.get('name') as string;
  const unit = formData.get('unit') as string;
  const priceStr = formData.get('pricePerKg') as string;

  if (!name || name.trim() === '') {
    return { success: false, message: 'Nama jenis sampah wajib diisi.' };
  }

  const pricePerKg = parseFloat(priceStr);
  if (isNaN(pricePerKg) || pricePerKg < 0) {
    return { success: false, message: 'Harga per satuan tidak valid atau negatif.' };
  }

  try {
    const existing = await prisma.wasteCategory.findFirst({
      where: {
        name: { equals: name.trim() },
        id: { not: id },
      },
    });
    if (existing) {
      return { success: false, message: 'Jenis sampah dengan nama tersebut sudah ada.' };
    }

    await prisma.wasteCategory.update({
      where: { id },
      data: {
        name: name.trim(),
        unit: unit.trim() || 'kg',
        pricePerKg,
      },
    });

    revalidatePath('/admin/kategori');
    return { success: true, message: 'Jenis sampah berhasil diperbarui.' };
  } catch (error) {
    console.error('Error updating category:', error);
    return { success: false, message: 'Terjadi kesalahan sistem.' };
  }
}

export async function toggleCategoryStatusAction(id: string, currentStatus: boolean) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { success: false, message: 'Unauthorized' };
  }

  try {
    await prisma.wasteCategory.update({
      where: { id },
      data: { isActive: !currentStatus },
    });

    revalidatePath('/admin/kategori');
    return { success: true, message: 'Status kategori berhasil diubah.' };
  } catch (error) {
    console.error('Error toggling category status:', error);
    return { success: false, message: 'Terjadi kesalahan sistem.' };
  }
}
