# Cross-Project Brain

[English README](./README.md)

Cross-Project Brain은 Codex와 Claude Code를 위한 memory framework입니다.

매 작업마다 긴 상위 문서를 다시 읽게 하기보다, 작업 중 확인된 재사용 가능한 lesson을 구조적으로 저장하고 다음 작업에서 다시 쓰는 데 초점을 둡니다.

한 줄로 말하면:

- 현재 프로젝트에서만 유효한 맥락은 `team` / `project brain`에 남기고
- 다음 프로젝트까지 가져갈 배움은 `global brain`에 남기고
- 장비별 quirk는 `device brain`에 분리하고
- 에이전트는 합쳐진 `runtime brain`을 읽고 작업합니다

## 먼저 알아야 할 것

- 이 저장소는 다른 저장소에 설치해 쓰는 재사용 가능한 framework core입니다.
- `v1.0.0`부터 첫 stable public contract를 명시합니다.
- 사용자는 계속 현재 프로젝트 repo에서 일하고, CPB가 개인 repo와 로컬 상태를 뒤에서 연결합니다.
- career 문서는 매 작업마다 자동 생성하지 않고, 사용자가 요청할 때만 만듭니다.

## 무엇을 해결하나

- 같은 문제를 다음 작업과 다음 프로젝트에서 다시 설명하는 비용을 줄입니다.
- 같은 사용자가 데스크탑과 랩탑을 오갈 때 lesson을 이어서 씁니다.
- 팀 repo에서도 공용 규칙과 개인 기억을 분리할 수 있게 합니다.
- 에이전트가 긴 README 전체를 매번 다시 읽지 않고, runtime brain 중심으로 작업하게 합니다.

## 이런 저장소에 특히 맞습니다

- Codex나 Claude Code를 반복적으로 쓰는 실제 제품/서비스 저장소
- 같은 사람이 여러 프로젝트를 넘나들며 problem-solving pattern을 이어가고 싶은 경우
- shared repo에서 팀 규칙과 개인 lesson을 분리하고 싶은 경우
- 설치 후에는 일반적인 `git pull` / `git push` 흐름을 유지하고 싶은 경우

## 빠른 설치

현재 작업 중인 저장소 루트에서 설치하는 방식을 권장합니다.

공개 저장소에서 바로 설치:

```bash
tmpdir="$(mktemp -d)" && git clone --depth 1 https://github.com/<owner>/cross-project-brain.git "$tmpdir" && bash "$tmpdir/scripts/cpb-install.sh" --personal-repo "$HOME/.cpb-personal" --shared-repo && rm -rf "$tmpdir"
```

로컬에 framework checkout이 이미 있을 때:

```bash
bash /path/to/cross-project-brain/scripts/cpb-install.sh --personal-repo "$HOME/.cpb-personal" --shared-repo
```

설치 후 먼저 확인할 것:

```bash
bash scripts/cpb-doctor.sh
cpb status
```

처음 설정이 끝나면, 의도된 일상 흐름은 여전히 현재 프로젝트 repo에서의 일반 `git pull` / `git push` 입니다.

설치 옵션과 세부 동작은 [INSTALLATION.md](./INSTALLATION.md)를 보면 됩니다.

## CPB로 작업하는 방식

보통은 아래 흐름으로 씁니다.

1. 현재 repo에 CPB를 설치합니다.
2. 에이전트가 `AGENTS.md` 또는 `CLAUDE.md`를 읽게 둡니다.
3. 평소처럼 현재 repo 작업 프롬프트를 줍니다.
4. 작업 중 durable lesson이 생기면 에이전트가 맞는 brain layer에 기록합니다.
5. finish-check로 작업을 닫고, 다음 작업은 갱신된 runtime brain에서 시작합니다.

즉 사람은 평소처럼 repo 작업을 지시하고, low-level CPB script는 필요할 때 에이전트가 처리하는 방식이 기본입니다.

직접 상태를 보거나 동작을 호출하고 싶을 때 유용한 명령:

- `cpb status`
- `cpb profiles`
- `cpb apply team-local`
- `cpb scaffold-design-system`
- `cpb import-starter-skills --preset web`
- `bash scripts/cpb-doctor.sh`

## 예시 프롬프트

- `현재 프로젝트 구조를 요약하고 주요 서브시스템을 정리해줘.`
- `이 repo에 <feature>를 구현하고, 작업 중 durable lesson이 나오면 같이 기록해줘.`
- `이 PR을 리뷰해서 회귀, 리스크, 테스트 누락을 먼저 알려줘.`
- `이 shared repo는 project brain은 local-only로 두고, global brain은 내 private repo로 sync되게 설정해줘.`
- `이 repo의 초기 design system을 scaffold하고, DESIGN.md를 작업 계약으로 써줘.`
- `저장된 lesson을 바탕으로 취업용 한국어 프로젝트 소개 문서를 만들어줘.`

## 설치 후 꼭 이해해야 할 핵심 개념

- `team-brain`
  - 팀이 공유하는 리뷰된 공용 규칙
- `global brain`
  - 다음 프로젝트까지 가져갈 reusable lesson
- `project brain`
  - 이 저장소에서만 유효한 lesson
- `device brain`
  - 현재 장비에서만 유효한 quirk
