/**
 * Helpers shared by the ZK page and its server functions. Browser-safe: no
 * Supabase, no node built-ins.
 */

/** Claim keys that plausibly carry a date of birth across the demo schemas. */
const DOB_KEYS = [
  "dob",
  "DOB",
  "dateOfBirth",
  "date_of_birth",
  "birthDate",
  "birth_date",
  "birthYear",
  "birth_year",
  "yearOfBirth",
];

export type ZkCredential = {
  id: string;
  schemaName: string | null;
  subject: string | null;
  issuerDid: string | null;
  holderDid: string | null;
  claims: Record<string, string>;
  jwt: string;
  /** Commitment recorded by an earlier ZK presentation of this credential. */
  lastCommitment: string | null;
};

/**
 * Pulls a four-digit year out of whichever date-of-birth-shaped claim the
 * schema happened to use. Returns null when the credential carries none.
 */
export function extractBirthYear(claims: Record<string, unknown> | null | undefined): {
  year: number | null;
  claimKey: string | null;
} {
  if (!claims) return { year: null, claimKey: null };
  for (const key of DOB_KEYS) {
    const raw = claims[key];
    if (raw === undefined || raw === null) continue;
    const match = String(raw).match(/\d{4}/);
    if (!match) continue;
    const year = Number(match[0]);
    if (year >= 1900 && year <= 2100) return { year, claimKey: key };
  }
  return { year: null, claimKey: null };
}
