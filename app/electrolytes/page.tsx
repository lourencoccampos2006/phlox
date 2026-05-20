'use client'

import { useState } from 'react'

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 14, outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 5 }

// ─── POTASSIUM ────────────────────────────────────────────────────────────────
function PotassiumCalc() {
  const [k, setK] = useState('')
  const [weight, setWeight] = useState('')
  const [route, setRoute] = useState<'iv'|'oral'>('iv')

  const kv = parseFloat(k)
  const w = parseFloat(weight)

  const getProtocol = () => {
    if (!kv || kv <= 0 || kv > 6) return null
    const deficit = w ? Math.round((4.0 - kv) * 200 * 0.4) : null // ~200 mEq total body K lost per 0.1 drop

    if (kv >= 3.5) return { level: 'normal', color: '#059669', label: 'Normal (3.5–5.0 mEq/L)', steps: ['Sem reposição necessária.'] }
    if (kv >= 3.0) return {
      level: 'mild', color: '#d97706', label: `Hipocaliemia ligeira (${kv} mEq/L)`,
      steps: [
        route === 'oral'
          ? 'KCl 40–80 mEq/dia oral em 2–4 doses (ex: Slow-K® 2 comprimidos 2x/dia)'
          : 'KCl 20 mEq/h IV em veia periférica (em 100mL SF — concentração máx 40 mEq/L periférica)',
        'Corrigir hipomagnesemia concomitante (bloqueia reposição de K)',
        'Reavaliação analítica em 4–6h após início da reposição',
        deficit ? `Défice estimado: ${deficit} mEq (estimativa orientativa)` : '',
      ].filter(Boolean)
    }
    if (kv >= 2.5) return {
      level: 'moderate', color: '#ea580c', label: `Hipocaliemia moderada (${kv} mEq/L)`,
      steps: [
        route === 'iv'
          ? 'KCl 20–40 mEq/h IV via central (máx 40 mEq/h em situação de risco)'
          : 'KCl 40 mEq oral x 3–4 vezes/dia',
        'Via central preferível para concentrações > 40 mEq/L',
        'Monitorizar ECG contínuo (risco de arritmias)',
        'Reavaliação analítica em 2–4h',
        'Corrigir causa (diuréticos, vómitos, diarreia)',
        deficit ? `Défice estimado: ~${deficit} mEq` : '',
      ].filter(Boolean)
    }
    return {
      level: 'severe', color: '#dc2626', label: `Hipocaliemia grave (${kv} mEq/L) — RISCO ARRÍTMICO`,
      steps: [
        'KCl 40 mEq/h IV via central com monitorização ECG contínua',
        'Máximo recomendado: 40 mEq/h — vigilância intensiva obrigatória',
        'Monitorização ECG contínua + UAVC/UCI',
        'Corrigir hipomagnesemia urgente (MgSO4 2g IV)',
        'Reavaliação analítica a cada 1–2h',
        'Suspender diuréticos e outros fármacos hipocaligénicos',
        deficit ? `Défice estimado: ~${deficit} mEq (pode ser > 400–600 mEq)` : '',
      ].filter(Boolean)
    }
  }

  const proto = kv && kv > 0 ? getProtocol() : null

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
        Protocolo de reposição de potássio por nível sérico. Corrigir sempre hipomagnesemia concomitante.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label style={lbl}>K⁺ sérico (mEq/L)</label>
          <input type="number" step="0.1" value={k} onChange={e => setK(e.target.value)} placeholder="Ex: 2.8" style={inp} /></div>
        <div><label style={lbl}>Peso (kg) — opcional</label>
          <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Ex: 70" style={inp} /></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Via preferencial</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['iv', 'oral'] as const).map(r => (
            <button key={r} onClick={() => setRoute(r)}
              style={{ flex: 1, padding: '8px', background: route === r ? '#0f172a' : 'var(--bg-2)', border: `1.5px solid ${route === r ? '#0f172a' : 'var(--border)'}`, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: route === r ? 'white' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              {r === 'iv' ? 'IV / Endovenosa' : 'Oral / PO'}
            </button>
          ))}
        </div>
      </div>
      {proto && (
        <div style={{ background: 'var(--bg-2)', border: `2px solid ${proto.color}`, borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: proto.color, marginBottom: 12 }}>{proto.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proto.steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: proto.color, fontWeight: 700, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            Referência: guidelines KDIGO, NICE Electrolytes CG127 · Verificar sempre laboratório antes de cada bolus
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SODIUM ───────────────────────────────────────────────────────────────────
function SodiumCalc() {
  const [na, setNa] = useState('')
  const [weight, setWeight] = useState('')
  const [sex, setSex] = useState<'M'|'F'>('M')
  const [type, setType] = useState<'hypo'|'hyper'>('hypo')

  const nav = parseFloat(na), w = parseFloat(weight)
  const tbw = w ? w * (sex === 'M' ? 0.6 : 0.5) : 0

  const getProto = () => {
    if (!nav || !w) return null
    if (type === 'hypo') {
      const target = nav < 120 ? 125 : 135
      const deficit = tbw * (target - nav)
      const acute = nav < 125
      const maxRate = nav < 120 ? (acute ? '2 mEq/L/h (máx 12h)' : '0.5–1 mEq/L/h') : '0.5 mEq/L/h'
      const level = nav < 120 ? 'grave' : nav < 130 ? 'moderada' : 'ligeira'
      const color = nav < 120 ? '#dc2626' : nav < 130 ? '#ea580c' : '#d97706'
      return {
        color, level: `Hiponatremia ${level} — Na⁺ ${nav} mEq/L`,
        steps: [
          `Défice de sódio estimado: ${deficit.toFixed(0)} mEq (target ${target} mEq/L)`,
          nav < 125 ? 'NaCl 3% IV: corrigir 1–2 mEq/L/h nas primeiras 3–4h se sintomático' : 'Corrigir causa base + restrição hídrica',
          `Velocidade máxima de correcção: ${maxRate} (NUNCA > 10–12 mEq/L em 24h)`,
          'Risco de mielinólise pontina osmótica se correcção excessivamente rápida',
          'Monitorizar Na⁺ a cada 2h nas primeiras 12h',
          nav < 120 ? 'Neurocrítico: UAVC/UCI, considerar neurologista' : 'Avaliar SIADH, hipotiroidismo, ICC, cirrose',
          `Fórmula Adrogue-Madias: ΔNa = (soro Na - Na doente) / (TBW + 1)`,
        ]
      }
    } else {
      const excess = tbw * (nav - 140)
      const color = nav > 160 ? '#dc2626' : nav > 150 ? '#ea580c' : '#d97706'
      const level = nav > 160 ? 'grave' : nav > 150 ? 'moderada' : 'ligeira'
      return {
        color, level: `Hipernatremia ${level} — Na⁺ ${nav} mEq/L`,
        steps: [
          `Excesso de sódio / défice de água estimado: ${excess.toFixed(0)} mEq`,
          `Défice de água livre: ${((nav - 140) * tbw / 140).toFixed(1)} L`,
          'Repor défice em 48–72h (correcção máx: 0.5 mEq/L/h ou 10 mEq/L/24h)',
          'Via oral preferencial; se impossível: G5% ou SF 0.45% IV',
          nav > 160 ? 'UCI — monitorização horária de Na⁺' : 'Monitorizar Na⁺ a cada 4–6h',
          'Causa mais comum: défice de ingestão, febre, diabetes insipidus',
        ]
      }
    }
  }

  const proto = getProto()

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
        Protocolo de correcção de disnatremias. A velocidade de correcção é mais importante que o valor absoluto.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label style={lbl}>Na⁺ sérico (mEq/L)</label><input type="number" value={na} onChange={e => setNa(e.target.value)} placeholder="Ex: 118" style={inp} /></div>
        <div><label style={lbl}>Peso (kg)</label><input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Ex: 70" style={inp} /></div>
        <div><label style={lbl}>Sexo</label>
          <select value={sex} onChange={e => setSex(e.target.value as 'M'|'F')} style={inp}>
            <option value="M">Masculino</option><option value="F">Feminino</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Tipo de distúrbio</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['hypo', 'hyper'] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              style={{ flex: 1, padding: '8px', background: type === t ? '#1d4ed8' : 'var(--bg-2)', border: `1.5px solid ${type === t ? '#1d4ed8' : 'var(--border)'}`, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: type === t ? 'white' : 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              {t === 'hypo' ? 'Hiponatremia' : 'Hipernatremia'}
            </button>
          ))}
        </div>
      </div>
      {proto && (
        <div style={{ background: 'var(--bg-2)', border: `2px solid ${proto.color}`, borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: proto.color, marginBottom: 12 }}>{proto.level}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {proto.steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: proto.color, fontWeight: 700, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAGNESIUM ────────────────────────────────────────────────────────────────
function MagnesiumCalc() {
  const [mg, setMg] = useState('')
  const mgv = parseFloat(mg)
  const getProto = () => {
    if (!mgv) return null
    if (mgv >= 0.75) return { color: '#059669', label: 'Normal (0.75–1.05 mmol/L)', steps: ['Sem reposição necessária.'] }
    if (mgv >= 0.5) return {
      color: '#d97706', label: `Hipomagnesemia ligeira a moderada (${mgv} mmol/L)`,
      steps: [
        'MgSO4 2g (8 mmol) em 100mL SG5% IV em 2h + 1g/h x6h',
        'Alternativa oral: Óxido de Mg 400–800 mg/dia (efeito laxante frequente)',
        'Verificar e corrigir hipocaliemia concomitante',
        'Reavaliação em 24h',
      ]
    }
    return {
      color: '#dc2626', label: `Hipomagnesemia grave (${mgv} mmol/L) — RISCO ARRÍTMICO / CONVULSIVO`,
      steps: [
        'MgSO4 2g IV em 15 min (bolus); depois 1g/h em perfusão contínua x12–24h',
        'Se torsades de pointes: 2g IV em bolus imediato',
        'Se eclâmpsia: 4g IV loading em 20min + 1–2g/h manutenção',
        'Monitorizar reflexo patelar (perde-se com Mg > 4 mmol/L)',
        'Vigiar FR (depressão com Mg > 5 mmol/L)',
        'Antídoto: Gluconato de Ca 10% 10mL IV lento',
        'ECG contínuo; reavaliação analítica em 4–6h',
      ]
    }
  }
  const proto = getProto()
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
        A hipomagnesemia bloqueia a reposição de potássio e cálcio — corrigir sempre em simultâneo.
      </p>
      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Mg²⁺ sérico (mmol/L)</label>
        <input type="number" step="0.01" value={mg} onChange={e => setMg(e.target.value)} placeholder="Ex: 0.48" style={{ ...inp, maxWidth: 220 }} />
        <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>Normal: 0.75–1.05 mmol/L · mg/dL → dividir por 0.411</div>
      </div>
      {proto && (
        <div style={{ background: 'var(--bg-2)', border: `2px solid ${proto.color}`, borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: proto.color, marginBottom: 12 }}>{proto.label}</div>
          {proto.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: proto.color, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PHOSPHATE ───────────────────────────────────────────────────────────────
function PhosphateCalc() {
  const [ph, setPh] = useState('')
  const [weight, setWeight] = useState('')
  const phv = parseFloat(ph), w = parseFloat(weight)
  const getProto = () => {
    if (!phv) return null
    if (phv >= 0.8) return { color: '#059669', label: 'Normal (0.8–1.45 mmol/L)', steps: ['Sem reposição necessária.'] }
    if (phv >= 0.5) return {
      color: '#d97706', label: `Hipofosfatemia moderada (${phv} mmol/L)`,
      steps: [
        w ? `IV: fosfato potássico 0.16–0.24 mmol/kg = ${(0.2 * w).toFixed(1)} mmol em 4–6h` : 'IV: fosfato potássico 0.16–0.24 mmol/kg em 4–6h',
        'Oral: Phosphate Sandoz® 500mg 2–3x/dia (se tolerância GI)',
        'Reavaliação em 6h após reposição',
      ]
    }
    return {
      color: '#dc2626', label: `Hipofosfatemia grave (${phv} mmol/L) — Síndrome de Realimentação`,
      steps: [
        w ? `IV urgente: fosfato potássico 0.32–0.64 mmol/kg = ${(0.48 * w).toFixed(1)} mmol em 8–12h` : 'IV urgente: fosfato potássico 0.32–0.64 mmol/kg em 8–12h',
        'Risco síndrome de realimentação: suspender nutrição e corrigir eletrólitos primeiro',
        'Monitorizar cálcio (pode descer com reposição de fosfato)',
        'Monitorizar ECG (risco de arritmias)',
        'Reavaliação analítica em 4h',
      ]
    }
  }
  const proto = getProto()
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
        A hipofosfatemia grave está associada a falência respiratória, hemólise e síndrome de realimentação.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div><label style={lbl}>Fosfato sérico (mmol/L)</label><input type="number" step="0.01" value={ph} onChange={e => setPh(e.target.value)} placeholder="Ex: 0.35" style={inp} /></div>
        <div><label style={lbl}>Peso (kg) — opcional</label><input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="Ex: 70" style={inp} /></div>
      </div>
      {proto && (
        <div style={{ background: 'var(--bg-2)', border: `2px solid ${proto.color}`, borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: proto.color, marginBottom: 12 }}>{proto.label}</div>
          {proto.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: proto.color, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── CALCIUM ─────────────────────────────────────────────────────────────────
function CalciumCalc() {
  const [ca, setCa] = useState('')
  const [albumin, setAlbumin] = useState('')
  const cav = parseFloat(ca), alb = parseFloat(albumin)
  const corrected = alb && cav ? cav + 0.8 * (4.0 - alb) : cav
  const getProto = () => {
    const v = corrected
    if (!v) return null
    if (v > 2.6) return { color: '#059669', label: 'Normal (2.1–2.6 mmol/L)', steps: ['Sem reposição necessária.'] }
    if (v >= 1.9) return {
      color: '#d97706', label: `Hipocalcemia ligeira (Ca corrigido ${v.toFixed(2)} mmol/L)`,
      steps: [
        'Gluconato de Ca 10% 10mL IV em 10min (= 93mg Ca elementar)',
        'Alternativa oral: Carbonato de Ca 1–1.5g 3x/dia + Vitamina D',
        'Corrigir hipomagnesemia se presente (bloqueia resposta à reposição)',
        'Monitorizar ECG (QT prolongado)',
      ]
    }
    return {
      color: '#dc2626', label: `Hipocalcemia grave / Tetania (Ca corrigido ${v.toFixed(2)} mmol/L)`,
      steps: [
        'Gluconato de Ca 10% 20mL IV em 10–20min (= 186mg Ca elementar)',
        'Depois: perfusão contínua 0.5–2mg/kg/h Ca elementar',
        'Para cada 100mL G5%: adicionar 10mL Gluconato Ca 10%',
        'Monitorizar ECG contínuo',
        'Reavaliação analítica em 2h',
        'Causas: hipoparatiroidismo, hipomagnesemia, vitamina D, sépsis',
      ]
    }
  }
  const proto = getProto()
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
        Corrigir sempre o cálcio para a albumina. Hipomagnesemia impede a correcção da hipocalcemia.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div><label style={lbl}>Ca²⁺ total (mmol/L)</label><input type="number" step="0.01" value={ca} onChange={e => setCa(e.target.value)} placeholder="Ex: 1.85" style={inp} /></div>
        <div><label style={lbl}>Albumina (g/dL) — opcional</label><input type="number" step="0.1" value={albumin} onChange={e => setAlbumin(e.target.value)} placeholder="Ex: 2.8" style={inp} /></div>
      </div>
      {alb && cav && (
        <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#1d4ed8', fontFamily: 'var(--font-mono)' }}>
          Ca corrigido = {cav} + 0.8 × (4 – {alb}) = <strong>{corrected.toFixed(2)} mmol/L</strong>
        </div>
      )}
      {proto && (
        <div style={{ background: 'var(--bg-2)', border: `2px solid ${proto.color}`, borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: proto.color, marginBottom: 12 }}>{proto.label}</div>
          {proto.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: proto.color, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── HYPERKALEMIA ─────────────────────────────────────────────────────────────
function HyperkalemiaCalc() {
  const [k, setK] = useState('')
  const [ecg, setEcg] = useState('none')
  const kv = parseFloat(k)
  const getProto = () => {
    if (!kv) return null
    if (kv <= 5.5) return { color: '#059669', label: 'Normocaliemia / Hipercaliemia ligeira', steps: ['Sem tratamento de emergência. Rever causa (diuréticos, IECA, IRC).'] }
    const hasPseudo = kv > 5.5 && kv < 6
    const severe = kv > 6.5 || ecg !== 'none'
    const color = severe ? '#dc2626' : '#ea580c'
    return {
      color, label: `Hipercaliemia ${severe ? 'grave' : 'moderada'} — K⁺ ${kv} mEq/L`,
      steps: [
        ...(ecg !== 'none' || kv > 6.5 ? ['1. ESTABILIZAR MEMBRANA: Gluconato de Ca 10% 10mL IV em 5min (efeito em 5 min, duração 30–60 min) — repetir se ECG persistente'] : []),
        '2. REDISTRIBUIÇÃO: Insulina Regular 10 UI + Dextrose 50% 50mL IV (baixa K 0.5–1.5 mEq/L em 30min)',
        'Alternativa redistribuição: Salbutamol 10–20 mg nebulizado (baixa K 0.5–1 mEq/L)',
        '3. ELIMINAÇÃO: Furosemida 40–80 mg IV se diurese preservada',
        '3b. Resinas de troca: Patiromer ou Ciclosilicato de Zircônio-Sódio (mais eficazes que Kayexalate)',
        kv > 7 || ecg === 'sine' ? '4. DIÁLISE URGENTE se refractário ou K > 7 mEq/L com ECG grave' : '',
        'Monitorizar ECG contínuo + K⁺ cada 1–2h',
        'Suspender IECA/ARA, diuréticos poupadores de K, heparina',
        hasPseudo ? 'Excluir pseudohipercaliemia (hemólise, leucocitose, trombocitose)' : '',
      ].filter(Boolean)
    }
  }
  const proto = getProto()
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, lineHeight: 1.6 }}>
        Abordagem urgente da hipercaliemia: estabilizar membrana → redistribuir → eliminar.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div><label style={lbl}>K⁺ sérico (mEq/L)</label><input type="number" step="0.1" value={k} onChange={e => setK(e.target.value)} placeholder="Ex: 6.8" style={inp} /></div>
        <div><label style={lbl}>Alterações ECG</label>
          <select value={ecg} onChange={e => setEcg(e.target.value)} style={inp}>
            <option value="none">Sem alterações</option>
            <option value="peaked">T picadas (T peaked)</option>
            <option value="pr">PR alargado / P applanada</option>
            <option value="qrs">QRS alargado</option>
            <option value="sine">Padrão sinusoidal — EMERGÊNCIA</option>
          </select>
        </div>
      </div>
      {proto && (
        <div style={{ background: 'var(--bg-2)', border: `2px solid ${proto.color}`, borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: proto.color, marginBottom: 12 }}>{proto.label}</div>
          {proto.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
              <span style={{ color: proto.color, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'k', label: 'K⁺ Hipocaliemia', color: '#d97706', component: PotassiumCalc },
  { id: 'hk', label: 'K⁺ Hipercaliemia', color: '#dc2626', component: HyperkalemiaCalc },
  { id: 'na', label: 'Na⁺', color: '#2563eb', component: SodiumCalc },
  { id: 'mg', label: 'Mg²⁺', color: '#059669', component: MagnesiumCalc },
  { id: 'ph', label: 'Fosfato', color: '#7c3aed', component: PhosphateCalc },
  { id: 'ca', label: 'Ca²⁺', color: '#0891b2', component: CalciumCalc },
]

export default function ElectrolytesPage() {
  const [tab, setTab] = useState('k')
  const Active = TABS.find(t => t.id === tab)?.component || PotassiumCalc
  const activeTab = TABS.find(t => t.id === tab)!

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Protocolos Clínicos</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 6 }}>Reposição de Electrólitos</div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)', marginBottom: 16, maxWidth: 560 }}>
            Protocolos baseados em evidência para correcção de distúrbios hidroelectrolíticos. Com doses calculadas e monitorização.
          </div>
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? t.color : 'var(--ink-4)', borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent', marginBottom: -2, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 680 }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: activeTab.color }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{activeTab.label}</span>
          </div>
          <Active />
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
          Baseado em: KDIGO 2012, NICE CG127, UpToDate Electrolyte Disorders, European Journal of Internal Medicine 2020.
          Confirmar sempre com laboratório antes de cada reposição. Uso por profissionais de saúde.
        </div>
      </div>
    </div>
  )
}
