import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  CreditCard,
  Database,
  GitBranch,
  KeyRound,
  Layers,
  Lock,
  MonitorSmartphone,
  Plug,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/msk/site-header";

import heroHub from "@/assets/vs/hero-hub.jpg";
import fragmented from "@/assets/vs/fragmented.jpg";
import flowOrganized from "@/assets/vs/flow-organized.jpg";
import chatUi from "@/assets/vs/chat-ui.jpg";
import agentPanel from "@/assets/vs/agent-panel.jpg";
import githubImg from "@/assets/vs/github.jpg";
import lovableImg from "@/assets/vs/lovable.jpg";
import databaseImg from "@/assets/vs/database.jpg";
import vaultImg from "@/assets/vs/vault.jpg";
import apisImg from "@/assets/vs/apis.jpg";
import checkoutImg from "@/assets/vs/checkout.jpg";
import commandsImg from "@/assets/vs/commands.jpg";
import contextImg from "@/assets/vs/context.jpg";
import ecosystemImg from "@/assets/vs/ecosystem.jpg";

const TITLE = "ChatGPT vs MSK Agente — inteligência conectada ao seu projeto";
const DESCRIPTION =
  "Entenda por que usar ChatGPT, GitHub e Lovable separadamente não é a mesma experiência de ter o MSK Agente conectando contexto, integrações, segurança e execução.";

export const Route = createFileRoute("/msk-agente-vs-chatgpt")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

/* ---------------- primitives ---------------- */

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionShell({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <section id={id} className="relative w-full overflow-hidden px-4 py-16 sm:px-6 md:py-24">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function Eyebrow({ icon: Icon, children }: { icon: React.ElementType; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function GlowFrame({
  src,
  alt,
  width,
  height,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[2rem] opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 30%, color-mix(in oklab, var(--primary) 32%, transparent), transparent 70%), radial-gradient(50% 50% at 75% 70%, color-mix(in oklab, oklch(0.55 0.24 300) 30%, transparent), transparent 70%)",
        }}
      />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-sm">
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          className="h-auto w-full object-cover"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
      </div>
    </div>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-muted-foreground sm:text-base">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

function FlowSteps({ steps, tone = "primary" }: { steps: string[]; tone?: "primary" | "muted" }) {
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <motion.li
          key={s}
          initial={{ opacity: 0, x: -14 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ delay: i * 0.05, duration: 0.4 }}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-xs font-medium sm:text-sm ${
            tone === "primary"
              ? "border-primary/25 bg-primary/[0.07] text-foreground"
              : "border-white/10 bg-white/[0.03] text-muted-foreground"
          }`}
        >
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${
              tone === "primary" ? "bg-primary/20 text-primary" : "bg-white/10 text-muted-foreground"
            }`}
          >
            {i + 1}
          </span>
          {s}
        </motion.li>
      ))}
    </ol>
  );
}

function Split({
  reverse = false,
  image,
  children,
}: {
  reverse?: boolean;
  image: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
      <Reveal className={reverse ? "md:order-2" : ""}>{image}</Reveal>
      <Reveal delay={0.08} className={reverse ? "md:order-1" : ""}>
        {children}
      </Reveal>
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-4 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl md:text-4xl">
      {children}
    </h2>
  );
}

/* ---------------- page ---------------- */

