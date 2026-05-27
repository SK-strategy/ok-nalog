import { createApi } from '@convex-dev/better-auth'

import { createAuthOptions } from '../auth'
import schema from './schema'

// Exposes the better-auth adapter CRUD as Convex mutations/queries on this
// local component. The validators on these functions are derived from our
// `schema`, so the telegram-plugin fields (telegramId, telegramUsername,
// telegramPhoneNumber) and our `role` additionalField are accepted.
export const { create, findOne, findMany, updateOne, updateMany, deleteOne, deleteMany } =
  createApi(schema, createAuthOptions)
