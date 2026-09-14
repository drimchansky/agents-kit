# TanStack Query

Check installed-major docs (`./execution.md` § *Detect stack and sources*):

- v4: object useQuery, cacheTime, query onSuccess/onError/onSettled.
- v5: gcTime; effects/mutation callbacks replace query callbacks; queryOptions supported.

## Custom Hooks

- [ ] Add value beyond useQuery(options); return raw results without field-discarding wrappers.

## Query Options

- [ ] Reusable queryOptions beside fetching; select for views.

## Query Keys

- [ ] Central queryKeys factory; invalidation matches exactly.

## Side Effects

- [ ] Mutation callbacks over state effects; throwOnError for boundaries.

## Mutations

- [ ] useMutation for writes; onSuccess invalidates/updates cache; await mutateAsync or use mutate callbacks.
- [ ] Separate read/write hooks; mutation.variables instead of mirrored in-flight state.

## Common Mistakes

- [ ] Keys include identity parameters; identical queries share keys.
