import type { Locale } from "./i18n";

/**
 * Static, typed i18n dictionary — the same pattern as the explorador
 * web-public app (in-file object, not JSON, not async). Server components read
 * `getDictionary(lang)` and pass `dict` down as a prop. Copy that isn't here is
 * inlined per-component with `lang === "en" ? … : …` ternaries.
 */
export type Dictionary = {
  nav: { how: string; bridge: string; loans: string; treasury: string; dashboard: string; connect: string };
  hero: {
    kicker: string;
    title1: string;
    title2: string;
    lead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    stat1: string;
    stat1Label: string;
    stat2: string;
    stat2Label: string;
    stat3: string;
    stat3Label: string;
  };
  problem: { kicker: string; title: string; body: string };
  how: {
    kicker: string;
    title: string;
    steps: { title: string; body: string }[];
  };
  trust: { kicker: string; title: string; items: { title: string; body: string }[] };
  cta: { title: string; body: string; button: string };
  footer: { tagline: string; built: string; rights: string };
};

const pt: Dictionary = {
  nav: { how: "Como funciona", bridge: "Pedir empréstimo", loans: "Empréstimos", treasury: "Tesouraria", dashboard: "Painel", connect: "Entrar" },
  hero: {
    kicker: "Um empréstimo contra o seu imóvel",
    title1: "Compre a nova casa",
    title2: "antes de vender a atual",
    lead: "Faltam-lhe fundos para o CPCV da casa nova enquanto a sua ainda não vendeu? Colateralize o imóvel que está a vender e levante liquidez em minutos — sem banco, sem espera.",
    ctaPrimary: "Iniciar o empréstimo",
    ctaSecondary: "Ver como funciona",
    stat1: "24h",
    stat1Label: "até à liquidez",
    stat2: "0",
    stat2Label: "burocracia bancária",
    stat3: "100%",
    stat3Label: "auditável on-chain",
  },
  problem: {
    kicker: "O problema",
    title: "O capital fica preso na casa que ainda não vendeu",
    body: "Em Portugal, para assinar o CPCV da casa nova é preciso o sinal — muitas vezes 10 a 20% — imediatamente. Mas o seu dinheiro está imobilizado no imóvel que está a vender. Os empréstimos da banca são lentos, cheios de papelada e nem sempre aprovados a tempo.",
  },
  how: {
    kicker: "Como funciona",
    title: "Do documento à liquidez, em seis passos",
    steps: [
      { title: "1 · Entrar", body: "Entre com email ou conta social — a Privy cria uma carteira Sui não-custodial, sem extensão." },
      { title: "2 · Documentos + IA", body: "Carregue a caderneta predial e o documento de identificação. A IA extrai o artigo matricial, o VPT, a morada e o proprietário." },
      { title: "3 · Elegibilidade World ID", body: "O Identity Check atesta 18+ e documento emitido em Portugal; o KYC prova que está presente. Pedimos predicados, não dados — nome e número do documento nunca chegam à aplicação." },
      { title: "4 · Tokenizar", body: "O imóvel é emitido como moedas de capital HOUSE na Sui (pacote Move), com fornecimento indexado ao VPT." },
      { title: "5 · Colateralizar", body: "Bloqueie uma fração dos tokens como garantia. Um agente de IA valida a garantia, a elegibilidade World ID e a ausência de outro crédito ativo do mesmo humano." },
      { title: "6 · Levantar", body: "O agente de tesouraria transfere USDC autonomamente. Levante os fundos para o sinal da casa nova." },
    ],
  },
  trust: {
    kicker: "Porquê confiar",
    title: "Transparência criptográfica em cada passo",
    items: [
      { title: "Documentos cifrados", body: "A caderneta e o KYC são cifrados com Seal e guardados na Walrus — só você controla o acesso." },
      { title: "Registo imutável", body: "O hash de cada documento é ancorado on-chain na Sui — um rasto de auditoria inviolável." },
      { title: "Pagamento agêntico", body: "A tesouraria só liberta fundos através de um agente que verifica garantia e humano-real via World ID." },
    ],
  },
  cta: {
    title: "Pronto para desbloquear o valor da sua casa?",
    body: "Comece o empréstimo agora. Sem compromisso até confirmar os valores extraídos pela IA.",
    button: "Iniciar o empréstimo",
  },
  footer: {
    tagline: "Empréstimos imobiliários, colateralizados e auditáveis on-chain.",
    built: "Construído na ETHGlobal Lisboa 2026 · Sui · Walrus · World App",
    rights: "Todos os direitos reservados.",
  },
};

const en: Dictionary = {
  nav: { how: "How it works", bridge: "Get a loan", loans: "Loans", treasury: "Treasury", dashboard: "Dashboard", connect: "Sign in" },
  hero: {
    kicker: "A loan against your home equity",
    title1: "Buy the new home",
    title2: "before you sell the old one",
    lead: "Short on funds for the new house's CPCV while yours hasn't sold yet? Collateralize the home you're selling and draw liquidity in minutes — no bank, no waiting.",
    ctaPrimary: "Start the loan",
    ctaSecondary: "See how it works",
    stat1: "24h",
    stat1Label: "to liquidity",
    stat2: "0",
    stat2Label: "bank paperwork",
    stat3: "100%",
    stat3Label: "auditable on-chain",
  },
  problem: {
    kicker: "The problem",
    title: "Your capital is locked in the home you haven't sold",
    body: "In Portugal, signing the new home's CPCV means paying the signal — often 10 to 20% — right away. But your money is tied up in the property you're selling. Bank loans are slow, paperwork-heavy, and not always approved in time.",
  },
  how: {
    kicker: "How it works",
    title: "From document to liquidity, in six steps",
    steps: [
      { title: "1 · Sign in", body: "Sign in with email or a social account — Privy provisions a non-custodial Sui wallet, no extension." },
      { title: "2 · Documents + AI", body: "Upload the caderneta predial and your ID. AI extracts the tax article, VPT value, address and owner." },
      { title: "3 · World ID eligibility", body: "Identity Check attests 18+ and a Portugal-issued document; KYC proves you're present. We request predicates, not data — your name and document number never reach the app." },
      { title: "4 · Tokenize", body: "The property is issued as HOUSE equity coins on Sui (a Move package), supply pegged to its VPT value." },
      { title: "5 · Collateralize", body: "Lock a fraction of the tokens as collateral. An AI agent verifies the collateral, World ID eligibility, and that this human has no other active loan." },
      { title: "6 · Withdraw", body: "The treasury agent transfers USDC autonomously. Withdraw the funds for the new home's signal." },
    ],
  },
  trust: {
    kicker: "Why trust it",
    title: "Cryptographic transparency at every step",
    items: [
      { title: "Encrypted documents", body: "The caderneta and KYC are encrypted with Seal and stored on Walrus — only you control access." },
      { title: "Immutable record", body: "Every document's hash is anchored on-chain on Sui — a tamper-proof audit trail." },
      { title: "Agentic payment", body: "The treasury only releases funds through an agent that verifies collateral and a real human via World ID." },
    ],
  },
  cta: {
    title: "Ready to unlock your home's value?",
    body: "Start the loan now. No commitment until you confirm the values extracted by AI.",
    button: "Start the loan",
  },
  footer: {
    tagline: "Real-estate loans, collateralized and auditable on-chain.",
    built: "Built at ETHGlobal Lisbon 2026 · Sui · Walrus · World App",
    rights: "All rights reserved.",
  },
};

const DICTS: Record<Locale, Dictionary> = { pt, en };

export function getDictionary(locale: Locale): Dictionary {
  return DICTS[locale] ?? pt;
}
