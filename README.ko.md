# Cross-Project Brain

[English README](./README.md)

Cross-Project Brain은 Codex와 Claude Code에서 반복 토큰 낭비를 줄이고, 에이전트가 작업 중 배운 재사용 가능한 교훈을 구조적으로 기록하며, 사용자가 프로젝트 구조 이해, 문제 해결 추적, 면접 준비에 그 결과를 다시 활용할 수 있게 만드는 프레임워크입니다.

이 저장소는 다른 저장소에 설치해 재사용할 수 있는 **프레임워크 코어 초안**입니다.

## 이런 상황에서 특히 유용합니다

### 1. 한 프로젝트에서 배운 것을 다음 프로젝트로 이어가고 싶을 때

이 프레임워크의 핵심은 여기에 있습니다.

- 현재 프로젝트에서 배운 교훈 중 범용적인 것은 `global-operators/<github-username>`에 남길 수 있습니다.
- 다음 프로젝트를 시작해도 같은 사람이 같은 GitHub username을 `CPB_OPERATOR`로 쓰면, 그 교훈을 다시 읽고 작업을 시작할 수 있습니다.
- 그래서 프로젝트가 바뀔 때마다 처음부터 다시 배우지 않아도 됩니다.
- 즉 코드만 옮기는 것이 아니라, 문제 해결 방식과 판단 기준도 같이 이어집니다.

쉽게 말하면:

- `project brain` = 이 프로젝트에서만 유효한 배움
- `global brain` = 다음 프로젝트에도 가져갈 배움

### 2. AI 에이전트를 장기적으로 더 똑똑하게 쓰고 싶을 때

이 프레임워크는 매 작업마다 긴 상위 문서를 다시 읽게 하기보다, 이미 배운 lesson을 구조적으로 다시 쓰게 하는 쪽에 가깝습니다.

- 공통 규칙은 얇게 유지합니다.
- 재사용 가치가 있는 lesson만 남깁니다.
- 다음 작업은 갱신된 runtime brain으로 시작합니다.
- 취준 문서는 필요할 때만 생성해 토큰 낭비를 줄입니다.

### 3. 데스크탑과 랩탑을 번갈아 쓸 때

같은 사용자가 여러 장비를 오갈 때도 이 구조가 유리합니다.

- 같은 GitHub username을 `CPB_OPERATOR`로 쓰면 `project-operators/<github-username>`와 `global-operators/<github-username>`가 git으로 같이 이동합니다.
- 기본값은 GitHub username으로 두는 것이 가장 단순합니다.
- 랩탑에서 배운 교훈을 push하고 데스크탑에서 pull하면, 같은 사람이 쌓은 학습이 그대로 이어집니다.
- 장비에만 필요한 quirk는 `.agent/.../device-brain/brain_v4`에 남아서 다른 장비를 오염시키지 않습니다.
- git hook가 runtime brain을 다시 만들어 주기 때문에, pull 직후 새 기억을 바로 읽을 수 있습니다.

개인 환경에서는 보통 이렇게 씁니다.

1. 데스크탑과 랩탑 모두 같은 `CPB_OPERATOR`를 씁니다. 보통 GitHub username을 씁니다.
2. tracked brain 변경을 일반 코드처럼 commit/push/pull 합니다.
3. 장비별 문제는 `device-brain`에만 남깁니다.

### 4. 한 프로젝트를 여러 사람이 같이 운영할 때

팀 협업에서도 쓸 수는 있지만, 이 경우에는 운영 규칙을 더 엄격하게 잡아야 합니다.

- `team-brain`에는 검증된 공통 규칙만 넣습니다.
- 사람마다 다른 기억은 각자 `project-operators/<github-username>`와 `global-operators/<github-username>`에 남깁니다.
- 장비별 문제는 `device-brain`으로 분리합니다.
- 개인 lesson을 팀 공통 규칙으로 올릴 때는 리뷰 후 승격하는 방식이 안전합니다.

