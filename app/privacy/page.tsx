import { Metadata } from 'next'
import Link from 'next/link'
import { CONTROLLER, SUPERVISORY_AUTHORITY, SUBPROCESSORS, LEGAL_UPDATED } from '@/lib/legal'
import { PRAZOS, DECISOES_AUTOMATIZADAS } from '@/lib/rgpd'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Como a Phlox Clinical recolhe, usa e protege os seus dados pessoais. Conformidade com o RGPD.',
}

const SECTIONS: { title: string; content: string }[] = [
  {
    title: 'Quem é o responsável pelo tratamento — e quando não somos nós',
    content: `Há duas situações, e a diferença entre elas é a coisa mais importante desta página.\n\nNuma CONTA PESSOAL, é a própria pessoa que regista os seus dados e somos nós que decidimos as finalidades do serviço: a ${CONTROLLER.legalEntity} é a responsável pelo tratamento.\n\nNuma INSTITUIÇÃO — um lar, um centro de dia, um serviço de apoio domiciliário — quem decide que dados dos utentes se tratam e para quê é a instituição. Por definição do artigo 4.º/7 do RGPD, é ela a responsável pelo tratamento, e o Phlox é subcontratante (artigo 4.º/8), tratando esses dados por conta dela e apenas segundo as suas instruções documentadas. A relação rege-se pelo artigo 28.º.\n\nNa prática isto quer dizer que, se é utente de uma instituição ou familiar de um utente, os seus pedidos de acesso, retificação ou apagamento devem ser dirigidos a ESSA instituição — não a nós. Se nos chegarem, encaminhamo-los para ela e avisamo-lo.\n\nPara questões de proteção de dados sobre a plataforma, contacte ${CONTROLLER.privacyEmail}.`,
  },
  {
    title: 'Que dados recolhemos',
    content: 'Dados de conta: nome, email e foto de perfil (se iniciar sessão com Google) ou apenas email (se usar email e palavra-passe). Dados de utilização: que ferramentas usa, para lhe prestar o serviço e melhorar a plataforma. Dados de saúde que você ou a sua equipa registam: por exemplo, medicação, sinais vitais, sintomas, notas de cuidados. Estes são "categorias especiais" de dados (art. 9.º do RGPD) e merecem proteção reforçada.',
  },
  {
    title: 'Com que finalidade e com que base legal',
    content: 'Usamos os dados para lhe prestar o serviço (execução do contrato, artigo 6.º/1-b) e para cumprir obrigações legais (artigo 6.º/1-c).\n\nOs dados de saúde registados numa instituição são tratados ao abrigo do artigo 9.º/2-h — tratamento necessário para efeitos de prestação de cuidados de saúde ou de ação social — e não com base em consentimento. A razão é concreta: o consentimento tem de ser livre e tem de poder ser retirado a qualquer momento, e nenhuma das duas coisas é verdadeira aqui. Uma pessoa que vive num lar não escolhe livremente se os seus cuidados são registados, e a instituição não pode deixar de os registar mesmo que lhe peçam — a Portaria n.º 67/2012 obriga-a a manter processo individual, registo de medicação e registo de ocorrências. Apresentar isto como consentimento seria oferecer um direito que não existe.\n\nNuma conta pessoal, os dados de saúde que regista sobre si são tratados com o seu consentimento explícito (artigo 9.º/2-a), que pode retirar a qualquer momento apagando-os ou apagando a conta.\n\nO consentimento continua a ser pedido onde é mesmo livre: fotografias, partilha voluntária de informação com familiares, e comunicações que não são necessárias ao serviço. Nesses casos pode recusar sem perder nada.',
  },
  {
    title: 'Inteligência artificial',
    content: 'Algumas funcionalidades usam modelos de IA de fornecedores externos para gerar texto de apoio (por exemplo, explicar uma bula ou organizar informação). Esses fornecedores tratam apenas o necessário para devolver a resposta e, nos planos de API que usamos, não retêm os dados para treinar os seus modelos. A IA do Phlox organiza e apoia — não toma decisões clínicas. Veja o nosso enquadramento em /dispositivo-medico.',
  },
  {
    title: 'Quem trata os dados por nós (subprocessadores)',
    content: `Não vendemos dados pessoais. Recorremos a fornecedores que tratam dados em nosso nome, sob contratos conformes com o RGPD: ${SUBPROCESSORS.map(s => s.name).join(', ')}. A lista completa, com finalidades e localizações, está em /subprocessadores.`,
  },
  {
    title: 'Transferências internacionais',
    content: 'Alguns fornecedores estão sediados fora do Espaço Económico Europeu (por exemplo, nos EUA). Nesses casos, as transferências são protegidas por Cláusulas Contratuais-Tipo aprovadas pela Comissão Europeia e/ou pelo Data Privacy Framework, conforme indicado na página de subprocessadores.',
  },
  {
    title: 'Os seus direitos (RGPD)',
    content: `Tem direito de acesso (artigo 15.º), retificação (16.º), apagamento (17.º), limitação (18.º), portabilidade (20.º) e oposição (21.º), e de retirar o consentimento onde foi o consentimento que serviu de base.\n\nNem todos são absolutos: o direito ao apagamento não se aplica quando a conservação é necessária para cumprir uma obrigação legal (artigo 17.º/3-b) — é o caso do processo individual de um utente de lar. Nesse caso dizemos-lho e explicamos qual é a obrigação, em vez de simplesmente recusar.\n\nSe é utente de uma instituição ou familiar, dirija o pedido à instituição: é ela a responsável pelo tratamento. Para a plataforma, escreva para ${CONTROLLER.privacyEmail}. Respondemos no prazo de um mês, prorrogável por mais dois quando o pedido for complexo, caso em que o avisamos dentro do primeiro mês (artigo 12.º/3).\n\nTem também o direito de apresentar reclamação à autoridade de controlo: ${SUPERVISORY_AUTHORITY.name} (${SUPERVISORY_AUTHORITY.url}).`,
  },
  {
    title: 'Durante quanto tempo guardamos',
    content: 'O princípio é o do artigo 5.º/1-e: guarda-se o tempo necessário, nem mais nem menos. «Para sempre» viola-o tanto quanto apagar cedo de mais.\n\n'
      + PRAZOS.map(pr => `· ${pr.oQue}: ${pr.quanto}${pr.desde !== '—' ? `, a contar ${pr.desde}` : ''}. ${pr.fundamento}`).join('\n')
      + '\n\nOnde a lei fixa o prazo, seguimo-lo. Onde não fixa, o prazo acima é uma escolha fundamentada e não uma imposição legal — e a instituição pode definir outro, por escrito, no seu próprio registo de atividades de tratamento.\n\nNuma instituição, apagar uma conta do Phlox não apaga o processo individual de um utente: esse é da casa, e a casa é obrigada a conservá-lo.',
  },
  {
    title: 'Segurança',
    content: 'Os dados são cifrados em trânsito e em repouso. Não armazenamos palavras-passe em texto simples (usamos autenticação segura). O acesso aos dados é restrito ao nível da base de dados por Row Level Security, e a partilha em equipa é limitada à organização a que pertence.',
  },
  {
    title: 'Menores',
    content: 'A plataforma destina-se a maiores de 16 anos. Não recolhemos intencionalmente dados de menores sem o consentimento de quem exerce as responsabilidades parentais. Se tomarmos conhecimento de tal, apagamos os dados.',
  },
  {
    title: 'Cookies',
    content: 'Não há publicidade no Phlox, em plano nenhum, e não pomos cookies de publicidade nem de análise de terceiros. Depois de iniciar sessão, guardamos no seu navegador duas entradas estritamente necessárias para o manter com sessão iniciada. Os pormenores estão em /cookies.',
  },
  {
    title: 'Decisões automatizadas e definição de perfis',
    content: DECISOES_AUTOMATIZADAS.frase,
  },
  {
    title: 'Violações de dados',
    content: 'Se houver uma quebra de segurança que ponha em risco os seus dados, agimos em três frentes. Numa instituição, avisamos a instituição sem demora injustificada, porque é ela que tem o dever de notificar a CNPD nas 72 horas seguintes (artigos 33.º/1 e 33.º/2). Numa conta pessoal, notificamos nós a CNPD dentro das mesmas 72 horas. E quando a violação for suscetível de implicar um risco elevado para os seus direitos e liberdades, comunicamo-la também a si, diretamente e em linguagem clara (artigo 34.º).',
  },
  {
    title: 'Alterações e contacto',
    content: `Podemos atualizar esta política; a data de "última atualização" reflete a versão em vigor. Para qualquer questão sobre privacidade, contacte ${CONTROLLER.privacyEmail}.`,
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 14 }}>
          Política de Privacidade
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--ink)', marginBottom: 8, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Privacidade e dados
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
          Última atualização: {LEGAL_UPDATED}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 34 }}>
          {[['/cookies', 'Cookies'], ['/subprocessadores', 'Subprocessadores'], ['/terms', 'Termos'], ['/dispositivo-medico', 'Dispositivo médico']].map(([h, l]) => (
            <Link key={h} href={h} style={{ fontSize: 12.5, color: 'var(--green-2)', fontWeight: 600, textDecoration: 'none' }}>{l} →</Link>
          ))}
        </div>
        {SECTIONS.map(({ title, content }, i) => (
          <div key={title} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < SECTIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em' }}>
              {title}
            </h2>
            {/* `pre-wrap`: as secções passaram a ter parágrafos e listas, e sem
                isto saíam todas num bloco único de texto corrido — que numa
                política de privacidade é a diferença entre poder ser lida e
                só poder ser alegada. */}
            <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
