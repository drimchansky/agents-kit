# Hardware signing for Git operations

This reference owns hardware-access discovery and permission handling for operations that create signed commits. The calling workflow owns authorization to change Git history, its state checks, and recovery from a paused operation.

## Discover the signer

Use results already gathered by the caller, or read `commit.gpgsign` as a Git boolean, `gpg.format`, `user.signingkey`, and `gpg.ssh.program` with their config origins. Interpret settings by name; an unset setting produces no value. Include explicit signing options and any signing choice recorded by an active rebase when determining the effective signer.

For SSH signing with a key-file path, expand a leading `~/` and run `ssh-keygen -l -f` on the quoted path. A type ending in `-SK`, such as `ED25519-SK` or `ECDSA-SK`, identifies a FIDO hardware key. Inline public keys and agent-selected identities are not file paths; inspect their public identity using the applicable mechanism without displaying private key material. An unsuccessful probe leaves hardware use unknown, not disproved.

## Request device access

On Codex in a macOS sandbox, a confirmed SSH hardware signer requires requesting `sandbox_permissions="require_escalated"` for the authorized commit-producing command. Explain in the tool's justification that the configured signer needs access to the connected hardware key. A no-touch key still needs device access; sandbox denial can appear as `device not found` even when enumeration sees the key. Do not escalate read-only discovery or project checks solely for signing.

Request permission for the specific invocation through the host's approval flow. Keep the caller's last state comparison inside that invocation, after approval and immediately before the Git mutation. Permission to use the device does not authorize a different branch, range, staged set, or todo. Preserve signing settings, key selection and hooks; do not add an unsigned fallback or change the global sandbox policy.

If a touch may be required, tell the user immediately before the operation. The key's filename is not evidence that touch is disabled. A rebase may sign several commits and require more than one touch.

If escalation is unavailable or denied, report the reason and return control without attempting another execution route. Keep any prepared message or paused operation intact. If an approved attempt fails, inspect the resulting Git state and distinguish device/signature errors from conflicts or hooks; follow the caller's recovery path without looping on the same failure. A sandboxed failure with an unclassified signer warrants discovery before any retry; `device not found` alone does not prove sandbox denial.
