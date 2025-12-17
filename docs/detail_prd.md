# Dictanote: AI 기반 한국어 받아쓰기 및 교정 노트 서비스 상세 PRD

## 1. 프로젝트 개요
**목표**: 사용자의 음성을 실시간으로 받아쓰고, GPT-4o를 활용하여 문맥 기반의 정교한 교정 제안을 제공하며, 최종 결과물을 Notion에 자동으로 정리하여 저장하는 개인용 서비스 개발.

**타겟 유저**: 1인 (개발자 본인)

**핵심 가치**: 
- 높은 정확도의 한국어 음성 인식
- 문맥을 파악한 지능형 오탈자/비문 교정
- Notion 자동화 연동을 통한 지식 관리 효율화

## 2. 시스템 아키텍처

### Frontend
- **Framework**: Next.js (App Router)
- **Styling**: TailwindCSS (Shadcn/UI 컴포넌트 활용 권장)
- **State Management**: React Context or Zustand (스트리밍 데이터 관리)
- **Hosting**: Vercel (Supabase와 연동 용이) 또는 Supabase Hosting

### Backend & Database
- **Platform**: Supabase
- **Auth**: Supabase Auth (이메일 로그인 또는 단일 사용자 제한)
- **Database**: PostgreSQL (작업 세션 기록, 원본 텍스트, 수정 이력을 저장하여 데이터 유실 방지)
- **Edge Functions**: OpenAI API 및 Notion API 호출용 Proxy (API Key 보안)

### AI Models
- **STT (Speech-to-Text)**: `whisper-large-v3-turbo` (OpenAI Audio API) - `whisper-v2` 대비 8배 빠른 속도와 저렴한 비용.
- **Text Correction & Summary**: `gpt-5.2` (OpenAI Chat Completion API) - 가장 높은 성능의 GPT-5 모델 (High Capability)로 정교한 교정 수행.

## 3. 상세 기능 명세

### 3.1. 실시간 받아쓰기 (STT)
- **기능**: 마이크 입력을 받아 텍스트로 변환.
- **구현 방식**: 
  - 브라우저 MediaRecorder API를 사용하여 오디오 청크 수집.
  - 일정 간격(예: 10초) 또는 침묵 감지 시 오디오 데이터를 서버로 전송.
  - OpenAI `whisper-large-v3-turbo` API 호출하여 텍스트 변환 후 Frontend에 누적 표시.
- **UI**: 녹음 시작/일시정지/종료 버튼, 실시간 텍스트 스트리밍 뷰.

### 3.2. 문맥 기반 교정 및 제안 (AI Correction)
- **Trigger**: 받아쓰기 완료 후 '교정 모드' 진입 시.
- **Process**:
  1. 전체 텍스트를 `gpt-5.2`에 전송.
  2. 전체 문맥을 분석하여 3~5문장 단위(또는 논리적 단락 단위)로 묶음.
  3. 교정이 필요하거나 개선이 가능한 부분에 대해 3가지 수정 제안 생성.
- **System Prompt 전략**:
  - 역할: 전문 교정 에디터.
  - 출력 형식: 원본 텍스트 매핑 정보가 포함된 JSON (Client에서 UI 렌더링 용이하도록).
- **UI**:
  - 원본 텍스트에서 수정 제안이 있는 부분에 Underline 또는 Highlight 표시.
  - 해당 부분 클릭 시 Popover로 1, 2, 3번 후보 노출.
  - 4번 옵션으로 사용자 직접 입력 필드 제공.
  - 선택 시 본문 즉시 반영.

### 3.3. Notion 저장 (Export)
- **기능**: 완성된 텍스트를 Notion 페이지로 저장.
- **Process**:
  1. 최종 수정된 텍스트를 다시 `gpt-5.2`에 보내 '제목'과 '3줄 요약' 생성.
  2. Notion API를 사용하여 지정된 Database에 페이지 생성.
  3. 속성: Timestamp, Title, Summary, Tag(자동 생성).
  4. 본문: 전체 텍스트 내용.

## 4. AI 프롬프트 설계 (예시)

### 4.1. 교정 제안 프롬프트 (System Prompt)
```markdown
당신은 한국어 전문 교정 에디터입니다.
주어지는 텍스트는 음성 인식을 통해 생성된 것으로, 오탈자나 문맥에 맞지 않는 표현이 포함되어 있을 수 있습니다.
전체 텍스트의 문맥을 완벽하게 이해한 뒤, 텍스트를 논리적인 세그먼트(3~5문장 정도)로 분석하세요.

각 세그먼트 내에서 수정이 필요한 부분(비문, 오타, 더 자연스러운 표현 등)을 찾아서 다음 JSON 포맷으로 응답하세요.
수정할 필요가 없는 부분은 original_text만 반환하고 candidates는 빈 배열로 두세요.

응답 예시 JSON 구조:
{
  "segments": [
    {
      "original_text": "부분 텍스트...",
      "suggestions": [
        {
          "target_substring": "수정할 구체적인 단어 또는 구절",
          "candidates": ["수정안 1", "수정안 2", "수정안 3"],
          "reason": "수정 제안 이유 간략 설명"
        }
      ]
    }
  ]
}
```

### 4.2. Notion 저장용 요약 프롬프트 (System Prompt)
```markdown
다음 텍스트를 분석하여 Notion 페이지에 저장할 메타데이터를 생성해주세요.
1. 내용 전체를 포괄하는 직관적인 '제목' (20자 이내)
2. 핵심 내용을 요약한 '3줄 요약'
3. 관련된 태그 3개

JSON 포맷으로 응답:
{
  "title": "제목",
  "summary": "요약문...",
  "tags": ["태그1", "태그2", "태그3"]
}
```

## 5. 구현 단계 (Milestones)

### Phase 1: 기본 환경 및 STT 구현
- Next.js 프로젝트 세팅.
- Supabase 프로젝트 연동 및 환경변수 설정.
- Web Audio API + OpenAI Whisper 연동하여 실시간 텍스트 출력 구현.

### Phase 2: 교정 UI 및 AI 연동
- STT 결과 텍스트 편집기(Editor) 구현.
- GPT-5.2 연동 및 교정 제안 Prompt 튜닝.
- 텍스트 클릭 시 후보군 선택/직접입력 Popover UI 구현.

### Phase 3: Notion 연동 및 마무리
- Notion API 연동 (Database ID 확인 및 권한 설정).
- 저장 버튼 클릭 시 요약 생성 및 페이지 생성 로직 구현.
- 전체 UI 폴리싱 및 배포 (Vercel/Supabase).
