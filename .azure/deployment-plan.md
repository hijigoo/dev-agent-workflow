# Azure Container Apps Deployment Plan

**Status:** Validated

> The user explicitly requested GitHub Actions deployment to Azure Container Apps and is
> unavailable for follow-up. Preparation proceeds with cost-optimized POC assumptions.
> No Azure resources will be created by this task.

## Goal

Implement this controlled delivery lifecycle:

```text
User/Jira Issue
  → Copilot cloud agent assignment
  → Pull request, checks, independent review
  → Merge to main
  → Post-merge evaluation
  → GitHub production Environment approval
  → Azure Container Apps deployment
  → Website and API smoke verification
```

## Requirements and assumptions

| Requirement | Decision |
|---|---|
| Classification | POC / customer demonstration |
| Scale | Small, below 1,000 users |
| Budget | Cost-optimized |
| Availability | Single Azure region |
| Compliance | No production customer data or secrets |
| Azure subscription | Current authenticated subscription selected for the POC |
| Azure region | `koreacentral` |
| Resource group | `rg-agent-workflow` |
| Approval | GitHub Environment required reviewer before any Azure login or resource change |
| Data | Existing SQLite remains ephemeral demo data; no production durability claim |

## Workspace analysis

**Mode:** MODERNIZE — the application is containerized but has no Azure infrastructure.

| Component | Type | Technology | Path |
|---|---|---|---|
| web | SPA and reverse proxy | React, Vite, nginx | `apps/web` |
| meeting-api | REST API | Python, FastAPI, SQLite | `apps/api` |
| work-intake | REST API | Python, FastAPI, SQLite, GitHub API | `apps/work-intake` |

Existing Dockerfiles and GitHub Actions are present. No Copilot SDK, .NET Aspire, Azure
Functions, Terraform, Bicep, or `azure.yaml` markers were found.

## Recipe: Standalone Bicep + GitHub Actions

**Rationale:**

- The requested lifecycle requires custom GitHub job dependencies and Environment approval.
- Infrastructure must be deployable separately from source evaluation.
- Direct Bicep deployments make the foundation/build/application stages explicit.
- AZD is not selected because deployment is intentionally orchestrated by the existing
  GitHub Actions pipeline rather than a developer-driven `azd up`.

## Azure architecture

### Foundation

- Pre-created, policy-approved resource group used as the deployment boundary
- Azure Container Registry Basic, admin account disabled
- Log Analytics workspace
- Azure Container Apps managed environment
- User-assigned managed identity for ACR image pulls
- `AcrPull` role assignment scoped to the registry

### Applications

- `meeting-api`: internal-only Container App, target port 8000
- `work-intake`: internal-only Container App, target port 8001
- `web`: external HTTPS Container App, target port 80
- nginx proxies browser-relative `/api/*` and `/intake/*` to the internal app FQDNs
- Images use immutable `${{ github.sha }}` tags
- All apps use the managed identity to pull from ACR
- Web has minimum one replica; API replicas may scale to zero for POC cost control

### Deliberate POC limitations

- SQLite files are revision-local and can be lost on restart or new deployment.
- Work Intake deploys in local preview mode; no GitHub token is placed in Azure.
- Production adoption must move state to managed storage/database and add a secret store.
- Only the web app is internet-accessible.

## Delivery workflow

File: `.github/workflows/deploy-aca.yml`

1. Trigger on push to `main` after PR merge, with optional manual run.
2. Evaluation job:
   - Python tests
   - Web lint, unit tests, and production build
   - Chromium Playwright tests against real local APIs
   - Privacy-safe quality scorecard
   - Upload evaluation evidence
3. Deploy job depends on evaluation and declares `environment: production`.
4. Repository variable `ACA_DEPLOYMENT_ENABLED=true` is required; the safe default is disabled.
5. GitHub pauses the deploy job until a configured required reviewer approves.
6. Only after approval:
   - Exchange GitHub OIDC token for Azure credentials
   - Deploy foundation Bicep
   - Poll until the registry-scoped `AcrPull` role is visible
   - Build three images with `az acr build`
   - Deploy app Bicep with immutable image tags
   - Query the web FQDN and run HTTPS health/page smoke checks
7. Publish the website URL in the GitHub job summary.

## Identity and security

- GitHub Actions uses OIDC with `azure/login@v2`; no client secret.
- Azure IDs are stored as GitHub **production Environment secrets**:
  - `AZURE_CLIENT_ID`
  - `AZURE_TENANT_ID`
  - `AZURE_SUBSCRIPTION_ID`
- Non-secret Environment variables:
  - `AZURE_LOCATION`
  - `AZURE_RESOURCE_GROUP`
  - `AZURE_NAME_PREFIX`
- Workflow grants `id-token: write` and `contents: read` only.
- Deployment identity requires `Contributor` and permission to create the registry-scoped
  `AcrPull` assignment. Both roles are limited to the pre-created POC resource group.
