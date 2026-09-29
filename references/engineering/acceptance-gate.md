# Engineering Acceptance Gate

What the acceptance gate runs when the domain is code. Apply it to task completion and to completion claims from `implement` and `fix-findings`, independently of goal wording or repository declarations.

## Acceptance-gate recipe

Verify each criterion against the **shipped behavior**, not against your record of the work: run the actual command, exercise the actual flow, observe the actual output. A record describes intent, not current state.

Spot-checking a prior `met` goal (drift or resume): open the file or run the command it cites and confirm the behavior still holds. Flag a regressed result before trusting its prior verdict. Reading a historically completed task does not reopen it solely because this live gate was introduced; a new completion claim or independently observed regression takes the current gate.

**Goals verified after the session (`(external)`).** A code goal confirmed only downstream carries the `(external)` marker in `goals.md`. Tag it `pending external` while confirmation is unavailable, and park the task at `in-review` until a later run confirms it (`../workflow/acceptance-criteria.md`, `../workflow/task-lifecycle.md`). The deployment and browser checks below apply even when no such goal exists. Do not add a goal merely to track a pending check.

## Resolve live targets

For each affected deployable target, inspect repository instructions, manifests, CI/release configuration, and dependency consumers. Resolve the repository, expected source/build identity, preprod and prod environments, Argo CD application/context, Kubernetes context/namespace/workload, and frontend URL where applicable. A library change includes deployed consumers affected by that change. A mixed repository is resolved per affected target, not by its repository label.

For each target and environment, record either the verification to perform or an evidence-backed `not applicable` reason. A repository declaration can supply mapping details but does not enable or disable this gate. A local-only tool or library with no affected deployed consumer can be `not applicable`; name the evidence that rules out a deployed runtime. An environment supported as absent can be `not applicable`. Unknown target mapping, missing tools or credentials, unavailable expected environments, and unproven absence stay pending, recorded per `../workflow/task-lifecycle.md` § *Companion result file*. Lack of access is never evidence of non-applicability.

The resolved target classification also selects later finalization health under `../workflow/task-delivery-edges.md` § *Verification source after delivery*. Supported non-deployable work still owes fresh engineering health on its current work product.

## Observe each applicable environment

Identify the intended commit/build and its deployed image or revision through the repository's release path. Use read-only observations against the resolved target. For Argo CD, `argocd app get <app> -o json` exposes application state; `argocd app wait <app> --sync --health --timeout <seconds>` bounds a wait for sync and health. For Kubernetes, `kubectl --context <context> -n <namespace> get <kind>/<name> -o json` exposes workload state and image references. `kubectl --context <context> -n <namespace> get pods -l <workload-selector> -o json` exposes running container image identities. `kubectl --context <context> -n <namespace> rollout status <kind>/<name> --timeout=<duration>` checks rollout progress. Resolve installed CLI versions and exact selectors at run time. A rollout status watch may follow a newer rollout; pin `--revision=<number>` where supported and verify the observed workload and running pod image identity against the intended release after the wait. Green sync, health, or rollout alone cannot prove the expected change is running. [Argo CD app get](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_get/), [Argo CD app wait](https://argo-cd.readthedocs.io/en/stable/user-guide/commands/argocd_app_wait/), [kubectl get](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_get/), [kubectl rollout status](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_status/).

For a frontend target, open its URL in each applicable environment on that release and exercise the changed browser journey, including required failure or empty states. For a backend target, exercise the goal's live functional behavior as well as deployment health. Record environment, target, expected and observed release, observation time, workload health, check, outcome, and supporting evidence; include URL and behavior for browser checks.

An observed functional failure or wrong healthy revision remains unmet work. A future rollout, missing access, or unavailable check remains pending downstream verification, not completed delivery. Read-only observation grants no permission for Argo sync, deployment, rollout mutation, or production test writes.
