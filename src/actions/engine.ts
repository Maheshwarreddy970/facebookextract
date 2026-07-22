// src/actions/engine.ts
'use server';

import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { ApifyClient } from 'apify-client';

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dvean8ert',
  api_key: '614915691241462',
  api_secret: 'enzhjwaqN7UhvtgIkyCpM7_qRR8'
});

// Configure Apify
const apifyClient = new ApifyClient({
  token: 'apify_api_SoNIAG1xuFYPPzs3eZEenIedgryI7a3xcivO',
});

export async function processNextPendingRecord() {
  // 1. Fetch ONLY the next pending record, ordered by ID so it reliably resumes
  const record = await prisma.facebookData.findFirst({
    where: { logoStatus: 'pending' },
    orderBy: { id: 'asc' } 
  });
console.log(record);
  if (!record) {
    return { status: 'complete', message: 'No more pending records.' };
  }

  try {
    // 2. Call Apify
    const run = await apifyClient.actor("apify/facebook-pages-scraper").call({
      startUrls: [{ url: record.Facebook }]
    });
    
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0 || !items[0]) {
      throw new Error("Apify returned empty items. Page might be private.");
    }

    const data = items[0] as any; // Type-cast to bypass TS strictness on unknown Apify output

    // 3. Extract the image URL prioritizing the exact key you found
    let profilePicUrl = 
      data.profilePictureUrl || 
      data.profilePicture || 
      data.profilePic || 
      data.profilePicUrl || 
      data.image || 
      data.avatar;

    // Sometimes APIs nest the URL inside an object (e.g., { url: "https..." })
    if (typeof profilePicUrl === 'object' && profilePicUrl !== null) {
      profilePicUrl = profilePicUrl.url || profilePicUrl.src;
    }

    // 🔥 PREVENT CLOUDINARY CRASH: Enforce strict string type
    if (!profilePicUrl || typeof profilePicUrl !== 'string') {
      console.error(`Invalid image data for ${record.Facebook}:`, JSON.stringify(data));
      throw new Error("Could not extract a valid string URL for the profile picture.");
    }

    // 4. Upload to Cloudinary & Remove Background
    const uploadResult = await cloudinary.uploader.upload(profilePicUrl, {
      folder: 'facebookurl',
      background_removal: "cloudinary_ai", 
    });

    // 5. Update Database on Success
    await prisma.facebookData.update({
      where: { id: record.id },
      data: {
        logoUrl: uploadResult.secure_url,
        logoStatus: 'success',
        logoChecked: true
      }
    });

    return { status: 'processing', message: `✅ Success: Processed ${record.Facebook}` };

  } catch (error: any) {
    console.error(`❌ Error processing ${record.Facebook}:`, error.message);

    const isRateLimit = 
      error?.message?.includes('429') || 
      error?.http_code === 429 || 
      error?.response?.status === 429;

    // If it's a rate limit, leave it pending so it retries later
    if (isRateLimit) {
      return { 
        status: 'rate_limit', 
        message: 'API Rate limit exceeded. Pausing before retry...' 
      };
    }

    // For any other error (bad URL, private profile, Apify crash), mark as failed so the engine doesn't get permanently stuck on it
    await prisma.facebookData.update({
      where: { id: record.id },
      data: { logoStatus: 'failed' }
    });
    
    return { status: 'error', message: `Failed: ${error.message}` };
  }
}