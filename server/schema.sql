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
  job_title VARCHAR(100),
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
  medical_card_expiry DATE,
  hire_date DATE,
  termination_date DATE,
  cdl_file_url TEXT,
  medical_card_file_url TEXT,
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
  fuel_surcharge_enabled BOOLEAN DEFAULT false,
  fuel_surcharge_per_mile DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shippers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  type VARCHAR(20) DEFAULT 'shipper',
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  notes TEXT,
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
  miles INTEGER,
  fuel_surcharge DECIMAL(10,2),
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

-- Add new columns to existing tables if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='medical_card_expiry') THEN
    ALTER TABLE drivers ADD COLUMN medical_card_expiry DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='hire_date') THEN
    ALTER TABLE drivers ADD COLUMN hire_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='termination_date') THEN
    ALTER TABLE drivers ADD COLUMN termination_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='cdl_file_url') THEN
    ALTER TABLE drivers ADD COLUMN cdl_file_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='medical_card_file_url') THEN
    ALTER TABLE drivers ADD COLUMN medical_card_file_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='job_title') THEN
    ALTER TABLE users ADD COLUMN job_title VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='fuel_surcharge_enabled') THEN
    ALTER TABLE customers ADD COLUMN fuel_surcharge_enabled BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='fuel_surcharge_per_mile') THEN
    ALTER TABLE customers ADD COLUMN fuel_surcharge_per_mile DECIMAL(10,4) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='miles') THEN
    ALTER TABLE loads ADD COLUMN miles INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='fuel_surcharge') THEN
    ALTER TABLE loads ADD COLUMN fuel_surcharge DECIMAL(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='password_hash') THEN
    ALTER TABLE drivers ADD COLUMN password_hash VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='pod_url') THEN
    ALTER TABLE loads ADD COLUMN pod_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='auto_invoicing') THEN
    ALTER TABLE companies ADD COLUMN auto_invoicing BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='detention_fee') THEN
    ALTER TABLE loads ADD COLUMN detention_fee DECIMAL(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='pod_urls') THEN
    ALTER TABLE loads ADD COLUMN pod_urls JSONB DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='driver_notes') THEN
    ALTER TABLE loads ADD COLUMN driver_notes TEXT;
  END IF;
  -- Payment tracking columns on invoices
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='amount_paid') THEN
    ALTER TABLE invoices ADD COLUMN amount_paid DECIMAL(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='check_number') THEN
    ALTER TABLE invoices ADD COLUMN check_number VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='check_date') THEN
    ALTER TABLE invoices ADD COLUMN check_date DATE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS fuel_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  load_id UUID REFERENCES loads(id) ON DELETE SET NULL,
  truck_unit VARCHAR(100),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  state VARCHAR(50) NOT NULL,
  gallons DECIMAL(10,3) NOT NULL,
  price_per_gallon DECIMAL(10,4),
  total_amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_company ON fuel_purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_driver ON fuel_purchases(driver_id);

-- GPS & Geofencing tables
CREATE TABLE IF NOT EXISTS gps_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  load_id UUID REFERENCES loads(id) ON DELETE SET NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  speed DECIMAL(6,2),
  heading DECIMAL(5,2),
  accuracy DECIMAL(8,2),
  state VARCHAR(50),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geofence_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  load_id UUID REFERENCES loads(id) ON DELETE CASCADE,
  stop_id VARCHAR(100),
  stop_type VARCHAR(50),
  event_type VARCHAR(20) NOT NULL, -- 'enter' or 'exit'
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ifta_state_mileage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  load_id UUID REFERENCES loads(id) ON DELETE SET NULL,
  quarter VARCHAR(10) NOT NULL, -- e.g. '2026-Q1'
  state VARCHAR(50) NOT NULL,
  miles DECIMAL(10,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, driver_id, quarter, state)
);