- `runtime brain`
  - 에이전트가 실제로 읽는 병합된 live brain

핵심은 공용 규칙, 개인 reusable lesson, 장비 전용 상태를 섞지 않는 것입니다.

## 권장 운영 구조

실전에서는 보통 아래 3층 구조가 가장 안전합니다.

1. 현재 프로젝트 repo
   - 코드
   - `brains/team-brain`
   - 정말 필요한 shared 문서
2. 개인 private GitHub repo
   - `global brain`
   - 개인 career docs
   - 필요하면 개인용 `project brain` overlay
3. 현재 장비 로컬
   - `device brain`
   - `runtime brain`
   - shared repo에서의 local-only `project brain`

권장 기본값:

- `CPB_OPERATOR`
  - 보통 내 GitHub username
- 개인 private repo 이름
  - 보통 `<github-username>/cpb-personal`
- shared/team repo
  - `project brain`은 local-only 또는 personal-private-repo 경로 권장
- solo repo
  - `project brain`을 repo-tracked로 둬도 무방

## 주요 기능

- project profile scaffold
  - `config/cpdb/project-profile.json`
  - `docs/cpb/PROJECT_PROFILE.md`
- starter-skill import
  - pinned local registry 기반
  - `skills.lock.json`, `skill-role-map.json` 생성
- design-system scaffold
  - `DESIGN.md`를 빠른 작업 계약으로 사용
  - `docs/arch/design-system.md`에 더 깊은 근거와 토큰 레퍼런스 정리
- NeuronFS prebuilt release flow
- finish-check workflow
- profile wrapper
  - `cpb profiles`
  - `cpb apply team-local`
  - `cpb apply team-personal`
- on-demand career docs
  - 필요할 때만 생성
  - 기본 draft는 operator-scoped 경로 사용

## v1.0.0 안정성 및 호환성

`v1.0.0`에서 stable public contract로 보는 범위:

- `scripts/cpb-install.sh` 와 공개 `cpb` CLI 엔트리포인트를 중심으로 한 설치 흐름
- `AGENTS.md`, `CLAUDE.md`, `config/cpdb/*`, project-profile scaffold, `brains/team-brain/brain_v4` 로 이어지는 기본 생성 계약
- `team`, `global`, `project`, `device`, `runtime` brain 분리 모델
- `DESIGN.md`, `docs/arch/design-system.md`, `config/cpdb/design-system.json` 을 중심으로 한 optional design-system scaffold
- starter-skill import의 lockfile / role-map 흐름
- finish-check workflow

계속 개선될 수 있지만 breaking change로 보지 않는 범위:

- preset catalog, starter registry, template 문구
- 추가 helper script, 설치 prompt, profile wrapper
- 문서 깊이, 예시, release note 구조

위 stable surface를 깨는 변경은 새 major version에서만 나가야 합니다.

## 설치 후 어떤 파일이 생기나

git으로 같이 관리되는 대표 파일:

- `AGENTS.md`
- `CLAUDE.md`
- `config/cpdb/*`
- `docs/cpb/PROJECT_PROFILE.md`
- `.githooks/*`
- `brains/team-brain/brain_v4`
- `scripts/cpb-*`

로컬 전용 대표 경로:

- `.agent/cross-project-brain/<project-id>/device-brain/brain_v4`
- `.agent/cross-project-brain/<project-id>/runtime-brain/brain_v4`
- `.tools/neuronfs`

전체 파일 구조와 세부 생성물은 [INSTALLATION.md](./INSTALLATION.md)에 정리되어 있습니다.

## 어디까지 이 README를 읽으면 되나

빠르게 시작하려면 이 README에서는 아래만 보면 충분합니다.

1. 무엇을 해결하나
2. 빠른 설치
3. 설치 후 꼭 이해해야 할 핵심 개념
4. v1.0.0 안정성 및 호환성

그 다음 상세 문서는 필요할 때만 보면 됩니다.

## 더 자세한 문서

- [INSTALLATION.md](./INSTALLATION.md)
  - 설치 옵션, 설치 스크립트 동작, 생성 파일 구조
- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md)
  - framework mechanics, 핵심 개념, 기본 운영 규칙
- [PUBLIC_CORE_BOUNDARY.md](./PUBLIC_CORE_BOUNDARY.md)
  - 공개 코어에 들어갈 것과 제외할 것
- [ADAPTER_LINEAGE.md](./ADAPTER_LINEAGE.md)
  - 어떤 upstream pattern을 바탕으로 current adapter가 정리됐는지
- [FILESET.md](./FILESET.md)
  - 공개 repo로 분리할 때 포함/제외할 파일 기준
- [MIGRATION_MAP.md](./MIGRATION_MAP.md)
  - 프로젝트 전용 이름을 generic 이름으로 치환하는 기준
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
  - upstream attribution과 고지 의무
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
  - 공개 직전 점검 항목

템플릿과 실행 자산은 여기 있습니다.

- [`templates/`](./templates/)
  - `AGENTS.md`, `CLAUDE.md`, env example, config example
- [`scripts/`](./scripts/)
  - 설치, scaffold, logging, finish-check, autogrowth helper script
- [`tests/`](./tests/)
  - public core script test
