# Azure 배포 변경 계획

## 상태

Validated

## 목표

현재 하나의 공개 Web에 섞여 있는 테스트 앱과 Work Intake를 분리해 각각 독립된
URL과 명확한 역할을 갖도록 변경한다.

## 현재 구조

- `agentworkflow-web`: 테스트 앱 UI와 Work Intake UI를 함께 제공
- `agentworkflow-meeting-api`: 테스트 앱용 내부 API
- `agentworkflow-work-intake`: Web의 `/intake/` 프록시 뒤에 있는 내부 API

## 제안 구조

- `agentworkflow-web`: 테스트 앱 전용 외부 URL
- `agentworkflow-meeting-api`: 테스트 앱 전용 내부 API
- `agentworkflow-work-intake`: 업무 요청·GitHub Issue 생성 UI/API를 함께 제공하는
  별도 외부 URL

기존 ACA 3개를 유지하고 네 번째 앱을 추가하지 않는다.

## 변경 예정 범위

- 테스트 앱 Web에서 Work Intake 메뉴·클라이언트·프록시 제거
- Work Intake FastAPI 루트에 독립적인 한글 UI 제공
- Work Intake ACA ingress를 내부에서 외부로 변경
- Bicep output에 테스트 앱 URL과 Work Intake URL을 각각 제공
- 배포 workflow에서 두 URL과 health endpoint 검증
- 단위·E2E 테스트와 고객용 HTML의 URL·구조 설명 갱신

## 보안 원칙

- Work Intake ACA만 외부 ingress를 사용하되 GitHub token은 브라우저에 노출하지 않는다.
- GitHub Issue 발행 권한과 입력 검증은 서버에 유지한다.
- ACR pull은 기존 사용자 할당 Managed Identity를 계속 사용한다.
- Azure 배포는 기존 OIDC와 `production` Environment 승인 뒤에만 수행한다.

## 검증 계획

- [x] Work Intake API·UI 단위 테스트
- [x] 테스트 앱에서 Work Intake 메뉴와 `/intake/` 프록시 제거 확인
- [x] React lint·unit·build와 Playwright E2E
- [x] Bicep build/lint
- [x] Azure resource group template validation
- [x] Azure what-if로 의도한 ACA 변경만 포함되는지 확인
- [x] Bicep RBAC와 live role assignment 최소 권한 확인
- [x] 적용되는 Azure Policy assignment 확인
- [ ] 배포 후 두 외부 URL과 각 health endpoint 확인

## 배포 계획

1. 애플리케이션과 IaC 변경
2. 로컬 기능 검증
3. Azure 구성 검증
4. `main` 반영 후 03 Delivery 평가
5. `production` 사용자 승인
6. ACA revision 배포 및 두 URL 확인

## 롤백

이전 commit SHA 이미지와 기존 `apps.bicep` revision으로 되돌리고, Work Intake
ingress를 internal로 복원한다.

## 승인

Approved by user on 2026-07-31. Proceed through validation and production deployment.

## 구현 결과

- 테스트 앱에서 Work Intake 메뉴·React 코드·Nginx 프록시 제거
- Work Intake FastAPI에 독립 한글 UI 추가
- Work Intake ACA를 external ingress로 변경
- Bicep과 Delivery workflow에서 두 외부 URL을 별도 output·검증
- 고객용 HTML과 실행 문서의 URL·구조 설명 갱신

## 로컬 검증 결과

- Python: 29 passed
- React: 7 passed
- Playwright: 4 passed
- React lint/build: passed
- Bicep build/lint: passed
- 로컬 Docker CLI는 설치되어 있지 않아 ACR remote build에서 이미지 빌드를 검증

## Validation Proof

Azure validation은 subscription `c0a6269b-2c15-4ad8-b141-972148f33b91`,
resource group `rg-agent-workflow`, location `koreacentral` 기준으로 완료했다.

- `az deployment group validate --resource-group rg-agent-workflow
  --template-file infra/apps.bicep ...`: `Succeeded`
- `az deployment group what-if --resource-group rg-agent-workflow
  --template-file infra/apps.bicep ...`: 의도한 세 Container App만 deploy 대상으로
  표시되고 기존 environment, ACR, identity, Log Analytics workspace는 ignore
- live resource 확인: `cragentworkflowdsszbpol`, `agentworkflow-env`,
  `agentworkflow-pull`
- resource group 범위의 Azure Policy assignment: 없음
- `infra/foundation.bicep`은 built-in `AcrPull`
  (`7f951dda-4ed3-4680-a7ca-43fe172d538d`)을 pull identity에 부여하며 scope는
  특정 ACR resource로 제한됨
- live role query에서도 `agentworkflow-pull`의 role은
  `cragentworkflowdsszbpol` 범위 `AcrPull` 하나만 확인됨
- `infra/apps.bicep`은 기존 identity를 세 ACA에서 재사용하고 더 넓은 role을 추가하지 않음

로컬 Docker CLI가 없으므로 image build는 Delivery workflow의 ACR remote build에서
검증한다. 실제 ACA revision과 URL smoke check는 deployment proof로 추가한다.
