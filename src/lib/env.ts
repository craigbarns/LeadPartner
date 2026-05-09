import { z } from 'zod'

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  YOUSIGN_API_KEY: z.string().min(1).optional(),
  YOUSIGN_WEBHOOK_SECRET: z.string().min(1).optional(),
  YOUSIGN_API_BASE: z.string().url().default('https://api-sandbox.yousign.app/v3'),

  ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/=]+$/).optional(),

  ENABLE_CONTRACT_SIGNATURE: z.enum(['true', 'false']).default('false'),
})

export const serverEnv = ServerEnvSchema.parse(process.env)

export const isContractSignatureEnabled = () =>
  serverEnv.ENABLE_CONTRACT_SIGNATURE === 'true'
