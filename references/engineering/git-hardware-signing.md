# Hardware signing for Git operations

## Discover the signer

Read `commit.gpgsign` as a Git boolean, `gpg.format`, `user.signingkey`, and `gpg.ssh.program` with their config origins. Reuse values already gathered by the caller. Interpret results by setting name; unset settings print nothing. Account for explicit signing options and signing choices recorded by an active rebase.

For an SSH key-file path, expand a leading `~/` and run `ssh-keygen -l -f` on the quoted path. A key type ending in `-SK` identifies a FIDO hardware signer. Inspect inline public keys and agent-selected identities through their public identity, without displaying private key material. A failed probe leaves hardware use unknown.

## Request device access

On Codex in a macOS sandbox, request `sandbox_permissions="require_escalated"` for the authorized commit-producing invocation when an SSH hardware signer is confirmed. Explain in the justification that the configured signer needs access to the connected hardware key. A no-touch key still requires device access. Keep discovery and project checks under their existing permissions.

Keep the caller's final state comparisons inside the approved invocation, immediately before mutation. Preserve the authorized branch, range, staged set, todo, signing configuration, and hooks. Never disable signing or change sandbox policy to bypass a failure.

Warn immediately before execution when a touch may be required; a key's filename does not establish touch behavior. A rebase may sign several commits and require more than one touch.

If escalation is unavailable or denied, report the reason and stop without trying another execution route. Retain any prepared message file and paused operation. After an approved failure, inspect Git state and follow the caller's recovery path without repeating unchanged attempts. Discover an unclassified signer before retrying a sandboxed signing failure; `device not found` alone does not establish sandbox denial.