## 권장 실전 운영 모델

실제로 오래 쓰려면 보통 아래처럼 3층으로 나누는 것이 가장 안전합니다.

1. 현재 프로젝트 repo
   - 코드
   - `brains/team-brain`
   - 정말 필요한 shared 문서만
2. 내 개인 private GitHub repo
   - `global brain`
   - 개인 career docs
3. 현재 장비 로컬
   - `device brain`
   - `runtime brain`
   - 필요하면 로컬 전용 `project brain`

이렇게 두면:

- 프로젝트를 바꿔도 내 배움을 이어갈 수 있고
- 집 데스크탑과 회사 랩탑이 같은 기억을 쓸 수 있고
- 팀 repo에 내 개인 lesson, 개인 취준 문서, 개인 스타일이 섞이지 않습니다

권장 설정은 보통 이렇습니다.

- `CPB_OPERATOR`
  - 내 GitHub username
- 내 개인 private GitHub repo 이름
  - 보통 `<github-username>/cpb-personal`
- `CPB_PERSONAL_REPO`
  - 내 private GitHub repo 체크아웃 루트
- `CPB_GLOBAL_BRAIN`
  - 내 private GitHub repo 체크아웃 안의 `brains/global-operators/<github-username>/brain_v4`
- `CPB_PROJECT_BRAIN`
  - 개인 repo나 solo repo에서는 repo-tracked를 써도 됨
  - 팀/shared repo에서는 `.agent/...` 아래 local-only 경로를 권장
  - 다만 팀 repo를 더럽히지 않으면서도 내 데스크탑/랩탑 간 프로젝트 전용 학습을 같이 들고 가고 싶다면, personal private repo 안의 프로젝트 전용 경로를 쓰는 것도 가능
- `CPB_CAREER_DOCS_ROOT`
  - 내 private GitHub repo 안의 `docs/career/operators/<github-username>`

### 무엇이 어디에 저장되나

| 구분 | 들어가는 것 | 어떻게 sync 되나 | 팀원에게 보이나 |
| --- | --- | --- | --- |
| 현재 프로젝트 repo | 코드, `AGENTS.md`, `CLAUDE.md`, `scripts/cpb-*`, `.githooks`, `team-brain`, shared 승격 문서 | 현재 프로젝트 git remote로 `commit/push/pull` | 보임 |
| 내 개인 private GitHub repo | `global brain`, 개인 career docs, 개인 CPB 자산, 필요하면 개인용 `project brain` overlay | 내 private GitHub repo로 `commit/push/pull` | 안 보이게 운영 가능 |
| 현재 장비 로컬 | `device brain`, `runtime brain`, 필요하면 local-only `project brain` | git 없음 | 안 보임 |

쉽게 말하면:

- 프로젝트 repo는 **CPB 골격과 공용 규칙**을 공유하는 곳입니다.
- 개인 private repo는 **내가 프로젝트를 바꿔도 들고 가고 싶은 배움과 문서**를 모아두는 곳입니다.
- 로컬 전용 영역은 **이 장비에서만 필요한 상태**를 담습니다.

중요한 점:

- 개인/solo repo에서는 `project brain`도 repo-tracked로 두어도 됩니다.
- 팀/shared repo에서는 `project brain`을 local-only로 두는 편이 안전합니다.
- 다만 팀/shared repo에서도, 프로젝트 전용 학습을 내 장비들끼리만 공유하고 싶다면 `project brain`을 personal private repo 안에 둘 수 있습니다.
- 그래서 팀 프로젝트에서 CPB가 문제를 만들지 않게 하려면, 팀 repo에는 공용 자산만 남기고 개인 자산은 private repo나 로컬로 분리하는 것이 핵심입니다.

## 빠른 설치

이 프레임워크는 **지금 작업 중인 저장소 루트에서 명령어 한 줄**로 설치하는 방식을 권장합니다.

