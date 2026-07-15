'use server';

import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma'; 

export async function seedJsonAction() {
  try {
    const jsonPath = path.join(process.cwd(), 'src', 'data', 'test.json');
    const fileContent = await fs.readFile(jsonPath, 'utf-8');
    const websites = JSON.parse(fileContent);

    const result = await prisma.facebookData.createMany({
      data: websites.map((site: any, index: number) => ({
        row_number: index + 1,
        Facebook: site.Facebook,
        logoUrl: site.logoUrl || "",
        logoShape: site.logoShape || "unknown",
        logoStatus: site.logoStatus || "pending",
        logoChecked: site.logoChecked === "TRUE" || site.logoChecked === true,
      })),
      skipDuplicates: true, 
    });

    return { success: true, message: `Inserted ${result.count} new records.` };
  } catch (error: any) {
    console.error("Seeding failed:", error);
    return { success: false, message: error.message };
  }
}