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

CREATE TABLE IF NOT EXISTS shippers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  contact_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  load_number VARCHAR(100),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  shipper_id UUID REFERENCES shippers(id) ON DELETE SET NULL,
  origin_city VARCHAR(100),
  origin_state VARCHAR(50),
  dest_city VARCHAR(100),
  dest_state VARCHAR(50),
  pickup_date DATE,
  delivery_date DATE,
  rate DECIMAL(10,2),
  miles INTEGER,
  status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  load_id UUID REFERENCES loads(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100),
  amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'UNPAID',
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='commodity') THEN
    ALTER TABLE loads ADD COLUMN commodity VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='weight') THEN
    ALTER TABLE loads ADD COLUMN weight INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='trailer_number') THEN
    ALTER TABLE loads ADD COLUMN trailer_number VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='notes') THEN
    ALTER TABLE loads ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='extra_stop_fee') THEN
    ALTER TABLE loads ADD COLUMN extra_stop_fee DECIMAL(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='lumper_fee') THEN
    ALTER TABLE loads ADD COLUMN lumper_fee DECIMAL(10,2);
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
  gallons DECIMAL(8,3),
  price_per_gallon DECIMAL(8,4),
  total_amount DECIMAL(10,2),
  state VARCHAR(50),
  city VARCHAR(100),
  vendor VARCHAR(255),
  receipt_url TEXT,
  fuel_type VARCHAR(50) DEFAULT 'diesel',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gps_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  load_id UUID REFERENCES loads(id) ON DELETE SET NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  speed DECIMAL(6,2),
  heading DECIMAL(6,2),
  accuracy DECIMAL(8,2),
  altitude DECIMAL(8,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geofence_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  load_id UUID REFERENCES loads(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  geofence_type VARCHAR(50),
  location_name VARCHAR(255),
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ifta_state_mileage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  quarter VARCHAR(10) NOT NULL,
  state VARCHAR(50) NOT NULL,
  miles DECIMAL(10,3) DEFAULT 0,
  fuel_gallons DECIMAL(10,3) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, quarter, state)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='truck_id') THEN
    ALTER TABLE loads ADD COLUMN truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='truck_id') THEN
    ALTER TABLE drivers ADD COLUMN truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='current_lat') THEN
    ALTER TABLE drivers ADD COLUMN current_lat DECIMAL(10,7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='current_lng') THEN
    ALTER TABLE drivers ADD COLUMN current_lng DECIMAL(10,7);
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='dvir_photo_gated') THEN
    ALTER TABLE companies ADD COLUMN dvir_photo_gated BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='maintenance_alert_email') THEN
    ALTER TABLE companies ADD COLUMN maintenance_alert_email VARCHAR(255);
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
  state VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
  service_type VARCHAR(255) NOT NULL,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
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

-- ── Schema migrations for missing columns ─────────────────────────────────────
-- These ALTER TABLEs add columns referenced by the API server but missing from
-- the original CREATE TABLE definitions above.

DO $$ BEGIN

-- invoices: add customer_id, due_date, notes (used by POST /api/invoices)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='customer_id') THEN
  ALTER TABLE invoices ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='due_date') THEN
  ALTER TABLE invoices ADD COLUMN due_date DATE;
END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='notes') THEN
  ALTER TABLE invoices ADD COLUMN notes TEXT;
END IF;

-- loads: add full address columns (server uses origin_address, origin_zip, etc.)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='origin_address') THEN
  ALTER TABLE loads ADD COLUMN origin_address TEXT;
END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='origin_zip') THEN
  ALTER TABLE loads ADD COLUMN origin_zip VARCHAR(20);
END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='destination_address') THEN
  ALTER TABLE loads ADD COLUMN destination_address TEXT;
END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='destination_city') THEN
  ALTER TABLE loads ADD COLUMN destination_city VARCHAR(100);
END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='destination_state') THEN
  ALTER TABLE loads ADD COLUMN destination_state VARCHAR(50);
END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='destination_zip') THEN
  ALTER TABLE loads ADD COLUMN destination_zip VARCHAR(20);
END IF;

-- customers: add name column as alias for company_name (server also queries c.name in some JOINs)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='name') THEN
  ALTER TABLE customers ADD COLUMN name VARCHAR(255) GENERATED ALWAYS AS (company_name) STORED;
END IF;

-- companies: add shop_alert_email if missing
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='shop_alert_email') THEN
  ALTER TABLE companies ADD COLUMN shop_alert_email VARCHAR(255);
END IF;

-- shippers: ensure contact_phone and contact_email exist (old DBs may lack them)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shippers' AND column_name='contact_phone') THEN
  ALTER TABLE shippers ADD COLUMN contact_phone VARCHAR(50);
END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shippers' AND column_name='contact_email') THEN
  ALTER TABLE shippers ADD COLUMN contact_email VARCHAR(255);
END IF;

-- trucks: ensure state column exists (old DBs may lack it)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trucks' AND column_name='state') THEN
  ALTER TABLE trucks ADD COLUMN state VARCHAR(50);
END IF;

-- customers: ensure zip column exists (old DBs may lack it)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='zip') THEN
  ALTER TABLE customers ADD COLUMN zip VARCHAR(20);
END IF;

END $$;