function ComparePage() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground">
      {/* ambient background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 50% at 50% -10%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%), radial-gradient(60% 40% at 90% 20%, color-mix(in oklab, oklch(0.55 0.24 300) 18%, transparent), transparent 70%), radial-gradient(60% 40% at 5% 60%, color-mix(in oklab, oklch(0.55 0.24 300) 12%, transparent), transparent 70%)",
        }}
      />
      <SiteHeader />

      {/* 1 — HERO */}
      <SectionShell>
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <Reveal>
            <Eyebrow icon={Sparkles}>ChatGPT + MSK Agente</Eyebrow>
            <h1 className="mt-5 text-balance text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
              ChatGPT sozinho é inteligência.
              <span className="block bg-gradient-to-r from-primary via-primary to-[oklch(0.65_0.22_300)] bg-clip-text text-transparent">
                MSK Agente transforma inteligência em execução.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Entenda por que usar ChatGPT, GitHub e Lovable separadamente não é a mesma experiência de ter o MSK
              Agente conectando todo o seu projeto.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-xl text-base font-semibold">
                <Link to="/planos" hash="msk-agente">
                  Conhecer o MSK Agente <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-xl text-base">
                <a href="#ecossistema">Ver o ecossistema</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["CONTEXTO", "CONEXÕES", "SEGURANÇA", "COMANDOS", "EXECUÇÃO"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            >
              <GlowFrame src={heroHub} alt="MSK Agente como central conectando IA, repositório, editor de projeto, backend e APIs" width={1536} height={864} priority />
            </motion.div>
          </Reveal>
        </div>
      </SectionShell>

      {/* 2 — CHATGPT SOZINHO */}
      <SectionShell>
        <Split
          image={<GlowFrame src={fragmented} alt="Fluxo fragmentado com várias janelas abertas: conversa, repositório, editor e banco" width={1408} height={912} />}
          reverse
        >
          <Eyebrow icon={Layers}>Fluxo tradicional</Eyebrow>
          <Heading>O que acontece usando somente o ChatGPT?</Heading>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            O ChatGPT é extremamente poderoso para analisar, escrever código, explicar problemas e ajudar no
            desenvolvimento. Porém, em um fluxo tradicional, você ainda precisa administrar manualmente várias partes
            do trabalho.
          </p>
          <div className="mt-6">
            <FlowSteps
              tone="muted"
              steps={[
                "ChatGPT gera a resposta",
                "Você copia o código",
                "Abre o GitHub e procura o arquivo",
                "Aplica a alteração manualmente",
                "Abre o Lovable e confere o resultado",
              ]}
            />
          </div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            <Bullet>Copiar e colar código</Bullet>
            <Bullet>Explicar o contexto novamente</Bullet>
            <Bullet>Encontrar arquivos manualmente</Bullet>
            <Bullet>Alternar entre várias abas</Bullet>
            <Bullet>Integrações separadas</Bullet>
            <Bullet>Credenciais espalhadas</Bullet>
          </ul>
        </Split>
      </SectionShell>

      {/* 3 — COM MSK AGENTE */}
      <SectionShell>
        <Split image={<GlowFrame src={flowOrganized} alt="Fluxo organizado com o MSK Agente como hub central" width={1408} height={912} />}>
          <Eyebrow icon={Workflow}>Fluxo conectado</Eyebrow>
          <Heading>Agora veja o mesmo projeto com MSK Agente</Heading>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            O MSK Agente foi criado para reduzir o trabalho manual entre as ferramentas que você já utiliza.
          </p>
          <div className="mt-6">
            <FlowSteps
              steps={[
                "Você envia o comando",
                "MSK Agente organiza o contexto",
                "ChatGPT gera a solução",
                "GitHub e Lovable no mesmo fluxo",
                "Supabase, APIs e banco conectados",
              ]}
            />
          </div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            <Bullet>Projeto identificado</Bullet>
            <Bullet>Contexto organizado</Bullet>
            <Bullet>Comandos direcionados</Bullet>
            <Bullet>Conexões autorizadas</Bullet>
            <Bullet>Acesso controlado ao banco</Bullet>
            <Bullet>Acompanhamento da tarefa</Bullet>
          </ul>
        </Split>
      </SectionShell>

      {/* 4 — COMPARATIVO */}
      <SectionShell>
        <Reveal className="text-center">
          <Eyebrow icon={Boxes}>Lado a lado</Eyebrow>
          <Heading>ChatGPT tradicional vs MSK Agente</Heading>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Reveal>
            <article className="h-full rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm sm:p-7">
              <GlowFrame src={chatUi} alt="Interface de conversa gerando código" width={1024} height={1024} />
              <h3 className="mt-6 text-lg font-bold sm:text-xl">ChatGPT tradicional</h3>
              <p className="mt-2 text-sm text-primary">Excelente para pensar e gerar.</p>
              <ul className="mt-4 grid gap-2">
                <Bullet>Conversa</Bullet>
                <Bullet>Geração de código</Bullet>
                <Bullet>Explicações e análise</Bullet>
                <Bullet>Sugestões</Bullet>
              </ul>
              <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground">
                Você ainda administra a execução.
              </p>
            </article>
          </Reveal>
          <Reveal delay={0.1}>
            <article className="relative h-full rounded-3xl border border-primary/30 bg-primary/[0.06] p-5 backdrop-blur-sm sm:p-7">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-3xl"
                style={{ boxShadow: "0 0 60px -18px color-mix(in oklab, var(--primary) 60%, transparent) inset" }}
              />
              <GlowFrame src={agentPanel} alt="Painel do MSK Agente com módulos conectados" width={1024} height={1024} />
              <h3 className="mt-6 text-lg font-bold sm:text-xl">MSK Agente</h3>
              <p className="mt-2 text-sm text-primary">Criado para conectar inteligência ao ambiente do projeto.</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                <Bullet>Contexto do projeto</Bullet>
                <Bullet>Comandos focados</Bullet>
                <Bullet>Integrações</Bullet>
                <Bullet>Execução</Bullet>
                <Bullet>Banco e APIs</Bullet>
                <Bullet>Segurança e automações</Bullet>
              </ul>
            </article>
          </Reveal>
        </div>
      </SectionShell>

      {/* 5 — GITHUB */}
      <SectionShell>
        <Split image={<GlowFrame src={githubImg} alt="Repositório com arquivos, commits e alterações acompanhadas pelo agente" width={1408} height={912} />} reverse>
          <Eyebrow icon={GitBranch}>Repositório</Eyebrow>
          <Heading>GitHub deixa de ser apenas onde o código está salvo.</Heading>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Dentro do fluxo do MSK Agente, o repositório conectado passa a fazer parte do processo de alteração do
            projeto — sempre conforme as permissões que você autorizar.
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            <Bullet>Localizar arquivos</Bullet>
            <Bullet>Analisar código</Bullet>
            <Bullet>Modificar arquivos</Bullet>
            <Bullet>Criar commits</Bullet>
            <Bullet>Trabalhar no repositório conectado</Bullet>
            <Bullet>Acompanhar alterações</Bullet>
          </ul>
        </Split>
      </SectionShell>

      {/* 6 — LOVABLE */}
      <SectionShell>
        <Split image={<GlowFrame src={lovableImg} alt="Editor de projeto com preview do site e o MSK Agente conectado lateralmente" width={1408} height={912} />}>
          <Eyebrow icon={MonitorSmartphone}>Projeto</Eyebrow>
          <Heading>Projetos Lovable dentro de um fluxo mais organizado.</Heading>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            O MSK Agente foi pensado para trabalhar com projetos Lovable sem transformar cada correção em uma longa
            sequência manual de prompts e cópias de código.
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            <Bullet>Projeto identificado</Bullet>
            <Bullet>GitHub conectado</Bullet>
            <Bullet>Edição do código</Bullet>
            <Bullet>Preview e atualização</Bullet>
            <Bullet>Responsividade</Bullet>
            <Bullet>Correções de frontend</Bullet>
          </ul>
        </Split>
      </SectionShell>

      {/* 7 — SUPABASE E BANCO */}
      <SectionShell>
        <Split image={<GlowFrame src={databaseImg} alt="Banco de dados com tabelas, autenticação e proteção por políticas" width={1408} height={912} />} reverse>
          <Eyebrow icon={Database}>Backend</Eyebrow>
          <Heading>O agente não precisa ficar limitado somente ao frontend.</Heading>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Projetos modernos dependem de banco, autenticação, usuários, tabelas, RLS, funções e APIs. Tudo isso faz
            parte do mesmo contexto de trabalho.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["users", "profiles", "orders", "payments", "projects"].map((t) => (
              <span
                key={t}
                className="rounded-lg border border-primary/25 bg-primary/[0.07] px-3 py-1.5 font-mono text-xs text-primary"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-6 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Qualquer operação acontece somente conforme as conexões e permissões autorizadas por você.
          </p>
        </Split>
      </SectionShell>

      {/* 8 — COFRE */}
      <SectionShell>
        <Reveal className="text-center">
          <Eyebrow icon={Lock}>Cofre MSK</Eyebrow>
          <Heading>Credenciais não deveriam ficar espalhadas em conversas.</Heading>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Use uma estrutura apropriada para armazenar informações sensíveis utilizadas pelas integrações.
          </p>
        </Reveal>
        <Reveal delay={0.08} className="mt-10">
          <GlowFrame src={vaultImg} alt="Cofre digital 3D protegendo chaves, tokens e segredos" width={1408} height={912} />
        </Reveal>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["API KEY", "TOKEN", "SECRET", "CLIENT ID"].map((c, i) => (
            <Reveal key={c} delay={i * 0.06}>
              <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-4">
                <KeyRound className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold tracking-wide">{c}</p>
                  <p className="text-[11px] text-muted-foreground">••••••••••• protegido</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <p className="mt-8 text-center text-base font-semibold text-primary sm:text-lg">
            Segurança faz parte da infraestrutura.
          </p>
        </Reveal>
      </SectionShell>

      {/* 9 — APIs */}
      <SectionShell>
        <Split image={<GlowFrame src={apisImg} alt="Central de APIs futurista com endpoints e webhooks conectados" width={1408} height={912} />}>
          <Eyebrow icon={Plug}>Integrações</Eyebrow>
          <Heading>APIs deixam de ser configurações espalhadas.</Heading>
          <div className="mt-6 flex flex-wrap gap-2">
            {["API", "Webhook", "Backend", "Banco", "Checkout"].map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            <Bullet>Pagamentos</Bullet>
            <Bullet>Notificações</Bullet>
            <Bullet>Autenticação</Bullet>
            <Bullet>Serviços externos</Bullet>
            <Bullet>Webhooks</Bullet>
            <Bullet>Integrações do projeto</Bullet>
          </ul>
        </Split>
      </SectionShell>

      {/* 10 — CHECKOUT */}
      <SectionShell>
        <Split image={<GlowFrame src={checkoutImg} alt="Checkout com PIX, cartão, webhook e banco conectados" width={1408} height={912} />} reverse>
          <Eyebrow icon={CreditCard}>Checkout</Eyebrow>
          <Heading>Projetos reais precisam de muito mais que uma interface bonita.</Heading>
          <div className="mt-6">
            <FlowSteps steps={["Cliente", "Checkout", "Gateway", "Webhook", "Banco", "Sistema"]} />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
            O MSK Agente acompanha a estrutura técnica ao lado do fluxo — ajudando a organizar e trabalhar com
            integrações autorizadas, sempre dentro das regras de cada serviço.
          </p>
        </Split>
      </SectionShell>

      {/* 11 — COMANDOS */}
      <SectionShell>
        <Split image={<GlowFrame src={commandsImg} alt="Interface premium do agente com comandos rápidos" width={1408} height={912} />}>
          <Eyebrow icon={Terminal}>Comandos focados</Eyebrow>
          <Heading>Não comece cada tarefa do zero.</Heading>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {[
              "Corrigir problema",
              "Melhorar projeto",
              "Refinar layout",
              "Corrigir mobile",
              "Atualizar integração",
              "Analisar banco",
              "Corrigir autenticação",
              "Verificar API",
            ].map((c, i) => (
              <motion.span
                key={c}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-xs font-medium sm:text-sm"
              >
                <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
                {c}
              </motion.span>
            ))}
          </div>
        </Split>
      </SectionShell>

      {/* 12 — CONTEXTO */}
      <SectionShell>
        <Split image={<GlowFrame src={contextImg} alt="Memória e contexto digital conectados ao projeto" width={1408} height={912} />} reverse>
          <Eyebrow icon={BrainCircuit}>Contexto</Eyebrow>
          <Heading>Menos tempo explicando. Mais tempo executando.</Heading>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sem MSK</p>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {["Qual projeto?", "Qual repositório?", "Qual arquivo?", "Qual banco?", "Qual framework?", "Me envie o erro novamente."].map((q) => (
                  <li key={q}>“{q}”</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.07] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Com MSK</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {["Projeto identificado", "Repositório identificado", "Conexões identificadas", "Contexto organizado"].map((q) => (
                  <li key={q} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> {q}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Split>
      </SectionShell>

      {/* 13 — ECOSSISTEMA */}
      <SectionShell id="ecossistema">
        <Reveal className="text-center">
          <Eyebrow icon={Boxes}>Uma central para o projeto</Eyebrow>
          <Heading>Tudo conectado ao MSK Agente</Heading>
        </Reveal>
        <Reveal delay={0.08} className="mt-10">
          <GlowFrame src={ecosystemImg} alt="Diagrama do MSK Agente conectando IA, repositório, projeto, backend, banco, APIs, checkout, automação e cofre" width={1536} height={864} />
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {["ChatGPT", "GitHub", "Lovable", "Supabase", "Database", "APIs", "Checkout", "Automação", "Cofre", "MSK Agente"].map((n, i) => (
            <Reveal key={n} delay={i * 0.04}>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center text-xs font-semibold sm:text-sm">
                {n}
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["CONNECTED", "AUTHORIZED", "SYNCED", "SECURE"].map((s, i) => (
            <motion.span
              key={s}
              initial={{ opacity: 0.3 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 * i }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-primary"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
              {s}
            </motion.span>
          ))}
        </div>
      </SectionShell>

      {/* 14 — IMPACTO */}
      <SectionShell>
        <div className="rounded-[2rem] border border-white/10 bg-black/40 px-6 py-14 text-center backdrop-blur-sm sm:px-12 md:py-20">
          <div className="mx-auto max-w-3xl space-y-4">
            {[
              "ChatGPT é a inteligência.",
              "GitHub é o código.",
              "Lovable é o projeto.",
              "Supabase é o backend.",
              "APIs conectam serviços.",
            ].map((line, i) => (
              <motion.p
                key={line}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="text-lg font-semibold text-muted-foreground sm:text-2xl"
              >
                {line}
              </motion.p>
            ))}
            <motion.p
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="pt-6 text-2xl font-extrabold tracking-tight text-primary drop-shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_45%,transparent)] sm:text-4xl"
            >
              MSK AGENTE CONECTA O ECOSSISTEMA.
            </motion.p>
          </div>
        </div>
      </SectionShell>

      {/* 15 — POR QUE ASSINAR */}
      <SectionShell>
        <Reveal className="text-center">
          <Eyebrow icon={Sparkles}>Decisão</Eyebrow>
          <Heading>Então por que assinar o MSK Agente?</Heading>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Porque você não está assinando outro chat. Você está adicionando uma camada operacional ao seu
            desenvolvimento.
          </p>
        </Reveal>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { l: "CONTEXTO", i: BrainCircuit },
            { l: "INTEGRAÇÕES", i: Plug },
            { l: "SEGURANÇA", i: ShieldCheck },
            { l: "COMANDOS", i: Terminal },
            { l: "EXECUÇÃO", i: Zap },
            { l: "AUTOMAÇÃO", i: Workflow },
          ].map(({ l, i: Icon }, idx) => (
            <Reveal key={l} delay={idx * 0.05}>
              <div className="flex h-full flex-col items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.06] px-3 py-5 text-center">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-[11px] font-bold tracking-[0.14em] sm:text-xs">{l}</span>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2} className="mt-10 text-center">
          <Button asChild size="lg" className="h-14 w-full rounded-2xl text-base font-bold sm:w-auto sm:px-10">
            <Link to="/planos" hash="msk-agente">
              ATIVAR MSK AGENTE <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Transforme suas ferramentas separadas em um fluxo de trabalho conectado.
          </p>
        </Reveal>
      </SectionShell>
    </div>
  );
}
