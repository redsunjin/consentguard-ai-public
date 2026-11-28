/**
 * Apps in Toss Miniapp UI Controller (app.ts)
 */
import { analyzeDocumentForToss, analyzeTextForToss, fetchNegotiationMessage, fetchRevokeTemplateForToss, } from './api.js';
import { searchServiceCatalog } from './service-catalog.js';
const TRAP_LABELS = {
    EXCEPTION_REVERSAL: '단서 역전 함정',
    SILENCE_CONSENT: '침묵·자동 갱신',
    UNILATERAL_DISCRETION: '일방적 재량권',
    ASYMMETRIC_LIABILITY: '권리·책임 비대칭',
    THRESHOLD_DEVIATION: '수치 기준 이탈',
};
let currentTraps = [];
let currentDocName = '계약서/약관';
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
function switchTab(tab) {
    const tabs = ['search', 'analyze', 'revoke'];
    for (const t of tabs) {
        document.getElementById(`toss-view-${t}`)?.classList.toggle('hidden', t !== tab);
        document.getElementById(`nav-${t}`)?.classList.toggle('active', t === tab);
    }
}
function renderCatalog(query) {
    const box = document.getElementById('svc-catalog-list');
    if (!box)
        return;
    const items = searchServiceCatalog(query);
    if (items.length === 0) {
        box.innerHTML = `<div class="card" style="text-align:center;color:#8B95A1;font-size:13px;">검색 결과가 없습니다. [3초 판독] 탭에서 직접 진단해 보세요.</div>`;
        return;
    }
    box.innerHTML = items
        .map((svc) => {
        const chipCls = svc.riskLevel === 'RED'
            ? 'chip-red'
            : svc.riskLevel === 'YELLOW'
                ? 'chip-warn'
                : 'chip-green';
        const label = svc.riskLevel === 'RED' ? '위험' : svc.riskLevel === 'YELLOW' ? '주의' : '안전';
        return `
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div>
              <div style="font-size:15px;font-weight:800;">${escapeHtml(svc.name)}</div>
              <div style="font-size:11px;color:#8B95A1;">${escapeHtml(svc.category)}</div>
            </div>
            <span class="chip ${chipCls}">${label} · ${svc.riskScore}점</span>
          </div>
          <p class="sub" style="margin-bottom:10px;">${escapeHtml(svc.summary)}</p>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:4px;">
            <div style="color:#00A86B;font-weight:700;">✅ 체크: ${escapeHtml(svc.checkItems.join(', '))}</div>
            <div style="color:#F04452;font-weight:700;">❌ 해제 권장: ${escapeHtml(svc.uncheckItems.join(', '))}</div>
          </div>
        </div>
      `;
    })
        .join('');
}
function renderDiagnosisResult(score, level, summary, traps, negotiationMessage) {
    currentTraps = traps;
    const card = document.getElementById('toss-result-card');
    const badge = document.getElementById('toss-score-badge');
    const summaryEl = document.getElementById('toss-summary-text');
    const trapsEl = document.getElementById('toss-traps-list');
    const negoEl = document.getElementById('toss-nego-text');
    if (!card || !badge || !summaryEl || !trapsEl || !negoEl)
        return;
    card.classList.remove('hidden');
    badge.className = `chip ${level === 'RED' ? 'chip-red' : level === 'YELLOW' ? 'chip-warn' : 'chip-green'}`;
    badge.textContent = `${level === 'RED' ? '위험' : level === 'YELLOW' ? '주의' : '안전'} · ${score}점`;
    summaryEl.textContent = summary;
    trapsEl.innerHTML = traps
        .map((t) => `<span class="chip chip-red">${escapeHtml(TRAP_LABELS[t] || t)}</span>`)
        .join('');
    negoEl.textContent = negotiationMessage;
}
async function updateTone(tone) {
    const politeBtn = document.getElementById('toss-tone-polite');
    const firmBtn = document.getElementById('toss-tone-firm');
    if (politeBtn && firmBtn) {
        politeBtn.style.background = tone === 'polite' ? '#191F28' : '#FFFFFF';
        politeBtn.style.color = tone === 'polite' ? '#FFFFFF' : '#191F28';
        firmBtn.style.background = tone === 'firm' ? '#191F28' : '#FFFFFF';
        firmBtn.style.color = tone === 'firm' ? '#FFFFFF' : '#191F28';
    }
    const msg = await fetchNegotiationMessage(currentTraps, tone, 'vendor', currentDocName);
    const negoEl = document.getElementById('toss-nego-text');
    if (negoEl)
        negoEl.textContent = msg;
}
export function initTossMiniapp() {
    renderCatalog('');
    document.getElementById('nav-search')?.addEventListener('click', () => switchTab('search'));
    document.getElementById('nav-analyze')?.addEventListener('click', () => switchTab('analyze'));
    document.getElementById('nav-revoke')?.addEventListener('click', () => switchTab('revoke'));
    document.getElementById('svc-search-input')?.addEventListener('input', (e) => {
        renderCatalog(e.target.value);
    });
    document.getElementById('toss-analyze-btn')?.addEventListener('click', async () => {
        const input = document.getElementById('toss-terms-input');
        const text = (input?.value || '').trim();
        if (!text) {
            showToast('분석할 약관이나 계약서를 입력해 주세요.');
            return;
        }
        const { analysis, negotiationMessage } = await analyzeTextForToss(text);
        const traps = Array.from(new Set(analysis.analyzed_items.flatMap((i) => i.trap_patterns || [])));
        renderDiagnosisResult(analysis.overall_summary.risk_score ?? 50, analysis.overall_summary.risk_level, analysis.overall_summary.one_line_summary, traps, negotiationMessage);
        showToast('3초 진단이 완료되었습니다.');
    });
    document.getElementById('toss-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        currentDocName = file.name;
        const label = document.getElementById('toss-file-label');
        if (label)
            label.textContent = `📎 ${file.name}`;
        if (file.name.toLowerCase().endsWith('.txt') || file.name.toLowerCase().endsWith('.md')) {
            const content = await file.text();
            const input = document.getElementById('toss-terms-input');
            if (input)
                input.value = content.slice(0, 15000);
            document.getElementById('toss-analyze-btn')?.click();
            return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
            const res = await analyzeDocumentForToss(file.name, file.type || 'application/pdf', String(reader.result || ''));
            if (res) {
                const traps = Array.from(new Set(res.analysis.analyzed_items.flatMap((i) => i.trap_patterns || [])));
                renderDiagnosisResult(res.analysis.overall_summary.risk_score ?? 70, res.analysis.overall_summary.risk_level, res.analysis.overall_summary.one_line_summary, traps, res.negotiation_message);
                showToast(`'${file.name}' 즉시 분석 완료!`);
            }
            else {
                showToast('서버 미연결 상태입니다. 텍스트를 붙여넣어 주세요.');
            }
        };
        reader.readAsDataURL(file);
    });
    document.getElementById('toss-tone-polite')?.addEventListener('click', () => void updateTone('polite'));
    document.getElementById('toss-tone-firm')?.addEventListener('click', () => void updateTone('firm'));
    document.getElementById('toss-copy-nego-btn')?.addEventListener('click', () => {
        const text = document.getElementById('toss-nego-text')?.textContent || '';
        void copyText(text, '카톡 수정 요청 멘트가 복사되었습니다.');
    });
    document.getElementById('toss-revoke-gen-btn')?.addEventListener('click', async () => {
        const svc = document.getElementById('toss-revoke-service')?.value || '대상 서비스';
        const acc = document.getElementById('toss-revoke-account')?.value || 'user@korea.com';
        const body = await fetchRevokeTemplateForToss(svc, acc);
        const box = document.getElementById('toss-revoke-result');
        const pre = document.getElementById('toss-revoke-text');
        if (box && pre) {
            box.classList.remove('hidden');
            pre.textContent = body;
            showToast('제37조 철회 요청서가 생성되었습니다.');
        }
    });
    document.getElementById('toss-copy-revoke-btn')?.addEventListener('click', () => {
        const text = document.getElementById('toss-revoke-text')?.textContent || '';
        void copyText(text, '철회 요청서가 복사되었습니다.');
    });
}
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => initTossMiniapp());
}