공개 저장소에서 바로 설치할 때:

```bash
tmpdir="$(mktemp -d)" && git clone --depth 1 https://github.com/<owner>/cross-project-brain.git "$tmpdir" && bash "$tmpdir/scripts/cpb-install.sh" --personal-repo "$HOME/.cpb-personal" --shared-repo && rm -rf "$tmpdir"
```

로컬에 프레임워크 체크아웃이 이미 있을 때:

```bash
bash /path/to/cross-project-brain/scripts/cpb-install.sh --personal-repo "$HOME/.cpb-personal" --shared-repo
```

이 설치 스크립트는 기본적으로 아래를 한 번에 처리하도록 설계합니다.

- 공개용 helper script 복사
- `AGENTS.md`, `CLAUDE.md` 배치
- `brains/` 기본 구조 생성
- 초기 project profile scaffold 생성
- `.githooks/` 설정
- shell auto-env 연결
- NeuronFS 설치와 hook patch
- runtime brain 첫 rebuild

설치 과정에서는 첫 project profile scaffold도 같이 만듭니다.

- `config/cpdb/project-profile.json`
- `docs/cpb/PROJECT_PROFILE.md`
- `brains/team-brain/brain_v4/prefrontal/01_project-profile.md`

이 단계는 프로젝트를 완전히 이해한다고 주장하는 것이 아니라, 저장소에 보이는 흔한 신호를 바탕으로 첫 문맥을 잡아주는 수준입니다. 현재는 `package.json`, `vite.config.*`, `next.config.*`, Java build 파일, `go.mod`, `pyproject.toml`, `Cargo.toml`, `Dockerfile`, monorepo 레이아웃 등을 바탕으로 type과 stack을 추정합니다.

TTY에서 대화형으로 실행하면, 명시적으로 넘기지 않은 경우 아래를 물어봅니다.

- project type
- 짧은 project summary
- shared/team repo 여부
- `web-app`, `fullstack-app`, `greenfield` repo라면 초기 design system scaffold 생성 여부

아직 거의 비어 있는 repo라면, 이미 알고 있는 척하지 않고 `greenfield` 타입과 TODO placeholder로 scaffold를 만듭니다.

설치 시에는 pinned upstream repo에서 curated starter skill 세트를 가져오도록 설정할 수도 있습니다. 이 경로는 기본으로 켜지지 않고, 플래그나 대화형 prompt로 opt-in 해야 합니다. 기본 registry는 허용한 permissive license와 고정 commit ref만 사용하도록 제한되어 있고, 가져온 skill은 `.codex/vendor-skills/`에 vendor되고 `.codex/skills/` wrapper, `config/cpdb/skills.lock.json`, `docs/cpb/THIRD_PARTY_NOTICES.md`까지 같이 생성합니다.

원하면 초기 design system scaffold도 같이 만들 수 있습니다. 이 경로는 `config/cpdb/design-system.json`, `docs/design-system.md`, `docs/ui-specs/foundations.md`, `brains/team-brain/brain_v4/cortex/02_design-system.md` 를 생성합니다. 이것은 최종 브랜드를 확정하는 기능이 아니라, project profile을 바탕으로 첫 설계 방향을 잡아 주는 시작점입니다.

그리고 personal repo를 함께 지정했다면:

- 권장 GitHub private repo 이름을 `<github-username>/cpb-personal`로 가정합니다
- `gh` 인증이 되어 있으면 그 repo가 실제로 있는지 조회합니다
- repo가 있으면 local personal repo의 `origin`을 자동으로 연결하려고 시도합니다
- repo가 없으면 먼저 이름과 용도를 설명하고, 생성할지 물어본 뒤에만 `gh repo create ... --private`를 실행합니다
- 비대화형 환경이거나 `gh` 인증이 없으면 생성은 하지 않고, 먼저 만들라고 안내만 합니다

