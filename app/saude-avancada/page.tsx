'use client'

// /saude-avancada — hub para as ferramentas Pro de saúde mais especializadas.
// Antes eram 6 entradas soltas na categoria "Saúde" do Explorar, ao lado de
// coisas do dia-a-dia (marcar sintomas, ver análises) — a lista ficava
// avassaladora e sem hierarquia. Aqui não se reescreve nenhuma dessas
// ferramentas: cada link abre a página real, sem alterações. Isto é só a
// porta de entrada, para tirar 5 itens de cima do Explorar principal.

import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import Icon from '@/components/Icon'
import { modeTheme } from '@/lib/modeTheme'

const TOOLS = [
  { href: '/minha-condicao', icon: 'heart', label: 'Painel da minha condição', desc: 'Medicação, vitais, sintomas e risco à volta da tua doença crónica' },
  { href: '/revisao-medicacao', icon: 'search', label: 'Revisão da minha medicação', desc: 'O motor de regras clínicas explicado em linguagem simples' },
  { href: '/plano-peso', icon: 'scale', label: 'Plano de perda de peso', desc: 'Dieta e exercício contextualizados à tua medicação' },
  { href: '/rastreio-visual', icon: 'camera', label: 'Rastreio visual', desc: 'Risco dermatológico ABCDE por IA de visão' },
  { href: '/vigia-ruturas', icon: 'package', label: 'Vigia de ruturas', desc: 'Cruza a tua medicação com a lista oficial do INFARMED' },
  { href: '/plano-recuperacao', icon: 'target', label: 'Plano de recuperação', desc: 'Marcos realistas para o teu evento de saúde' },
  { href: '/exportar-saude', icon: 'download', label: 'Exportar o meu registo de saúde', desc: 'Medicação, vitais, sintomas e análises num PDF para o médico' },
]

export default function SaudeAvancadaPage() {
  const { user } = useAuth() as any
  const t = modeTheme(user?.experience_mode || 'personal')

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, fontFamily: 'var(--font-sans)', color: t.ink }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '30px 18px 48px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: t.accent, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>Pro</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 'clamp(26px,5.5vw,32px)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>Saúde avançada</h1>
        <p style={{ fontSize: 14.5, color: t.inkSoft, lineHeight: 1.55, margin: '0 0 28px', maxWidth: '54ch' }}>
          Ferramentas mais especializadas, para quem quer ir mais fundo do que o dia a dia — cada uma junta
          os teus dados reais (medicação, vitais, sintomas) para dar uma resposta mais específica.
        </p>

        <div>
          {TOOLS.map((tool, i) => (
            <Link key={tool.href} href={tool.href} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', textDecoration: 'none',
              borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
            }}>
              <span style={{ width: 36, height: 36, borderRadius: '50%', background: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={tool.icon} size={18} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: t.ink }}>{tool.label}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: t.inkFaint, marginTop: 1 }}>{tool.desc}</span>
              </span>
              <Icon name="chevron" size={16} color={t.inkFaint} style={{ flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
