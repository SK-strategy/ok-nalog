'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'

import type { Id } from '~/shared/api'
import { api } from '~/shared/api'

export interface UploadedFile {
  id: Id<'_storage'>
  name: string
  size: number
  type: string
}

/**
 * Pumps a File through Convex storage by:
 *  1. asking the backend for a short-lived signed URL (`generateUploadUrl`)
 *  2. POSTing the raw bytes to that URL
 *  3. handing the resulting `_storage` id back to the caller, which stores
 *     it alongside the description so the order references the upload.
 *
 * Errors surface via `error`; concurrent uploads keep their own state.
 */
export function useUpload() {
  const generateUrl = useMutation(api.files.generateUploadUrl)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File): Promise<UploadedFile | null> {
    setUploading((n) => n + 1)
    setError(null)
    try {
      const url = await generateUrl()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const { storageId } = (await res.json()) as { storageId: Id<'_storage'> }
      return { id: storageId, name: file.name, size: file.size, type: file.type }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить файл')
      return null
    } finally {
      setUploading((n) => Math.max(0, n - 1))
    }
  }

  return { upload, uploading: uploading > 0, error }
}
