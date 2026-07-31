# Azure Container Apps 배포 튜토리얼

이 가이드는 `Issue → Cloud Agent → PR → Merge → 평가 → 승인 → ACA 배포` 흐름을
처음 구성하는 저장소 관리자를 위한 것입니다. Azure 리소스 생성은
`production` Environment 승인 이후에만 수행됩니다.

## 1. 전달 흐름

```text
Jira/GitHub Issue
  → Copilot cloud agent 할당
  → draft PR + CI/E2E/CodeQL
  → 독립 reviewer 승인
  → main 병합
  → Post-merge evaluation
  → production required reviewer 승인
  → GitHub OIDC 로그인
  → Bicep + ACR build + Container Apps revision
  → HTTPS smoke test와 URL 보고
```

PR 병합 승인과 운영 배포 승인은 서로 다른 통제 지점입니다. 평가가 실패하면 배포
job은 시작되지 않고, 평가가 성공해도 `production` reviewer 승인 전에는 Azure
자격증명에 접근할 수 없습니다.

## 2. Azure 사전 준비

아래 값은 예시입니다. 실제 subscription과 허용 region은 조직 정책에 맞게 바꿉니다.

```bash
SUBSCRIPTION_ID="<subscription-id>"
LOCATION="koreacentral"
RESOURCE_GROUP="rg-cloud-agent-demo"
APP_NAME="github-cloud-agent-deployer"

az account set --subscription "$SUBSCRIPTION_ID"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

APP_ID="$(az ad app create --display-name "$APP_NAME" --query appId --output tsv)"
az ad sp create --id "$APP_ID"
RG_ID="$(az group show --name "$RESOURCE_GROUP" --query id --output tsv)"

az role assignment create \
  --assignee "$APP_ID" \
  --role Contributor \
  --scope "$RG_ID"
az role assignment create \
  --assignee "$APP_ID" \
  --role "User Access Administrator" \
  --scope "$RG_ID"
```

`User Access Administrator`는 Bicep이 ACR에 `AcrPull` 역할을 부여하는 데 필요합니다.
두 역할 모두 데모 resource group 범위로 제한합니다.

## 3. GitHub OIDC 신뢰 구성

`federated-credential.json`은 로컬 임시 파일로 만들고 저장소에 commit하지 않습니다.

```json
{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:hijigoo@1788481/dev-agent-workflow@1317968479:environment:production",
  "description": "Deploy approved revisions from the production environment",
  "audiences": ["api://AzureADTokenExchange"]
}
```

```bash
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters federated-credential.json

TENANT_ID="$(az account show --query tenantId --output tsv)"
printf 'Client ID: %s\nTenant ID: %s\nSubscription ID: %s\n' \
  "$APP_ID" "$TENANT_ID" "$SUBSCRIPTION_ID"
```

이 저장소의 GitHub OIDC subject prefix는 다음 명령으로 확인합니다.

```bash
gh api repos/hijigoo/dev-agent-workflow/actions/oidc/customization/sub
```

GitHub가 반환하는 immutable owner/repository ID prefix 뒤에
`:environment:production`을 붙입니다. 이름 기반 branch subject가 아니라 이 Environment
subject를 사용해야 저장소 rename에도 안전하고 승인 게이트와 OIDC 신뢰가 같은 경계를
공유합니다.

## 4. GitHub production Environment

`Settings → Environments → New environment → production`에서:

1. **Required reviewers**에 배포 승인자를 지정합니다.
2. 필요하면 **Prevent administrators from bypassing**을 활성화합니다.
3. Environment secrets를 등록합니다.

| Secret | 값 |
|---|---|
| `AZURE_CLIENT_ID` | 위 `APP_ID` |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | 대상 subscription ID |

Environment variables:

| Variable | 예시 | 제약 |
|---|---|---|
| `AZURE_LOCATION` | `koreacentral` | resource group location과 동일 |
| `AZURE_RESOURCE_GROUP` | `rg-cloud-agent-demo` | 사전 생성한 resource group |
| `AZURE_NAME_PREFIX` | `agentdemo` | 3~18자, 소문자·숫자·단일 하이픈 조합, 하이픈으로 끝나지 않음 |

모든 설정과 required reviewer를 확인한 마지막 단계에서 repository variable
`ACA_DEPLOYMENT_ENABLED=true`를 등록합니다. 이 값은 Environment variable이 아니라
**Repository Actions variable**이어야 합니다. 기본값은 비활성으로 간주되므로 저장소를
처음 push해도 Azure 배포 job이 우발적으로 실행되지 않습니다.

## 5. 저장소 보호 규칙

`main` ruleset에 CI, E2E, CodeQL과 독립 reviewer 승인을 required로 지정합니다.
Cloud Agent가 만든 workflow 변경은 사람이 diff를 확인하고 실행 승인합니다.
자동 병합과 branch protection 우회는 사용하지 않습니다.

## 6. 첫 배포

1. Agent-ready Issue를 Copilot에 할당합니다.
2. Agent PR의 테스트와 변경 범위를 검토합니다.
3. 독립 reviewer가 승인한 PR을 `main`에 병합합니다.
4. **Evaluate and deploy to Azure Container Apps** workflow를 엽니다.
5. `Post-merge evaluation`의 테스트와 artifact를 확인합니다.
6. `production` deployment를 승인합니다.
7. workflow가 `AcrPull` 역할 전파를 확인한 뒤 image를 build하는지 확인합니다.
8. job summary의 Website URL과 세 health check 결과를 확인합니다.

재실행이 필요하면 `workflow_dispatch`를 사용합니다. 모든 image는 commit SHA tag를
사용하므로 실행 결과가 어느 source revision인지 추적할 수 있습니다.

## 7. 데모 확인

```bash
curl --fail "https://<web-fqdn>/health"
curl --fail "https://<web-fqdn>/api/health"
curl --fail "https://<web-fqdn>/intake/health"
```

브라우저에서 Website URL을 열어 회의실 목록, 예약 생성, Work Intake preview를
확인합니다. API 앱은 internal ingress이므로 외부 URL로 직접 접근할 수 없습니다.

## 8. 운영 전환 전 필수 변경

- SQLite를 Azure Database for PostgreSQL 등 영속 managed database로 전환
- private networking, egress 통제, custom domain/WAF 검토
- Work Intake의 GitHub App token을 Key Vault와 managed identity로 연결
- staging Environment와 점진적 revision traffic/rollback 절차 추가
- 조직의 required tags, Azure Policy, Defender, backup, DR 기준 적용
