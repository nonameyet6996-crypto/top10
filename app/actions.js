"use server";

import { put, get } from "@vercel/blob";

// The "key" we use to find your specific data in Blob Storage
const STORE_KEY = "rc-top-10-photos.json";

// 1. Upload a new photo file to Vercel Blob Storage
export async function uploadPhoto(formData) {
  // Security Check: Grab the password from the upload request
  const password = formData.get("password");
  
  // Compare it to the secret password in your .env.local file
  if (password !== process.env.ADMIN_PASSWORD) {
    return { success: false, error: "Incorrect password" };
  }

  const file = formData.get("file");
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  // Upload the image to Vercel Blob (set to public so visitors can see it)
  try {
    const blob = await put(`top10/${Date.now()}-${file.name}`, file, { 
      access: "public" 
    });
    return { success: true, url: blob.url };
  } catch (error) {
    console.error("Blob upload failed:", error);
    return { success: false, error: "Failed to upload image" };
  }
}

// 2. Fetch the photos when anyone visits the page
export async function getRankings() {
  try {
    const response = await get(STORE_KEY);
    if (!response) {
      return null;
    }
    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to fetch rankings:", error);
    return null;
  }
}

// 3. Save the new order of photos to the database
export async function saveRankings(photos, password) {
  // Security Check: Only allow saves if the password matches
  if (password !== process.env.ADMIN_PASSWORD) {
    return { success: false, error: "Incorrect password" };
  }
  
  try {
    await put(STORE_KEY, JSON.stringify(photos), { 
      access: "private",
      contentType: "application/json"
    });
    return { success: true };
  } catch (error) {
    console.error("Blob save failed:", error);
    return { success: false, error: "Failed to save rankings" };
  }
}
