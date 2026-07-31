# Cloud Agent Platform Workflow Demo

GitHub Copilot cloud agent를 팀 개발 프로세스에 편입하는 실행 가능한 샘플입니다.

이 저장소는 다음 흐름을 시연합니다.

1. Jira webhook 또는 로컬 Work Intake에서 과업 등록
2. 실제 GitHub Issue 생성 또는 자격증명 없는 preview 생성
3. GitHub UI/Jira/Slack에서 Copilot cloud agent에 작업 할당
4. Agent가 코드·테스트·PR 작성
5. CI, E2E, CodeQL과 독립 reviewer가 변경 검증
6. Mini Agent 품질 저하를 감지해 개선 과업 생성
7. `main` 병합 후 재평가하고 별도 운영 승인 뒤 Azure Container Apps 배포

> Cloud agent는 PR을 자동 승인하거나 병합하지 않습니다. 이 샘플도 모든 자동화의 종착점을 Issue 또는 draft PR로 제한합니다.

## 구성

```text
apps/
  api/                  FastAPI 회의실 예약·비식별 품질 지표 API
  work-intake/          독립 UI·Jira webhook·GitHub Issue 생성 API
  web/                  회의실·Mini Agent 테스트 앱
scripts/                주간 품질 리포트
tests/                  자동화 스크립트 테스트
scenarios/              고객 실습용 과업·테스트 시나리오
.github/
  agents/               Security/E2E/Quality custom agents
  workflows/            CI, CodeQL, E2E, 평가·승인·ACA 배포 workflow
infra/                   ACR·Container Apps·managed identity Bicep
docs/                    Azure OIDC와 production 승인 설정 가이드
```

전체 workflow와 시퀀스 다이어그램은
[`agentic-devops-workflow.html`](agentic-devops-workflow.html),
상세 고객 workshop은 [`cloud-agent-ax-workshop.html`](cloud-agent-ax-workshop.html)입니다.
Agentic DLC 실습과 평가표는
[`scenarios/agentic-dlc-scenarios.md`](scenarios/agentic-dlc-scenarios.md)를 사용합니다.
브라우저의 **Mini Agent** 화면은 별도 model/API key 없이 즉시 실행됩니다.

## 빠른 실행

### Docker Compose

```bash
docker compose up --build
```

- Web: <http://localhost:5173>
- Meeting API docs: <http://localhost:8000/docs>
- Work Intake: <http://localhost:8001>
- Work Intake docs: <http://localhost:8001/docs>

기본은 **local preview mode**입니다. Work Intake에서 실제 GitHub Issue를 생성하려면:

```bash
export GITHUB_TOKEN="fine-grained token or GitHub App token"
export GITHUB_REPOSITORY="hijigoo/dev-agent-workflow"
docker compose up --build
```

토큰은 저장소에 기록하지 마세요. 운영에서는 GitHub App의 최소 권한 토큰을 사용합니다.

### 로컬 프로세스

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e 'apps/api[test]' -e 'apps/work-intake[test]'

uvicorn meeting_api.main:app --app-dir apps/api --reload --port 8000
uvicorn work_intake.main:app --app-dir apps/work-intake --reload --port 8001

