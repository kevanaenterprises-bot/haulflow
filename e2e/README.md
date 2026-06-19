# HaulFlow End-to-End Test Suite

Comprehensive Playwright E2E tests for the HaulFlow TMS platform.
Tests cover the full lifecycle from company sign-up through load delivery and invoicing.

## What Gets Tested

### Suite 01 - Company Onboarding
- API health check (server is up)
- Company registration via API (POST /api/onboard)
- Duplicate email rejection
- Password validation (min 6 chars)
- Auto-login token returned after signup
- Token payload structure validation
- /onboard UI page loads correctly
- Duplicate email shows error in UI

### Suite 02 - Admin Login and Company Setup
- Admin login via API (correct/wrong credentials)
- Company profile fetch and update
- Create customer, shipper, driver, truck
- Set driver portal password
- Employee list returns admin user
- Unauthorized requests are rejected (401)
- Admin dashboard loads via UI with stored token

### Suite 03 - Load Management
- Create a full load (origin/destination/rate/driver/customer/shipper)
- List loads with driver name joined
- Update load fields
- Full status lifecycle: booked -> dispatched -> in_transit -> delivered
- List drivers, trucks, customers, shippers

### Suite 04 - Driver Portal (Mobile App API)
- Driver login by phone + password
- Wrong password rejected (401)
- Unknown phone rejected (401)
- Driver fetches their assigned loads
- Driver updates load status to in_transit
- Driver marks load as delivered
- Pre-trip inspection: all pass
- Pre-trip inspection: with defect (brake failure)
- Today's inspection check (GET /api/driver/dvir/today)
- Unauthorized driver request rejected

### Suite 05 - Invoicing
- Create invoice linked to load + customer
- Invoice number auto-generated (TRL-XXXXX format)
- Invoice list with customer name joined
- Invoice starts as unpaid
- Mark invoice paid (PATCH /api/invoices/:id/pay)
- Paid invoice shows paid_at timestamp
- Invoice counter increments per company
- Invoice without load_id allowed
- Unauthorized access rejected

### Suite 06 - DVIR Inspections (Admin View)
- List all inspections (GET /api/dvir/inspections)
- Filter defects only (?defects_only=true)
- Get single inspection by ID
- Inspection items returned as parsed JSON array
- Pagination with limit/offset params
- Unauthorized access rejected
- 404 for non-existent inspection ID

## Getting Started

### Prerequisites
- Node.js 18+
- Access to the HaulFlow production or staging environment

### Install

    cd e2e
        npm install
            npx playwright install chromium

            ### Run All Tests

                npm test

                ### Run in Browser (headed mode)

                    npm run test:headed

                    ### Debug a Single Test

                        npm run test:debug -- --grep "Driver login"

                        ### View HTML Report

                            npm run test:report

                            ## Environment Variables

                            | Variable | Default | Description |
                            |---|---|---|
                            | BASE_URL | https://haulflow.vercel.app | Target app URL |

                            Example override:

                                BASE_URL=https://staging.haulflow.vercel.app npm test

                                ## How Tests Share State

                                Tests run sequentially (not in parallel). The global setup script generates unique credentials for each run (using a timestamp suffix) and stores them in `.test-context.json`. Each test spec reads from and writes back to this file to pass data (IDs, tokens) to later specs.

                                For example: onboarding creates the company and saves the adminToken. Load management reads that token and the customerId/shipperId created by admin-setup to create loads. Invoicing reads the loadId to create invoices against it.

                                ## Test Data

                                Each run creates:
                                - 1 trucking company (Thunder Ridge Logistics)
                                - 1 admin user
                                - 1 driver (Bobby Roadhog)
                                - 1 customer (Midwest Steel Corp)
                                - 1 shipper (Great Lakes Distribution)
                                - 1 truck (Kenworth T680, unit T-101)
                                - 2 loads
                                - 2 pre-trip inspections (1 clean pass, 1 with brake defect)
                                - 3 invoices

                                Test data is NOT automatically cleaned up. Run periodically and purge old test companies from the Supabase dashboard if needed.

                                ## Periodic Testing Schedule

                                Recommended: Run after every deployment or at minimum weekly.

                                    # Quick smoke test (run once a week)
                                        npm test

                                            # Full regression with report
                                                npm test && npm run test:report
