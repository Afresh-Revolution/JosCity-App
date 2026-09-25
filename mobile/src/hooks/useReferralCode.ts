import { useEffect, useState } from "react";
import { lookupReferral } from "../api/auth";

export const REFERRAL_CODE_LENGTH = 9;
export const REFERRAL_CODE_PATTERN = /^JOS[A-Z0-9]{6}$/;
export const REFERRAL_FORMAT_ERROR = "Enter a valid referral code, such as JOSABC123.";

export function normalizeReferralCode(value: string) {
  return value.replace(/\s/g, "").toUpperCase().slice(0, REFERRAL_CODE_LENGTH);
}

export function isCompleteReferralCode(code: string) {
  return REFERRAL_CODE_PATTERN.test(code);
}

export type ReferralLookup = {
  code: string;
  name?: string;
  error?: string;
  valid: boolean;
  retryable?: boolean;
};

export function useReferralCode(initialCode = "") {
  const [referralCode, setReferralCode] = useState(normalizeReferralCode(initialCode));
  const [referralLookup, setReferralLookup] = useState<ReferralLookup | null>(null);
  const [referralRetry, setReferralRetry] = useState(0);

  useEffect(() => {
    const next = normalizeReferralCode(initialCode);
    if (next) setReferralCode((current) => current || next);
  }, [initialCode]);

  useEffect(() => {
    let active = true;
    if (!referralCode || referralCode.length < REFERRAL_CODE_LENGTH) {
      setReferralLookup(null);
      return undefined;
    }
    if (!isCompleteReferralCode(referralCode)) {
      setReferralLookup({ code: referralCode, valid: false, error: REFERRAL_FORMAT_ERROR });
      return undefined;
    }
    setReferralLookup(null);
    const timer = setTimeout(() => {
      void lookupReferral(referralCode)
        .then((result) => {
          if (!active) return;
          setReferralLookup({
            code: referralCode,
            name: result.name,
            valid: result.code_active,
            error: result.code_active ? undefined : "This referral code is not active yet.",
          });
        })
        .catch((error) => {
          if (!active) return;
          const message = error instanceof Error ? error.message : "";
          const missing = /not found|valid referral/i.test(message);
          setReferralLookup({
            code: referralCode,
            valid: false,
            error: missing ? REFERRAL_FORMAT_ERROR : message || "Could not verify this referral code. Please try again.",
            retryable: !missing,
          });
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [referralCode, referralRetry]);

  const updateReferralCode = (value: string) => {
    setReferralCode(normalizeReferralCode(value));
  };

  const markShortOnBlur = () => {
    if (referralCode && referralCode.length < REFERRAL_CODE_LENGTH) {
      setReferralLookup({ code: referralCode, valid: false, error: REFERRAL_FORMAT_ERROR });
    }
  };

  const validateReferral = () => {
    if (!referralCode) return null;
    if (referralCode.length < REFERRAL_CODE_LENGTH || !isCompleteReferralCode(referralCode)) {
      return `${REFERRAL_FORMAT_ERROR} Correct or remove the code to continue.`;
    }
    if (referralLookup?.code !== referralCode || !referralLookup.valid) {
      return referralLookup?.code === referralCode && referralLookup.error
        ? `${referralLookup.error} Correct or remove the code to continue.`
        : "Please wait while we verify your referral code.";
    }
    return null;
  };

  return {
    referralCode,
    setReferralCode: updateReferralCode,
    referralLookup,
    referralRetry,
    retryReferral: () => setReferralRetry((value) => value + 1),
    markShortOnBlur,
    validateReferral,
  };
}
