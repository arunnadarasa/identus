import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Credentials the holder can prove something about: issued, accepted, and
 * carrying a signed JWT (the JWT is what the ZK proof binds itself to).
 */
export const listZkCredentials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [creds, presentations] = await Promise.all([
      context.supabase
        .from("credential_records")
        .select("id, schema_name, subject, issuer_did, holder_did, claims, jwt, connection_id")
        .not("jwt", "is", null)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("sim_presentations")
        .select("credential_record_id, zk_proof, created_at")
        .not("zk_proof", "is", null)
        .order("created_at", { ascending: false }),
    ]);
    if (creds.error) throw new Error(creds.error.message);

    const commitments = new Map<string, string>();
    for (const row of presentations.data ?? []) {
      const proof = (row.zk_proof ?? {}) as { commitment?: string };
      if (row.credential_record_id && proof.commitment && !commitments.has(row.credential_record_id)) {
        commitments.set(row.credential_record_id, proof.commitment);
      }
    }

    return (creds.data ?? []).map((row) => ({
      id: row.id as string,
      schemaName: (row.schema_name ?? null) as string | null,
      subject: (row.subject ?? null) as string | null,
      issuerDid: (row.issuer_did ?? null) as string | null,
      holderDid: (row.holder_did ?? null) as string | null,
      claims: (row.claims ?? {}) as Record<string, string>,
      jwt: row.jwt as string,
      lastCommitment: commitments.get(row.id as string) ?? null,
    }));
  });

/** Stores a completed browser-side ZK proof as a presentation against the credential. */
export const recordZkPresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        credentialId: z.string().uuid(),
        commitment: z.string().trim().min(3),
        thresholdYear: z.number().int(),
        publicInputs: z.array(z.string()).max(16),
        proofBytes: z.number().int().nonnegative(),
        fields: z.number().int().nonnegative(),
        ms: z.number().int().nonnegative(),
        verified: z.boolean(),
        circuit: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { logActivity } = await import("./identus/agent.server");
    const { data: record, error: readError } = await context.supabase
      .from("credential_records")
      .select("id, connection_id, issuer_did, schema_name")
      .eq("id", data.credentialId)
      .single();
    if (readError) throw new Error(readError.message);

    const { data: row, error } = await context.supabase
      .from("sim_presentations")
      .insert({
        user_id: context.userId,
        connection_id: record.connection_id,
        credential_record_id: record.id,
        verifier_did: record.issuer_did,
        state: "ZkPresentationVerified",
        result: data.verified ? "valid" : "invalid",
        zk_proof: {
          kind: "noir-ultrahonk",
          commitment: data.commitment,
          threshold_year: data.thresholdYear,
          public_inputs: data.publicInputs,
          proof_bytes: data.proofBytes,
          fields: data.fields,
          ms: data.ms,
          circuit: data.circuit,
        } as unknown as never,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await logActivity(
      context.supabase,
      context.userId,
      record.connection_id,
      "presentation.zk_verified",
      `Zero-knowledge age proof accepted for ${record.schema_name ?? "credential"}`,
    );
    return { id: row.id as string, commitment: data.commitment };
  });
