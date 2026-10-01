# Privacy

Cookies, headers, logout clearing, and log scrubbing: `security.md`.

## Data Minimization

- [ ] Minimize granularity; offer guest access when accounts are unnecessary.
- [ ] Document retention; delete after purpose ends; require fresh consent for reuse.

## Transparency

- [ ] Explain non-obvious fields inline; explain permissions before prompting, excluding page-load requests.
- [ ] Deletion takes ≤creation steps; no prechecked consent, unequal Accept/Reject styling, or buried rejection.

## Third-Party Embeds

- [ ] Static façades load heavy iframes on click; prefer privacy variants/share links over SDKs.
- [ ] Sensitive pages exclude unnecessary third-party scripts; federated sign-in uses FedCM.

## Fingerprinting

- [ ] Feature-detect; no UA sniffing. Necessary device hints use navigator.userAgentData.getHighEntropyValues().
- [ ] No font/device enumeration or canvas fingerprinting.

## User Rights

- [ ] Export all account data, preferably machine-readable; offer self-service deletion/identity correction without degrading unrelated service for opt-outs.
