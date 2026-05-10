// Types généré-équivalents pour le schéma LeadPartner.
// Pour générer automatiquement à partir de Supabase :
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "super_admin" | "company_admin" | "collaborator" | "referrer";
export type SubscriptionPlan = "starter" | "pro" | "business";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";
export type IndustryCode =
  | "real_estate"
  | "construction"
  | "insurance"
  | "credit"
  | "automotive"
  | "training"
  | "b2b_services"
  | "other";

export type OpportunityStatus =
  | "new"
  | "qualified"
  | "assigned"
  | "contacted"
  | "meeting_booked"
  | "proposal_sent"
  | "contract_signed"
  | "sale_closed"
  | "commission_due"
  | "commission_paid"
  | "rejected"
  | "lost";

export type CommissionStatus =
  | "estimated"
  | "due"
  | "validated"
  | "paid"
  | "canceled";

export type CommissionRuleType = "fixed" | "percentage" | "tiered";
export type CommissionBase =
  | "contract_amount"
  | "fees"
  | "signed_quote"
  | "collected_revenue";

export type ContractStatus =
  | "draft"
  | "pending_info"
  | "sent"
  | "signed"
  | "declined"
  | "expired"
  | "canceled";

export type ReferrerStatus = "individual" | "auto_entrepreneur" | "company";

