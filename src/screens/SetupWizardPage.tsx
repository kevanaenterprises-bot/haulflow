import { OnboardingWizard } from '../components/onboarding';
import InteractiveAvatar from '../components/avatar/InteractiveAvatar';

/**
 * SetupWizardPage — The Self-Service Onboarding Wizard
 *
 * Rendered at /setup after a user completes Stripe payment.
 * This is a multi-step wizard for:
 * 1. Company Profile
 * 2. Data Import (CSV templates)
 * 3. Team Invites
 * 4. Invoice Configuration
 */
export default function SetupWizardPage() {
  return (
    <>
      <OnboardingWizard />
      {/* Kristy — ready to help through every setup step */}
      <InteractiveAvatar context="setup" />
    </>
  );
}
