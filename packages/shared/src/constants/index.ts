export const CONTRACT_VERSION = 1 as const;
export const RISK_POLICY_VERSION = "risk-v1" as const;
export const AGREEMENT_CANONICALIZATION_VERSION = "v1" as const;

export const RISK_GATE_THRESHOLDS = {
  completenessMinimum: 85,
  paymentReadinessMinimum: 80,
  disputeRiskMaximum: 35
} as const;
