import { OnboardingWizard } from '../components/onboarding';

/**
 * SetupWizardPage — The Self-Service Onboarding Wizard
 *
 * Rendered at /setup after a user completes Stripe payment.
 * This is a multi-step wizard for:
 *   1. Company Profile
 *   2. Data Import (CSV templates)
 *   3. Team Invites
 *   4. Invoice Configuration
 *
 * UI-only for now — no Supabase backend wiring.
 */
export default function SetupWizardPage() {
  return <OnboardingWizard />;
}