위 한 줄 설치에서 `--personal-repo ... --shared-repo`를 함께 주면, 개인 private repo 연동까지 한 번에 끝납니다.

처음 설치에서 자주 쓰는 옵션:

- `--project-type <type>`
  - 첫 project profile type을 강제로 지정합니다
- `--project-summary <text>`
  - 자동 추정이나 TODO 대신 첫 summary를 직접 넣습니다
- `--with-starter-skills`
  - 설치 중 curated starter skill preset을 같이 import합니다
- `--starter-skill-preset <name>`
  - `minimal`, `web`, `backend`, `fullstack`, `growth` 같은 preset을 고릅니다
- `--starter-skill-registry <path>`
  - 기본 pinned registry 대신 로컬 custom registry 파일을 씁니다
- `--scaffold-design-system`
  - 설치 중 초기 design system scaffold를 같이 생성합니다
- `--non-interactive`
  - prompt 없이 스크립트형 설치로 고정합니다
- `--shared-repo`
  - 첫 scaffold와 personal-brain wiring을 shared/team repo 기준으로 잡습니다

설치가 끝나면 먼저 아래 명령으로 상태를 확인하면 됩니다.

```bash
bash scripts/cpb-doctor.sh
```

이 설정이 끝나면 보통 사용자는 추가 CPB 명령 없이 이렇게만 쓰면 됩니다.

- 현재 프로젝트 repo에서 `git pull`
  - 개인 private repo를 먼저 pull 해보고
  - 그 다음 runtime brain을 다시 만듭니다
- 현재 프로젝트 repo에서 `git push`
  - 개인 private repo 변경을 commit/pull/push 해보고
  - 그 다음 현재 프로젝트 push를 진행합니다

즉 초기 설치 이후에는 보통 **평소처럼 현재 프로젝트 repo에서 `git pull` / `git push`만 쓰면 됩니다.**

단, 데스크탑/랩탑 간 실제 동기화는 **개인 private repo에 git remote upstream이 연결돼 있을 때** 완전히 동작합니다.

## 환경 프로필 wrapper

공개 CPB 코어는 여전히 저수준 스크립트를 기본으로 제공합니다.

- `cpb-install.sh`
- `cpb-setup-personal-repo.sh`
- `cpb-setup-git-hooks.sh`
- `cpb-setup-shell.sh`
- `cpb-doctor.sh`

그리고 이제 공용 프로필 wrapper도 같이 제공합니다.

- `setup-cpb-profile.sh`

이 wrapper는 아래 같은 실제 운영 모드를 바로 고를 수 있게 해줍니다.

- 팀 공유 repo + project brain 로컬 유지
- 팀 공유 repo + project brain 개인 private repo 공유
- 개인 repo + project brain 현재 repo 추적
- 개인 repo + project brain 개인 private repo 공유

내장 프로필은 다음과 같습니다.

- `team-local`
- `team-personal`
- `solo-tracked`
- `solo-personal`

`bash scripts/cpb-setup-shell.sh` 후 `source ~/.bashrc`를 하면 기본 인터페이스는 이렇게 됩니다.

```bash
cpb profiles
cpb status
cpb apply team-local
cpb apply team-personal
```

fallback 명령도 그대로 됩니다.

```bash
bash scripts/setup-cpb-profile.sh status
```

소비자 repo가 원하면 이 위에 더 짧은 product alias를 얹을 수는 있지만, 이제 profile 기반 초기 설정과 상태 확인 자체는 공개 CPB 코어의 `cpb ...` 인터페이스만으로도 됩니다.

## Starter Skill Import

공개 CPB는 기본으로 외부 skill 본문을 같이 싣지 않지만, 원하면 curated starter set을 vendor할 수 있습니다.

설치 후 수동 import:

```bash
bash scripts/cpb-import-starter-skills.sh --preset web
```

