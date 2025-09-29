import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase
const SUPABASE_URL = 'https://jkvthdkqqckhipdlnpuk.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdnRoZGtxcWNraGlwZGxucHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTU2NTQsImV4cCI6MjA2NzQ5MTY1NH0.jQHWBy-jKpocqiRcgb3caYicjJPa-3tCpWkVdK7Y3Wg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Upload a file to Supabase Storage
 * Replaces any existing file with the same base name (ignores extension)
 * @param {File} file - File object from input
 * @param {string} bucket - Supabase bucket name
 * @param {string} path - Path to save file inside bucket (e.g., "profileImages/user123.png")
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export async function uploadFile(file, bucket, path) {
  if (!file) throw new Error("No file provided");

  const parts = path.split("/");
  const filename = parts.pop();
  const folder = parts.join("/");
  const baseName = filename.split(".")[0];
  const newExt = filename.split(".").pop();

  // List all files in folder
  const { data: files, error: listError } = await supabase.storage
    .from(bucket)
    .list(folder || "", { limit: 1000 });

  if (listError) throw listError;

  // Delete old files with same base name but different extension
  const toDelete = files
    .filter(f => {
      const fBase = f.name.split(".")[0];
      const fExt = f.name.split(".").pop();
      return fBase === baseName && fExt !== newExt;
    })
    .map(f => (folder ? `${folder}/${f.name}` : f.name));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase.storage.from(bucket).remove(toDelete);
    if (deleteError) throw deleteError;
  }

  // Upload new file
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: true });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: publicUrlData, error: urlError } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  if (urlError) throw urlError;

  return publicUrlData.publicUrl;
}
