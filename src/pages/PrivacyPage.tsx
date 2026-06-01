import React from 'react';
import { useNavigate } from 'react-router-dom';

const EFFECTIVE_DATE = '2026년 6월 1일';
const OPERATOR_NAME = '김민선 (개인 운영)';
const CPO_NAME = '김민선';
const CPO_EMAIL = 'minsun9856@gmail.com';
const CPO_PHONE = '010-7176-9856';

const sectionStyle: React.CSSProperties = {
  marginTop: 28,
  marginBottom: 8,
  fontSize: 16,
  fontWeight: 700,
  color: '#fff',
};

const subStyle: React.CSSProperties = {
  marginTop: 16,
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  letterSpacing: 0.3,
};

const pStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.75,
  color: 'rgba(255,255,255,0.85)',
  marginBottom: 10,
};

const liStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.75,
  color: 'rgba(255,255,255,0.85)',
  marginBottom: 4,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
  color: 'rgba(255,255,255,0.85)',
  marginBottom: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  background: 'rgba(255,255,255,0.04)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  verticalAlign: 'top',
};

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'transparent', border: 'none', color: '#fff',
            fontSize: 32, lineHeight: 1, cursor: 'pointer',
            padding: '0 8px 0 0', marginLeft: -8,
          }}
          aria-label="뒤로"
        >
          ‹
        </button>
        <span>개인정보 처리방침</span>
      </div>

      <div style={{ padding: '0 16px 32px' }}>
        <p style={{ ...pStyle, color: 'var(--color-text-secondary)', fontSize: 12 }}>
          시행일 {EFFECTIVE_DATE} · 최종 개정 {EFFECTIVE_DATE}
        </p>

        <p style={pStyle}>
          {OPERATOR_NAME}(이하 "운영자")는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를
          보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보
          처리방침을 수립·공개합니다. 본 처리방침은 AquaWorld(이하 "서비스")의 모든 이용자에게
          적용됩니다.
        </p>

        <h2 style={sectionStyle}>제1조 개인정보의 처리 목적</h2>
        <p style={pStyle}>
          운영자는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적
          이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」
          제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
        </p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}><strong>회원 식별 및 관리</strong> — 회원가입 의사 확인, 로그인 인증, 본인 식별, 부정 이용 방지</li>
          <li style={liStyle}><strong>서비스 제공</strong> — 어항 데이터 저장·동기화, 물고기 부화·성장 진행도 관리, 일일 보상 지급, 도감 진행도 관리</li>
          <li style={liStyle}><strong>알림 발송</strong> — 부화 완료·성장 완료·일일 보상 등 서비스 알림 전송</li>
          <li style={liStyle}><strong>고객 문의 응대</strong> — 이메일 문의 접수 및 회신</li>
          <li style={liStyle}><strong>서비스 개선</strong> — 오류 진단, 사용성 분석, 신규 기능 개발 참고 (분석 도구 도입 시)</li>
          <li style={liStyle}><strong>마케팅 정보 전송</strong> — 별도 동의 시 신규 콘텐츠·이벤트·프로모션 안내 (선택)</li>
        </ul>

        <h2 style={sectionStyle}>제2조 처리하는 개인정보의 항목</h2>
        <p style={subStyle}>가. 회원가입 및 로그인 (필수)</p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>Google 계정 로그인 시: 이메일 주소, 프로필 이름, 프로필 이미지 URL, Google 계정 고유 ID</li>
          <li style={liStyle}>게스트 모드 이용 시: 기기 내부에서 자동 생성된 익명 식별자(UUID) — 서버 전송 없이 기기 내 로컬 저장</li>
        </ul>

        <p style={subStyle}>나. 서비스 이용 (필수)</p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>어항·물고기·꾸미기 데이터, 재화(Pearl·Star Coral) 잔액, 도감 진행도, 출석·먹이주기 이력</li>
          <li style={liStyle}>로그인 IP 주소, 마지막 접속 일시</li>
        </ul>

        <p style={subStyle}>다. 자동 수집 항목</p>
        <p style={pStyle}>
          서비스 이용 과정에서 자동으로 생성·수집될 수 있는 정보입니다. IP 주소, 브라우저
          쿠키(인증 토큰·세션 정보), 기기 정보(OS, 브라우저 종류, 화면 해상도), 서비스 이용 기록을
          포함합니다.
        </p>

        <p style={subStyle}>라. 푸시 알림 (선택)</p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>FCM(Firebase Cloud Messaging) 토큰 — 푸시 알림 수신을 허용한 경우에만 수집</li>
        </ul>

        <p style={subStyle}>마. 수집하지 않는 정보</p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>주민등록번호, 여권번호, 운전면허번호, 외국인등록번호 등 고유식별정보</li>
          <li style={liStyle}>건강·생체·종교·정치·범죄경력 등 민감정보</li>
          <li style={liStyle}>전화번호, 실명, 주소 등 회원가입 시 추가 본인확인 정보</li>
        </ul>

        <h2 style={sectionStyle}>제3조 개인정보의 처리 및 보유 기간</h2>
        <p style={pStyle}>
          운영자는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에
          동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>처리 업무</th>
                <th style={thStyle}>보유 기간</th>
                <th style={thStyle}>근거</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>회원 식별·계정 관리</td>
                <td style={tdStyle}>회원 탈퇴 시까지</td>
                <td style={tdStyle}>이용자 동의</td>
              </tr>
              <tr>
                <td style={tdStyle}>서비스 진행도(어항·재화·도감)</td>
                <td style={tdStyle}>회원 탈퇴 시까지</td>
                <td style={tdStyle}>이용자 동의</td>
              </tr>
              <tr>
                <td style={tdStyle}>로그인 기록·접속 IP</td>
                <td style={tdStyle}>3개월</td>
                <td style={tdStyle}>통신비밀보호법 제15조의2</td>
              </tr>
              <tr>
                <td style={tdStyle}>FCM 푸시 토큰</td>
                <td style={tdStyle}>이용자가 알림을 비활성화하거나 무효 토큰으로 확인될 때까지</td>
                <td style={tdStyle}>이용자 동의</td>
              </tr>
              <tr>
                <td style={tdStyle}>이메일 문의 기록</td>
                <td style={tdStyle}>회신 완료 후 1년</td>
                <td style={tdStyle}>전자상거래법 제6조 (소비자 불만 또는 분쟁처리)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 style={sectionStyle}>제4조 개인정보의 제3자 제공</h2>
        <p style={pStyle}>
          운영자는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만
          처리하며, 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우(정보주체의 별도 동의,
          법률의 특별한 규정 등)를 제외하고는 개인정보를 제3자에게 제공하지 않습니다.
        </p>

        <h2 style={sectionStyle}>제5조 개인정보 처리의 위탁</h2>
        <p style={pStyle}>
          운영자는 원활한 서비스 운영을 위해 아래와 같이 개인정보 처리업무를 외부에 위탁하고
          있습니다. 위탁계약 체결 시 「개인정보 보호법」 제26조에 따라 위탁업무 수행목적 외
          개인정보 처리 금지, 기술적·관리적 보호조치, 재위탁 제한, 수탁자에 대한 관리·감독,
          손해배상 등 책임에 관한 사항을 명시하고 있습니다.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>수탁자</th>
                <th style={thStyle}>위탁 업무</th>
                <th style={thStyle}>국가 / 리전</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Google LLC (Firebase Authentication)</td>
                <td style={tdStyle}>소셜 로그인 인증, 세션 관리</td>
                <td style={tdStyle}>미국</td>
              </tr>
              <tr>
                <td style={tdStyle}>Google LLC (Cloud Firestore)</td>
                <td style={tdStyle}>회원·어항·재화 데이터 저장</td>
                <td style={tdStyle}>대한민국 (asia-northeast3 / 서울 리전)</td>
              </tr>
              <tr>
                <td style={tdStyle}>Google LLC (Cloud Functions)</td>
                <td style={tdStyle}>서버 권위 게임 로직(가챠·재화 검증·일일 보상) 실행</td>
                <td style={tdStyle}>대한민국 (asia-northeast3 / 서울 리전)</td>
              </tr>
              <tr>
                <td style={tdStyle}>Google LLC (Firebase Cloud Messaging)</td>
                <td style={tdStyle}>푸시 알림(부화 완료 등) 발송</td>
                <td style={tdStyle}>미국</td>
              </tr>
              <tr>
                <td style={tdStyle}>Google LLC (Firebase Storage / Hosting)</td>
                <td style={tdStyle}>정적 리소스·앱 번들 호스팅</td>
                <td style={tdStyle}>미국</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ ...pStyle, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          위탁 기간: 위탁 계약 종료 시 또는 회원 탈퇴 시까지. 향후 분석 도구(Firebase Analytics 등),
          오류 추적(Sentry 등), 결제 대행(인앱 결제) 등이 추가될 경우 본 처리방침 개정을 통해 사전
          공지합니다.
        </p>

        <h2 style={sectionStyle}>제6조 정보주체와 법정대리인의 권리·의무 및 행사 방법</h2>
        <p style={pStyle}>
          정보주체는 운영자에 대해 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.
          권리 행사는 「개인정보 보호법」 시행령 제41조 제1항에 따라 서면, 전자우편 등을 통하여
          하실 수 있으며, 운영자는 이에 대해 지체 없이 조치하겠습니다.
        </p>
        <p style={subStyle}>가. 권리 행사 방법</p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>이메일: {CPO_EMAIL}</li>
          <li style={liStyle}>전화: {CPO_PHONE}</li>
          <li style={liStyle}>회원 탈퇴: 앱 내 설정 화면 또는 위 이메일로 요청</li>
        </ul>
        <p style={pStyle}>
          정보주체가 권리 행사를 대리인에게 위임하는 경우 위임장을 제출하셔야 합니다. 정보주체의
          권리는 「개인정보 보호법」 제35조, 제36조, 제37조에 따라 제한될 수 있으며, 운영자는 이에
          관하여 이메일로 안내합니다.
        </p>

        <h2 style={sectionStyle}>제7조 개인정보의 파기 절차 및 방법</h2>
        <p style={pStyle}>
          운영자는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는
          지체 없이 해당 개인정보를 파기합니다. 회원 탈퇴 요청(앱 내 "설정 &gt; 회원 탈퇴")
          접수 즉시 회원 식별 정보 및 서비스 진행 데이터(어항·재화·도감 등)는 영구 삭제되며,
          복구가 불가능합니다. 법령에 의해 별도 보존이 필요한 항목(예: 결제 도입 후 거래 기록)은
          해당 보존 기간 동안 분리 보관 후 자동 파기합니다.
        </p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}><strong>전자적 파일 형태:</strong> 복구 및 재생이 불가능한 방법으로 영구 삭제</li>
          <li style={liStyle}><strong>법령 보존 의무 데이터:</strong> 보존 기간 동안 별도 데이터베이스로 분리 보관 후 자동 삭제</li>
        </ul>

        <h2 style={sectionStyle}>제8조 개인정보의 안전성 확보 조치</h2>
        <p style={pStyle}>
          운영자는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
        </p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}><strong>관리적 조치:</strong> 개인정보 취급 인력 최소화, 정기적인 자체 점검</li>
          <li style={liStyle}><strong>기술적 조치:</strong> Firebase Authentication 기반의 안전한 로그인 토큰 관리, HTTPS 통신, 데이터베이스 접근 권한 분리(Firestore 보안 규칙), 재화·아이템 변경은 Cloud Functions 서버 권위 로직으로만 처리</li>
          <li style={liStyle}><strong>물리적 조치:</strong> 데이터는 Google Cloud Platform(서울 리전 등)의 보안 데이터센터에 보관되며, 접근은 Google의 물리적 보안 정책을 따릅니다.</li>
        </ul>

        <h2 style={sectionStyle}>제9조 개인정보 자동 수집 장치의 설치·운영 및 거부</h2>
        <p style={pStyle}>
          운영자는 이용자의 로그인 세션 유지 및 서비스 이용 편의를 위해 쿠키(cookie) 및 브라우저
          로컬 스토리지를 사용합니다. 쿠키는 인증 토큰·세션 정보·이용자 환경 설정(BGM/효과음 등)을
          저장하는 용도로 이용됩니다.
        </p>
        <p style={subStyle}>거부 방법</p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>Chrome: 설정 &gt; 개인정보 및 보안 &gt; 쿠키 및 기타 사이트 데이터</li>
          <li style={liStyle}>Safari: 환경설정 &gt; 개인정보 보호 &gt; 쿠키 및 웹사이트 데이터 관리</li>
          <li style={liStyle}>Edge: 설정 &gt; 쿠키 및 사이트 권한 &gt; 쿠키 및 사이트 데이터 관리</li>
          <li style={liStyle}>Firefox: 설정 &gt; 개인정보 및 보안 &gt; 쿠키와 사이트 데이터</li>
        </ul>
        <p style={pStyle}>
          쿠키 저장을 거부할 경우 로그인 유지 등 일부 기능 이용에 제약이 있을 수 있습니다.
        </p>

        <h2 style={sectionStyle}>제10조 만 14세 미만 아동의 개인정보 처리</h2>
        <p style={pStyle}>
          본 서비스는 만 14세 미만 아동의 회원가입 및 이용을 허용하지 않습니다. 만 14세 미만 아동의
          개인정보가 보호자의 동의 없이 수집된 사실이 확인될 경우, 운영자는 지체 없이 해당 정보를
          파기합니다. 만 14세 미만 아동이 본 서비스에 가입한 사실을 확인하시면 위 이메일로
          알려주시기 바랍니다.
        </p>

        <h2 style={sectionStyle}>제11조 개인정보 보호책임자 및 열람 청구 접수</h2>
        <p style={pStyle}>
          운영자는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한
          정보주체의 불만처리 및 피해구제를 위하여 아래와 같이 개인정보 보호책임자를 지정하고
          있습니다. 정보주체는 본 책임자 연락처로 개인정보 보호 관련 문의·불만·피해구제·열람청구
          등을 요청할 수 있으며, 운영자는 지체 없이 답변·처리합니다.
        </p>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 10,
          padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, lineHeight: 1.9 }}>
            <div><strong>성명</strong> · {CPO_NAME}</div>
            <div><strong>직책</strong> · 서비스 운영자 (개인정보 보호책임자 겸임)</div>
            <div><strong>이메일</strong> · {CPO_EMAIL}</div>
            <div><strong>연락처</strong> · {CPO_PHONE}</div>
          </div>
        </div>

        <h2 style={sectionStyle}>제12조 정보주체의 권익침해 구제 방법</h2>
        <p style={pStyle}>
          정보주체는 개인정보침해로 인한 구제를 받기 위하여 아래 기관에 분쟁해결이나 상담 등을
          신청할 수 있습니다.
        </p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>개인정보 분쟁조정위원회 · 국번 없이 <strong>1833-6972</strong> · www.kopico.go.kr</li>
          <li style={liStyle}>개인정보 침해신고센터 · 국번 없이 <strong>118</strong> · privacy.kisa.or.kr</li>
          <li style={liStyle}>대검찰청 · 국번 없이 <strong>1301</strong> · www.spo.go.kr</li>
          <li style={liStyle}>경찰청 · 국번 없이 <strong>182</strong> · ecrm.police.go.kr</li>
        </ul>

        <h2 style={sectionStyle}>제13조 개인정보 처리방침의 변경</h2>
        <p style={pStyle}>
          본 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가, 삭제
          및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 앱 내 공지를 통해 고지합니다. 다만,
          이용자 권리에 중대한 변경이 있을 경우 최소 30일 전에 공지합니다.
        </p>
        <p style={subStyle}>개정 이력</p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>2026년 6월 1일 · 최초 제정 및 시행</li>
        </ul>

        <div style={{
          marginTop: 32,
          padding: '12px 14px',
          background: 'rgba(255,200,0,0.08)',
          border: '1px solid rgba(255,200,0,0.2)',
          borderRadius: 10,
          fontSize: 11,
          lineHeight: 1.7,
          color: 'rgba(255,255,255,0.7)',
        }}>
          본 처리방침은 2025년 4월 21일 개인정보보호위원회 처리방침 작성지침과
          2026년 3월 10일 공포된 개정 개인정보보호법(2026년 9월 11일 시행)을 반영하여 작성된
          초안입니다. 서비스 운영 중 처리위탁 업체, 수집 항목, 결제 도입 등 사정 변경 시 본 방침을
          개정합니다.
        </div>
      </div>
    </div>
  );
}