이 명령은 아래를 합니다.

- local starter registry에 적힌 pinned upstream skill repo를 clone
- 가져온 파일을 `.codex/vendor-skills/` 아래에 vendor
- `.codex/skills/` 아래에 managed wrapper 생성
- `config/cpdb/skill-role-map.json` 생성
- `config/cpdb/skills.lock.json` 생성
- `docs/cpb/THIRD_PARTY_NOTICES.md` 재생성

기본 registry는 설치 뒤 `config/cpdb/starter-skill-registry.json` 에 놓입니다. 여기에는 아래 정보가 들어갑니다.

- upstream repo URL
- pinned ref
- allowlisted license
- import할 source path
- local skill 이름, alias, role

framework core repo 자체에서도 `cpb import-starter-skills --list-presets` 를 바로 쓸 수 있도록, 설치 전에는 `templates/config/starter-skill-registry.json` 으로 fallback 하도록 되어 있습니다.

## 초기 Design-System Scaffold

초기 design system scaffold는 설치 중에도 만들 수 있고, 나중에 다시 생성할 수도 있습니다.

설치 중에 같이 만들려면:

```bash
bash scripts/cpb-install.sh --scaffold-design-system
```

나중에 다시 만들거나 덮어쓰려면:

```bash
cpb scaffold-design-system
cpb scaffold-design-system --style editorial --primary "#9A3412" --motion high --force
```

생성되는 산출물:

```text
config/
  cpdb/
    design-system.json

docs/
  design-system.md
  ui-specs/
    foundations.md

brains/
  team-brain/
    brain_v4/
      cortex/
        02_design-system.md
```

이 scaffold는 아래 preset 중 하나를 기준으로 잡습니다.

- `product-ui`
- `console`
- `editorial`
- `concept-starter`

`design-system.json` 은 에이전트와 후속 tooling이 읽는 machine-readable source이고, Markdown 문서는 사람이 검토하고 다듬는 용도입니다. team-brain seed는 에이전트가 매 작업마다 긴 문서를 다시 읽지 않아도 되도록 짧게 남겨 둔 포인터입니다.

## 설치 후 저장소 구조

설치가 끝나면 보통 아래 구조가 생깁니다.

### git으로 같이 관리되는 파일

```text
AGENTS.md
CLAUDE.md

config/
  cpdb/
    cpb.env.example
    project-profile.json
    starter-skill-registry.json
    skill-role-map.example.json
    skill-role-map.json
    skills.lock.json

docs/
  cpb/
    PROJECT_PROFILE.md
    THIRD_PARTY_NOTICES.md

.codex/
  skills/
  vendor-skills/

brains/
  team-brain/brain_v4/
  project-operators/<github-username>/brain_v4/
  global-operators/<github-username>/brain_v4/

.githooks/
  post-merge
  post-checkout
  post-rewrite
  pre-push

scripts/
  cpb-*.mjs
  cpb-*.sh
  cpb-*.cjs
  project-brain-autoenv.bash
```

중요한 점:

- `team-brain`은 현재 프로젝트 repo에 남습니다.
- `--personal-repo`를 썼다면 `global-operators/<github-username>`는 보통 개인 private repo 쪽으로 갑니다.
- `--shared-repo`를 썼다면 `project-operators/<github-username>`도 보통 로컬 `.agent/...` 쪽으로 빠집니다.

각 역할:

- `AGENTS.md`, `CLAUDE.md`
  - 에이전트에게 brain 사용법을 알려주는 얇은 안내판
- `brains/team-brain/brain_v4`
  - 팀 공통 규칙
- `brains/project-operators/<github-username>/brain_v4`
  - 현재 프로젝트 전용 lesson
- `brains/global-operators/<github-username>/brain_v4`
  - 다른 프로젝트에도 들고 갈 lesson
- `.githooks/*`
  - pull, rebase, 브랜치 전환 뒤 runtime brain 갱신
  - `pre-push`는 개인 private repo sync를 먼저 시도