-- Add GPS/geofence columns to existing tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='shipper_lat') THEN
    ALTER TABLE loads ADD COLUMN shipper_lat DECIMAL(10,7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='shipper_lng') THEN
    ALTER TABLE loads ADD COLUMN shipper_lng DECIMAL(10,7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='receiver_lat') THEN
    ALTER TABLE loads ADD COLUMN receiver_lat DECIMAL(10,7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='receiver_lng') THEN
    ALTER TABLE loads ADD COLUMN receiver_lng DECIMAL(10,7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='geofence_radius') THEN
    ALTER TABLE loads ADD COLUMN geofence_radius INTEGER DEFAULT 300;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='last_known_lat') THEN
    ALTER TABLE drivers ADD COLUMN last_known_lat DECIMAL(10,7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='last_known_lng') THEN
    ALTER TABLE drivers ADD COLUMN last_known_lng DECIMAL(10,7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='last_known_speed') THEN
    ALTER TABLE drivers ADD COLUMN last_known_speed DECIMAL(6,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='last_known_heading') THEN
    ALTER TABLE drivers ADD COLUMN last_known_heading DECIMAL(5,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='last_position_update') THEN
    ALTER TABLE drivers ADD COLUMN last_position_update TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='miles_driven') THEN
    ALTER TABLE loads ADD COLUMN miles_driven DECIMAL(10,3) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='mc_number') THEN
    ALTER TABLE companies ADD COLUMN mc_number VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='dot_number') THEN
    ALTER TABLE companies ADD COLUMN dot_number VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='is_demo') THEN
    ALTER TABLE companies ADD COLUMN is_demo BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='demo_expires_at') THEN
    ALTER TABLE companies ADD COLUMN demo_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- ── Trucks & Trailers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trucks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL DEFAULT 'truck', -- truck | trailer
  unit_number VARCHAR(50),
  year INTEGER,
  make VARCHAR(100),
  model VARCHAR(100),
  vin VARCHAR(50),
  license_plate VARCHAR(50),
  plate_state VARCHAR(10),
  status VARCHAR(30) DEFAULT 'active', -- active | inactive | in_shop
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
  service_type VARCHAR(100) NOT NULL, -- Oil Change, DOT Inspection, Tire Rotation, etc.
  service_date DATE NOT NULL,
  odometer INTEGER,
  cost DECIMAL(10,2),
  vendor VARCHAR(255),
  notes TEXT,
  next_service_date DATE,
  next_service_miles INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Driver Qualification (DQ) File ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,

  -- Section 1: Personal Info
  first_name VARCHAR(100),
  middle_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(255), -- derived: first + middle + last
  dob DATE,
  ssn VARCHAR(20), -- stored encrypted-at-rest recommended; required by FMCSA 391.21
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),

  -- Section 2: Address History (last 3 years)
  address_history JSONB DEFAULT '[]', -- [{address, city, state, zip, from_date, to_date}]

  -- Section 3: License History (all licenses held)
  license_history JSONB DEFAULT '[]', -- [{license_number, state, license_type, class, issued, expiry}]
  cdl_number VARCHAR(100), -- current CDL (for quick access)
  cdl_state VARCHAR(10),
  cdl_class VARCHAR(10),
  cdl_expiry DATE,
  endorsements TEXT,
  cdl_ever_denied BOOLEAN DEFAULT false,
  cdl_ever_suspended BOOLEAN DEFAULT false,
  cdl_denied_explanation TEXT,

  -- Section 4: Driving Experience
  driving_experience JSONB DEFAULT '[]', -- [{vehicle_type, years, miles}]

  -- Section 5: Accident Record (last 3 years)
  accident_history JSONB DEFAULT '[]',

  -- Section 6: Traffic Convictions (last 3 years)
  violation_history JSONB DEFAULT '[]',

  -- Section 7: Employment History (last 3 years)
  employment_history JSONB DEFAULT '[]',

  -- Section 8: CMV Employment (last 3 years — DOT-regulated driving jobs)
  cmv_employment JSONB DEFAULT '[]',

  -- Section 9: Employment Gaps (covers 10-year period)
  no_employment_gaps BOOLEAN DEFAULT false,
  employment_gaps_explanation TEXT, -- free text explanation of any gaps

  -- Drug & Alcohol
  drug_alcohol_violation BOOLEAN DEFAULT false,
  drug_alcohol_explanation TEXT,
  dot_drug_test_consent BOOLEAN DEFAULT false,

  -- Section 10: Certification & Signature
  certified_accurate BOOLEAN DEFAULT false,
  applicant_signature VARCHAR(255), -- typed full name as electronic signature
  cert_date VARCHAR(20),
  certified_at TIMESTAMPTZ,
  ip_address VARCHAR(50),

  -- Admin-managed DQ documents (upload URLs)
  mvr_url TEXT,
  mvr_date DATE,
  psp_url TEXT,
  road_test_url TEXT,
  pre_employment_drug_url TEXT,
  previous_employer_verification_url TEXT,

  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trucks_company ON trucks(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_truck ON maintenance_logs(truck_id);
CREATE INDEX IF NOT EXISTS idx_dq_driver ON driver_applications(driver_id);
CREATE INDEX IF NOT EXISTS idx_gps_events_driver ON gps_events(driver_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_gps_events_load ON gps_events(load_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_load ON geofence_events(load_id);
CREATE INDEX IF NOT EXISTS idx_ifta_company_quarter ON ifta_state_mileage(company_id, quarter);

CREATE INDEX IF NOT EXISTS idx_loads_company ON loads(company_id);
CREATE INDEX IF NOT EXISTS idx_loads_status ON loads(company_id, status);
CREATE INDEX IF NOT EXISTS idx_drivers_company ON drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_shippers_company ON shippers(company_id);
