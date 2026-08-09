import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { 
  Eye, EyeOff, Loader2, DollarSign, Rocket, TrendingUp, 
  HeartHandshake, Zap, Target, Sparkles, CheckCircle2 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MskLogo } from "@/components/msk/logo";
import { linkAffiliateReferral } from "@/lib/affiliate.functions";
import { getVisitorId, readAffiliateRef } from "@/lib/urls";

const searchSchema = z.object({ next: z.string().optional() });

type IconProps = { className?: string };

function GoogleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.3 0-.7-.1-1.4-.2-2H12z"
      />
      <path
        fill="#34A853"
        d="M5.3 14.3l-.7.6-2.5 2A10 10 0 0 0 12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4z"
      />
      <path
        fill="#FBBC05"
        d="M2.1 7.1A9.9 9.9 0 0 0 2 12c0 1.6.4 3.2 1.1 4.6l3.2-2.5A5.9 5.9 0 0 1 6 12c0-.7.1-1.4.3-2.1L2.1 7.1z"
      />
      <path
        fill="#4285F4"
        d="M12 6c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 3.1 7.1l3.2 2.5C7 7.4 9.3 6 12 6z"
      />
    </svg>
  );
}

function AppleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.2-2.8.8-3.6.8-.7 0-1.9-.8-3.1-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.3 1.3-2.6 1.3-2.6s-2.4-1-2.4-3.8zM14.1 5.4c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.8-1.4z" />
    </svg>
  );
}

function GitHubIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .9-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
    </svg>
  );
}

function DiscordIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
      <path d="M19.3 5.3A16 16 0 0 0 15.4 4l-.2.4c1.3.3 2.5.9 3.6 1.6a12.7 12.7 0 0 0-10.7 0c1.1-.7 2.3-1.3 3.6-1.6L11.6 4c-1.4.2-2.7.6-4 1.3C5 9.1 4.3 12.8 4.7 16.4A16 16 0 0 0 9.5 19l1-1.4c-.8-.3-1.6-.7-2.3-1.2l.6-.4a11.4 11.4 0 0 0 9.8 0l.6.4c-.7.5-1.5.9-2.3 1.2l1 1.4a16 16 0 0 0 4.8-2.6c.5-4.2-.7-7.9-3.4-11.1zM9.7 14.3c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.7 1.9-1.7 1.9zm4.6 0c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.7 1.9-1.7 1.9z" />
    </svg>
  );
}

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — LOVABLE MSK" },
      {
        name: "description",
        content:
          "Acesse o painel da sua licença Lovable MSK, veja seu token e gerencie dispositivos.",
      },
      { property: "og:title", content: "Acesso — LOVABLE MSK" },
      { property: "og:description", content: "Entre na plataforma Lovable MSK." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "reset" | "verify" | "pre-signup";

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>("login");
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    // Se vier do botão de afiliado, inicia no modo pré-cadastro
    const isAffiliate = search.next?.includes('parceiro') || 
                        window.location.hash === '#afiliado' || 
                        window.location.href.includes('#afiliado') ||
                        document.referrer.includes('/parceiros');

    if (isAffiliate) {
      setMode("pre-signup");
    }
  }, [search.next]);

  async function resendVerification() {
    if (!email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) throw error;
      toast.success("E-mail de confirmação reenviado!");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResending(false);
    }
  }

  /** Vincula a indicação salva (cookie/localStorage) à conta recém-autenticada. */
  async function attachRef() {
    const code = readAffiliateRef();
    if (!code) return;
    try {
      await linkAffiliateReferral({ data: { code, visitorId: getVisitorId() } });
    } catch {
      /* indicação inválida ou expirada — não bloqueia o acesso */
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        // Se já estiver logado E o usuário for afiliado (não está no pre-signup), redireciona pro painel de parceiro
        // Senão, se apenas logado, vai pro painel normal. 
        // A chave aqui é NÃO redirecionar se estivermos explicitamente tentando ver a copy (pre-signup)
        if (mode !== "pre-signup") {
          navigate({ to: "/painel" });
        }
      }
    });
  }, [navigate, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await attachRef();
        navigate({ to: "/painel" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) throw error;
        await attachRef();
        setMode("verify");
        toast.success("Verifique seu e-mail para confirmar o cadastro.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/painel`,
        });
        if (error) throw error;
        toast.success("Enviamos um link de recuperação para o seu e-mail.");
        setMode("login");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const PROVIDERS = [
    { id: "google", label: "Google", Icon: GoogleIcon },
    { id: "apple", label: "Apple", Icon: AppleIcon },
    { id: "github", label: "GitHub", Icon: GitHubIcon },
    { id: "discord", label: "Discord", Icon: DiscordIcon },
  ] as const;

  async function social(provider: (typeof PROVIDERS)[number]["id"]) {
    try {
      try {
        sessionStorage.setItem("post-auth-redirect", "/painel");
      } catch {
        /* storage indisponível */
      }

      if (provider === "google") {
        const { lovable } = await import("@/integrations/lovable");
        await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
    } catch (err) {
      const msg = (err as Error)?.message ?? "";
      if (/unsupported provider|not enabled|provider is not/i.test(msg)) {
        toast.error(
          `Login com ${provider} ainda não está habilitado. Use Google, Apple ou e-mail e senha.`,
        );
        return;
      }
      toast.error(msg || "Não foi possível entrar com o provedor selecionado.");
    }
  }


  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-30" />
      <div className={`glass relative w-full transition-all duration-700 ease-in-out ${mode === 'pre-signup' && !showForm ? 'max-w-4xl p-10 md:p-16' : 'max-w-md p-8'} rounded-3xl neon-glow`}>
        {(mode === 'pre-signup' && !showForm) ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-6">
                <Sparkles className="w-12 h-12 text-primary animate-pulse" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight uppercase italic italic-neon">
                Você está a um passo de transformar <span className="text-primary underline">indicação</span> em renda extra real.
              </h1>
              <p className="text-xl text-white/60 font-medium max-w-2xl mx-auto">
                O mercado de Inteligência Artificial está explodindo. Quem entra agora colhe os resultados depois.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { 
                  icon: DollarSign, 
                  title: "Renda Extra Todo Mês", 
                  desc: "Receba comissões de até 40% por cada pessoa que você indicar. Sem precisar criar produto, sem estoque, sem complicação.",
                  emoji: "💰"
                },
                { 
                  icon: Rocket, 
                  title: "O Mercado que Mais Cresce", 
                  desc: "Enquanto muitos ainda estão tentando entender IA, você já pode lucrar com ela. Quem age cedo, sai na frente.",
                  emoji: "🚀"
                },
                { 
                  icon: TrendingUp, 
                  title: "Liberdade e Prosperidade", 
                  desc: "Construa uma renda que não depende de chefe, de horário fixo ou de bater ponto. Seu esforço vira resultado.",
                  emoji: "📈"
                },
                { 
                  icon: HeartHandshake, 
                  title: "Ajude Pessoas e Lucre", 
                  desc: "Ao indicar, você ajuda outras pessoas a terem acesso a ferramentas de IA e ainda é recompensado por isso.",
                  emoji: "🤝"
                },
                { 
                  icon: Zap, 
                  title: "Tudo Automático", 
                  desc: "A plataforma entrega, processa e paga. Você só indica e acompanha os resultados no painel.",
                  emoji: "⚡"
                },
                { 
                  icon: Target, 
                  title: "Momento Certo", 
                  desc: "As maiores oportunidades não esperam. O melhor momento para começar a construir sua renda com IA é agora.",
                  emoji: "🎯"
                }
              ].map((card, i) => (
                <div 
                  key={i} 
                  className="group p-6 rounded-[2rem] bg-white/[0.03] border border-white/10 hover:border-primary/40 transition-all hover:bg-white/[0.05] hover:-translate-y-1 duration-300"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-colors duration-300">
                      <card.icon className="w-5 h-5" />
                    </div>
                    <span className="text-2xl">{card.emoji}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">{card.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed font-medium">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-6 pt-6">
              <Button 
                variant="neon" 
                size="lg" 
                className="h-20 px-16 text-2xl font-black rounded-2xl shadow-[0_0_30px_-5px_rgba(0,255,170,0.3)] hover:scale-105 transition-all duration-300"
                onClick={() => {
                  setShowForm(true);
                  setMode("signup");
                }}
              >
                QUERO GARANTIR MINHA VAGA AGORA
              </Button>
              <div className="flex gap-8 text-[10px] font-black tracking-widest text-white/40 uppercase">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-primary" /> Vagas Limitadas</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-primary" /> Início Imediato</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-primary" /> Lucro Real</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Link to="/" className="inline-block">
              <MskLogo size={38} />
            </Link>
            <h1 className="mt-8 text-2xl font-bold animate-in fade-in slide-in-from-top-2 duration-500">
              {mode === "login"
                ? "Entrar na plataforma"
                : mode === "signup"
                  ? "Criar sua conta de parceiro"
                  : mode === "verify"
                    ? "Confirme seu cadastro"
                    : "Recuperar senha"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground animate-in fade-in duration-700">
              {mode === "signup" ? "Comece a lucrar com IA agora mesmo." : "Acesse seu token, assinatura e dispositivos."}
            </p>

            {mode === "verify" ? (
              <div className="mt-7 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex justify-center">
                  <img
                    src="/favicon.png"
                    alt="Logo"
                    className="h-20 w-20 rounded-2xl shadow-lg ring-1 ring-white/10"
                  />
                </div>
                <div className="glass flex items-center justify-between rounded-2xl border-l-4 border-l-primary p-4 shadow-sm">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Verifique seu e-mail</p>
                    <p className="text-xs text-muted-foreground">Enviamos um link para {email}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Button
                    variant="neon"
                    className="w-full"
                    onClick={() => setMode("login")}
                    disabled={loading}
                  >
                    Voltar para Login
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={resendVerification}
                    disabled={resending}
                  >
                    {resending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Reenviar e-mail
                  </Button>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <form onSubmit={submit} className="mt-7 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {mode !== "reset" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pr-11"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-primary"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <Button type="submit" variant="neon" className="w-full" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : mode === "login" ? (
                      "Entrar"
                    ) : mode === "signup" ? (
                      "Criar conta"
                    ) : (
                      "Enviar link"
                    )}
                  </Button>
                </form>

                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground animate-in fade-in duration-1000">
                  <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
                </div>

                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
                  {PROVIDERS.map((p) => (
                    <Button
                      key={p.id}
                      variant="glass"
                      className="justify-center gap-2"
                      onClick={() => social(p.id)}
                    >
                      <p.Icon className="h-4 w-4 shrink-0" />
                      <span>{p.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {mode !== "verify" && (
              <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground animate-in fade-in duration-1000">
                {mode !== "login" ? (
                  <button className="hover:text-primary" onClick={() => setMode("login")}>
                    Já tenho conta — entrar
                  </button>
                ) : (
                  <>
                    <button
                      className="block w-full hover:text-primary"
                      onClick={() => {
                        setShowForm(false);
                        setMode("pre-signup");
                      }}
                    >
                      Não tenho conta — criar agora
                    </button>
                    <button
                      className="block w-full hover:text-primary"
                      onClick={() => setMode("reset")}
                    >
                      Esqueci minha senha
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}