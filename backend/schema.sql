-- Reference MySQL schema for the Invoice Management System.
-- SQLAlchemy will create these tables automatically on first run;
-- this file is provided for DBAs who prefer to provision manually.

CREATE DATABASE IF NOT EXISTS invoicedb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE invoicedb;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255)
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40),
  avatar VARCHAR(255),
  role_id INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  reset_token VARCHAR(120),
  reset_token_expiry DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  company_name VARCHAR(200),
  contact_person VARCHAR(150),
  email VARCHAR(150),
  phone VARCHAR(40),
  whatsapp VARCHAR(40),
  gst_number VARCHAR(40),
  pan VARCHAR(40),
  address TEXT,
  city VARCHAR(80),
  state VARCHAR(80),
  country VARCHAR(80) DEFAULT 'India',
  pin VARCHAR(20),
  website VARCHAR(200),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX(email)
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  description VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_id INT,
  description TEXT,
  price DECIMAL(12,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 18,
  unit VARCHAR(40) DEFAULT 'Nos',
  hsn_sac VARCHAR(40),
  image VARCHAR(255),
  featured BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  client_id INT,
  assigned_user_id INT,
  start_date DATE,
  end_date DATE,
  technology VARCHAR(255),
  status VARCHAR(30) DEFAULT 'planning',
  cost DECIMAL(12,2) DEFAULT 0,
  advance_paid DECIMAL(12,2) DEFAULT 0,
  description TEXT,
  attachments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (assigned_user_id) REFERENCES users(id)
);

CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  client_id INT NOT NULL,
  project_id INT,
  invoice_date DATE NOT NULL,
  due_date DATE,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_terms VARCHAR(100),
  notes TEXT, terms TEXT,
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  cgst DECIMAL(12,2) DEFAULT 0,
  sgst DECIMAL(12,2) DEFAULT 0,
  igst DECIMAL(12,2) DEFAULT 0,
  extra_charges DECIMAL(12,2) DEFAULT 0,
  round_off DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  balance_due DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  pdf_path VARCHAR(255),
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  service_id INT,
  description TEXT,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit VARCHAR(40),
  rate DECIMAL(12,2) DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 18,
  amount DECIMAL(12,2) DEFAULT 0,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE TABLE quotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quotation_number VARCHAR(50) UNIQUE NOT NULL,
  client_id INT NOT NULL,
  quotation_date DATE NOT NULL,
  valid_until DATE,
  currency VARCHAR(10) DEFAULT 'INR',
  notes TEXT, terms TEXT,
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',
  version INT DEFAULT 1,
  converted_invoice_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (converted_invoice_id) REFERENCES invoices(id)
);

CREATE TABLE quotation_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quotation_id INT,
  service_id INT,
  description TEXT,
  quantity DECIMAL(10,2) DEFAULT 1,
  rate DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 18,
  amount DECIMAL(12,2) DEFAULT 0,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(40),
  transaction_id VARCHAR(120),
  reference_number VARCHAR(120),
  upi_reference VARCHAR(120),
  notes TEXT,
  receipt VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

CREATE TABLE company_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  logo VARCHAR(255),
  company_name VARCHAR(200),
  tagline VARCHAR(255),
  business_name VARCHAR(200),
  address TEXT, city VARCHAR(80), state VARCHAR(80),
  country VARCHAR(80) DEFAULT 'India', pincode VARCHAR(20),
  phone VARCHAR(40), alt_phone VARCHAR(40),
  email VARCHAR(150), website VARCHAR(200),
  gst_number VARCHAR(40), pan_number VARCHAR(40),
  udyam_number VARCHAR(40), cin_number VARCHAR(40), msme_number VARCHAR(40),
  bank_name VARCHAR(120), account_name VARCHAR(150),
  account_number VARCHAR(50), ifsc VARCHAR(40), swift VARCHAR(40),
  upi_id VARCHAR(80), qr_code VARCHAR(255),
  default_currency VARCHAR(10) DEFAULT 'INR', currency_symbol VARCHAR(10) DEFAULT '₹',
  invoice_prefix VARCHAR(20) DEFAULT 'INV', quotation_prefix VARCHAR(20) DEFAULT 'QUO',
  financial_year VARCHAR(20) DEFAULT '2026-27',
  default_tax DECIMAL(5,2) DEFAULT 18,
  default_payment_terms VARCHAR(255) DEFAULT 'Net 15',
  late_fee_percent DECIMAL(5,2) DEFAULT 0,
  footer_notes TEXT, terms_conditions TEXT,
  signature VARCHAR(255), stamp VARCHAR(255),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE smtp_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host VARCHAR(150), port INT DEFAULT 587,
  username VARCHAR(150), password VARCHAR(500),
  from_email VARCHAR(150), from_name VARCHAR(150),
  reply_to VARCHAR(150),
  use_tls BOOLEAN DEFAULT TRUE, use_ssl BOOLEAN DEFAULT FALSE,
  enabled BOOLEAN DEFAULT TRUE,
  imap_host VARCHAR(150), imap_port INT DEFAULT 993,
  imap_username VARCHAR(150), imap_password VARCHAR(500),
  imap_use_ssl BOOLEAN DEFAULT TRUE,
  imap_folder VARCHAR(80) DEFAULT 'INBOX',
  imap_enabled BOOLEAN DEFAULT FALSE,
  invoice_email_subject VARCHAR(255),
  invoice_email_template TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE email_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  to_email VARCHAR(255), subject VARCHAR(255), template VARCHAR(80),
  status VARCHAR(30), error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT, action VARCHAR(120), entity VARCHAR(80), entity_id INT,
  detail TEXT, ip_address VARCHAR(64),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT, title VARCHAR(200), message TEXT, type VARCHAR(40),
  `read` BOOLEAN DEFAULT FALSE, link VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE tax_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL, rate DECIMAL(5,2) DEFAULT 0, type VARCHAR(30) DEFAULT 'GST'
);

CREATE TABLE currencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) UNIQUE, symbol VARCHAR(10), name VARCHAR(80)
);