cd apps/web
npm ci
npm run dev
```

## 테스트

```bash
python -m pytest apps/api/tests apps/work-intake/tests tests
cd apps/web
npm ci
npm run lint
npm test
npm run build
npm run test:e2e
```

E2E 최초 실행 전:

```bash
cd apps/web
npx playwright install chromium
```

## Cloud Agent 사용

### GitHub Issue

1. `agent-ready` Issue를 생성합니다.
2. Assignee에서 **Copilot**을 선택합니다.
3. Agent session에서 계획·실행 로그를 확인합니다.
4. PR에서 workflow 변경 여부를 검토한 후 필요한 경우 **Approve and run workflows**를 선택합니다.
5. 후속 수정은 기존 PR에 `@copilot` 댓글로 요청합니다.
6. 요청자와 다른 독립 reviewer가 승인한 뒤 병합합니다.

### Jira

`POST /webhooks/jira/normalize`은 Jira webhook을 공통 WorkItem으로 변환합니다. 실제 Jira용 GitHub Copilot 연동을 설치하면 Jira Assignee 또는 `@GitHub Copilot` 댓글로 직접 Agent 작업을 시작할 수 있습니다. 자세한 순서는 발표 자료의 **실행 튜토리얼**을 참고하세요.

### Slack

GitHub App for Slack을 설치하고 DM 또는 비민감 thread에서 `@GitHub Copilot`을 호출합니다. Slack은 요청·상태 공유, Jira는 업무 추적, GitHub PR은 코드 검토의 기준 채널로 사용합니다.

## 자동화 시나리오

| 요구사항 | 구현 |
|---|---|
| 의존성 취약점 | Dependabot security/version updates + regression CI |
| 코드 취약점 | CodeQL + Security campaign/Copilot 할당 |
| UI E2E | Playwright trace·HTML report artifact |
| 답변 품질 | 비식별 golden 품질 데이터와 주간 scorecard 예시 |
| 신규 기능 | Issue template + custom agents + required checks |
| 로그 모니터링 | `weekly-quality-review.yml` + `scripts/build_quality_report.py` |
| 승인 후 Azure 배포 | 원본 Issue 승인 대기 알림 + `production` Environment + ACA |

## GitHub Actions 데모 순서

PR 검증과 Main 배포를 서로 다른 workflow로 분리해 실행 원인과 승인 지점을
명확하게 표시합니다.

| 번호 | Workflow | 역할 |
|---|---|---|
| 00 | Cloud Agent — Reproducible Setup | Copilot Agent job 내부 환경 준비 |
| 01 | PR Validation — Quality and CodeQL | Ready PR 품질·보안 검증 |
| 02 | Production Deployment — Evaluate, Approve, Deploy | Main 재평가·운영 승인·ACA 배포 |
| 03 | Optional — Scheduled Security and Quality Review | 주간 CodeQL·선택형 품질 리포트 |

| 구간 | Job | 데모 목적 | 실행 시점 |
|---|---|---|---|
| Agent setup | Cloud Agent user-configured setup | Python·Node와 의존성 준비 | Copilot Agent job 내부 |
| PR 1/2 | Quality validation | Python·React·Playwright·품질 artifact | Ready for review PR |
| PR 2/2 | CodeQL security | Python·JavaScript/TypeScript 취약점 분석 | PR 1/2 성공 후 |
| Main 1/3 | Post-merge evaluation | 병합 SHA의 기능·E2E 재평가 | `main` 병합 후 |
| Main 2/3 | Production approval notice | 원본 Issue에 승인 링크 알림 | 재평가 성공 후 |
| Main 3/3 | Production approval and ACA deployment | 승인 후 OIDC·ACR·ACA 배포 | 운영 승인 후 |

Copilot이 만든 Draft/WIP PR에서는 PR Validation job을 실행하지 않습니다.
**Ready for review** 전환 후 PR 1/2~2/2를 순서대로 수행하며, 이후 commit이
추가되면 최신 commit을 다시 검증합니다. CodeQL은 PR 2/2에서 한 번 실행하고
merge 후에는 다시 실행하지 않습니다.

`03 · Optional — Scheduled Security and Quality Review`는 주간 CodeQL과 수동
비식별 품질 검토를 담당합니다.

일반 Dependabot version-update schedule은 데모 noise를 줄이기 위해 제거했습니다.
Dependabot alerts와 security updates는 repository **Security & analysis** 설정에서
활성화해 신규 취약점에만 사용합니다.
이 설정을 켜면 GitHub가 관리하는 **Dependabot Updates** 항목이 Actions에 별도로
보일 수 있으며, 사용자 정의 데모 workflow가 아니라 Security alert 조치 경로입니다.

## Azure Container Apps 배포

`main` 병합이 곧바로 운영 변경을 만들지는 않습니다.

```text
main merge
  → post-merge unit/integration/E2E/quality evaluation
  → production Environment required reviewer 대기
  → GitHub OIDC 로그인
  → ACR build + Container Apps revision
  → 테스트 앱·Work Intake 독립 URL과 health check 보고
```

배포 후 공개 URL은 두 개입니다.

- 테스트 앱: `agentworkflow-web` — 회의실·예약·Mini Agent 기능
- Work Intake: `agentworkflow-work-intake` — 업무 요청·GitHub Issue 생성

`agentworkflow-meeting-api`는 테스트 앱만 호출하는 내부 ACA로 유지합니다.

Azure client secret은 사용하지 않습니다. 실제 subscription·region·resource group과
required reviewer 구성은
[`docs/azure-container-apps-deployment.md`](docs/azure-container-apps-deployment.md)를
따릅니다. 현재 SQLite 데이터는 revision-local인 POC 구성이므로 운영 전에는 managed
database로 전환해야 합니다. Repository variable `ACA_DEPLOYMENT_ENABLED`의 기본값은
비활성이며, `production` 보호와 OIDC 설정을 완료한 뒤에만 `true`로 변경합니다.

## 실제 환경 적용 전 변경할 값

- `.github/CODEOWNERS`의 팀·사용자
- Jira/Slack GitHub App의 대상 조직·저장소 범위
- `QUALITY_METRICS_URL` repository variable과 read-only 인증 방식
- 품질 기준선과 E2E test data
- ruleset의 required checks와 승인 수
- `production` Environment의 required reviewer와 Azure OIDC federation
- Azure resource group, region, required tags·Policy·quota