/** Alias hors `Database` pour éviter les références circulaires sur `Insert` / `Update`. */
export type SubscriptionsRow = {
  id: string;
  tenant_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_end: string | null;
  current_period_start: string | null;
  trial_ends_at: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  billing_cycle: "monthly" | "annual";
  included_seats: number;
  extra_seats: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_extra_seat_price_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SeatChangesRow = {
  id: string;
  tenant_id: string;
  type: "add" | "remove";
  member_id: string | null;
  effective_at: string;
  changed_by: string | null;
  proration_amount_cents: number | null;
  stripe_invoice_id: string | null;
  created_at: string;
};

export type StripeEventsRow = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: Json;
  received_at: string;
  processed_at: string | null;
};

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          industry: IndustryCode;
          logo_url: string | null;
          primary_color: string | null;
          custom_domain: string | null;
          subscription_plan: SubscriptionPlan;
          subscription_status: SubscriptionStatus;
          trial_ends_at: string | null;
          legal_name: string | null;
          legal_form: string | null;
          siret: string | null;
          rcs_city: string | null;
          capital: number | null;
          legal_address: string | null;
          representative_name: string | null;
          representative_role: string | null;
          carte_t_number: string | null;
          carte_t_city: string | null;
          caisse_garantie: string | null;
          orias_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tenants"]["Row"]> & {
          name: string;
          slug: string;
          industry: IndustryCode;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Row"]>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          is_super_admin: boolean;
          referrer_status: ReferrerStatus | null;
          birth_date: string | null;
          birth_place: string | null;
          nationality: string | null;
          address: string | null;
          postal_code: string | null;
          city: string | null;
          country: string | null;
          iban_encrypted: string | null;
          bic: string | null;
          social_security_number_encrypted: string | null;
          siret: string | null;
          naf_code: string | null;
          vat_number: string | null;
          vat_applicable: boolean | null;
          company_name: string | null;
          legal_form: string | null;
          rcs_city: string | null;
          capital: number | null;
          legal_representative_name: string | null;
          legal_representative_role: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      tenant_members: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: Exclude<AppRole, "super_admin">;
          status: "active" | "invited" | "suspended";
          referral_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tenant_members"]["Row"]> & {
          tenant_id: string;
          user_id: string;
          role: Exclude<AppRole, "super_admin">;
        };
        Update: Partial<Database["public"]["Tables"]["tenant_members"]["Row"]>;
      };
      programs: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          terms: string | null;
          public_signup_enabled: boolean;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["programs"]["Row"]> & {
          tenant_id: string;
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["programs"]["Row"]>;
      };
      referral_links: {
        Row: {
          id: string;
          tenant_id: string;
          program_id: string;
          owner_user_id: string | null;
          code: string;
          uses_count: number;
          max_uses: number | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["referral_links"]["Row"]> & {
          tenant_id: string;
          program_id: string;
          code: string;
        };
        Update: Partial<Database["public"]["Tables"]["referral_links"]["Row"]>;
      };
      opportunities: {
        Row: {
          id: string;
          tenant_id: string;
          program_id: string | null;
          referrer_id: string | null;
          assignee_id: string | null;
          status: OpportunityStatus;
          prospect_name: string;
          prospect_email: string | null;
          prospect_phone: string | null;
          city: string | null;
          address: string | null;
          description: string | null;
          estimated_value: number | null;
          urgency: "low" | "medium" | "high" | null;
          comment: string | null;
          custom_fields: Json;
          closed_value: number | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["opportunities"]["Row"]> & {
          tenant_id: string;
          prospect_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["opportunities"]["Row"]>;
      };
      opportunity_fields: {
        Row: {
          id: string;
          tenant_id: string;
          industry: IndustryCode;
          key: string;
          label: string;
          type: "text" | "number" | "select" | "date" | "boolean";
          options: Json;
          required: boolean;
          sort_order: number;
        };
        Insert: Partial<Database["public"]["Tables"]["opportunity_fields"]["Row"]> & {
          tenant_id: string;
          industry: IndustryCode;
          key: string;
          label: string;
          type: "text" | "number" | "select" | "date" | "boolean";
        };
        Update: Partial<Database["public"]["Tables"]["opportunity_fields"]["Row"]>;
      };
      opportunity_status_history: {
        Row: {
          id: string;
          opportunity_id: string;
          tenant_id: string;
          from_status: OpportunityStatus | null;
          to_status: OpportunityStatus;
          note: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["opportunity_status_history"]["Row"]
        > & {
          opportunity_id: string;
          tenant_id: string;
          to_status: OpportunityStatus;
        };
        Update: Partial<
          Database["public"]["Tables"]["opportunity_status_history"]["Row"]
        >;
      };
      commission_rules: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          type: CommissionRuleType;
          base: CommissionBase;
          fixed_amount: number | null;
          percentage: number | null;
          tiers: Json;
          is_default: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["commission_rules"]["Row"]> & {
          tenant_id: string;
          name: string;
          type: CommissionRuleType;
          base: CommissionBase;
        };
        Update: Partial<Database["public"]["Tables"]["commission_rules"]["Row"]>;
      };
      commissions: {
        Row: {
          id: string;
          tenant_id: string;
          opportunity_id: string;
          referrer_id: string;
          rule_id: string | null;
          status: CommissionStatus;
          amount: number;
          base_amount: number | null;
          notes: string | null;
          due_at: string | null;
          paid_at: string | null;
          validated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["commissions"]["Row"]> & {
          tenant_id: string;
          opportunity_id: string;
          referrer_id: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["commissions"]["Row"]>;
      };
      documents: {
        Row: {
          id: string;
          tenant_id: string;
          opportunity_id: string | null;
          uploader_id: string | null;
          file_name: string;
          file_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["documents"]["Row"]> & {
          tenant_id: string;
          file_name: string;
          file_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Row"]>;
      };
      subscriptions: {
        Row: SubscriptionsRow;
        Insert: Partial<SubscriptionsRow> & {
          tenant_id: string;
          plan: SubscriptionPlan;
        };
        Update: Partial<SubscriptionsRow>;
      };
      seat_changes: {
        Row: SeatChangesRow;
        Insert: Partial<SeatChangesRow> & {
          tenant_id: string;
          type: "add" | "remove";
        };
        Update: Partial<SeatChangesRow>;
      };
      stripe_events: {
        Row: StripeEventsRow;
        Insert: Partial<StripeEventsRow> & {
          stripe_event_id: string;
          event_type: string;
          payload: Json;
        };
        Update: Partial<StripeEventsRow>;
      };
      invitations: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          role: Exclude<AppRole, "super_admin">;
          token: string;
          accepted_at: string | null;
          invited_by: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["invitations"]["Row"]> & {
          tenant_id: string;
          email: string;
          role: Exclude<AppRole, "super_admin">;
          token: string;
          expires_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["invitations"]["Row"]>;
      };
      contracts: {
        Row: {
          id: string;
          tenant_id: string;
          member_id: string;
          status: ContractStatus;
          yousign_signature_request_id: string | null;
          yousign_document_id: string | null;
          unsigned_pdf_path: string | null;
          signed_pdf_path: string | null;
          contract_data: Json;
          sent_at: string | null;
          signed_at: string | null;
          expires_at: string | null;
          canceled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contracts"]["Row"]> & {
          tenant_id: string;
          member_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["contracts"]["Row"]>;
      };
      yousign_events: {
        Row: {
          id: string;
          yousign_event_id: string;
          event_type: string;
          signature_request_id: string | null;
          payload: Json;
          received_at: string;
          processed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["yousign_events"]["Row"]> & {
          yousign_event_id: string;
          event_type: string;
          payload: Json;
        };
        Update: Partial<Database["public"]["Tables"]["yousign_events"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_tenant_id: { Args: Record<string, never>; Returns: string | null };
      is_member_of: { Args: { tid: string }; Returns: boolean };
      is_admin_of: { Args: { tid: string }; Returns: boolean };
      count_paid_seats: { Args: { t: string }; Returns: number };
      seats_remaining: { Args: { t: string }; Returns: number };
      tenant_slug_available: { Args: { p_slug: string }; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      industry_code: IndustryCode;
      opportunity_status: OpportunityStatus;
      commission_status: CommissionStatus;
      commission_rule_type: CommissionRuleType;
      commission_base: CommissionBase;
      subscription_plan: SubscriptionPlan;
      subscription_status: SubscriptionStatus;
      contract_status: ContractStatus;
      referrer_status: ReferrerStatus;
    };
  };
}
