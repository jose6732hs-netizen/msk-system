/*! MSK SYSTEM • CÓDIGO PROPRIETÁRIO, ÚNICO E RESTRITO • LICENÇA E INTEGRIDADE VALIDADAS NO SERVIDOR • ALTERAÇÃO NÃO AUTORIZADA BLOQUEIA O USO. */
'use strict';
const _0x8f1 = 'https://msksystem.online/api/extension/license-identity';
const _0x8f2 = 5000;
const _0x8fA = 'https://iybjfmhqbblrppqoodyf.supabase.co/functions/v1/msk-agent';
const _0x8f4 = 'sb_publishable_-aERipV8XmdiDq9UMERZUA_OIyOeyzD';
const _0x8f5 = 'msk-studio-3.4.6-backend-active-ai';
const _0x8f6 = 'MSK System • Projeto proprietário, único e restrito. Uso, cópia, clonagem ou alteração não autorizada é proibida.';
const store = chrome.storage.local;
const SVG_ICONS = {
  wrench: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  compass: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  sparkles: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  code: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  maximize: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`,
  glass: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  header: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>`,
  footer: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="15" x2="21" y2="15"/></svg>`,
  modal: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3"/><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`,
  zap: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 0 1 4 4v4a8 8 0 0 1-16 0v-2"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  creditCard: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  star: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  help: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  cookie: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="9" r="1"/><circle cx="15" cy="8" r="1"/><circle cx="10" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`
};
const PROMPT_LIBRARY = [
  { id: 'fix-build', cat: 'fix', iconKey: 'wrench', bg: 'linear-gradient(135deg, #EF4444, #F97316)', title: 'Auto-Fix Build Lovable', desc: 'Analisa o projeto, resolve erros de TypeScript e corrige imports quebrados.', prompt: 'Analise todos os componentes React do projeto, corrija erros de TypeScript, resolva importações quebradas e garanta que todos os exports estejam corretos para o preview do Lovable compilar 100%.' },
  { id: 'fix-routes', cat: 'fix', iconKey: 'compass', bg: 'linear-gradient(135deg, #3B82F6, #6366F1)', title: 'Resolver Rotas TanStack', desc: 'Corrige conflitos de rotas e caminhos relativos na navegação.', prompt: 'Verifique todas as rotas do TanStack Router, corrija conflitos de caminhos e garanta que a navegação entre todas as páginas funcione perfeitamente sem recarregar a tela.' },
  { id: 'fix-imports', cat: 'fix', iconKey: 'code', bg: 'linear-gradient(135deg, #10B981, #059669)', title: 'Limpar Imports & Código Morto', desc: 'Remove dependências e imports não utilizados.', prompt: 'Remova imports não utilizados, corrija referências a pacotes inexistentes e organize a estrutura dos componentes limpando código desnecessário.' },
  { id: 'fix-types', cat: 'fix', iconKey: 'tag', bg: 'linear-gradient(135deg, #8B5CF6, #EC4899)', title: 'Tipagem TypeScript Estrita', desc: 'Adiciona interfaces e tipos TypeScript em todos os componentes.', prompt: 'Adicione interfaces e tipos TypeScript estritos em todos os props, hooks e estados dos componentes para eliminar avisos e erros de tipagem no build.' },
  { id: 'fix-overflow', cat: 'fix', iconKey: 'maximize', bg: 'linear-gradient(135deg, #F59E0B, #EF4444)', title: 'Reparar Scroll / Overflow Quebrado', desc: 'Remove larguras fixas que quebram o layout mobile.', prompt: 'Identifique e corrija elementos com largura fixa que estão causando scroll horizontal indesejado ou quebrando o layout em dispositivos móveis.' },
  { id: 'ui-glass', cat: 'ui', iconKey: 'glass', bg: 'linear-gradient(135deg, #00D2FF, #7C3AED)', title: 'Tema Glassmorphism Cyber', desc: 'Aplica visual de vidro fosco e degradês refinados.', prompt: 'Aplique um design ultra moderno com efeitos de vidro fosco (glassmorphism), bordas com brilho neon sutil e gradientes refinados em todos os cards e modais.' },
  { id: 'ui-anims', cat: 'ui', iconKey: 'sparkles', bg: 'linear-gradient(135deg, #FF007A, #7C3AED)', title: 'Micro-Interações & Hover Effects', desc: 'Insere transições fluidas e micro-animações em botões.', prompt: 'Adicione micro-animações suaves em todos os botões, cards e links interativos usando Tailwind CSS e transições fluidas com escala e elevação.' },
  { id: 'ui-darkmode', cat: 'ui', iconKey: 'moon', bg: 'linear-gradient(135deg, #1E1B4B, #4338CA)', title: 'Dark / Light Mode Completo', desc: 'Alternância de tema escuro/claro com LocalStorage.', prompt: 'Implemente suporte completo a tema escuro (Dark Mode) e claro com persistência no LocalStorage, transição suave de 300ms e botão de alternância no cabeçalho.' },
  { id: 'ui-header', cat: 'ui', iconKey: 'header', bg: 'linear-gradient(135deg, #06B6D4, #3B82F6)', title: 'Header Sticky Glass com CTA', desc: 'Cabeçalho fixo com desfoque e botão de destaque.', prompt: 'Crie um cabeçalho moderno fixo no topo com efeito de desfoque de fundo (backdrop-blur), logo, links de navegação com indicador ativo e botão de CTA destacado.' },
  { id: 'ui-footer', cat: 'ui', iconKey: 'footer', bg: 'linear-gradient(135deg, #4B5563, #1F2937)', title: 'Rodapé Completo com Redes Sociais', desc: 'Rodapé com copyright, links e newsletter.', prompt: 'Crie um rodapé moderno completo com copyright, links de navegação, selos de segurança, formulário de newsletter e ícones de redes sociais.' },
  { id: 'ui-modal', cat: 'ui', iconKey: 'modal', bg: 'linear-gradient(135deg, #8B5CF6, #D946EF)', title: 'Modal Pop-up com Animação Fluida', desc: 'Modal com backdrop blur e botão acessível.', prompt: 'Crie um componente de modal reutilizável com animação suave de fade-in e scale, backdrop com desfoque e botão de fechar acessível.' },
  { id: 'ui-skeleton', cat: 'ui', iconKey: 'zap', bg: 'linear-gradient(135deg, #F59E0B, #D97706)', title: 'Skeleton Loading (Efeito Shimmer)', desc: 'Placeholders animados com efeito shimmer.', prompt: 'Substitua estados de carregamento em branco por placeholders esqueleto (skeleton screens) animados com efeito shimmer gradiente.' },
  { id: 'mob-bottomnav', cat: 'mobile', iconKey: 'phone', bg: 'linear-gradient(135deg, #10B981, #06B6D4)', title: 'Bottom Nav Bar (Estilo App Nativo)', desc: 'Barra inferior estilo iOS/Android com ícones.', prompt: 'Crie uma barra de navegação inferior estilo aplicativo mobile nativo (Bottom Navigation Bar) com ícones modernos e feedback tátil visual.' },
  { id: 'mob-drawer', cat: 'mobile', iconKey: 'menu', bg: 'linear-gradient(135deg, #6366F1, #8B5CF6)', title: 'Menu Lateral Deslizante (Drawer)', desc: 'Menu gaveta com animação suave para mobile.', prompt: 'Adicione um menu lateral deslizante (Drawer) moderno com overlay escuro, animação suave e links de navegação para telas menores.' },
  { id: 'mob-touch', cat: 'mobile', iconKey: 'hand', bg: 'linear-gradient(135deg, #EC4899, #F43F5E)', title: 'Touch Gestures & Swipe Cards', desc: 'Suporte a deslizar (swipe) entre cards em celulares.', prompt: 'Adicione suporte a gestos de toque (swipe) para alternar entre cards, carrosséis ou abas em smartphones.' },
  { id: 'auth-login', cat: 'auth', iconKey: 'shield', bg: 'linear-gradient(135deg, #7C3AED, #3B82F6)', title: 'Tela de Login Glassmorphic', desc: 'Login moderno com validação de campos.', prompt: 'Crie uma tela de Login moderna e responsiva com campos de e-mail e senha, botão de exibir/ocultar senha, validação visual e design glassmorphic premium.' },
  { id: 'auth-register', cat: 'auth', iconKey: 'user', bg: 'linear-gradient(135deg, #10B981, #3B82F6)', title: 'Tela de Cadastro com Validador', desc: 'Registro com medidor de força de senha.', prompt: 'Crie uma página de registro completa com validação de força de senha em tempo real, confirmação de senha e checkbox de termos de serviço.' },
  { id: 'auth-contact', cat: 'auth', iconKey: 'mail', bg: 'linear-gradient(135deg, #06B6D4, #10B981)', title: 'Formulário de Contato com Feedback', desc: 'Formulário profissional com validação e toast.', prompt: 'Adicione um formulário de contato profissional com validação de campos obrigatórios, máscara de telefone e toast de confirmação de envio.' },
  { id: 'shop-card', cat: 'shop', iconKey: 'tag', bg: 'linear-gradient(135deg, #F59E0B, #EC4899)', title: 'Card de Produto com Efeito 3D Hover', desc: 'Card premium com badges e botão de compra.', prompt: 'Crie um card de produto premium com imagem em destaque, badges de desconto, seletor de quantidade, preço parcelado e botão de compra rápida.' },
  { id: 'shop-cart', cat: 'shop', iconKey: 'cart', bg: 'linear-gradient(135deg, #10B981, #059669)', title: 'Carrinho Lateral Deslizante (Slide-Over)', desc: 'Gaveta de carrinho com cálculo de frete.', prompt: 'Implemente um carrinho de compras lateral moderno com lista de itens, ajuste de quantidade em tempo real, cálculo de frete e botão de checkout.' },
  { id: 'shop-pricing', cat: 'shop', iconKey: 'creditCard', bg: 'linear-gradient(135deg, #8B5CF6, #3B82F6)', title: 'Tabela de Preços Comparativa (Pricing)', desc: 'Planos Mensal/Anual com lista de benefícios.', prompt: 'Crie uma tabela de preços moderna com planos (Mensal/Anual), badge de "Mais Popular" em destaque, lista de benefícios com checkmarks e botões de assinar.' },
  { id: 'shop-testimonials', cat: 'shop', iconKey: 'star', bg: 'linear-gradient(135deg, #F59E0B, #F97316)', title: 'Depoimentos com Estrelas de Avaliação', desc: 'Carrossel de depoimentos com fotos e estrelas.', prompt: 'Adicione uma seção de depoimentos de clientes com carrossel moderno, fotos de perfil, estrelas de avaliação e cards em vidro.' },
  { id: 'shop-faq', cat: 'shop', iconKey: 'help', bg: 'linear-gradient(135deg, #6366F1, #4F46E5)', title: 'Seção de FAQ (Acordeão Animado)', desc: 'Acordeão moderno de perguntas frequentes.', prompt: 'Crie uma seção de FAQ moderna com acordeão animado, busca rápida de dúvidas e ícones de expansão suave.' },
  { id: 'perf-toast', cat: 'perf', iconKey: 'bell', bg: 'linear-gradient(135deg, #EC4899, #8B5CF6)', title: 'Sistema de Notificações Toast', desc: 'Avisos visuais flutuantes com auto-dismiss.', prompt: 'Adicione um componente de notificações Toast para exibir mensagens de sucesso e erro ao usuário com animação suave e auto-dismiss.' },
  { id: 'perf-seo', cat: 'perf', iconKey: 'globe', bg: 'linear-gradient(135deg, #06B6D4, #3B82F6)', title: 'SEO & Meta Tags Open Graph', desc: 'Tags para compartilhamento em redes sociais.', prompt: 'Adicione tags Open Graph (OG), Twitter Card, favicon dinâmico e meta descriptions otimizadas para redes sociais no index.html.' },
  { id: 'perf-countdown', cat: 'perf', iconKey: 'clock', bg: 'linear-gradient(135deg, #F59E0B, #EF4444)', title: 'Contador Regressivo de Oferta', desc: 'Timer animado para ofertas por tempo limitado.', prompt: 'Adicione um contador regressivo moderno com dias, horas, minutos e segundos animados para ofertas por tempo limitado.' },
  { id: 'perf-search', cat: 'perf', iconKey: 'search', bg: 'linear-gradient(135deg, #3B82F6, #6366F1)', title: 'Busca em Tempo Real com Filtro', desc: 'Barra de pesquisa instantânea por texto.', prompt: 'Adicione uma barra de pesquisa com filtro instantâneo por texto e categorias para filtrar itens da lista em tempo real.' },
  { id: 'perf-cookies', cat: 'perf', iconKey: 'cookie', bg: 'linear-gradient(135deg, #8B5CF6, #EC4899)', title: 'Banner de Cookies & LGPD', desc: 'Consentimento de cookies com preferências.', prompt: 'Crie um banner discreto e moderno de consentimento de cookies (LGPD) com botões de aceitar e preferências.' },
  { id: 'perf-whatsapp-float', cat: 'perf', iconKey: 'chat', bg: 'linear-gradient(135deg, #25D366, #128C7E)', title: 'Botão Flutuante de WhatsApp Oficial', desc: 'Botão no canto inferior com tooltip pulsante.', prompt: 'Adicione um botão flutuante oficial do WhatsApp no canto inferior com tooltip pulsante e mensagem pré-configurada para o número +55 11 94321-3342.' }
];
const state = {
  config: null,
  license: null,
  aiRouting: 'msk-auto',
  aiCatalog: [],
  aiModelByProvider: {},
  agentContext: { projectId: '', session: '', pageUrl: '', repository: '' },
  agentHistory: [],
  stats: { commits: 0, files: 0 },
  theme: 'light',
  attachedFiles: [],
  isLoading: false,
  abortCtrl: null,
  activeCategory: 'all',
  searchQuery: ''
};
const $ = (id) => document.getElementById(id);
const headerStatusPill = $('header-status-pill');
const headerStatusText = $('header-status-text');
const themeToggleBtn  = $('theme-toggle-btn');
const themeIconSun    = $('theme-icon-sun');
const themeIconMoon   = $('theme-icon-moon');
const settingsPanel   = $('settings-panel');
const historyPanel    = $('history-panel');
const statsPanel      = $('stats-panel');
const libraryPanel    = $('prompts-library-panel');
const messagesArea    = $('messages-area');
const welcomeMsg      = $('welcome-message');
const messageInput    = $('message-input');
const sendBtn         = $('send-btn');
const stopBtn         = $('stop-btn');
const attachBtn       = $('attach-btn');
const fileInput       = $('file-input');
const filePreviewArea = $('file-preview-area');
const filePreviewList = $('file-preview-list');
const statusBar       = $('status-bar');
const statusMsg       = $('status-message');
const settingsBtn     = $('settings-btn');
const historyBtn      = $('history-btn');
const statsBtn        = $('stats-btn');
const libraryHeaderBtn= $('library-header-btn');
const presetChipsBar  = $('preset-chips-bar');
const popupAiProviderSelect = $('popup-ai-provider-select');
const popupAiModelSelect = $('popup-ai-model-select');
const popupAiActiveBadge = $('popup-ai-active-badge');
const licenseGate = $('license-gate');
const licenseEmailInput = $('license-email');
const licenseKeyInput = $('license-input');
const licenseActivateBtn = $('license-activate');
const licenseStatus = $('license-status');
const openStudioHeaderBtn = $('open-studio-header-btn');
const welcomeOpenStudioBtn = $('welcome-open-studio-btn');
const floatingBubbleTrigger = $('floating-bubble-widget');
const floatingBubbleMenu    = $('floating-bubble-menu');
const floatingMenuClose     = $('floating-menu-close');
const openLibraryBtn        = $('open-library-btn');
const libraryCloseBtn       = $('library-close');
const searchInput           = $('library-search-input');
const searchClearBtn        = $('library-search-clear');
const cardsContainer        = $('library-cards-container');
const wizardView            = $('wizard-builder-view');
async function openMskStudio() {
  const ok = await ensureActiveLicense({ network: true, quiet: false });
  if (!ok) return;
  const studioUrl = chrome.runtime.getURL('studio.html');
  chrome.tabs.create({ url: studioUrl });
  toast('✓ MSK Studio aberto em Tela Cheia!', 'success', 2500);
}
openStudioHeaderBtn?.addEventListener('click', openMskStudio);
welcomeOpenStudioBtn?.addEventListener('click', openMskStudio);
floatingBubbleTrigger?.addEventListener('click', () => {
  floatingBubbleMenu?.classList.toggle('hidden');
});
floatingMenuClose?.addEventListener('click', (e) => {
  e.stopPropagation();
  floatingBubbleMenu?.classList.add('hidden');
});
openLibraryBtn?.addEventListener('click', () => {
  floatingBubbleMenu?.classList.add('hidden');
  togglePanel(libraryPanel, libraryHeaderBtn);
  renderLibraryCards();
});
libraryHeaderBtn?.addEventListener('click', () => {
  togglePanel(libraryPanel, libraryHeaderBtn);
  renderLibraryCards();
});
libraryCloseBtn?.addEventListener('click', showMain);
function renderLibraryCards() {
  if (!cardsContainer) return;
  const query = state.searchQuery.toLowerCase().trim();
  const cat = state.activeCategory;
  if (cat === 'wizard') {
    cardsContainer.classList.add('hidden');
    wizardView?.classList.remove('hidden');
    return;
  } else {
    cardsContainer.classList.remove('hidden');
    wizardView?.classList.add('hidden');
  }
  const filtered = PROMPT_LIBRARY.filter(item => {
    const matchesCat = (cat === 'all') || (item.cat === cat);
    const matchesQuery = !query ||
      item.title.toLowerCase().includes(query) ||
      item.desc.toLowerCase().includes(query) ||
      item.prompt.toLowerCase().includes(query);
    return matchesCat && matchesQuery;
  });
  if (filtered.length === 0) {
    cardsContainer.innerHTML = `
      <div style="text-align:center;padding:24px 12px;color:var(--text-muted);font-size:12px;">
        <span style="font-size:24px;display:block;margin-bottom:6px;">🔍</span>
        Nenhuma ação encontrada para "<strong>${escHtml(query)}</strong>".
      </div>`;
    return;
  }
  cardsContainer.innerHTML = filtered.map(item => {
    const svgIcon = SVG_ICONS[item.iconKey] || SVG_ICONS.sparkles;
    return `
      <div class="lib-card" data-prompt-id="${item.id}">
        <div class="lib-card-icon-svg" style="background:${item.bg};">
          ${svgIcon}
        </div>
        <div class="lib-card-info">
          <div class="lib-card-top-row">
            <strong class="lib-card-title">${item.title}</strong>
            <span class="lib-card-tag">${getCatLabel(item.cat)}</span>
          </div>
          <p class="lib-card-desc">${item.desc}</p>
        </div>
      </div>
    `;
  }).join('');
  cardsContainer.querySelectorAll('.lib-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-prompt-id');
      const item = PROMPT_LIBRARY.find(p => p.id === id);
      if (item) {
        loadPromptToInput(item.prompt);
        showMain();
      }
    });
  });
}
function getCatLabel(cat) {
  const map = { fix: 'Fixes', ui: 'Design UI', mobile: 'Mobile', auth: 'Auth', shop: 'Vendas', perf: 'Otimizar' };
  return map[cat] || 'Geral';
}
searchInput?.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  if (state.searchQuery) {
    searchClearBtn?.classList.remove('hidden');
  } else {
    searchClearBtn?.classList.add('hidden');
  }
  renderLibraryCards();
});
searchClearBtn?.addEventListener('click', () => {
  searchInput.value = '';
  state.searchQuery = '';
  searchClearBtn.classList.add('hidden');
  renderLibraryCards();
});
document.querySelectorAll('.library-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.library-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.activeCategory = tab.getAttribute('data-cat');
    renderLibraryCards();
  });
});
$('wizard-generate-btn')?.addEventListener('click', () => {
  const goal = $('wizard-goal')?.value || 'Crie uma nova tela completa de';
  const desc = $('wizard-desc')?.value.trim() || 'meu aplicativo';
  const style = $('wizard-style')?.value || 'usando Tailwind CSS e design glassmorphic premium';
  const fullPrompt = `${goal} "${desc}", ${style}. Mantenha a tipografia elegante, adicione estados de carregamento e garanta que todos os componentes React e tipos TypeScript estejam 100% corretos para o preview do Lovable.`;
  loadPromptToInput(fullPrompt);
  showMain();
  toast('🪄 Prompt Estruturado pela IA Carregado!', 'success', 3000);
});
function loadPromptToInput(promptText) {
  if (!messageInput.disabled) {
    messageInput.value = promptText;
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
    messageInput.focus();
    toast('Prompt carregado! Clique em Enviar.', 'success', 2500);
  }
}
function applyTheme(theme = 'light') {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    themeIconSun?.classList.remove('hidden');
    themeIconMoon?.classList.add('hidden');
  } else {
    themeIconSun?.classList.add('hidden');
    themeIconMoon?.classList.remove('hidden');
  }
}
themeToggleBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  store.set({ theme: next });
});
let toastTimer;
function toast(msg, type = '', ms = 4000) {
  statusMsg.textContent = msg;
  statusBar.className = 'toast' + (type ? ' ' + type : '');
  statusBar.classList.remove('hidden');
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = setTimeout(() => statusBar.classList.add('hidden'), ms);
}
function showMain() {
  settingsPanel.classList.add('hidden');
  historyPanel.classList.add('hidden');
  statsPanel.classList.add('hidden');
  libraryPanel?.classList.add('hidden');
  floatingBubbleMenu?.classList.add('hidden');
  settingsBtn.classList.remove('active');
  historyBtn.classList.remove('active');
  statsBtn.classList.remove('active');
  libraryHeaderBtn?.classList.remove('active');
}
function togglePanel(panel, btn) {
  const isHidden = panel.classList.contains('hidden');
  showMain();
  if (isHidden) {
    panel.classList.remove('hidden');
    btn?.classList.add('active');
  }
}
settingsBtn?.addEventListener('click', () => {
  togglePanel(settingsPanel, settingsBtn);
  if (!settingsPanel.classList.contains('hidden')) populateSettings();
});
historyBtn?.addEventListener('click', () => {
  togglePanel(historyPanel, historyBtn);
  if (!historyPanel.classList.contains('hidden')) loadHistory();
});
statsBtn?.addEventListener('click', () => {
  togglePanel(statsPanel, statsBtn);
  if (!statsPanel.classList.contains('hidden')) populateStats();
});
$('settings-close')?.addEventListener('click', showMain);
$('history-close')?.addEventListener('click', showMain);
$('stats-close')?.addEventListener('click', showMain);
function updateStatusPill() {
  if (!headerStatusPill || !headerStatusText) return;
  const licenseOnline = !!state.license?.key && !!state.license?.email && !licenseExpiredLocally();
  if (licenseOnline) {
    headerStatusPill.className = 'status-pill online';
    headerStatusText.textContent = 'Conectado';
    const expiry = state.license?.expiresAt ? formatLicenseExpiry(state.license.expiresAt) : 'Vitalícia / sem expiração';
    headerStatusPill.title = `Licença MSK ativa • ${expiry}`;
  } else {
    headerStatusPill.className = 'status-pill offline';
    headerStatusText.textContent = 'Desconectado';
    headerStatusPill.title = 'Ative uma key MSK para conectar';
  }
}
presetChipsBar?.addEventListener('click', (e) => {
  const chip = e.target.closest('.preset-chip');
  if (!chip) return;
  const promptText = chip.getAttribute('data-prompt');
  if (promptText && !messageInput.disabled) {
    loadPromptToInput(promptText);
  }
});
function populateStats() {
  $('stat-commits').textContent = state.stats.commits || 0;
  $('stat-files').textContent = state.stats.files || 0;
}
function recordStatCommit(filesCount = 1) {
  state.stats.commits = (state.stats.commits || 0) + 1;
  state.stats.files = (state.stats.files || 0) + filesCount;
  store.set({ stats: state.stats });
}
let licensePollTimer = null;
let licenseExpiryTimer = null;
function licenseMessage(code) {
  const map = {
    LICENSE_REQUIRED: 'Informe seu e-mail e sua key MSK.',
    LICENSE_INVALID: 'Key não encontrada ou ainda não liberada pelo servidor.',
    LICENSE_EMAIL_MISMATCH: 'Este e-mail não corresponde ao proprietário da key.',
    LICENSE_EXPIRED: 'Sua licença expirou. Ative uma nova key MSK para continuar.',
    LICENSE_REVOKED: 'Esta licença foi revogada pelo servidor MSK.',
    LICENSE_BLOCKED: 'Esta licença está bloqueada no servidor MSK.',
    ORIGIN_NOT_ALLOWED: 'Esta instalação não foi autorizada pelo servidor.',
    LICENSE_SERVICE_UNAVAILABLE: 'Servidor de licença indisponível. Tente novamente em instantes.',
  };
  return map[String(code || '')] || 'Não foi possível validar sua licença MSK.';
}
function normalizeLicense(data, email, key) {
  return {
    key: String(key || '').trim(),
    email: String(data?.email || email || '').trim().toLowerCase(),
    licenseId: String(data?.license_id || ''),
    status: String(data?.status || 'active'),
    activatedAt: data?.activated_at || null,
    expiresAt: data?.expires_at || null,
    checkedAt: Date.now(),
  };
}
function licenseExpiredLocally(license = state.license) {
  if (!license?.key || !license?.email) return true;
  if (!license.expiresAt) return false;
  const ms = Date.parse(String(license.expiresAt));
  return Number.isFinite(ms) && ms <= Date.now();
}
function formatLicenseExpiry(value) {
  if (!value) return 'Vitalícia / sem expiração';
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return '—';
  const remaining = ms - Date.now();
  if (remaining <= 0) return 'EXPIRADA';
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return `${new Date(ms).toLocaleString('pt-BR')} • ${d > 0 ? `${d}d ` : ''}${h}h ${m}m restantes`;
}
function updateLicenseStatus() {
  const emailEl = $('license-info-email');
  const statusEl = $('license-info-status');
  const expiryEl = $('license-info-expiry');
  if (emailEl) emailEl.textContent = state.license?.email || '—';
  if (statusEl) statusEl.textContent = state.license && !licenseExpiredLocally() ? 'Ativa' : 'Bloqueada';
  if (expiryEl) expiryEl.textContent = state.license ? formatLicenseExpiry(state.license.expiresAt) : '—';
  updateStatusPill();
}
function showLicenseGate(message = '', type = '') {
  document.body.classList.add('msk-license-locked');
  licenseGate?.classList.remove('hidden');
  if (licenseStatus) {
    licenseStatus.textContent = message;
    licenseStatus.className = `license-status${type ? ` ${type}` : ''}`;
  }
  if (licenseEmailInput && state.license?.email && !licenseEmailInput.value) licenseEmailInput.value = state.license.email;
  setTimeout(() => (licenseEmailInput?.value ? licenseKeyInput : licenseEmailInput)?.focus(), 60);
}
function hideLicenseGate() {
  document.body.classList.remove('msk-license-locked');
  licenseGate?.classList.add('hidden');
  if (licenseStatus) {
    licenseStatus.textContent = '';
    licenseStatus.className = 'license-status';
  }
}
async function forgetLicense(message = 'Informe uma nova key MSK para continuar.') {
  state.license = null;
  clearTimeout(licenseExpiryTimer);
  await new Promise(resolve => store.remove(['mskLicense', 'mskSession'], resolve));
  updateLicenseStatus();
  showLicenseGate(message, 'error');
}
async function validateLicense(email, key, { persist = true, quiet = false } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanKey = String(key || '').trim();
  if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) throw Object.assign(new Error('Informe o e-mail usado na compra.'), { code: 'EMAIL_REQUIRED' });
  if (cleanKey.length < 8) throw Object.assign(new Error('Informe uma key MSK válida.'), { code: 'LICENSE_REQUIRED' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(_0x8f1, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cleanKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, source: 'msk-system-studio-extension' }),
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || data?.active !== true) {
      const code = String(data?.code || 'LICENSE_INVALID');
      const err = Object.assign(new Error(licenseMessage(code)), { code, data });
      throw err;
    }
    const license = normalizeLicense(data, cleanEmail, cleanKey);
    if (licenseExpiredLocally(license)) throw Object.assign(new Error(licenseMessage('LICENSE_EXPIRED')), { code: 'LICENSE_EXPIRED' });
    state.license = license;
    if (persist) await new Promise(resolve => store.set({ mskLicense: license }, resolve));
    scheduleLicenseExpiry();
    updateLicenseStatus();
    if (!quiet) hideLicenseGate();
    return license;
  } finally {
    clearTimeout(timer);
  }
}
function scheduleLicenseExpiry() {
  clearTimeout(licenseExpiryTimer);
  if (!state.license?.expiresAt) return;
  const expiresMs = Date.parse(String(state.license.expiresAt));
  if (!Number.isFinite(expiresMs)) return;
  const wait = expiresMs - Date.now();
  if (wait <= 0) {
    void forgetLicense('Sua licença expirou. Ative uma nova key MSK para continuar.');
    return;
  }
  licenseExpiryTimer = setTimeout(() => {
    if (licenseExpiredLocally()) void forgetLicense('Sua licença expirou. Ative uma nova key MSK para continuar.');
    else scheduleLicenseExpiry();
  }, Math.min(wait + 100, 2147483000));
}
async function ensureActiveLicense({ network = true, quiet = true } = {}) {
  if (!state.license) {
    const saved = await new Promise(resolve => store.get(['mskLicense'], resolve));
    state.license = saved.mskLicense || null;
  }
  if (!state.license?.key || !state.license?.email) {
    showLicenseGate('Informe seu e-mail e sua key MSK para ativar.', '');
    return false;
  }
  if (licenseExpiredLocally()) {
    await forgetLicense('Sua licença expirou. Ative uma nova key MSK para continuar.');
    return false;
  }
  if (!network) {
    scheduleLicenseExpiry();
    updateLicenseStatus();
    return true;
  }
  try {
    await validateLicense(state.license.email, state.license.key, { persist: true, quiet: true });
    hideLicenseGate();
    return true;
  } catch (error) {
    const code = error?.code || '';
    if (['LICENSE_INVALID','LICENSE_EMAIL_MISMATCH','LICENSE_EXPIRED','LICENSE_REVOKED','LICENSE_BLOCKED','ORIGIN_NOT_ALLOWED'].includes(code)) {
      await forgetLicense(error.message || licenseMessage(code));
    } else if (!quiet) {
      showLicenseGate(error?.message || 'Não foi possível validar a licença.', 'error');
    }
    return false;
  }
}
function startLicenseWatch() {
  clearInterval(licensePollTimer);
  licensePollTimer = setInterval(async () => {
    if (!state.license) return;
    await ensureActiveLicense({ network: true, quiet: true });
  }, _0x8f2);
}
const MSK_PROJECT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function normalizeRepoInput(value) {
  return String(value || '').trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
}
async function resolveAgentContext({ preferInput = false } = {}) {
  const saved = await new Promise(r => store.get(['mskAgentProjectId', 'mskAgentSession', 'config'], r));
  let tab = null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs?.[0] || null;
  } catch {}
  const pageUrl = String(tab?.url || state.agentContext?.pageUrl || '');
  let detected = '';
  if (/^https:\/\/lovable\.dev\//i.test(pageUrl)) {
    const m = pageUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    detected = m?.[0] || '';
  }
  const inputProject = String($('lovable-project-id')?.value || '').trim();
  const projectId = (preferInput && MSK_PROJECT_ID_RE.test(inputProject) ? inputProject : '') || detected || String(saved.mskAgentProjectId || state.config?.projectId || '');
  let session = String(saved.mskAgentSession || state.agentContext?.session || '');
  try {
    const u = new URL(pageUrl);
    const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
    const fromHash = String(hash.get('msk_session') || '').trim();
    if (fromHash) session = fromHash;
  } catch {}
  const repository = normalizeRepoInput(state.config?.repo || saved.config?.repo || '');
  state.agentContext = { projectId, session, pageUrl, repository };
  const patch = {};
  if (projectId) patch.mskAgentProjectId = projectId;
  if (session) patch.mskAgentSession = session;
  if (Object.keys(patch).length) await store.set(patch);
  if ($('lovable-project-id') && projectId) $('lovable-project-id').value = projectId;
  return state.agentContext;
}
async function mskAgentRequest(action, payload = {}, signal = null) {
  if (!(await _0x8f7())) throw new Error('Integridade MSK inválida. Reinstale a extensão oficial.');
  const licensed = await ensureActiveLicense({ network: true, quiet: false });
  if (!licensed || !state.license?.key) throw new Error('Licença MSK necessária.');
  const ctx = await resolveAgentContext();
  if (!MSK_PROJECT_ID_RE.test(String(ctx.projectId || ''))) {
    const err = new Error('Abra o projeto no Lovable ou informe o Project ID nas configurações.');
    err.code = 'PROJECT_ID_REQUIRED';
    throw err;
  }
  const body = JSON.stringify({
    lovable_project_id: ctx.projectId,
    ...payload,
    source: 'msk-system-extension',
    license_email: state.license.email || '',
  });
  const headers = {
    'Authorization': `Bearer ${state.license.key}`,
    'apikey': _0x8f4,
    'Content-Type': 'application/json',
  };
  if (ctx.session) headers['x-msk-session'] = ctx.session;
  const res = await fetch(`${_0x8fA}?action=${encodeURIComponent(action)}`, { method: 'POST', headers, body, signal });
  const data = await res.json().catch(() => ({}));
  if (data?.session_token) {
    state.agentContext.session = String(data.session_token);
    await store.set({ mskAgentSession: state.agentContext.session });
  }
  if (!res.ok) {
    const code = String(data?.code || data?.error?.code || '');
    if (['LICENSE_INVALID','LICENSE_EMAIL_MISMATCH','LICENSE_EXPIRED','LICENSE_REVOKED','LICENSE_BLOCKED'].includes(code) || res.status === 401 && code === 'LICENSE_REQUIRED') {
      await forgetLicense(licenseMessage(code || 'LICENSE_INVALID'));
    }
    const message = typeof data?.error === 'string' ? data.error : data?.error?.message || data?.message || data?.reason || `HTTP ${res.status}`;
    const error = new Error(message);
    error.code = code;
    error.status = res.status;
    error.details = data?.details || data?.error?.details || [];
    throw error;
  }
  return data;
}
async function ensureAgentConnected({ openAuthorization = false } = {}) {
  const ctx = await resolveAgentContext();
  if (!MSK_PROJECT_ID_RE.test(String(ctx.projectId || ''))) return { connected: false, code: 'PROJECT_ID_REQUIRED' };
  try {
    const status = await mskAgentRequest('status', {});
    if (status?.connected) {
      if (status.repository) {
        state.agentContext.repository = String(status.repository);
        state.config = { ...(state.config || {}), repo: String(status.repository), projectId: ctx.projectId, branch: state.config?.branch || 'main' };
        await store.set({ config: state.config });
      }
      return status;
    }
  } catch (e) {
    if (!['MSK_SESSION_REQUIRED'].includes(String(e.code || ''))) throw e;
  }
  const connect = await mskAgentRequest('connect', {
    page_url: ctx.pageUrl || `https://lovable.dev/projects/${ctx.projectId}`,
    return_url: ctx.pageUrl || `https://lovable.dev/projects/${ctx.projectId}`,
    repository_url: normalizeRepoInput(state.config?.repo || ctx.repository || ''),
  });
  if (connect?.session_token) {
    state.agentContext.session = String(connect.session_token);
    await store.set({ mskAgentSession: state.agentContext.session });
  }
  if (connect?.connected) return connect;
  if (connect?.authorize_url && openAuthorization) {
    await chrome.tabs.create({ url: connect.authorize_url });
  }
  return connect;
}
function rememberAgentHistory(res) {
  const files = Array.isArray(res?.files) ? res.files : Array.isArray(res?.committed) ? res.committed.map(x => x.path).filter(Boolean) : [];
  if (!res?.commit_sha && !res?.commit_url) return;
  const entry = {
    sha: String(res.commit_sha || '').slice(0, 40),
    url: String(res.commit_url || ''),
    date: new Date().toISOString(),
    message: String(res.summary || res.message || 'Alteração MSK concluída'),
    branch: String(res.branch || res.branch_used || state.config?.branch || 'main'),
    files,
    taskId: String(res.task_id || ''),
  };
  state.agentHistory = [entry, ...(state.agentHistory || []).filter(x => x.sha !== entry.sha)].slice(0, 30);
  store.set({ agentHistory: state.agentHistory });
}
function populateSettings() {
  resolveAgentContext().then(ctx => {
    if ($('lovable-project-id')) $('lovable-project-id').value = ctx.projectId || '';
  }).catch(() => {});
  if (state.config) {
    $('gh-repo').value   = state.config.repo   || '';
    $('gh-branch').value = state.config.branch || 'main';
  }
  updateLicenseStatus();
}
$('settings-save')?.addEventListener('click', async () => {
  const projectId = String($('lovable-project-id')?.value || '').trim();
  const repo = normalizeRepoInput($('gh-repo')?.value || '');
  const branch = String($('gh-branch')?.value || '').trim() || 'main';
  if (!MSK_PROJECT_ID_RE.test(projectId)) { toast('Informe um Project ID Lovable válido ou abra o projeto no Lovable.', 'error'); return; }
  const btn = $('settings-save');
  btn.disabled = true;
  btn.textContent = 'Conectando...';
  try {
    if (!(await ensureActiveLicense({ network: true, quiet: false }))) return;
    state.config = { ...(state.config || {}), repo, branch, projectId };
    state.agentContext.projectId = projectId;
    await store.set({ config: state.config, mskAgentProjectId: projectId });
    const result = await ensureAgentConnected({ openAuthorization: true });
    if (result?.connected) {
      toast(`✓ Projeto conectado${result.repository ? ` • ${result.repository}` : ''}`, 'success');
      updateStatusPill();
      enableInput();
      setTimeout(() => { settingsPanel.classList.add('hidden'); settingsBtn.classList.remove('active'); }, 900);
    } else if (result?.authorize_url) {
      toast('Autorize o GitHub na aba aberta e depois volte ao Lovable.', '', 4500);
    } else {
      throw new Error(result?.error || 'Não foi possível concluir a conexão do projeto.');
    }
  } catch (e) {
    toast(`Erro: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Conectar Projeto';
  }
});
$('history-refresh')?.addEventListener('click', loadHistory);
async function loadHistory() {
  const list = $('history-list');
  const saved = await new Promise(r => store.get(['agentHistory'], r));
  state.agentHistory = Array.isArray(saved.agentHistory) ? saved.agentHistory : (state.agentHistory || []);
  $('history-branch').textContent = `Projeto: ${state.agentContext?.projectId || state.config?.projectId || '—'}`;
  if (!state.agentHistory.length) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Nenhum commit criado por esta instalação ainda.</div>';
    return;
  }
  list.innerHTML = state.agentHistory.map(c => `
    <div class="history-item">
      <div class="history-header">
        ${c.url ? `<a class="history-sha" href="${c.url}" target="_blank">${escHtml(String(c.sha || '').slice(0, 8) || 'commit')} ↗</a>` : `<span class="history-sha">${escHtml(String(c.sha || '').slice(0, 8) || 'commit')}</span>`}
        <span class="history-date">${new Date(c.date).toLocaleString('pt-BR')}</span>
      </div>
      <div class="history-msg">${escHtml(String(c.message || 'Alteração MSK').split('\n')[0])}</div>
    </div>
  `).join('');
}
attachBtn?.addEventListener('click', () => fileInput.click());
fileInput?.addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    if (file.size > 100 * 1024) { toast(`Arquivo "${file.name}" muito grande (max 100KB)`, 'error'); continue; }
    const content = await file.text();
    state.attachedFiles.push({ name: file.name, content });
  }
  fileInput.value = '';
  renderFileChips();
});
function renderFileChips() {
  if (!state.attachedFiles.length) {
    filePreviewArea.classList.add('hidden');
    filePreviewList.innerHTML = '';
    return;
  }
  filePreviewArea.classList.remove('hidden');
  filePreviewList.innerHTML = state.attachedFiles.map((f, i) => `
    <div class="file-chip">
      <span>📎 ${f.name}</span>
      <button class="file-chip-remove" data-i="${i}">×</button>
    </div>
  `).join('');
  filePreviewList.querySelectorAll('.file-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.attachedFiles.splice(parseInt(btn.dataset.i), 1);
      renderFileChips();
    });
  });
}
messageInput?.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
});
messageInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});
sendBtn?.addEventListener('click', sendMessage);
async function _0x8f7() {
  try {
    if (!window.__MSK_GUARD_PROMISE__) return false;
    return (await window.__MSK_GUARD_PROMISE__) === true;
  } catch { return false; }
}
function _0x8f8() {
  if (popupAiActiveBadge) popupAiActiveBadge.textContent = 'IA ativa do Super Admin';
}
function _0x8f9() { _0x8f8(); }
async function _0x8fa() { _0x8f8(); return true; }
stopBtn?.addEventListener('click', () => {
  if (state.abortCtrl) state.abortCtrl.abort();
  resetInput();
  removeTypingIndicator();
  toast('Geração cancelada.', '', 2000);
});
function addUserMessage(text, files = []) {
  welcomeMsg?.classList.add('hidden');
  const div = document.createElement('div');
  div.className = 'msg msg-user';
  div.innerHTML = `
    <div class="msg-bubble">
      ${escHtml(text)}
      ${files.length ? `<div class="msg-files">${files.map(f => `<span class="msg-file">📎 ${f.name}</span>`).join('')}</div>` : ''}
    </div>`;
  messagesArea.appendChild(div);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  return div;
}
function addTypingIndicator() {
  const div = document.createElement('div');
  div.className = 'msg msg-assistant';
  div.id = 'typing';
  div.innerHTML = `<div class="msg-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  messagesArea.appendChild(div);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}
function removeTypingIndicator() {
  document.getElementById('typing')?.remove();
}
function addAssistantMessage(res) {
  removeTypingIndicator();
  const div = document.createElement('div');
  div.className = 'msg msg-assistant';
  let content = '';
  if (res.ok) {
    if (res.summary || res.message) content += `<div class="msg-summary">✨ ${escHtml(res.summary || res.message)}</div>`;
    const filePaths = Array.isArray(res.files)
      ? res.files.map(x => typeof x === 'string' ? x : x?.path).filter(Boolean)
      : Array.isArray(res.committed) ? res.committed.map(x => x?.path).filter(Boolean) : [];
    if (filePaths.length) {
      content += `<div class="msg-files">`;
      for (const path of filePaths) content += `<span class="msg-file ok">✓ ${escHtml(path)}</span>`;
      content += `</div>`;
    }
    if (res.preview_pending) {
      content += `<div style="margin-top:7px;font-size:10.5px;color:var(--text-muted);">Prévia do Lovable em validação pelo MSK.</div>`;
    }
    if (res.commit_url) {
      content += `
        <div class="msg-actions-bar">
          <a class="msg-commit-link" href="${res.commit_url}" target="_blank">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
            Ver commit no GitHub
          </a>
        </div>`;
    }
  } else {
    content += `<div style="color:var(--neon-crimson);font-weight:700;font-size:12px;">❌ Não foi possível aplicar alterações</div>`;
    if (res.error || res.message) {
      content += `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:8px;color:var(--text-primary);font-size:11px;margin-top:5px;line-height:1.4;">${escHtml(res.error || res.message)}</div>`;
    }
  }
  div.innerHTML = `<div class="msg-bubble">${content}</div>`;
  messagesArea.appendChild(div);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || state.isLoading) return;
  const ctx = await resolveAgentContext();
  if (!MSK_PROJECT_ID_RE.test(String(ctx.projectId || ''))) {
    toast('Abra o projeto no Lovable ou configure o Project ID.', 'error');
    settingsPanel.classList.remove('hidden');
    settingsBtn.classList.add('active');
    populateSettings();
    return;
  }
  const files = [...state.attachedFiles];
  state.attachedFiles = [];
  renderFileChips();
  messageInput.value = '';
  messageInput.style.height = 'auto';
  addUserMessage(text, files);
  addTypingIndicator();
  disableInput();
  state.isLoading = true;
  state.abortCtrl = new AbortController();
  try {
    const connected = await ensureAgentConnected({ openAuthorization: true });
    if (!connected?.connected) {
      if (connected?.authorize_url) throw new Error('Autorize o GitHub na aba aberta e depois envie o comando novamente.');
      throw new Error(connected?.error || 'Projeto ainda não está conectado ao GitHub MSK.');
    }
    const res = await mskAgentRequest('run', {
      command: text,
      original_command: text,
      client_original_command: text,
      repository_url: connected.repository || state.config?.repo || undefined,
      branch: state.config?.branch || undefined,
      attached_files: files,
    }, state.abortCtrl.signal);
    addAssistantMessage(res);
    if (res.ok) {
      const count = Number(res.files_changed_count || (Array.isArray(res.files) ? res.files.length : 0) || (Array.isArray(res.committed) ? res.committed.length : 0));
      recordStatCommit(count || 1);
      rememberAgentHistory(res);
      const suffix = res.preview_pending ? ' • preview em validação' : '';
      toast(`✓ ${count || 0} arquivo(s) commitados no GitHub${suffix}`, 'success');
    } else {
      toast(res.error || res.message || 'Erro ao aplicar alterações.', 'error');
    }
  } catch (e) {
    removeTypingIndicator();
    if (e.name !== 'AbortError') {
      addAssistantMessage({ ok: false, error: e.message });
      toast('Erro: ' + e.message, 'error');
    }
  } finally {
    resetInput();
  }
}
function disableInput() {
  messageInput.disabled = true;
  sendBtn.disabled = true;
  attachBtn.disabled = true;
  stopBtn.classList.remove('hidden');
}
function resetInput() {
  state.isLoading = false;
  state.abortCtrl = null;
  messageInput.disabled = false;
  sendBtn.disabled = false;
  attachBtn.disabled = false;
  stopBtn.classList.add('hidden');
  messageInput.focus();
}
function enableInput() {
  messageInput.disabled = false;
  sendBtn.disabled = false;
  attachBtn.disabled = false;
}
licenseActivateBtn?.addEventListener('click', async () => {
  const email = licenseEmailInput?.value || '';
  const key = licenseKeyInput?.value || '';
  if (licenseActivateBtn) licenseActivateBtn.disabled = true;
  if (licenseStatus) {
    licenseStatus.textContent = 'Validando no servidor MSK...';
    licenseStatus.className = 'license-status';
  }
  try {
    const license = await validateLicense(email, key, { persist: true, quiet: false });
    if (licenseKeyInput) licenseKeyInput.value = '';
    if (licenseStatus) {
      licenseStatus.textContent = '✓ Licença aprovada e ativada.';
      licenseStatus.className = 'license-status ok';
    }
    hideLicenseGate();
    startLicenseWatch();
    await _0x8fa({ quiet: true });
    enableInput();
    toast('✓ Licença MSK ativada!', 'success', 1200);
    setTimeout(() => window.location.reload(), 350);
  } catch (error) {
    const msg = error?.message || licenseMessage(error?.code);
    if (licenseStatus) {
      licenseStatus.textContent = msg;
      licenseStatus.className = 'license-status error';
    }
  } finally {
    if (licenseActivateBtn) licenseActivateBtn.disabled = false;
  }
});
licenseKeyInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') licenseActivateBtn?.click();
});
licenseEmailInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') licenseKeyInput?.focus();
});
$('license-remove')?.addEventListener('click', async () => {
  if (!confirm('Remover a key deste dispositivo? O Studio ficará bloqueado até uma nova ativação.')) return;
  await forgetLicense('Key removida. Informe uma nova licença MSK.');
});
window.addEventListener('focus', () => { if (state.license) void ensureActiveLicense({ network: true, quiet: true }); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.license) void ensureActiveLicense({ network: true, quiet: true });
});
async function init() {
  if (!(await _0x8f7())) { disableInput(); return; }
  showMain();
  const saved = await new Promise(r => store.get(['config', 'stats', 'theme', 'mskLicense', 'agentHistory', 'mskAgentProjectId', 'mskAgentSession'], r));
  applyTheme(saved.theme || 'light');
  if (saved.stats) state.stats = saved.stats;
  state.license = saved.mskLicense || null;
  state.agentHistory = Array.isArray(saved.agentHistory) ? saved.agentHistory : [];
  state.agentContext.projectId = String(saved.mskAgentProjectId || saved.config?.projectId || '');
  state.agentContext.session = String(saved.mskAgentSession || '');
  if (licenseEmailInput && state.license?.email) licenseEmailInput.value = state.license.email;
  updateLicenseStatus();
  const licensed = await ensureActiveLicense({ network: true, quiet: true });
  if (!licensed) { disableInput(); return; }
  hideLicenseGate();
  startLicenseWatch();
  if (saved.config) state.config = { ...saved.config, token: undefined };
  const ctx = await resolveAgentContext();
  if ($('gh-repo')) $('gh-repo').value = state.config?.repo || '';
  if ($('gh-branch')) $('gh-branch').value = state.config?.branch || 'main';
  if ($('lovable-project-id')) $('lovable-project-id').value = ctx.projectId || '';
  updateStatusPill();
  if (!MSK_PROJECT_ID_RE.test(String(ctx.projectId || ''))) {
    settingsPanel.classList.remove('hidden');
    settingsBtn.classList.add('active');
    populateSettings();
    disableInput();
    return;
  }
  try {
    const connected = await ensureAgentConnected({ openAuthorization: false });
    if (connected?.connected) {
      enableInput();
      if (popupAiActiveBadge) popupAiActiveBadge.textContent = 'IA ativa do Super Admin';
      return;
    }
  } catch (e) {
    console.warn('MSK agent connection check failed', e?.message || e);
  }
  settingsPanel.classList.remove('hidden');
  settingsBtn.classList.add('active');
  populateSettings();
  enableInput();
}
init();
