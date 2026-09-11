// scripts/gerar-chaves-vapid.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Gera o par de chaves VAPID das notificações e diz onde pôr cada uma.
//
//   node scripts/gerar-chaves-vapid.mjs
//
// ATENÇÃO: trocar as chaves invalida TODAS as subscrições existentes. Quem já
// tinha notificações ativas tem de as reativar no dispositivo. Só se gera um
// par novo quando não há nenhum, ou quando o antigo se perdeu.
// ─────────────────────────────────────────────────────────────────────────────
import webpush from 'web-push'

const { publicKey, privateKey } = webpush.generateVAPIDKeys()

const linha = '─'.repeat(72)
console.log(`\n${linha}\nPar de chaves VAPID novo\n${linha}\n`)
console.log('Põe estas TRÊS variáveis na Vercel (Settings → Environment Variables),')
console.log('em Production, Preview e Development:\n')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log(`VAPID_EMAIL=suporte@phloxclinical.com`)
console.log(`
As duas primeiras são a MESMA chave, de propósito: a pública precisa do prefixo
NEXT_PUBLIC_ para o browser a poder ler, e sem prefixo para o servidor assinar.
Se forem diferentes, o serviço de push responde 403 e nada chega.

Depois de guardar: é preciso um deploy novo. Variáveis de ambiente só entram em
funções publicadas depois disso.

Para confirmar que ficou tudo certo: /settings → Notificações → "Testar agora".
${linha}
`)
