export type Money = number;

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role?: string;
  is_active?: boolean;
}

export interface Client {
  id: number;
  name: string;
  company_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  gst_number?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
  website?: string;
  notes?: string;
  status?: string;
  created_at?: string;
}

export interface Service {
  id: number;
  name: string;
  category_id?: number;
  category?: string;
  description?: string;
  price: number;
  gst_rate: number;
  unit?: string;
  hsn_sac?: string;
  status?: string;
}

export interface InvoiceItem {
  id?: number;
  service_id?: number | null;
  description?: string;
  quantity: number;
  unit?: string;
  rate: number;
  discount?: number;
  tax_rate: number;
  amount?: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  client?: string;
  client_data?: Client | null;
  project_id?: number | null;
  invoice_date: string;
  due_date?: string | null;
  currency: string;
  payment_terms?: string;
  notes?: string;
  terms?: string;
  subtotal: Money;
  discount: Money;
  tax: Money;
  cgst: Money;
  sgst: Money;
  igst: Money;
  extra_charges: Money;
  round_off: Money;
  grand_total: Money;
  amount_paid: Money;
  balance_due: Money;
  status: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  authorized_signatory?: string;
  created_at?: string;
}

export interface Payment {
  id: number;
  invoice_id: number;
  payment_date: string;
  amount: number;
  method?: string;
  transaction_id?: string;
  reference_number?: string;
  notes?: string;
}

export interface DashboardStats {
  today_revenue: number;
  monthly_revenue: number;
  yearly_revenue: number;
  pending: number;
  paid: number;
  overdue: number;
  total_clients: number;
  active_clients: number;
  inactive_clients: number;
  projects_running: number;
  projects_completed: number;
  invoices_generated: number;
  gst_collected: number;
  monthly: { month: string; revenue: number }[];
  status_pie: { status: string; count: number }[];
  latest_invoices: Invoice[];
  latest_clients: Client[];
  upcoming_due: Invoice[];
}
