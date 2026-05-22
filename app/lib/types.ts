export type Status = "todo" | "called" | "positive" | "negative";

export interface Prospect {
  name: string;
  metier: string;
  phone: string;
  ville: string;
  departement: string;
  region: string;
  region_label?: string;
  rating: string;
  reviews: string;
  hours_status?: string;
  is_open_now?: string;
  address?: string;
  maps_url: string;
  siret?: string;
  created_at?: string;
  age_years?: string;
  legal_status?: "actif" | "radie" | "inconnu" | "";
  naf_code?: string;
}

export interface ProspectState {
  status: Status;
  notes: string;
  calledAt?: string;
  callDuration?: number;
  callHistory?: Array<{ at: string; status: Status; duration?: number; note?: string }>;
}

export interface RegionEntry {
  key: string;
  label: string;
  csv: string;
  total: number;
  plombiers: number;
  electriciens: number;
}

export interface Manifest {
  regions: RegionEntry[];
  generated_at: string;
}
