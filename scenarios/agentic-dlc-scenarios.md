# Cloud Agent 기반 Agentic DLC 검증 시나리오

이 문서는 GitHub Copilot cloud agent를 단순 코드 생성기가 아니라 개발 수명주기의 비동기 팀원으로 사용할 수 있는지 검증한다.

## 검증 원칙

각 시나리오는 다음 수명주기를 끝까지 수행해야 한다.

```text
Signal/Requirement
  → Agent-ready work item
  → Agent session
  → Branch and pull request
  → Automated evidence
  → Human review and feedback
  → Agent rework
  → Independent approval
  → Merge or reject
  → Metrics and retrospective
```

**PR 생성만으로 성공 처리하지 않는다.** 과업 추적성, 변경 범위, 자동 검증, 사람 승인, 실패 복구, 회고 데이터까지 확인한다.

## 공통 사전 준비

- GitHub Enterprise Cloud 조직에서 Copilot cloud agent 활성화
- 이 저장소를 fork하거나 파일럿 저장소로 복제
- `copilot-setup-steps.yml`, CI, E2E, CodeQL을 기본 브랜치에서 먼저 성공
- ruleset에 required checks와 독립 reviewer 승인 적용
- Jira/Slack 연동은 샘플·비민감 프로젝트에만 연결
- `dependencies/upstream-versions.json`의 적용 버전을 실제 값으로 교체
- 운영 로그 대신 `samples/quality-metrics.json` 사용

## 시나리오 1 — Jira 요구사항에서 신규 기능까지

### 검증 목적

비개발 업무 중에도 구조화된 요구사항이 Cloud Agent의 구현·테스트·PR로 전환되는지 확인한다.

### 시작 조건

회의실 검색 API는 최소 수용 인원만 지원하고, UI는 장비 하나만 선택할 수 있다고 가정한다.

### 과업

> 회의실 검색에서 여러 필수 장비를 선택할 수 있게 하고 URL query string에 검색 조건을 유지한다.

### 실행

1. Jira work item에 배경, 제외 범위, 인수 조건, 검증 명령을 작성한다.
2. Jira Assignee를 GitHub Copilot로 지정한다.
3. Agent session에서 저장소 조사와 계획을 확인한다.
4. draft PR이 만들어지면 API·UI diff와 신규 테스트를 검토한다.
5. 리뷰 댓글로 빈 결과 접근성 요구를 추가한다.

```text
@copilot 빈 검색 결과에 role="status"를 적용하고,
검색 조건 초기화 버튼과 component test를 추가해 주세요.
API 계약이나 라우팅 구조는 변경하지 마세요.
```

6. 후속 commit과 최신 CI 결과를 확인한다.
7. 요청자가 기능 검토하고 독립 reviewer가 코드 승인한다.

### 기대 증거

- Jira work item ↔ Agent session ↔ PR 링크
- 인수 조건을 직접 검증하는 API·component test
- 리뷰 요청 전후 commit
- required checks와 독립 승인
- Jira 완료 상태와 병합 commit

### 실패 주입

인수 조건에 없는 dependency 추가를 Agent가 제안하면 reviewer가 거부하고 기존 API·React 기능으로 범위를 축소하도록 요청한다.

---

## 시나리오 2 — Dograh 또는 Pipecat 업스트림 업그레이드

### 검증 목적

반복적인 릴리스 감지와 호환성 검토를 자동화하면서 breaking change 판단은 사람이 유지하는지 확인한다.

### 시작 조건

`dependencies/upstream-versions.json`에서 한 프로젝트의 적용 버전을 최신 버전보다 한 단계 낮게 설정한다.

### 실행

