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

const KB = 1024
const MB = KB * 1024

export const MAX_FILE_SIZE_BYTES = 10 * MB

const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'apk',
  'bat',
  'cmd',
  'com',
  'scr',
  'pif',
  'vbs',
  'jar',
  'msi',
  'dll',
  'ps1',
  'sh',
  'deb',
  'rpm',
  'dmg',
  'pkg',
  'ipa',
  'xap',
  'app',
])

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
  'bmp',
  'svg',
  'avif',
])

export function getFileExtension(name: string): string {
  const i = name.lastIndexOf('.')
  if (i <= 0 || i === name.length - 1) return ''
  return name.slice(i + 1).toLowerCase()
}

export function isImageFile(type: string, name: string): boolean {
  if (type.startsWith('image/')) return true
  return IMAGE_EXTENSIONS.has(getFileExtension(name))
}

export type ValidationResult = { ok: true } | { ok: false; reason: string }

export function validateFile(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: `Файл «${file.name}» больше 10 МБ` }
  }
  const ext = getFileExtension(file.name)
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `Файл «.${ext}» нельзя загрузить` }
  }
  return { ok: true }
}

/**
 * Pumps a File through Convex storage:
 *   1. asks the backend for a short-lived signed URL (`generateUploadUrl`)
 *   2. POSTs the raw bytes
 *   3. hands the `_storage` id back to the caller
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
