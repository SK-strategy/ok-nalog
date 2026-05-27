import { z } from 'zod/v4'

import { MAX_ATTACHMENTS } from './constants'
import { executorStatusSchema } from './enums'

// User-facing input shapes, shared by the apps (forms) and Convex (arg
// validation). Convex additionally enforces `v.id(...)` integrity server-side,
// so ids are plain strings here.

const id = z.string().min(1)
const attachmentIds = z.array(id).max(MAX_ATTACHMENTS).default([])

export const createOrderInput = z.object({
  categoryId: id,
  description: z.string().trim().min(20, 'Опишите проблему подробнее').max(5000),
  attachmentIds,
})
export type CreateOrderInput = z.infer<typeof createOrderInput>

export const executorApplicationInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  bio: z.string().trim().min(20).max(2000),
  qualifications: z.string().trim().min(10).max(2000),
  categoryIds: z.array(id).min(1, 'Выберите хотя бы одну категорию'),
})
export type ExecutorApplicationInput = z.infer<typeof executorApplicationInput>

export const categoryInput = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(1000),
  basePrice: z.int().nonnegative(), // kopecks
  isActive: z.boolean(),
  sortOrder: z.int(),
})
export type CategoryInput = z.infer<typeof categoryInput>

export const priceOrderInput = z.object({
  orderId: id,
  approvedPrice: z.int().positive(), // kopecks
})
export type PriceOrderInput = z.infer<typeof priceOrderInput>

export const rejectOrderInput = z.object({
  orderId: id,
  reason: z.string().trim().min(3).max(1000),
})
export type RejectOrderInput = z.infer<typeof rejectOrderInput>

export const assignExecutorInput = z.object({
  orderId: id,
  executorUserId: id,
})
export type AssignExecutorInput = z.infer<typeof assignExecutorInput>

export const reviewExecutorInput = z
  .object({
    profileId: id,
    decision: executorStatusSchema.exclude(['pending']),
    rejectionReason: z.string().trim().min(3).max(1000).optional(),
  })
  .refine((v) => v.decision === 'approved' || !!v.rejectionReason, {
    message: 'Укажите причину отказа',
    path: ['rejectionReason'],
  })
export type ReviewExecutorInput = z.infer<typeof reviewExecutorInput>

export const sendMessageInput = z.object({
  orderId: id,
  body: z.string().trim().min(1).max(4000),
  attachmentIds,
})
export type SendMessageInput = z.infer<typeof sendMessageInput>