- ACR admin credentials are disabled.
- Container Apps pull images through managed identity.
- No workflow uses automatic merge or bypasses required reviewers.

## Policy and quota constraints

Azure subscription and policy context are unavailable in this preparation session. Before
first deployment:

1. Confirm the actual subscription name and ID.
2. Confirm `koreacentral` or another region allowed by organizational policy.
3. Check required tags, allowed resource types/SKUs, public ingress restrictions, and role
   assignment policy.
4. Verify Container Apps managed environment and ACR provisioning limits.

## Generated artifacts

- `infra/foundation.bicep`
- `infra/apps.bicep`
- `infra/modules/container-app.bicep`
- `.github/workflows/deploy-aca.yml`
- `apps/web/nginx.conf.template`
- Updated web Dockerfile, Compose configuration, README, workshop, and Agentic DLC scenario
- `docs/azure-container-apps-deployment.md`

## Functional verification

- Status: Verified
- Python tests: 24 passed in an isolated Python 3.12 virtual environment
- Web unit tests: 7 passed
- Web lint and production build: passed
- Playwright E2E against both real APIs: 2 passed
- GitHub-hosted E2E environment regression: explicitly cleared automatic
  `GITHUB_REPOSITORY`/`GITHUB_TOKEN` for local Work Intake preview; reproduced locally with
  `GITHUB_REPOSITORY` present and 2 tests passed
- Bicep: `foundation.bicep` and `apps.bicep` compiled successfully
- GitHub Actions: all workflow YAML files parsed successfully
- Workshop: JavaScript syntax and all eight tutorial tab/panel pairs verified
- Secret scan of generated infra/workflow: no password, client secret, or Azure credential
  object found
- Docker/nginx container smoke: not run because Docker is unavailable in this session;
  the workflow performs deployed `/health`, `/api/health`, and `/intake/health` checks

## Approval gate setup required in GitHub

Repository administrators must create a `production` Environment:

1. Add required reviewers.
2. Disable administrator bypass if policy requires it.
3. Add Azure OIDC Environment secrets and deployment variables.
4. Configure the Azure federated credential subject as:
   `repo:hijigoo/dev-agent-workflow:environment:production`.

The deployment job cannot obtain Environment secrets or an Azure OIDC token before approval.

## Validation checklist

- [x] All validation checks pass
  - [x] Bicep compilation
  - [x] Bicep linting
  - [x] Application build and automated tests
  - [x] Static RBAC role verification
  - [x] Azure CLI authentication detected
  - [x] Target subscription selected and `koreacentral` resource group created
  - [x] Azure resource-group template validation
  - [x] Azure what-if preview
  - [x] Assigned Azure Policy review

`rg-agent-workflow` was created in `koreacentral` after the user explicitly requested that
resource group name. No paid application resources were created during validation.

## Role Assignment Verification

- Status: Verified statically
- Identity: `${namePrefix}-pull` user-assigned managed identity
- Role: `AcrPull` (`7f951dda-4ed3-4680-a7ca-43fe172d538d`)
- Scope: the specific Azure Container Registry resource
- Consumers: meeting API, Work Intake API, and Web Container Apps
- Issues: none; the applications perform no other Azure data-plane operations

## Section 7: Validation Proof

Validation completed at `2026-07-31T06:04:12Z`.

| Check | Command/evidence | Result |
|---|---|---|
| Bicep compile | `az bicep build --file infra/foundation.bicep --stdout` | Passed |
| Bicep compile | `az bicep build --file infra/apps.bicep --stdout` | Passed |
| Bicep lint | `az bicep lint` for both entry templates | Passed |
| Python regression | `python -m pytest apps/api/tests apps/work-intake/tests tests -q` | 24 passed |
| Web validation | `npm run lint && npm test && npm run build` | 7 tests passed; build passed |
| Browser E2E | `npm run test:e2e` | 2 passed |
| Workflow syntax | Parsed all `.github/workflows/*.yml` | Passed |
| Workshop behavior | JavaScript parse and tutorial tab/panel wiring | Passed |
| Azure authentication | `az account show` | Authenticated; POC target selected |
| Resource group | `az group create --name rg-agent-workflow --location koreacentral` | Succeeded |
| Foundation validate | `az deployment group validate` | Passed |
| Foundation what-if | `az deployment group what-if` | 5 creates, no diagnostics |
| Apps validate | `az deployment group validate --validation-level Template` | Passed |
| Apps what-if | `az deployment group what-if --validation-level Template` | 3 creates, no diagnostics |
| Azure Policy | Exact and inherited assignment review at resource-group scope | No assignments |

## Out of scope

- Executing an Azure deployment in this preparation task
- Creating a paid Azure subscription or changing tenant policy
- Configuring Jira/Slack tenant applications
- Production database migration, private networking, WAF, custom domain, or multi-region DR
- Automatic production rollback or automatic merge
