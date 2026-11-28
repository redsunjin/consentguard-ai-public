/**
 * Pre-Analyzed Popular Korean Services Catalog for Apps in Toss
 * 사용자가 가입 직전 서비스 이름만 검색해도 3초 만에 체크 가이드를 확인할 수 있는 사전 진단 DB
 */
export const POPULAR_SERVICE_CATALOG = [
    {
        id: 'svc_nexus',
        name: '넥서스 프리미엄 멤버십',
        category: '쇼핑 · 구독',
        riskLevel: 'RED',
        riskScore: 84,
        summary: '30일 무료 후 월 9,900원 자동 전환 및 14개 보험사 제3자 제공이 사전 체크되어 있습니다.',
        checkItems: ['[필수] 서비스 이용약관 (저작권 조항 주의)', '[필수] 개인정보 최소 수집'],
        uncheckItems: ['[선택] 14개 금융·보험사 제3자 제공', '[선택] 야간 광고성 SMS·푸시'],
        traps: ['SILENCE_CONSENT', 'ASYMMETRIC_LIABILITY', 'THRESHOLD_DEVIATION'],
    },
    {
        id: 'svc_fitness',
        name: '피트니스 12개월 특가 회원권',
        category: '헬스 · PT',
        riskLevel: 'RED',
        riskScore: 88,
        summary: '특가 상품 환불 일체 불가 단서와 위약금 30% 공제 조항이 포함되어 있습니다.',
        checkItems: ['[필수] 시설 이용 기본 수칙'],
        uncheckItems: ['[선택] 제휴 건강식품·보험 마케팅 제공'],
        traps: ['EXCEPTION_REVERSAL', 'THRESHOLD_DEVIATION', 'ASYMMETRIC_LIABILITY'],
    },
    {
        id: 'svc_delivery',
        name: '배달의상상 앱 신규 가입',
        category: '배달 · 외식',
        riskLevel: 'YELLOW',
        riskScore: 54,
        summary: '기본 주문은 필수 2건으로 충분하며, 야간 쿠폰 푸시와 제휴 이벤트 제공은 해제해도 됩니다.',
        checkItems: ['[필수] 배달 위치·연락처 확인', '[필수] 전자금융거래 이용약관'],
        uncheckItems: ['[선택] 제휴 식음료 쿠폰 알림 (야간 포함)', '[선택] 맞춤형 광고 프로파일링'],
        traps: ['SILENCE_CONSENT'],
    },
    {
        id: 'svc_alba',
        name: '단기 알바 표준 근로계약서',
        category: '근로 · 알바',
        riskLevel: 'YELLOW',
        riskScore: 48,
        summary: '수습 기간 임금 감액 단서와 손해배상 포괄 전가 문구 여부를 반드시 확인하세요.',
        checkItems: ['시급·주휴수당 명시 여부', '근무 시간 및 휴게 시간 확인'],
        uncheckItems: ['지각 시 임의 벌금 공제 특약 (확인 필요)'],
        traps: ['EXCEPTION_REVERSAL', 'UNILATERAL_DISCRETION'],
    },
    {
        id: 'svc_ott',
        name: '무비나우 OTT 정기 구독',
        category: 'OTT · 스트리밍',
        riskLevel: 'GREEN',
        riskScore: 18,
        summary: '7일 미시청 시 전액 환불 및 탈퇴 시 즉시 파기 기준을 준수하는 안전한 약관입니다.',
        checkItems: ['[필수] 서비스 이용약관', '[필수] 개인정보 수집·이용'],
        uncheckItems: ['[선택] 신작 추천 이메일·푸시'],
        traps: [],
    },
];
export function searchServiceCatalog(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q)
        return POPULAR_SERVICE_CATALOG;
    return POPULAR_SERVICE_CATALOG.filter((item) => item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q));
}
