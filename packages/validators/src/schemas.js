'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.sendMessageInput =
  exports.reviewExecutorInput =
  exports.assignExecutorInput =
  exports.rejectOrderInput =
  exports.priceOrderInput =
  exports.categoryInput =
  exports.executorApplicationInput =
  exports.createOrderInput =
    void 0
var v4_1 = require('zod/v4')
var constants_1 = require('./constants')
var enums_1 = require('./enums')
// User-facing input shapes, shared by the apps (forms) and Convex (arg
// validation). Convex additionally enforces `v.id(...)` integrity server-side,
// so ids are plain strings here.
var id = v4_1.z.string().min(1)
var attachmentIds = v4_1.z.array(id).max(constants_1.MAX_ATTACHMENTS).default([])
exports.createOrderInput = v4_1.z.object({
  categoryId: id,
  description: v4_1.z.string().trim().min(20, 'Опишите проблему подробнее').max(5000),
  attachmentIds: attachmentIds,
})
exports.executorApplicationInput = v4_1.z.object({
  fullName: v4_1.z.string().trim().min(2).max(120),
  bio: v4_1.z.string().trim().min(20).max(2000),
  qualifications: v4_1.z.string().trim().min(10).max(2000),
  categoryIds: v4_1.z.array(id).min(1, 'Выберите хотя бы одну категорию'),
})
exports.categoryInput = v4_1.z.object({
  title: v4_1.z.string().trim().min(2).max(120),
  description: v4_1.z.string().trim().min(2).max(1000),
  basePrice: v4_1.z.int().nonnegative(), // kopecks
  isActive: v4_1.z.boolean(),
  sortOrder: v4_1.z.int(),
})
exports.priceOrderInput = v4_1.z.object({
  orderId: id,
  approvedPrice: v4_1.z.int().positive(), // kopecks
})
exports.rejectOrderInput = v4_1.z.object({
  orderId: id,
  reason: v4_1.z.string().trim().min(3).max(1000),
})
exports.assignExecutorInput = v4_1.z.object({
  orderId: id,
  executorUserId: id,
})
exports.reviewExecutorInput = v4_1.z
  .object({
    profileId: id,
    decision: enums_1.executorStatusSchema.exclude(['pending']),
    rejectionReason: v4_1.z.string().trim().min(3).max(1000).optional(),
  })
  .refine(
    function (v) {
      return v.decision === 'approved' || !!v.rejectionReason
    },
    {
      message: 'Укажите причину отказа',
      path: ['rejectionReason'],
    },
  )
exports.sendMessageInput = v4_1.z.object({
  orderId: id,
  body: v4_1.z.string().trim().min(1).max(4000),
  attachmentIds: attachmentIds,
})
