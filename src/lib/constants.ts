import type {
  AppRole,
  CommissionStatus,
  IndustryCode,
  OpportunityStatus,
  SubscriptionPlan,
} from "@/types/database";

export const INDUSTRIES: { value: IndustryCode; label: string; emoji: string }[] = [
  { value: "real_estate", label: "Immobilier", emoji: "🏠" },
  { value: "construction", label: "Travaux & rénovation", emoji: "🔨" },
  { value: "insurance", label: "Assurance", emoji: "🛡️" },
  { value: "credit", label: "Crédit & financement", emoji: "💳" },
  { value: "automotive", label: "Automobile", emoji: "🚗" },
  { value: "training", label: "Formation", emoji: "🎓" },
  { value: "b2b_services", label: "Services B2B", emoji: "💼" },
  { value: "other", label: "Autre", emoji: "✨" },
];

export const OPPORTUNITY_STATUSES: {
  value: OpportunityStatus;
  label: string;
  color: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}[] = [
  { value: "new", label: "Nouveau", color: "default" },
  { value: "qualified", label: "Qualifié", color: "secondary" },
  { value: "assigned", label: "Attribué", color: "secondary" },
  { value: "contacted", label: "Contacté", color: "secondary" },
  { value: "meeting_booked", label: "RDV pris", color: "warning" },
  { value: "proposal_sent", label: "Proposition envoyée", color: "warning" },
  { value: "contract_signed", label: "Contrat signé", color: "success" },
  { value: "sale_closed", label: "Vente réalisée", color: "success" },
  { value: "commission_due", label: "Commission due", color: "warning" },
  { value: "commission_paid", label: "Commission payée", color: "success" },
  { value: "rejected", label: "Refusé", color: "destructive" },
  { value: "lost", label: "Perdu", color: "destructive" },
];

export const COMMISSION_STATUSES: {
  value: CommissionStatus;
  label: string;
  color: "default" | "secondary" | "success" | "warning" | "destructive";
}[] = [
  { value: "estimated", label: "Estimée", color: "default" },
  { value: "due", label: "Due", color: "warning" },
  { value: "validated", label: "Validée", color: "secondary" },
  { value: "paid", label: "Payée", color: "success" },
  { value: "canceled", label: "Annulée", color: "destructive" },
];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super administrateur",
  company_admin: "Administrateur entreprise",
  collaborator: "Collaborateur",
  referrer: "Apporteur d'affaires",
};

export const PLANS: {
  value: SubscriptionPlan;
  label: string;
  monthly_price: number;
  annual_price: number;
  included_seats: number;
  extra_seat_monthly: number;
  features: string[];
  cta: string;
}[] = [
  {
    value: "starter",
    label: "Starter",
    monthly_price: 29,
    annual_price: 296,
    included_seats: 3,
    extra_seat_monthly: 12,
    features: [
      "1 admin + 2 collaborateurs",
      "Apporteurs illimités",
      "Branding personnalisé",
      "Signature de contrats Yousign",
      "Support email",
    ],
    cta: "Choisir Starter",
  },
  {
    value: "pro",
    label: "Pro",
    monthly_price: 79,
    annual_price: 806,
    included_seats: 6,
    extra_seat_monthly: 9,
    features: [
      "1 admin + 5 collaborateurs",
      "Apporteurs illimités",
      "Branding personnalisé",
      "Signature de contrats Yousign",
      "Support prioritaire",
      "Sièges supplémentaires +9 €/mois",
    ],
    cta: "Choisir Pro",
  },
  {
    value: "business",
    label: "Business",
    monthly_price: 199,
    annual_price: 2030,
    included_seats: 16,
    extra_seat_monthly: 6,
    features: [
      "1 admin + 15 collaborateurs",
      "Apporteurs illimités",
      "Branding personnalisé",
      "Signature de contrats Yousign",
      "Support dédié",
      "Sièges supplémentaires +6 €/mois (dégressif)",
    ],
    cta: "Choisir Business",
  },
];

export function statusLabel(status: OpportunityStatus | null | undefined) {
  if (!status) return "—";
  return OPPORTUNITY_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function statusColor(status: OpportunityStatus | null | undefined) {
  if (!status) return "default" as const;
  return OPPORTUNITY_STATUSES.find((s) => s.value === status)?.color ?? "default";
}

export function commissionStatusLabel(status: CommissionStatus | null | undefined) {
  if (!status) return "—";
  return COMMISSION_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function commissionStatusColor(status: CommissionStatus | null | undefined) {
  if (!status) return "default" as const;
  return COMMISSION_STATUSES.find((s) => s.value === status)?.color ?? "default";
}

export function industryLabel(industry: IndustryCode | null | undefined) {
  if (!industry) return "—";
  return INDUSTRIES.find((i) => i.value === industry)?.label ?? industry;
}
