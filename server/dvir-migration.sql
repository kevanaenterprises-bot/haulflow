-- DVIR Photo Retention & Alerting — Database Migration
-- Run after existing schema.sql

-- 1. Add shop_alert_email to companies table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='shop_alert_email') THEN
    ALTER TABLE companies ADD COLUMN shop_alert_email VARCHAR(255);
  END IF;
END $$;

-- 2. Create dvir_photos table for photo retention tracking
CREATE TABLE IF NOT EXISTS dvir_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    truck_id VARCHAR(100) NOT NULL,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    inspection_point VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ok',
    notes TEXT,
    storage_path TEXT NOT NULL,
    url TEXT NOT NULL,
    is_protected BOOLEAN DEFAULT false,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    delete_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

-- 3. Indexes for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_dvir_photos_company ON dvir_photos(company_id);
CREATE INDEX IF NOT EXISTS idx_dvir_photos_truck ON dvir_photos(truck_id);
CREATE INDEX IF NOT EXISTS idx_dvir_photos_retention ON dvir_photos(is_protected, delete_at)
  WHERE is_protected = false;

-- 4. Create dvir_inspections table for full pre-trip inspection records
CREATE TABLE IF NOT EXISTS dvir_inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    driver_name VARCHAR(255),
    truck_unit VARCHAR(100),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    items JSONB NOT NULL DEFAULT '[]',
    has_defects BOOLEAN DEFAULT false,
    overall_status VARCHAR(20) DEFAULT 'pass',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS idx_dvir_inspections_company ON dvir_inspections(company_id);
CREATE INDEX IF NOT EXISTS idx_dvir_inspections_driver ON dvir_inspections(driver_id);
CREATE INDEX IF NOT EXISTS idx_dvir_inspections_submitted ON dvir_inspections(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_dvir_inspections_defects ON dvir_inspections(company_id, has_defects)
  WHERE has_defects = true;