- `scripts/*`
  - 설치, rebuild, logging, finish-check, autogrowth 같은 공개용 helper 스크립트
  - `cpb-setup-personal-repo.sh`로 개인 private repo 연동 가능
  - `cpb-doctor.sh`로 현재 wiring 상태를 한 번에 점검 가능

### 내 컴퓨터에만 생기는 파일

이 파일들은 현재 장비 전용이거나, 로컬 툴 설치 결과입니다.

```text
.agent/cross-project-brain/<project-id>/
  device-brain/brain_v4/
  runtime-brain/brain_v4/

.tools/neuronfs/
```

각 역할:

- `device-brain/brain_v4`
  - 현재 장비에서만 필요한 lesson
- `runtime-brain/brain_v4`
  - 에이전트가 실제로 읽는 합본 brain
- `.tools/neuronfs`
  - NeuronFS CLI와 patched hook가 설치되는 위치

### 사용자 학습 문서 생성 안내

이 문서들은 매 작업마다 자동으로 생기지 않습니다. 사용자가 필요할 때 요청하면, 에이전트가 저장된 lesson과 현재 프로젝트 정보를 읽어 정리해서 만듭니다.

```text
docs/career/operators/<github-username>/<role>/<language>/
  interview-answers.md
  star-examples.md
  portfolio-projects.md
  resume-lines.md

docs/career/shared/<language>/
  project-overview.md
  architecture-decisions.md
  problem-solving-index.md
```

이 문서들의 용도는 보통 아래와 같습니다.

- 프로젝트 이해
  - `project-overview.md`
  - `architecture-decisions.md`
- 문제 해결 학습 정리
  - `problem-solving-index.md`
- 면접 준비 / 취준 정리
  - `interview-answers.md`
  - `star-examples.md`
  - `portfolio-projects.md`
  - `resume-lines.md`

보통 이런 식으로 요청합니다.

- `프론트엔드 취준 문서 정리해줘`
- `백엔드 영어 이력서 문장 정리해줘`
- `프로젝트 구조 설명 문서 만들어줘`
- `아키텍처 결정 이유를 한국어로 정리해줘`

이렇게 요청하면 에이전트는 보통 아래 순서로 동작합니다.

1. 관련 role lesson과 현재 프로젝트 문서를 읽습니다.
2. 요청한 목적에 맞는 문서 종류를 고릅니다.
3. 요청한 언어에 맞는 경로를 선택합니다.
4. 기본적으로 `operators/<github-username>/...` 아래 기존 파일을 업데이트하고, 없으면 새로 만듭니다.
5. 공유용 승격을 요청한 경우에만 `shared/...`에 반영합니다.

기본 경로를 `operators/<github-username>/...`로 두는 이유는, 여러 사람이 같은 저장소에서 일할 때도 개인 draft끼리 바로 덮어쓰지 않게 하기 위해서입니다.
`shared/...`를 수정한 경우에는 finish-check도 명시적 publish 승인과 함께 끝내야 합니다.

팀 프로젝트나 회사 repo처럼 공용 저장소와 개인 문서를 섞고 싶지 않다면:

- `CPB_CAREER_DOCS_ROOT`를 내 private GitHub repo 경로로 잡습니다.
- 그러면 취준 문서와 설명 문서는 그 개인 repo 안에서 버전 관리할 수 있습니다.
- 현재 코드 repo에는 shared로 승격한 문서만 남기면 됩니다.

즉 이 문서들은 단순 출력물이 아니라, 사용자가 프로젝트를 이해하고 학습하고 면접 준비에 활용하기 위한 사용자용 정리 문서입니다.

중요한 표현 규칙:

