import { Link } from "@tanstack/react-router";
import { MskLogo } from "./logo";
import { PlansExperienceEnhancer } from "./plans-experience-enhancer";

export function SiteFooter() {
  return (
    <>
      <PlansExperienceEnhancer />
      <footer className="border-t border-border/60 bg-background/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <MskLogo size={34} />
          <nav className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Link to="/planos" className="hover:text-primary">
              Planos
            </Link>
            <Link to="/documentacao" className="hover:text-primary">
              Documentação da API
            </Link>
            <Link to="/auth" className="hover:text-primary">
              Entrar
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MSK SISTEM. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </>
  );
}