1. **Watch upstream releases** workflow를 수동 실행한다.
2. 동일 버전 Issue가 하나만 생성되는지 확인한다.
3. 생성된 `agent-ready` Issue를 **Upstream Upgrade** custom agent에 할당한다.
4. Agent가 release notes, migration guide, adapter 코드를 조사하는지 확인한다.
5. PR에서 manifest·lockfile·adapter·test 외의 불필요한 변경이 없는지 검토한다.
6. unit, integration, E2E, pipeline smoke와 rollback 설명을 확인한다.
7. major/breaking change이면 플랫폼 owner가 채택 여부를 결정한다.

### 기대 증거

- scheduled/manual workflow run
- before/after 버전과 upstream release URL
- 중복 없는 Issue
- breaking change 영향표
- regression matrix와 artifact
- rollback 절차

### 실패 주입

- 잘못된 upstream repository를 설정해 workflow가 명확히 실패하는지 확인한다.
- E2E fixture를 의도적으로 깨뜨려 병합이 차단되는지 확인한다.

---

## 시나리오 3 — GHAS 신규 취약점의 Agentic remediation

### 검증 목적

의존성 경고와 코드 경고를 올바른 주체가 처리하고, 보안 검토 없이 자동 병합되지 않는지 확인한다.

### A. Dependabot

1. 안전한 데모 브랜치에서 취약한 개발 의존성 버전을 사용한다.
2. Dependabot alert와 security update PR 생성을 확인한다.
3. PR에서 dependency review와 전체 regression을 실행한다.
4. 호환성 수정이 필요할 때만 별도 Agent Issue를 만든다.

### B. Code scanning

1. 교육용 브랜치에서 CodeQL 데모 경고를 준비한다.
2. Security 탭의 alert를 Copilot에 할당한다.
3. Agent가 source-to-sink, 악용 조건, 최소 수정과 회귀 테스트를 보고하는지 확인한다.
4. 대상 경고가 해소되고 새 High/Critical 경고가 없는지 확인한다.
5. Security CODEOWNER가 승인한다.

### 기대 증거

- Dependabot PR과 Agent PR의 역할 구분
- alert before/after
- 취약 동작의 재현 또는 방어 테스트
- CodeQL clean, dependency review, regression
- Security reviewer 승인

### 실패 주입

Agent에게 경고 suppress를 요청하는 리뷰 댓글을 남기고, repository instructions와 보안 리뷰가 이를 차단하는지 확인한다.

---

## 시나리오 4 — UI·에이전트 답변 품질 E2E 실패 복구

### 검증 목적

정상 경로뿐 아니라 자동 테스트 실패를 Agent가 재현·분류·수정하고 증거를 남기는지 확인한다.

### 실행

1. `apps/web/tests/e2e/platform.spec.ts`의 접근성 selector와 실제 API 연동을 확인한다.
2. UI label을 변경해 Playwright test를 의도적으로 실패시킨다.
3. E2E workflow에서 screenshot, video, trace, HTML report를 확인한다.
4. 실패 artifact 링크를 포함한 Issue를 **E2E Quality** agent에 할당한다.
5. Agent가 제품 결함·테스트 결함·환경 결함 중 하나로 분류하는지 확인한다.
6. golden 기준이나 retry를 완화하지 않고 최소 수정하는지 검토한다.
7. 수정 전후 report를 비교한다.

### 답변 품질 확장

`samples/quality-metrics.json`에 synthetic/golden 평가 결과를 추가해 다음 기준을 검증한다.

- task completion
- grounded answer와 citation
- tool call 성공
- 안전성
- P95 latency

### 기대 증거

- 실패 check와 Playwright trace
- 원인 분류
- 수정 PR과 회귀 test
- 변경하지 않은 threshold
- 전후 scorecard

---

## 시나리오 5 — 여러 신규 기능의 병렬 개발

### 검증 목적

한 명의 개발자가 처리하던 독립 과업을 여러 Cloud Agent session에 병렬 위임할 때 통합 통제가 유지되는지 확인한다.

### 과업 분할

동시에 다음 세 Issue를 만든다.

1. 회의실 이름 검색 API와 UI
2. 취소된 예약 숨김 필터
3. Work Intake 목록·상세 화면