- 취준 문서는 프로젝트 내부 기능명, 변수명, 테이블명, 내부 닉네임을 그대로 복사하는 문서가 아닙니다.
- 외부 면접관이나 채용 담당자가 이해할 수 있는 기술 언어로 먼저 설명해야 합니다.
- 내부 이름이 꼭 필요하면 괄호나 근거 섹션에서만 한 번 덧붙입니다.

예:

- 내부 이름보다 `핵심 분석 API`, `비동기 분석 파이프라인 준비 상태`, `계약 불일치`, `세션 요약 기반 데이터 흐름` 같은 표현을 우선합니다.

## 작업할 때는 어떻게 쓰이나

평소 작업 흐름은 이렇게 이해하면 됩니다.

1. 사용자가 평소처럼 작업을 지시합니다.
2. 에이전트가 `AGENTS.md`나 `CLAUDE.md`를 읽습니다.
3. shell auto-env가 `runtime-brain/brain_v4`를 연결합니다.
4. 에이전트가 작업을 해결합니다.
5. 재사용할 lesson이 생기면 project/global/device brain 중 맞는 곳에 기록합니다.
6. runtime brain을 다시 만듭니다.
7. 다음 작업은 갱신된 brain을 읽고 시작합니다.

한 줄로 줄이면:

- 체크인된 brain은 오래 가는 공유 기억
- 로컬 brain은 장비 전용 또는 합본 상태
- career 문서는 필요할 때만 생성되는 출력물

## 취준 문서는 어디에 어떻게 쌓이나

취준 문서는 아래 기준으로 나누되, 기본 위치는 개인 draft 경로입니다.

- `role`
  - `frontend`, `backend`, `design`, `platform`, `security`, `testing`, `shared`
- `language`
  - 보통 `ko`, `en`
- `document kind`
  - `interview-answers.md`
  - `star-examples.md`
  - `portfolio-projects.md`
  - `resume-lines.md`

쉽게 풀면:

- `role`
  - 어떤 직무로 지원할 때 볼 문서인가
  - `frontend` = 프론트엔드 직무용
  - `backend` = 백엔드 직무용
  - `design` = 디자인 직무용
  - `platform` = 인프라, 운영, CI/CD, 관측 직무용
  - `security` = 보안 직무용
  - `testing` = QA, 테스트, 검증 직무용
  - `shared` = 특정 직무 하나가 아니라 여러 직무에 공통으로 쓰는 문서
- `language`
  - 어떤 언어로 읽을 문서인가
  - `ko` = 한국어
  - `en` = 영어
- `document kind`
  - 어떤 목적의 문서인가
  - `interview-answers.md` = 면접에서 말로 답할 내용을 모아두는 파일
  - `star-examples.md` = STAR 형식으로 압축한 답변 예시 파일
  - `portfolio-projects.md` = 포트폴리오용 프로젝트 사례를 정리하는 파일
  - `resume-lines.md` = 이력서 한 줄 문장을 모아두는 파일

예:

- `docs/career/operators/<github-username>/frontend/ko/interview-answers.md`
- `docs/career/operators/<github-username>/backend/en/resume-lines.md`
- `docs/career/operators/<github-username>/platform/ko/star-examples.md`
- `docs/career/shared/ko/project-overview.md`

경로를 한국어로 읽으면:

- `docs/career/operators/<github-username>/frontend/ko/interview-answers.md`
  - 특정 사용자의 개인 draft
  - 프론트엔드 직무용
  - 한국어 문서
  - 면접 답변 정리 파일
- `docs/career/operators/<github-username>/backend/en/resume-lines.md`
  - 특정 사용자의 개인 draft
  - 백엔드 직무용
  - 영어 문서
  - 이력서 한 줄 정리 파일
- `docs/career/operators/<github-username>/platform/ko/star-examples.md`
  - 특정 사용자의 개인 draft
  - 플랫폼 직무용
  - 한국어 문서
  - STAR 사례 정리 파일
