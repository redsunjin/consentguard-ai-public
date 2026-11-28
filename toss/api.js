/**
 * Apps in Toss Miniapp Backend API Client (Zero-Retention + Local Fallback)
 */
export const DEFAULT_TOSS_API_BASE = 'http://127.0.0.1:8000';
const RRN_REGEX = /\b\d{6}-[1-4]\d{6}\b/g;
const PHONE_REGEX = /\b01[016789]-\d{3,4}-\d{4}\b/g;
const EMAIL_REGEX = /\b[\w.-]+@[\w.-]+\.\w+\b/g;
export function maskClientPII(text) {
    return (text || '')
        .replace(RRN_REGEX, '[MASKED_RRN]')
        .replace(PHONE_REGEX, '[MASKED_PHONE]')
        .replace(EMAIL_REGEX, '[MASKED_EMAIL]');
}
export function buildLocalFallbackDiagnosis(rawText) {
    const safeText = maskClientPII(rawText);
    const traps = [];
    let score = 12;
    if (/다만[, ]|단[, ]|제외합니다/.test(safeText)) {
        traps.push('EXCEPTION_REVERSAL');
        score += 24;
    }
    if (/별도\s*통지\s*없이|자동\s*정기\s*결제|동의한\s*것으로\s*간주/.test(safeText)) {
        traps.push('SILENCE_CONSENT');
        score += 24;
    }
    if (/임의로|합리적으로\s*판단/.test(safeText)) {
        traps.push('UNILATERAL_DISCRETION');
        score += 18;
    }
    if (/영구\s*귀속|영구히\s*양도|일체의\s*책임을\s*부담하지|면합니다/.test(safeText)) {
        traps.push('ASYMMETRIC_LIABILITY');
        score += 32;
    }
    if (/환불이\s*일체\s*불가|환불\s*불가|위약금\s*30%|영구\s*보관|14개/.test(safeText)) {
        traps.push('THRESHOLD_DEVIATION');
        score += 28;
    }
    score = Math.min(100, score);
    const level = score >= 70 ? 'RED' : score >= 40 ? 'YELLOW' : 'GREEN';
    const analysis = {
        analysis_id: `toss_local_${Date.now()}`,
        overall_summary: {
            risk_level: level,
            risk_score: score,
            decision_engine: 'local_fallback',
            total_clauses: 1,
            recommended_unchecks_count: level === 'RED' ? 1 : 0,
            one_line_summary: level === 'RED'
                ? `공정위 표준약관 대비 ${traps.length || 1}건의 핵심 함정이 감지되어 서명 전 확인이 필요합니다.`
                : level === 'YELLOW'
                    ? '일부 주의가 필요한 선택 동의 또는 단서 조항이 포함되어 있습니다.'
                    : '표준약관 및 소비자 기준에 부합하는 비교적 안전한 문구입니다.',
        },
        analyzed_items: [
            {
                client_item_id: 'toss_1',
                title: '핵심 조항 진단',
                type: 'MANDATORY',
                risk_level: level,
                risk_score: score,
                confidence: 0.85,
                trap_patterns: traps,
                recommended_action: level === 'RED' ? 'CAUTION_CHECK' : 'CHECK',
                issues: [],
                plain_korean_summary: level === 'RED'
                    ? '환불 제한, 자동 결제, 저작권 귀속 또는 포괄 면책 소지가 있어 사전 조율이 필요합니다.'
                    : '기본적인 서비스 이용 및 표준 환불 기준에 부합합니다.',
            },
        ],
        dark_patterns: [],
    };
    return {
        analysis,
        negotiationMessage: buildLocalNegotiationText(traps, 'polite', '계약서/약관'),
    };
}
export function buildLocalNegotiationText(traps, tone, docName) {
    const map = {
        EXCEPTION_REVERSAL: "단서 조항('다만, ~제외')으로 환불·청약철회 권리가 제한될 수 있어 표준 기준으로 조율 가능할까요?",
        SILENCE_CONSENT: '별도 통지 없는 자동 결제·연장 문구가 있어 갱신 전 사전 안내 절차로 변경 부탁드립니다.',
        UNILATERAL_DISCRETION: '일방적 해지·중단 조항에 객관적 사유와 사전 통지 기간을 명시해 주실 수 있을까요?',
        ASYMMETRIC_LIABILITY: '저작권 영구 귀속·포괄 면책 부분을 상호 합리적인 책임 분담 기준으로 보완 부탁드립니다.',
        THRESHOLD_DEVIATION: '위약금 비율·보유 기간이 표준 기준 대비 과도한 편이어서 소비자분쟁해결기준 수준으로 조정 가능할까요?',
    };
    const targets = traps.length > 0 ? traps : ['THRESHOLD_DEVIATION'];
    const bullets = targets.map((t, i) => `${i + 1}. ${map[t]}`).join('\n');
    if (tone === 'firm') {
        return `안녕하세요 담당자님, 전달해 주신 ${docName} 내용을 검토했습니다.\n\n서명 전 아래 항목은 표준 기준 대비 불리할 소지가 있어 수정이 필요합니다.\n\n${bullets}\n\n수정본 확인 후 진행하고 싶습니다. 검토 부탁드립니다.`;
    }
    return `안녕하세요 담당자님! 보내주신 ${docName} 잘 읽어보았습니다 😊\n\n진행하기 전에 아래 부분만 함께 확인하고 조율하면 서로 편할 것 같아 여쭤봅니다.\n\n${bullets}\n\n확인해 주시면 감사하겠습니다!`;
}
export async function analyzeTextForToss(rawText, apiBaseUrl = DEFAULT_TOSS_API_BASE) {
    const sanitized = maskClientPII(rawText);
    try {
        const res = await fetch(`${apiBaseUrl}/v1/clauses/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'IOS_APP' },
            body: JSON.stringify({
                source_info: { domain: 'apps-in-toss.local', page_type: 'GENERAL', input_type: 'RAW_TEXT' },
                items: [],
                raw_content: sanitized,
            }),
        });
        if (res.ok) {
            const json = (await res.json());
            if (json.status === 'SUCCESS' && json.data) {
                const traps = Array.from(new Set(json.data.analyzed_items.flatMap((i) => i.trap_patterns || [])));
                const nego = await fetchNegotiationMessage(traps, 'polite', 'vendor', '계약서/약관', apiBaseUrl);
                return { analysis: json.data, negotiationMessage: nego, source: 'api' };
            }
        }
    }
    catch {
        // Fallback to local
    }
    const fallback = buildLocalFallbackDiagnosis(sanitized);
    return { ...fallback, source: 'local' };
}
export async function analyzeDocumentForToss(filename, mimeType, contentBase64, apiBaseUrl = DEFAULT_TOSS_API_BASE) {
    try {
        const res = await fetch(`${apiBaseUrl}/v1/clauses/analyze-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'IOS_APP' },
            body: JSON.stringify({
                filename,
                mime_type: mimeType,
                content_base64: contentBase64,
                counterparty_role: 'vendor',
                tone: 'polite',
            }),
        });
        if (res.ok) {
            return (await res.json());
        }
    }
    catch {
        // Offline fallback handled by caller
    }
    return null;
}
export async function fetchNegotiationMessage(trapPatterns, tone, role, docName, apiBaseUrl = DEFAULT_TOSS_API_BASE) {
    try {
        const res = await fetch(`${apiBaseUrl}/v1/clauses/negotiation-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document_name: docName,
                counterparty_role: role,
                tone,
                trap_patterns: trapPatterns,
            }),
        });
        if (res.ok) {
            const json = (await res.json());
            if (json.message)
                return json.message;
        }
    }
    catch {
        // Fallback
    }
    return buildLocalNegotiationText(trapPatterns, tone, docName);
}
export async function fetchRevokeTemplateForToss(serviceName, userAccount, apiBaseUrl = DEFAULT_TOSS_API_BASE) {
    try {
        const res = await fetch(`${apiBaseUrl}/v1/clauses/revoke-template`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_name: serviceName,
                user_account: userAccount,
                revoke_targets: [
                    '개인정보 제3자(제휴 금융사/보험사) 제공 동의 일체',
                    '광고성 정보(SMS, 이메일, 앱 푸시) 수신 동의',
                ],
            }),
        });
        if (res.ok) {
            const json = (await res.json());
            if (json.body)
                return json.body;
        }
    }
    catch {
        // Fallback
    }
    const today = new Date().toISOString().split('T')[0];
    return `수신: ${serviceName} 개인정보보호책임자\n제목: [개인정보보호법 제37조] 개인정보 제3자 제공 및 마케팅 동의 철회 요청\n\n본인은 개인정보보호법 제37조 제1항에 의거하여 귀사 '${serviceName}' 이용 시 동의한 선택 항목(제3자 제공 및 광고성 정보 수신)을 전면 철회하며 즉각적인 파기를 요청합니다.\n\n- 계정: ${userAccount}\n- 요청일: ${today}`;
}
