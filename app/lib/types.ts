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
