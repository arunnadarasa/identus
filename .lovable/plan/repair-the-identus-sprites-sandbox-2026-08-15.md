# Repair the Identus Sprites sandbox

## Confirmed diagnosis

The latest sandbox successfully installed `@hyperledger/identus-edge-agent-sdk@6.6.0`, but npm blocked the SDK's lifecycle scripts. The published SDK bundle directly imports `rxdb` and its plugins while declaring `rxdb` only as a development dependency, so the verification step fails with `MODULE_NOT_FOUND`.

## Changes

1. **Make the SDK install deterministic**
   - Explicitly install the SDK's required `rxdb@14.17.1` runtime package alongside the existing peers.
   - Keep the clean reinstall path so the failed dependency tree is removed before repair.
   - Use a supported Node 20 runtime for this pinned SDK rather than accepting the Sprite's current Node 24 runtime.

2. **Strengthen verification**
   - Verify the installed SDK version, `rxdb` resolution, and core Identus exports before marking the box ready.
   - Preserve the complete useful module error in the provisioning log instead of showing only the tail of the stack.

3. **Improve repair behavior**
   - Make **Repair box** perform the clean deterministic reinstall automatically.
   - Keep the box in `failed` state until the import probe passes; only then enable snippet execution as SDK-ready.

4. **Validate end to end**
   - Repair the existing per-user Sprite.
   - Confirm SDK 6.6.0 imports successfully and a minimal Identus snippet runs.
   - Check that the Sandbox page changes from `failed` to `ready` and reports the resolved SDK version.

## Technical detail

The fix stays within the Sprites workspace/provisioning path. No agent-hosting behavior or Fly Machine configuration changes.