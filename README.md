# Team Repeat - React 웹앱

Flutter 앱과 동일한 Supabase DB를 사용하는 React 기반 웹 애플리케이션입니다.  
iOS 포함 모든 기기의 브라우저에서 접속 가능합니다.

**배포 URL:** https://repeatbasketballreact.vercel.app

## 기술 스택

- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Auth)
- **Routing**: React Router v6
- **Styling**: CSS3
- **배포**: Vercel

## 페이지 구성

| 페이지 | 경로 | 기능 |
|--------|------|------|
| 로그인 | `/login` | 로그인 / 회원가입 |
| 캘린더 | `/calendar` | 일정 관리, 출석 투표 |
| 멤버 | `/members` | 회원 통계, 능력치, 견장 관리 |
| 랭킹 | `/ranking` | 승리 / 위닝시리즈 / 승률 / 출석률 TOP 3 |
| 팀분배 | `/teams` | 자동분배, 게스트 추가, 팀 저장 |
| 경기결과 | `/match` | 게임별 점수 입력, 승패 기록 |

## 주요 기능

- **출석 투표**: 일정별 참석/미정/불참 투표, 실시간 현황 확인
- **멤버 관리**: 시즌별 승률/승/패/위닝시리즈/출석률 통계, 최근 5경기 기록
- **견장 시스템**: 견장 회원 표시 및 자동분배 시 팀 균등 배분
- **능력치**: 8개 항목 슬라이더 편집 (관리자)
- **자동분배**: 포지션 + 견장 기반 균형 팀 구성 알고리즘 (2/3/4팀)
- **경기결과**: 게임별 점수 기록 → 승/패 자동 집계 → 멤버 통계 반영

## 로컬 개발

```bash
npm install
npm run dev
```

http://localhost:5173 에서 실행됩니다.

## 환경 변수

`.env` 파일:

```
VITE_SUPABASE_URL=https://wffilbsberoeoyqjeiwe.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## 재배포

```bash
vercel --prod
```

## 프로젝트 구조

```
src/
├── components/
│   ├── Layout.jsx / Layout.css        # 헤더 + 하단 네비게이션
│   ├── AttendanceModal.jsx            # 출석 투표 모달
│   ├── AbilityEditModal.jsx           # 능력치 편집 모달
│   └── EpauletteModal.jsx             # 견장 설정 모달
├── context/
│   └── AuthContext.jsx                # 로그인 상태 관리
├── lib/
│   └── supabase.js                    # Supabase 클라이언트
├── pages/
│   ├── LoginPage.jsx                  # 로그인 / 회원가입
│   ├── CalendarPage.jsx               # 캘린더 + 일정 관리
│   ├── MemberPage.jsx                 # 멤버 목록 + 통계
│   ├── RankingPage.jsx                # 랭킹 TOP 3
│   ├── TeamPage.jsx                   # 팀분배
│   └── MatchPage.jsx                  # 경기결과 입력
└── App.jsx                            # 라우팅
```

## Supabase 테이블

| 테이블 | 용도 |
|--------|------|
| `profiles` | 회원 정보 (닉네임, 포지션, 역할, 견장) |
| `events` | 일정 |
| `attendance` | 출석 투표 |
| `member_records` | 멤버별 승/패 기록 |
| `member_abilities` | 멤버별 능력치 |
| `team_configurations` | 팀분배 결과 |
| `match_results` | 경기 세션 |
| `game_results` | 게임별 점수 및 승자 |

## iOS 설치 방법

1. iPhone Safari에서 https://repeatbasketballreact.vercel.app 접속
2. 하단 공유 버튼 → **홈 화면에 추가**
3. 앱 아이콘으로 실행
