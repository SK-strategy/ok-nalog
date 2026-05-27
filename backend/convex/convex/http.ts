import { httpRouter } from 'convex/server'

import { authComponent, createAuth } from './auth'

const http = httpRouter()

// Mounts /api/auth/* — sign-in/callback/session/etc. — on the Convex
// HTTP actions origin (CONVEX_SITE_ORIGIN, port 3311 locally).
authComponent.registerRoutesLazy(http, createAuth, { cors: true })

export default http
