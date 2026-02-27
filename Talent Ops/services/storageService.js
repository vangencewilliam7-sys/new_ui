import { supabase } from '../lib/supabaseClient';

/**
 * Storage Service
 * Responsibility: Handles all file-related operations with Supabase Storage.
 * Follows SRP (Single Responsibility Principle).
 */

/**
 * Sanitizes a filename for storage consistency while keeping it "normal".
 * Only removes characters that are known to cause S3/Supabase 400 errors (like brackets).
 * Keeps spaces (optionally replaces with underscores for safety).
 */
export const sanitizeFileName = (fileName) => {
    if (!fileName) return `file_${Date.now()}`;

    // Replace characters that break S3/Supabase keys: [ ] { }
    // These are often the cause of "400 Bad Request" in storage uploads
    return fileName
        .replace(/[\[\]{}]/g, '') // Remove brackets/braces
        .replace(/\s+/g, '_');    // Replace spaces with underscores for URL safety
};

/**
 * Uploads a file to a specific bucket with path grouping.
 * Grouping by path (e.g. org/user/task/) makes the filenames look "normal".
 */
export const uploadFile = async ({ bucket, path, file }) => {
    try {
        // 1. PROACTIVE AUTH CHECK: This prevents "failing after some days"
        // by forcing a session refresh right before the high-stakes upload.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            throw new Error('Your session has expired. Please refresh the page and log in again.');
        }

        // 2. PATH VALIDATION: Ensure we aren't creating a "null" path which triggers 400 errors
        if (path && (path.includes('undefined') || path.includes('null'))) {
            console.warn('StorageService: Malformed path detected:', path);
            // We can try to repair or just warn, but usually this means context is stale
        }

        const cleanName = sanitizeFileName(file.name);

        // We put the uniqueness in the path and a timestamp prefix
        // This avoids the "long string of random letters" in the actual filename
        const fileName = `${Date.now()}_${cleanName}`;
        const filePath = path ? `${path}/${fileName}` : fileName;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);

        return {
            publicUrl,
            fileName: file.name,
            storagePath: filePath
        };
    } catch (error) {
        console.error('StorageService: Upload failed:', error.message);
        throw error;
    }
};

/**
 * Bulk upload helper for multiple files.
 */
export const uploadMultipleFiles = async ({ bucket, path, files, onProgress }) => {
    const results = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
        const file = files[i];

        const progressStart = (i / total) * 100;
        onProgress?.(progressStart);

        const result = await uploadFile({ bucket, path, file });
        results.push({
            ...result,
            fileType: file.type || 'application/octet-stream'
        });

        const progressEnd = ((i + 1) / total) * 100;
        onProgress?.(progressEnd);
    }

    return results;
};
