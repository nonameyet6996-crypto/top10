"use server";

import { put } from "@vercel/blob";
import { kv } from "@vercel/kv";

// The "key" we use to find your specific data in the KV database
const STORE_KEY = "rc-top-10-photos";

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
    const data = await kv.get(STORE_KEY);
    return data; // Returns the array of photos, or null if it's empty
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
    await kv.set(STORE_KEY, photos);
    return { success: true };
  } catch (error) {
    console.error("KV save failed:", error);
    return { success: false, error: "Failed to save rankings" };
  }
}