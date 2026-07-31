# Lightweight Upgrade Simulation

대형 외부 프로젝트 대신 이 저장소의 deterministic Mini Agent를 두 개의 작은
versioned component로 나눠 Agentic DevOps upgrade 흐름을 시연합니다.

| Component | 역할 | 실제 코드 |
|---|---|---|
| `mini-agent-runtime` | 입력 검증, intent별 응답 계약 | `apps/api/meeting_api/main.py` |
| `mini-pipeline-sdk` | normalize → classify → respond 단계 | `apps/api/meeting_api/main.py` |

`upstream-versions.json`은 플랫폼에 현재 적용된 버전이고,
`samples/upstream-releases.json`은 데모용 release catalog입니다. Actions workflow는 두
파일을 비교해 새 버전 하나당 중복 없는 upgrade Issue를 생성합니다.

실습할 때 catalog의 `tag_name`만 올리면 외부 API나 대형 컨테이너 없이 즉시 upgrade
감지 → Cloud Agent 할당 → 테스트 PR 흐름을 보여줄 수 있습니다.
