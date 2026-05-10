import { z } from "zod";

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  YOUSIGN_API_KEY: z.string().min(1).optional(),
  YOUSIGN_WEBHOOK_SECRET: z.string().min(1).optional(),
  YOUSIGN_API_BASE: z.string().url().default("https://api-sandbox.yousign.app/v3"),

  ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/=]+$/).optional(),

  ENABLE_CONTRACT_SIGNATURE: z.enum(["true", "false"]).default("false"),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_STARTER_ANNUAL: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_ANNUAL: z.string().optional(),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().optional(),
  STRIPE_PRICE_BUSINESS_ANNUAL: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_STARTER_ANNUAL: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_PRO_ANNUAL: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_BUSINESS_MONTHLY: z.string().optional(),
  STRIPE_PRICE_EXTRA_SEAT_BUSINESS_ANNUAL: z.string().optional(),

  CRON_SECRET: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/** Appel explicite uniquement quand toutes les variables requises doivent être validées (évite ZodError au `next build`). */
export function getServerEnv(): ServerEnv {
  return ServerEnvSchema.parse(process.env);
}

export const isContractSignatureEnabled = () =>
  process.env.ENABLE_CONTRACT_SIGNATURE === "true";

export const isStripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;
