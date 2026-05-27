import { defineComponent } from 'convex/server'

// Local better-auth component — replaces @convex-dev/better-auth/convex.config
// because we need a schema with the telegram-plugin fields. Convex regenerates
// the adapter's validators from `./schema.ts`.
const component = defineComponent('betterAuth')

export default component
