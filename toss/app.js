/**
 * Apps in Toss Miniapp Step-by-Step Controller (app.ts)
 * One Thing Per Page: Onboarding (Step 0) -> Select/Upload (Step 1) -> Result (Step 2) -> Action (Step 3)
 */
import { analyzeDocumentForToss, analyzeTextForToss, fetchNegotiationMessage, fetchRevokeTemplateForToss, } from './api.js';
import { POPULAR_SERVICE_CATALOG, searchServiceCatalog, } from './service-catalog.js';
const TRAP_LABELS = {
    EXCEPTION_REVERSAL: '단서 역전 함정',
    SILENCE_CONSENT: '침묵·자동 갱신',
    UNILATERAL_DISCRETION: '일방적 재량권',
    ASYMMETRIC_LIABILITY: '권리·책임 비대칭',
    THRESHOLD_DEVIATION: '수치 기준 이탈',
};
const PRESETS = {
    gym: '제5조 결제 후 7일 이내라도 특가 이벤트 상품은 환불이 일체 불가하며, 중도 해지 시 위약금 30%를 공제합니다. 센터 내 안전사고 시 회사는 일체의 책임을 부담하지 않습니다.',
    trap: '제9조 결제 후 7일 이내 환불이 가능합니다. 다만, 프로모션 상품은 제외합니다. 30일 무료 체험 후 별도 통지 없이 월 12,900원 자동 정기 결제로 전환됩니다.',
    safe: '공정거래위원회 표준약관 준수: 최소한의 식별 정보(이메일, 닉네임)만 수집하며, 7일 이내 미이용 시 전액 환불되고 회원 탈퇴 시 즉시 파기합니다.',
};
const state = {
    step: 0,
    inputMode: 'catalog',
    actionMode: 'nego',
    selectedService: POPULAR_SERVICE_CATALOG[0],
    uploadedDocName: '',
    uploadedBase64: '',
    uploadedMime: '',
    diagnosis: null,
    tone: 'polite',
};
let toastTimer = null;
function escapeHtml(raw) {
    return (raw || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function showToast(message) {
    const el = document.getElementById('toss-toast');
    if (!el)
        return;
    el.textContent = message;
    el.classList.add('show');
    if (toastTimer)
        clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
async function copyText(text, doneMessage) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        }
        showToast(doneMessage);
    }
    catch {
        showToast('복사에 실패했습니다.');
    }
}
function goToStep(nextStep) {
    state.step = nextStep;
    const topbar = document.getElementById('app-topbar');
    const badge = document.getElementById('step-badge');
    const cta = document.getElementById('primary-cta');
    const subCta = document.getElementById('secondary-cta');
    for (const s of [0, 1, 2, 3]) {
        document.getElementById(`step-${s}`)?.classList.toggle('hidden', s !== nextStep);
    }
    topbar?.classList.toggle('hidden', nextStep === 0);
    if (nextStep > 0) {
        if (badge)
            badge.textContent = `${nextStep} / 3 단계`;
        for (const idx of [1, 2, 3]) {
            const bar = document.getElementById(`bar-${idx}`);
            const lbl = document.getElementById(`lbl-${idx}`);
            bar?.classList.toggle('done', idx < nextStep);
            bar?.classList.toggle('active', idx === nextStep);
            lbl?.classList.toggle('active', idx === nextStep);
        }
    }
    if (cta) {
        cta.disabled = false;
        if (nextStep === 0)
            cta.textContent = '3초 진단 시작하기';
        else if (nextStep === 1)
            cta.textContent = '다음 · 3초 진단하기';
        else if (nextStep === 2)
            cta.textContent = '다음 · 대응 문구 만들기';
        else
            cta.textContent = state.actionMode === 'nego' ? '카톡 수정 멘트 복사하기' : '제37조 철회서 복사하기';
    }
    subCta?.classList.toggle('hidden', nextStep !== 3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderCatalog(query) {
    const list = document.getElementById('svc-catalog-list');
    if (!list)
        return;
    const items = searchServiceCatalog(query);
    if (items.length === 0) {
        list.innerHTML = `<div style="padding:20px;text-align:center;color:#8B95A1;font-size:13px;">찾는 서비스가 없다면 상단 [파일 · 텍스트 입력]을 이용해 보세요.</div>`;
        return;
    }
    list.innerHTML = items
        .map((svc) => {
        const isSelected = state.selectedService.id === svc.id;
        const chipCls = svc.riskLevel === 'RED'
            ? 'chip-red'
            : svc.riskLevel === 'YELLOW'
                ? 'chip-warn'
                : 'chip-green';
        const label = svc.riskLevel === 'RED' ? '위험' : svc.riskLevel === 'YELLOW' ? '주의' : '안전';
        return `
        <button class="svc-row ${isSelected ? 'selected' : ''}" data-svc-id="${escapeHtml(svc.id)}">
          <div>
            <div class="svc-name">${escapeHtml(svc.name)}</div>
            <div class="svc-cat">${escapeHtml(svc.category)}</div>
          </div>
          <span class="chip ${chipCls}">${label} · ${svc.riskScore}점</span>
        </button>
      `;
    })
        .join('');
    list.querySelectorAll('[data-svc-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const found = POPULAR_SERVICE_CATALOG.find((s) => s.id === btn.dataset.svcId);
            if (!found)
                return;
            state.selectedService = found;
            renderCatalog(query);
        });
    });
}
function renderStep2Result() {
    const d = state.diagnosis;
    if (!d)
        return;
    const headline = document.getElementById('res-headline');
    const riskChip = document.getElementById('res-risk-chip');
    const summaryEl = document.getElementById('res-summary-text');
    const scoreNum = document.getElementById('res-score-num');
    const circle = document.getElementById('res-gauge-circle');
    const trapsWrap = document.getElementById('res-traps-wrap');
    const trapsList = document.getElementById('res-traps-list');
    const guideBox = document.getElementById('res-check-guide');
    if (headline) {
        headline.textContent =
            d.level === 'RED'
                ? '서명 전 꼭 확인해야 할 조항이 있어요'
                : d.level === 'YELLOW'
                    ? '선택 항목만 주의하면 안전해요'
                    : '표준 기준에 부합하는 안전한 약관이에요';
    }
    if (riskChip) {
        riskChip.className = `chip ${d.level === 'RED' ? 'chip-red' : d.level === 'YELLOW' ? 'chip-warn' : 'chip-green'}`;
        riskChip.textContent =
            d.level === 'RED' ? '위험 · RED' : d.level === 'YELLOW' ? '주의 · YELLOW' : '안전 · GREEN';
    }
    if (summaryEl)
        summaryEl.textContent = d.summary;
    if (scoreNum)
        scoreNum.textContent = String(d.score);
    if (circle) {
        const circ = 2 * Math.PI * 28;
        circle.setAttribute('stroke-dasharray', String(circ));
        circle.setAttribute('stroke-dashoffset', String(circ * (1 - d.score / 100)));
        circle.setAttribute('stroke', d.level === 'RED' ? '#F04452' : d.level === 'YELLOW' ? '#E5850B' : '#00A86B');
    }
    if (trapsWrap && trapsList) {
        if (d.traps.length > 0) {
            trapsWrap.classList.remove('hidden');
            trapsList.innerHTML = d.traps
                .map((t) => `<span class="chip chip-red">${escapeHtml(TRAP_LABELS[t] || t)}</span>`)
                .join('');
        }
        else {
            trapsWrap.classList.add('hidden');
        }
    }
    if (guideBox) {
        const checkHtml = d.checkItems
            .map((item) => `<div class="guide-line" style="color:#00A86B;">✓ 체크: ${escapeHtml(item)}</div>`)
            .join('');
        const uncheckHtml = d.uncheckItems
            .map((item) => `<div class="guide-line" style="color:#F04452;">✕ 해제 권장: ${escapeHtml(item)}</div>`)
            .join('');
        guideBox.innerHTML = checkHtml + uncheckHtml;
    }
}
async function renderStep3Action() {
    const d = state.diagnosis;
    const docName = state.inputMode === 'catalog'
        ? state.selectedService.name
        : state.uploadedDocName || '계약서/약관';
    const revokeSvcInput = document.getElementById('toss-revoke-service');
    if (revokeSvcInput)
        revokeSvcInput.value = docName;
    const negoEl = document.getElementById('toss-nego-text');
    if (negoEl) {
        negoEl.textContent =
            d?.negotiationMessage ||
                (await fetchNegotiationMessage(d?.traps || [], state.tone, 'vendor', docName));
    }
    await refreshRevokePreview();
}
async function refreshRevokePreview() {
    const svc = document.getElementById('toss-revoke-service')?.value || '대상 서비스';
    const acc = document.getElementById('toss-revoke-account')?.value || 'user@korea.com';
    const pre = document.getElementById('toss-revoke-text');
    if (pre) {
        pre.textContent = await fetchRevokeTemplateForToss(svc, acc);
    }
}
async function runStep1Diagnosis() {
    const cta = document.getElementById('primary-cta');
    if (cta) {
        cta.disabled = true;
        cta.textContent = '3초 만에 진단하는 중...';
    }
    try {
        if (state.inputMode === 'catalog') {
            const svc = state.selectedService;
            const nego = await fetchNegotiationMessage(svc.traps, state.tone, 'vendor', svc.name);
            state.diagnosis = {
                score: svc.riskScore,
                level: svc.riskLevel,
                summary: svc.summary,
                traps: svc.traps,
                checkItems: svc.checkItems,
                uncheckItems: svc.uncheckItems,
                negotiationMessage: nego,
            };
            return true;
        }
        // Direct mode: uploaded PDF or text
        if (state.uploadedBase64 && state.uploadedDocName.toLowerCase().endsWith('.pdf')) {
            const docRes = await analyzeDocumentForToss(state.uploadedDocName, state.uploadedMime || 'application/pdf', state.uploadedBase64);
            if (docRes) {
                const traps = Array.from(new Set(docRes.analysis.analyzed_items.flatMap((i) => i.trap_patterns || [])));
                state.diagnosis = {
                    score: docRes.analysis.overall_summary.risk_score ?? 75,
                    level: docRes.analysis.overall_summary.risk_level,
                    summary: docRes.analysis.overall_summary.one_line_summary,
                    traps,
                    checkItems: ['필수 기본 이용 조건 확인'],
                    uncheckItems: traps.length > 0 ? ['감지된 함정 조항 서명 전 협의 필요'] : [],
                    negotiationMessage: docRes.negotiation_message,
                };
                return true;
            }
        }
        const rawText = (document.getElementById('toss-terms-input')?.value || '').trim();
        if (!rawText) {
            showToast('분석할 약관이나 계약서 내용을 입력해 주세요.');
            return false;
        }
        const { analysis, negotiationMessage } = await analyzeTextForToss(rawText);
        const traps = Array.from(new Set(analysis.analyzed_items.flatMap((i) => i.trap_patterns || [])));
        state.diagnosis = {
            score: analysis.overall_summary.risk_score ?? 50,
            level: analysis.overall_summary.risk_level,
            summary: analysis.overall_summary.one_line_summary,
            traps,
            checkItems: ['표준 필수 동의 항목'],
            uncheckItems: analysis.overall_summary.risk_level === 'GREEN'
                ? []
                : ['불리한 단서·선택 조항 수정 또는 해제 권장'],
            negotiationMessage,
        };
        return true;
    }
    finally {
        if (cta)
            cta.disabled = false;
    }
}
export function initTossMiniapp() {
    renderCatalog('');
    goToStep(0);
    // Back button
    document.getElementById('btn-back')?.addEventListener('click', () => {
        if (state.step === 1)
            goToStep(0);
        else if (state.step === 2)
            goToStep(1);
        else if (state.step === 3)
            goToStep(2);
    });
    // Step 1 mode toggle
    const catalogBtn = document.getElementById('mode-catalog-btn');
    const directBtn = document.getElementById('mode-direct-btn');
    catalogBtn?.addEventListener('click', () => {
        state.inputMode = 'catalog';
        catalogBtn.classList.add('active');
        directBtn?.classList.remove('active');
        document.getElementById('input-mode-catalog')?.classList.remove('hidden');
        document.getElementById('input-mode-direct')?.classList.add('hidden');
    });
    directBtn?.addEventListener('click', () => {
        state.inputMode = 'direct';
        directBtn.classList.add('active');
        catalogBtn?.classList.remove('active');
        document.getElementById('input-mode-direct')?.classList.remove('hidden');
        document.getElementById('input-mode-catalog')?.classList.add('hidden');
    });
    // Search input
    document.getElementById('svc-search-input')?.addEventListener('input', (e) => {
        renderCatalog(e.target.value);
    });
    // Preset chips
    document.querySelectorAll('[data-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.preset || 'trap';
            const ta = document.getElementById('toss-terms-input');
            if (ta)
                ta.value = PRESETS[key] || '';
            state.uploadedDocName = btn.textContent || '예시 약관';
            state.uploadedBase64 = '';
        });
    });
    // File upload
    document.getElementById('toss-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        state.uploadedDocName = file.name;
        state.uploadedMime = file.type;
        const label = document.getElementById('toss-file-label');
        if (label)
            label.textContent = file.name;
        if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
            const ta = document.getElementById('toss-terms-input');
            if (ta)
                ta.value = (await file.text()).slice(0, 15000);
            state.uploadedBase64 = '';
            showToast('파일 텍스트를 불러왔습니다.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            state.uploadedBase64 = String(reader.result || '');
            showToast('PDF가 준비되었습니다. 하단 버튼을 눌러 진단하세요.');
        };
        reader.readAsDataURL(file);
    });
    // Step 3 action toggle
    const actNegoBtn = document.getElementById('act-nego-btn');
    const actRevokeBtn = document.getElementById('act-revoke-btn');
    actNegoBtn?.addEventListener('click', () => {
        state.actionMode = 'nego';
        actNegoBtn.classList.add('active');
        actRevokeBtn?.classList.remove('active');
        document.getElementById('act-panel-nego')?.classList.remove('hidden');
        document.getElementById('act-panel-revoke')?.classList.add('hidden');
        const cta = document.getElementById('primary-cta');
        if (cta)
            cta.textContent = '카톡 수정 멘트 복사하기';
    });
    actRevokeBtn?.addEventListener('click', () => {
        state.actionMode = 'revoke';
        actRevokeBtn.classList.add('active');
        actNegoBtn?.classList.remove('active');
        document.getElementById('act-panel-revoke')?.classList.remove('hidden');
        document.getElementById('act-panel-nego')?.classList.add('hidden');
        const cta = document.getElementById('primary-cta');
        if (cta)
            cta.textContent = '제37조 철회서 복사하기';
        void refreshRevokePreview();
    });
    // Tone switcher
    const politeBtn = document.getElementById('toss-tone-polite');
    const firmBtn = document.getElementById('toss-tone-firm');
    const setTone = async (tone) => {
        state.tone = tone;
        if (politeBtn && firmBtn) {
            politeBtn.style.background = tone === 'polite' ? '#191F28' : '#FFFFFF';
            politeBtn.style.color = tone === 'polite' ? '#FFFFFF' : '#191F28';
            firmBtn.style.background = tone === 'firm' ? '#191F28' : '#FFFFFF';
            firmBtn.style.color = tone === 'firm' ? '#FFFFFF' : '#191F28';
        }
        const docName = state.inputMode === 'catalog'
            ? state.selectedService.name
            : state.uploadedDocName || '계약서/약관';
        const msg = await fetchNegotiationMessage(state.diagnosis?.traps || [], tone, 'vendor', docName);
        const negoEl = document.getElementById('toss-nego-text');
        if (negoEl)
            negoEl.textContent = msg;
    };
    politeBtn?.addEventListener('click', () => void setTone('polite'));
    firmBtn?.addEventListener('click', () => void setTone('firm'));
    // Revoke input live update
    document.getElementById('toss-revoke-service')?.addEventListener('input', () => void refreshRevokePreview());
    document.getElementById('toss-revoke-account')?.addEventListener('input', () => void refreshRevokePreview());
    // Primary Thumb-Zone CTA
    document.getElementById('primary-cta')?.addEventListener('click', async () => {
        if (state.step === 0) {
            goToStep(1);
            return;
        }
        if (state.step === 1) {
            const ok = await runStep1Diagnosis();
            if (ok) {
                renderStep2Result();
                goToStep(2);
            }
            return;
        }
        if (state.step === 2) {
            await renderStep3Action();
            goToStep(3);
            return;
        }
        if (state.step === 3) {
            const text = state.actionMode === 'nego'
                ? document.getElementById('toss-nego-text')?.textContent || ''
                : document.getElementById('toss-revoke-text')?.textContent || '';
            await copyText(text, state.actionMode === 'nego'
                ? '카톡 수정 요청 멘트가 복사되었습니다.'
                : '제37조 철회 요청서가 복사되었습니다.');
        }
    });
    // Secondary CTA (Restart)
    document.getElementById('secondary-cta')?.addEventListener('click', () => {
        goToStep(1);
    });
}
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => initTossMiniapp());
}
