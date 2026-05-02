export type LoadStatus =
  | 'WAITING_DISPATCH'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'INVOICED'
  | 'PAID';

export interface Company {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  invoice_prefix?: string;
  subscription_status?: string;
}

export interface User {
  id: string;
  company_id: string;
  email: string;
  name: string;
  role: 'admin' | 'driver';
  is_active: boolean;
}

export interface Driver {
  id: string;
  company_id: string;
  name: string;
  phone?: string;
  email?: string;
  license_number?: string;
  license_expiry?: string;
  status: 'available' | 'on_route' | 'off_duty';
}

export interface Customer {
  id: string;
  company_id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface Load {
  id: string;
  company_id: string;
  load_number: string;
  status: LoadStatus;
  driver_id?: string;
  customer_id?: string;
  driver?: Driver;
  customer?: Customer;
  origin_address?: string;
  origin_city?: string;
  origin_state?: string;
  dest_address?: string;
  dest_city?: string;
  dest_state?: string;
  pickup_date?: string;
  delivery_date?: string;
  rate?: number;
  extra_stop_fee?: number;
  lumper_fee?: number;
  cargo_description?: string;
  bol_number?: string;
  acceptance_token?: string;
  accepted_at?: string;
  delivered_at?: string;
  created_at?: string;
  driver_name?: string;
  customer_name?: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  load_id: string;
  invoice_number: string;
  amount: number;
  status: 'UNPAID' | 'PAID';
  paid_at?: string;
  payment_method?: string;
  created_at?: string;
  load?: Load;
}
