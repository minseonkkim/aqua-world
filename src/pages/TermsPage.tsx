import React from 'react';
import { useNavigate } from 'react-router-dom';

const EFFECTIVE_DATE = '2026년 6월 1일';
const OPERATOR_NAME = '김민선';
const OPERATOR_EMAIL = 'minsun9856@gmail.com';
const OPERATOR_PHONE = '010-7176-9856';
const SERVICE_NAME = 'AquaWorld';

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

const olStyle: React.CSSProperties = {
  paddingLeft: 20,
  marginBottom: 8,
};

export default function TermsPage() {
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
        <span>이용약관</span>
      </div>

      <div style={{ padding: '0 16px 32px' }}>
        <p style={{ ...pStyle, color: 'var(--color-text-secondary)', fontSize: 12 }}>
          시행일 {EFFECTIVE_DATE} · 최종 개정 {EFFECTIVE_DATE}
        </p>

        <h2 style={sectionStyle}>제1조 (목적)</h2>
        <p style={pStyle}>
          본 약관은 {OPERATOR_NAME}(이하 "운영자")이 제공하는 {SERVICE_NAME}(이하 "서비스") 이용과
          관련하여 운영자와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을
          목적으로 합니다.
        </p>

        <h2 style={sectionStyle}>제2조 (용어의 정의)</h2>
        <ol style={olStyle}>
          <li style={liStyle}><strong>"서비스"</strong>란 운영자가 제공하는 PWA 기반 어항 시뮬레이션 게임 {SERVICE_NAME}을 의미합니다.</li>
          <li style={liStyle}><strong>"이용자"</strong>란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
          <li style={liStyle}><strong>"회원"</strong>이란 Google 계정 등 소셜 로그인을 통해 가입하여 서비스를 이용하는 자를 말합니다.</li>
          <li style={liStyle}><strong>"게스트"</strong>란 회원가입 없이 기기 내 로컬 데이터만으로 서비스를 이용하는 자를 말합니다.</li>
          <li style={liStyle}><strong>"콘텐츠"</strong>란 서비스 내에 게시되거나 송신되는 모든 정보·텍스트·이미지·캡처 이미지를 말합니다.</li>
          <li style={liStyle}><strong>"게임 재화"</strong>란 서비스 내에서 사용되는 가상의 화폐(Pearl 및 Star Coral)와 아이템(알·꾸미기 오브젝트·물고기 등)을 말합니다.</li>
          <li style={liStyle}><strong>"유료 재화"</strong>란 향후 도입될 예정인 결제를 통해 충전되는 Star Coral 및 유료 패키지를 말합니다.</li>
        </ol>

        <h2 style={sectionStyle}>제3조 (약관의 명시와 개정)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>운영자는 본 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기 화면 또는 설정 메뉴에 게시합니다.</li>
          <li style={liStyle}>운영자는 「약관의 규제에 관한 법률」, 「전자상거래 등에서의 소비자보호에 관한 법률」, 「개인정보 보호법」, 「게임산업진흥에 관한 법률」 등 관련 법을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</li>
          <li style={liStyle}>운영자가 약관을 개정할 경우 적용일자 및 개정사유를 명시하여 현행 약관과 함께 적용일자 7일 이전부터 적용일자 전일까지 앱 내 공지로 고지합니다. 다만 이용자에게 불리하게 약관 내용을 변경하는 경우에는 최소 30일 이상의 사전 유예기간을 두고 공지합니다.</li>
          <li style={liStyle}>이용자가 개정 약관에 동의하지 않는 경우 회원 탈퇴할 수 있으며, 시행일 이후에도 서비스를 계속 이용하는 경우 개정 약관에 동의한 것으로 간주됩니다.</li>
        </ol>

        <h2 style={sectionStyle}>제4조 (서비스의 제공)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>운영자는 다음의 서비스를 제공합니다.
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              <li style={liStyle}>3D 어항 시뮬레이션 및 물고기 사육</li>
              <li style={liStyle}>알 부화·물고기 성장·도감 수집 기능</li>
              <li style={liStyle}>어항 꾸미기 및 사진 캡처·공유 기능</li>
              <li style={liStyle}>일일 보상·이벤트·미션 기능</li>
              <li style={liStyle}>친구·시즌 패스 등 향후 확장 기능</li>
              <li style={liStyle}>기타 운영자가 추가로 개발하거나 제휴를 통해 제공하는 일체의 서비스</li>
            </ul>
          </li>
          <li style={liStyle}>서비스는 연중무휴, 1일 24시간 제공함을 원칙으로 합니다. 다만 정기 점검, 시스템 업그레이드, 천재지변, 통신 장애 등 부득이한 경우에는 일시적으로 중단될 수 있습니다.</li>
          <li style={liStyle}>운영자는 서비스의 내용을 변경할 수 있으며, 중대한 변경의 경우 사전에 공지합니다.</li>
        </ol>

        <h2 style={sectionStyle}>제5조 (서비스의 중단)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>운영자는 시스템 점검, 보수, 교체, 통신 두절, 천재지변 등 운영상 또는 기술상 필요한 경우 서비스 제공을 일시적으로 중단할 수 있습니다.</li>
          <li style={liStyle}>운영자는 사업 종료, 경영 악화 등 부득이한 사유로 서비스를 영구 종료할 수 있으며, 종료 30일 전에 앱 내 공지 및 이메일로 안내합니다. 유료 재화 잔액이 있는 경우 환불 또는 보상 정책을 함께 안내합니다.</li>
          <li style={liStyle}>운영자는 본 조에 따른 서비스 중단으로 인하여 이용자에게 발생한 손해에 대하여 운영자의 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.</li>
        </ol>

        <h2 style={sectionStyle}>제6조 (회원가입 및 이용자 자격)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>이용을 희망하는 자가 본 약관과 개인정보 처리방침에 동의하고 Google 계정 등 소셜 로그인 절차를 완료하면 회원가입이 성립됩니다.</li>
          <li style={liStyle}><strong>본 서비스는 만 14세 미만의 가입을 허용하지 않습니다.</strong> 만 14세 미만 아동의 가입 사실이 확인될 경우 운영자는 즉시 계정을 삭제하고 보유 데이터를 파기합니다.</li>
          <li style={liStyle}>운영자는 다음 각 호에 해당하는 경우 가입을 거절하거나 사후에 자격을 상실시킬 수 있습니다.
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              <li style={liStyle}>타인 명의 또는 허위 정보를 이용한 가입</li>
              <li style={liStyle}>본 약관을 위반하여 서비스 운영을 방해한 경우</li>
              <li style={liStyle}>관계 법령 위반 또는 공서양속에 반하는 목적으로 이용한 경우</li>
            </ul>
          </li>
        </ol>

        <h2 style={sectionStyle}>제7조 (회원 탈퇴 및 자격 상실)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>회원은 언제든지 앱 내 "설정 &gt; 회원 탈퇴" 메뉴를 통해 직접 탈퇴할 수 있습니다. 탈퇴 요청 시 즉시 처리됩니다.</li>
          <li style={liStyle}>회원 탈퇴 시 회원의 모든 게임 데이터(어항·물고기·재화·도감 등) 및 인증 계정이 즉시 영구 삭제되며, 복구되지 않습니다.</li>
          <li style={liStyle}>유료 재화(Star Coral 등) 잔액은 환불되지 않으며, 탈퇴와 동시에 소멸합니다. 단, 결제 후 사용하지 않은 유료 재화에 대해서는 제11조에 따른 환불 정책이 적용됩니다.</li>
        </ol>

        <h2 style={sectionStyle}>제8조 (이용자의 의무)</h2>
        <p style={pStyle}>이용자는 다음 행위를 하여서는 안 됩니다.</p>
        <ul style={{ paddingLeft: 20 }}>
          <li style={liStyle}>타인의 계정·결제 정보를 도용하는 행위</li>
          <li style={liStyle}>서비스의 운영을 방해할 목적으로 비정상적인 방법(매크로·봇·자동화 도구·취약점 악용)으로 서비스에 접속하거나 게임 재화를 획득하는 행위</li>
          <li style={liStyle}>서비스를 분해·디컴파일·역공학하거나 서비스에 사용된 소스코드·데이터를 무단 추출·복제·배포하는 행위</li>
          <li style={liStyle}>게임 재화·계정을 현금 또는 현물로 거래하는 행위</li>
          <li style={liStyle}>음란물·폭력·차별·혐오·범죄 등 공서양속에 반하는 콘텐츠(닉네임·사진 등)를 게시·공유하는 행위</li>
          <li style={liStyle}>운영자 또는 제3자의 저작권·상표권·초상권 등 지식재산권을 침해하는 행위</li>
          <li style={liStyle}>기타 관계 법령에 위배되는 행위</li>
        </ul>

        <h2 style={sectionStyle}>제9조 (운영자의 의무)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>운영자는 관계 법령과 본 약관을 준수하며, 안정적이고 지속적인 서비스 제공을 위해 최선을 다합니다.</li>
          <li style={liStyle}>운영자는 이용자의 개인정보 보호를 위하여 별도의 개인정보 처리방침을 수립·공개합니다.</li>
          <li style={liStyle}>운영자는 이용자의 의견 또는 불만이 정당하다고 인정되는 경우 합리적인 기간 내에 이를 처리합니다.</li>
        </ol>

        <h2 style={sectionStyle}>제10조 (게임 재화 및 확률형 아이템)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>서비스 내 사용되는 게임 재화는 다음과 같이 구분됩니다.
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              <li style={liStyle}><strong>Pearl(진주):</strong> 무료 재화. 일일 보상, 먹이주기 보상, 도감 마일스톤 등으로 획득.</li>
              <li style={liStyle}><strong>Star Coral(스타산호):</strong> 향후 결제를 통해 충전될 예정인 유료 재화. 현재는 무료 보상으로만 지급됩니다.</li>
            </ul>
          </li>
          <li style={liStyle}>게임 재화는 운영자가 제공하는 가상의 데이터이며 현금화·환전이 불가능합니다. 이용자는 게임 재화에 대해 소유권이 아닌 이용권만을 가집니다.</li>
          <li style={liStyle}>운영자는 「게임산업진흥에 관한 법률」 제33조 및 동법 시행령에 따라 확률형 아이템(알 부화)의 종별 출현 확률을 서비스 내 상점 또는 도움말 화면에 공시합니다.</li>
          <li style={liStyle}>표시된 확률은 각 아이템(알) 개별 추첨에 적용되며, 서버 측에서 무작위 결정됩니다. 운영자는 표시 확률과 실제 확률이 일치하도록 합리적인 조치를 취합니다.</li>
        </ol>

        <h2 style={sectionStyle}>제11조 (결제 및 환불)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>현재 서비스는 무료로 제공되며, 결제 기능은 도입되지 않았습니다. 향후 유료 재화(Star Coral 등) 결제 기능이 추가될 경우 본 약관 개정을 통해 결제 수단·환불 정책을 사전 공지합니다.</li>
          <li style={liStyle}>유료 결제 도입 후, 이용자는 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조에 따라 결제일로부터 7일 이내에 청약을 철회할 수 있습니다. 다만 다음의 경우에는 청약철회가 제한될 수 있습니다.
            <ul style={{ paddingLeft: 18, marginTop: 4 }}>
              <li style={liStyle}>이용자가 유료 재화를 일부 또는 전부 사용한 경우</li>
              <li style={liStyle}>일부만 사용한 경우 미사용분에 한하여 환불 가능</li>
              <li style={liStyle}>이용자에게 책임이 있는 사유로 재화가 멸실·훼손된 경우</li>
            </ul>
          </li>
          <li style={liStyle}>환불 요청은 위 운영자 이메일로 접수하며, 운영자는 영업일 기준 7일 이내에 처리합니다.</li>
        </ol>

        <h2 style={sectionStyle}>제12조 (저작권 및 이용자 콘텐츠)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>서비스에 포함된 그래픽·코드·디자인·텍스트·음원 등 일체의 저작물에 대한 저작권 및 지식재산권은 운영자 또는 정당한 권리자에게 귀속됩니다.</li>
          <li style={liStyle}>이용자가 서비스 내에서 작성·생성한 콘텐츠(어항 배치, 캡처한 사진, 닉네임 등)에 대한 저작권은 이용자에게 귀속됩니다.</li>
          <li style={liStyle}>이용자는 서비스 운영·홍보·연구·개선 목적으로 운영자가 해당 콘텐츠를 비독점적·전 세계적·무상으로 복제·배포·전시·수정할 수 있도록 라이선스를 부여한 것으로 봅니다. 단, 마케팅 등 영리적 외부 노출에는 사전 동의를 받습니다.</li>
          <li style={liStyle}>운영자는 이용자가 게시한 콘텐츠가 본 약관 또는 법령에 위배된다고 판단되는 경우 사전 통지 없이 삭제할 수 있습니다.</li>
        </ol>

        <h2 style={sectionStyle}>제13조 (오픈소스 소프트웨어 고지)</h2>
        <p style={pStyle}>
          서비스는 다수의 오픈소스 소프트웨어를 이용하여 개발되었으며, 각 라이선스 본문은 앱 내
          "설정 &gt; 오픈소스 라이선스" 페이지에서 확인할 수 있습니다.
        </p>

        <h2 style={sectionStyle}>제14조 (책임의 제한)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>운영자는 천재지변, 전쟁, 통신 두절, 정부의 명령, 노동쟁의 등 운영자의 통제 범위를 벗어난 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.</li>
          <li style={liStyle}>운영자는 이용자의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.</li>
          <li style={liStyle}>운영자는 무료로 제공되는 서비스 이용과 관련하여 운영자의 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.</li>
          <li style={liStyle}>운영자의 손해배상 책임은 관련 법령에서 달리 정하지 않는 한, 이용자가 직전 1년간 결제한 금액을 한도로 합니다.</li>
        </ol>

        <h2 style={sectionStyle}>제15조 (분쟁 해결 및 준거법)</h2>
        <ol style={olStyle}>
          <li style={liStyle}>운영자와 이용자 간 분쟁이 발생한 경우, 양 당사자는 신의성실의 원칙에 따라 우선 협의를 통해 해결합니다.</li>
          <li style={liStyle}>협의가 이루어지지 아니할 경우, 「전자상거래 등에서의 소비자보호에 관한 법률」 제33조에 따른 소비자분쟁조정위원회의 조정을 신청할 수 있습니다.</li>
          <li style={liStyle}>본 약관과 관련하여 운영자와 이용자 간 분쟁이 발생한 경우, 분쟁의 관할 법원은 「민사소송법」에 따라 정해진 법원으로 하며, 준거법은 대한민국 법으로 합니다.</li>
        </ol>

        <h2 style={sectionStyle}>제16조 (문의처)</h2>
        <div style={{
          background: 'var(--color-surface)', borderRadius: 10,
          padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, lineHeight: 1.9 }}>
            <div><strong>운영자</strong> · {OPERATOR_NAME} (개인 운영)</div>
            <div><strong>서비스명</strong> · {SERVICE_NAME}</div>
            <div><strong>이메일</strong> · {OPERATOR_EMAIL}</div>
            <div><strong>연락처</strong> · {OPERATOR_PHONE}</div>
          </div>
        </div>

        <h2 style={sectionStyle}>부칙</h2>
        <p style={pStyle}>본 약관은 {EFFECTIVE_DATE}부터 시행됩니다.</p>

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
          본 이용약관은 공정거래위원회 전자상거래 표준약관(제10023호) 및 「게임산업진흥에 관한
          법률」을 참고하여 작성된 초안입니다. 결제 도입, 친구 시스템 도입 등 서비스 확장 시 약관을
          개정합니다. 정식 배포 전 법률 자문을 권장합니다.
        </div>
      </div>
    </div>
  );
}