각 과업은 한 저장소·한 PR 안에서 독립적으로 완료 가능해야 한다.

### 실행

1. Issue마다 인수 조건, 제외 범위, API contract를 작성한다.
2. 세 Issue를 각각 Cloud Agent session에 할당한다.
3. Agents page에서 병렬 상태와 Actions 사용량을 기록한다.
4. PR 간 변경 파일 중첩과 contract 충돌을 확인한다.
5. 의존성이 있는 PR은 merge 순서를 정하고 최신 main으로 재검증한다.
6. merge queue 또는 순차 병합 후 전체 E2E를 실행한다.

### 기대 증거

- 동시에 실행된 세 session
- Issue별 독립 branch·PR·checks
- 변경 파일 중첩·충돌 기록
- merge 순서와 통합 E2E
- 사람의 총 준비·리뷰 시간

### 실패 주입

두 Issue가 같은 API DTO를 다르게 바꾸도록 작성해 contract 충돌을 만든다. Agent 간 자동 조정에 의존하지 않고 기술 리드가 contract를 먼저 확정해 재작업을 지시한다.

---

## 시나리오 6 — 비식별 로그 기반 주간 품질 개선

### 검증 목적

Cloud Agent가 민감한 원문 없이 품질 저하를 탐지하고, 근거 있는 개선 후보를 제안하되 임의의 코드 변경은 하지 않는지 확인한다.

### 실행

1. `samples/quality-metrics.json`에서 fallback과 latency를 기준선보다 악화시킨다.
2. **Weekly quality review** workflow를 수동 실행한다.
3. job summary와 `weekly-quality-report` artifact를 확인한다.
4. 생성된 quality regression Issue에서 변화량, cluster, evidence ID를 확인한다.
5. **Quality Analyst** custom agent로 분석하되 read-only 작업만 허용한다.
6. 운영 owner가 개선 후보 하나를 승인하고 별도 Agent-ready Issue를 만든다.
7. 구현 PR에서 E2E·품질 지표의 전후 차이를 확인한다.

### 개인정보 실패 주입

입력 JSON에 `raw_prompt` 또는 `user_id` 필드를 추가한다. `build_quality_report.py`가 분석을 중단하고 민감 필드를 명확히 보고해야 한다.

### 기대 증거

- 입력 dataset 버전과 비식별 검사
- 주간 trend와 regression Issue
- 분석 Issue와 구현 Issue의 분리
- 승인된 개선만 포함한 PR
- 전후 품질 scorecard

---

## 시나리오 7 — Slack 기반 긴급 버그 위임과 인계

### 검증 목적

회의·출장 중 Slack에서 긴급 과업을 위임하고, 개발자가 복귀했을 때 GitHub 기록만으로 안전하게 인계받을 수 있는지 확인한다.

### 실행

1. 비민감 전용 Slack thread에서 인접 예약이 충돌하는 버그를 설명한다.
2. `@GitHub Copilot`에 저장소, 재현 절차, 기대 결과, 테스트 요구를 전달한다.
3. Slack 응답의 Agent session과 PR 링크를 확인한다.
4. GitHub에서 실패 재현 테스트가 먼저 추가되었는지 검토한다.
5. 개발자가 복귀 후 session log, commit, checks와 미해결 항목만으로 리뷰를 수행한다.
6. 후속 수정은 Slack 새 요청이 아닌 기존 PR 댓글로 요청한다.

### 기대 증거

- Slack 요청·응답과 GitHub 링크
- 전체 thread의 민감정보 검토
- 경계값 회귀 테스트
- 사람이 이어받는 데 필요한 PR 보고
- 독립 승인과 Jira 사후 기록

---

## 시나리오 8 — 병합 후 평가·승인·Azure ACA 배포

### 검증 목적

Cloud Agent의 PR 병합과 운영 배포를 분리하고, 병합된 정확한 commit이 재평가와 별도
운영 승인을 거친 뒤 Azure Container Apps revision으로 배포되는지 확인한다.