- `docs/career/shared/ko/project-overview.md`
  - 공용 승격본
  - 한국어 문서
  - 프로젝트 전체 소개 파일

기본 운영 방식:

- 작업마다 날짜 파일을 새로 만들지 않습니다
- `직무/언어/문서종류`별 고정 파일을 유지합니다
- 같은 파일 안에서 사례별 섹션을 추가하거나 갱신합니다
- 아주 큰 사례만 `cases/<slug>.md`로 승격합니다
- 기본 draft는 operator 단위로 분리해 팀 협업 시 충돌을 줄입니다

### 언어는 어떻게 바꾸나

취준 문서는 요청 시점에 언어를 정합니다.

- 사용자가 한국어를 요청하면 기본적으로 `docs/career/operators/<github-username>/<role>/ko/...`에 씁니다
- 사용자가 영어를 요청하면 기본적으로 `docs/career/operators/<github-username>/<role>/en/...`에 씁니다
- 언어를 따로 말하지 않으면 사용자의 주 언어를 따릅니다

공용판은 사용자가 명시적으로 요청할 때만 `docs/career/shared/<language>/...`에 씁니다.
이 경우 finish-check도 `--allow-shared-career-publish` 플래그와 함께 실행합니다.

중요한 점:

- lesson 경로 slug는 영어로 유지됩니다
- 사람이 읽는 취준 문서 본문만 요청한 언어로 생성됩니다

## 더 자세한 설명은 어디서 보나

이 README는 메인 사용법 문서이고, 아래는 상황별 참조 문서입니다.

- [INSTALLATION.md](./INSTALLATION.md)
  - 설치 스크립트가 실제로 무엇을 하고, 어떤 옵션이 있는지 정리한 문서
- [HOW_IT_WORKS.md](./HOW_IT_WORKS.md)
  - 이 프레임워크의 동작 원리, 핵심 개념, 기본 정책을 설명하는 문서
- [PUBLIC_CORE_BOUNDARY.md](./PUBLIC_CORE_BOUNDARY.md)
  - 공개 코어에 무엇을 넣고 무엇을 빼야 하는지 정리한 문서
- [ADAPTER_LINEAGE.md](./ADAPTER_LINEAGE.md)
  - 현재 어댑터가 어떤 upstream skill과 패턴을 바탕으로 검증됐는지 정리한 문서
- [FILESET.md](./FILESET.md)
  - 새 공개용 repo에 무엇을 넣고 무엇을 빼야 하는지 정리한 문서
- [MIGRATION_MAP.md](./MIGRATION_MAP.md)
  - 현재 프로젝트 이름, 경로, prefix를 generic 이름으로 바꿀 때 참고하는 문서
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
  - NeuronFS, agency-agents, ui-ux-pro-max-skill 같은 upstream 출처와 고지 의무를 정리한 문서
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
  - 실제로 오픈소스 공개 전에 마지막으로 점검할 항목을 모아둔 문서

템플릿과 스크립트는 여기서 찾습니다:

- [`templates/`](./templates/)
  - `AGENTS.md`, `CLAUDE.md`, env 예시, config 예시 템플릿
- [`scripts/`](./scripts/)
  - 공개용 generic helper 스크립트
- [`tests/`](./tests/)
  - 공개용 코어 스크립트 테스트

빠르게 찾으려면:

- 설치 옵션/동작 -> `INSTALLATION.md`
- 동작 원리와 기본 정책 -> `HOW_IT_WORKS.md`
- 공개 코어 경계 -> `PUBLIC_CORE_BOUNDARY.md`
- skill 계보와 검증 배경 -> `ADAPTER_LINEAGE.md`
- 파일 포함/제외 기준 -> `FILESET.md`
- 이름 치환 기준 -> `MIGRATION_MAP.md`
- 라이선스/출처 기준 -> `THIRD_PARTY_NOTICES.md`
- 공개 직전 점검 -> `RELEASE_CHECKLIST.md`
