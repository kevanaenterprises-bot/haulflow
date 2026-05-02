-- HaulFlow multi-tenant schema
-- Every table has company_id for tenant isolation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  invoice_prefix VARCHAR(20) DEFAULT 'INV',
  invoice_counter INTEGER DEFAULT 1000,
  payment_terms INTEGER DEFAULT 30,
  stripe_customer_id VARCHAR(255),
  subscription_status VARCHAR(50) DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  license_number VARCHAR(100),
  license_expiry DATE,
  status VARCHAR(50) DEFAULT 'available',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  load_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'WAITING_DISPATCH',
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  origin_address TEXT,
  origin_city VARCHAR(100),
  origin_state VARCHAR(50),
  dest_address TEXT,
  dest_city VARCHAR(100),
  dest_state VARCHAR(50),
  pickup_date DATE,
  delivery_date DATE,
  rate DECIMAL(10,2),
  extra_stop_fee DECIMAL(10,2),
  lumper_fee DECIMAL(10,2),
  cargo_description TEXT,
  bol_number VARCHAR(100),
  acceptance_token VARCHAR(100),
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, load_number)
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  load_id UUID REFERENCES loads(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'UNPAID',
  paid_at TIMESTAMPTZ,
  payment_method VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loads_company ON loads(company_id);
CREATE INDEX IF NOT EXISTS idx_loads_status ON loads(company_id, status);
CREATE INDEX IF NOT EXISTS idx_drivers_company ON drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