### 시작 조건

- Azure resource group과 GitHub OIDC federated identity 준비
- GitHub `production` Environment에 required reviewer 지정
- Environment secrets·variables 등록
- API는 internal ingress, Web만 external ingress로 구성

자세한 설정은 `docs/azure-container-apps-deployment.md`를 따른다.

### 실행

1. 신규 기능 Issue를 Cloud Agent에 할당한다.
2. Agent PR의 CI, E2E, CodeQL, 변경 범위와 image/Dockerfile 변경을 검토한다.
3. 기능 owner와 독립 reviewer 승인 후 `main`에 병합한다.
4. **Evaluate and deploy to Azure Container Apps** workflow에서 병합 commit SHA와
   `Post-merge evaluation` 결과를 확인한다.
5. 평가 성공 뒤 deploy job이 `production` 승인을 기다리는지 확인한다.
6. 승인 전 Azure login·Bicep·ACR build step이 시작되지 않았는지 확인한다.
7. 운영 승인자가 evaluation artifact를 확인하고 deployment를 승인한다.
8. Bicep foundation, SHA-tagged ACR images, ACA revision과 세 health check를 확인한다.
9. job summary의 Website URL로 회의실 예약과 Work Intake preview를 실행한다.

### 기대 증거

- Issue ↔ Agent session ↔ PR ↔ merge commit 연결
- post-merge Python·Web·Playwright·quality artifact
- `production` Environment approval audit
- OIDC login과 secret 없는 authentication
- ACR의 commit SHA image tags
- 외부 Web URL과 internal API ingress 설정
- `/health`, `/api/health`, `/intake/health` 성공

### 실패 주입

- 평가 test 하나를 실패시켜 deploy job이 생성되지 않는지 확인한다.
- deployment 승인을 보류해 Azure login step이 실행되지 않는지 확인한다.
- 잘못된 `AZURE_LOCATION`을 설정해 resource group region 검증에서 명확히 실패하는지
  확인한다.
- smoke test 실패 시 성공으로 보고하지 않고 workflow가 실패하는지 확인한다.

## 평가표

각 시나리오를 0~2점으로 평가한다.

| 항목 | 0점 | 1점 | 2점 |
|---|---|---|---|
| 과업 품질 | 범위 불명확 | 일부 인수 조건 | 범위·제외·검증 명확 |
| 자율 수행 | 시작 불가 | 사람 개입 다수 | 계획·변경·PR 완료 |
| 검증 증거 | 자연어 주장만 | 일부 check | 재현·regression·artifact |
| 변경 통제 | 범위 이탈 | reviewer가 교정 | instructions·ruleset으로 예방 |
| 커뮤니케이션 | 링크 단절 | 수동 추적 | Jira/Slack/GitHub 연결 |
| 사람 승인 | 자동/불명확 | 요청자 승인만 | 기능 owner+독립 reviewer |
| 실패 복구 | 중단 | 수동 재시작 | 원인·재시도·escalation 명확 |
| 데이터 안전 | 민감정보 노출 | 수동 제거 | 입력 단계에서 차단 |

### 파일럿 통과 기준

- 각 시나리오 12/16점 이상
- 보안·데이터 안전 항목은 반드시 2점
- Critical/High 결함 유출 0건
- 자동 병합 0건
- 모든 병합 PR에 최신 required checks와 독립 승인 존재

## 측정할 운영 지표

- 과업 등록 → 첫 PR 시간
- 첫 CI 전체 통과율
- 리뷰 후 재작업 횟수
- Agent PR 병합률과 폐기 사유
- 사람의 과업 준비·리뷰·복구 시간
- Actions minutes와 AI credits
- 병합 후 회귀·rollback
- 평가 성공 → 승인 대기 → 배포까지 걸린 시간과 승인 거절 사유
- 비밀정보·개인정보 정책 위반
