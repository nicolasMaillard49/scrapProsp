export type Status = "todo" | "called" | "positive" | "negative" | "no_answer";

export interface Prospect {
  id: string;
  name: string;
  metier: string;
  phone: string;
  ville: string;
  departement: string;
  region: string;
  region_label: string | null;
  rating: number | null;
  reviews: number | null;
  hours_status: string | null;
  address: string | null;
  maps_url: string;
  siret: string | null;
  company_created_at: string | null;
  age_years: number | null;
  legal_status: string | null;
  naf_code: string | null;
  status: Status;
  notes: string;
  created_at: string;
  updated_at: string;
  calls?: Call[];
}

export interface Call {
  id: string;
  prospect_id: string;
  called_at: string;
  status: Status;
  duration: number | null;
  note: string | null;
  created_at: string;
}

export interface CompetitorResult {
  name: string;
  rating: number | null;
  reviews: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  category: string | null;
  gbp_score: number;
}

export interface AdsTierResult {
  key: string;
  label: string;
  desc: string;
  budget: number;
}

export interface CompetitorReport {
  id: string;
  prospect_id: string;
  ville: string;
  metier: string;
  competitors: CompetitorResult[];
  ads_budget_est: number | null;
  ads_tiers?: AdsTierResult[];
  limit_used: number;
  created_at: string;
}
