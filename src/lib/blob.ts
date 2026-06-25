import { supabase } from './supabase'

// Uploads a file via the `blob-upload` Supabase edge function, which proxies to
// the ClaimTec blob-storage API server-side (keeping its credentials off the
// client). Returns the public file URL. The user's session JWT is attached
// automatically by supabase-js.
export async function uploadToBlob(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)

  const { data, error } = await supabase.functions.invoke<{ fileUrl?: string; error?: string }>(
    'blob-upload',
    { body: form },
  )
  if (error) throw new Error(error.message)
  if (!data?.fileUrl) throw new Error(data?.error || 'Upload failed')
  return data.fileUrl
}
