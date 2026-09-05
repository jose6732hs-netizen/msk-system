import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium cursor-pointer transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

// Sun icon component
const SunIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

// Moon icon component
const MoonIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

// Animation keyframes injected via style tag
const themeToggleStyles = `
  @keyframes theme-toggle-rotate {
    0% {
      transform: rotate(0deg) scale(1);
      opacity: 1;
    }
    50% {
      transform: rotate(180deg) scale(0.8);
      opacity: 0.5;
    }
    100% {
      transform: rotate(360deg) scale(1);
      opacity: 1;
    }
  }
  
  @keyframes theme-icon-enter {
    0% {
      transform: rotate(-90deg) scale(0.5);
      opacity: 0;
    }
    100% {
      transform: rotate(0deg) scale(1);
      opacity: 1;
    }
  }
  
  @keyframes theme-icon-exit {
    0% {
      transform: rotate(0deg) scale(1);
      opacity: 1;
    }
    100% {
      transform: rotate(90deg) scale(0.5);
      opacity: 0;
    }
  }
  
  .theme-toggle-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .theme-toggle-icon.animate-enter {
    animation: theme-icon-enter 300ms ease-out forwards;
  }
  
  .theme-toggle-icon.animate-exit {
    animation: theme-icon-exit 200ms ease-in forwards;
  }
  
  .theme-toggle-sun {
    color: #f59e0b;
  }
  
  .theme-toggle-moon {
    color: #6366f1;
  }
`;

// Theme toggle hook for managing theme state
function useThemeToggle() {
  const [isDark, setIsDark] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    // Check initial theme from document
    const isDarkMode = document.documentElement.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark" ||
      (!document.documentElement.getAttribute("data-theme") && 
       window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setIsDark((prev) => {
      const newIsDark = !prev;
      
      // Update DOM
      if (newIsDark) {
        document.documentElement.classList.add("dark");
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.setAttribute("data-theme", "light");
        localStorage.setItem("theme", "light");
      }
      
      return newIsDark;
    });
  }, []);

  return { isDark, toggleTheme, mounted };
}

// ThemeToggle component with sun/moon icons and rotation animation
interface ThemeToggleProps extends Omit<React.ComponentPropsWithoutRef<typeof Toggle>, "checked" | "onCheckedChange" | "defaultPressed"> {
  className?: string;
  size?: "default" | "sm" | "lg";
}

const ThemeToggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  ThemeToggleProps
>(({ className, size = "default", ...props }, ref) => {
  const { isDark, toggleTheme, mounted } = useThemeToggle();
  const [animationClass, setAnimationClass] = React.useState("");
  const prevIsDarkRef = React.useRef(isDark);
  const iconRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (prevIsDarkRef.current !== isDark && mounted) {
      // Trigger exit animation
      setAnimationClass("animate-exit");
      
      const timer = setTimeout(() => {
        // Switch to enter animation
        setAnimationClass("animate-enter");
        
        // Clear animation after completion
        setTimeout(() => {
          setAnimationClass("");
        }, 300);
      }, 200);

      prevIsDarkRef.current = isDark;
      return () => clearTimeout(timer);
    }
  }, [isDark, mounted]);

  // Inject styles on mount
  React.useEffect(() => {
    const styleId = "theme-toggle-styles";
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = themeToggleStyles;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Avoid hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <TogglePrimitive.Root
        ref={ref}
        className={cn(toggleVariants({ size, className }))}
        aria-label="Toggle theme"
        {...props}
      >
        <span className="theme-toggle-icon">
          <SunIcon className="theme-toggle-sun" />
        </span>
      </TogglePrimitive.Root>
    );
  }

  return (
    <TogglePrimitive.Root
      ref={ref}
      className={cn(toggleVariants({ size, className }))}
      pressed={isDark}
      onPressedChange={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-checked={isDark}
      role="switch"
      {...props}
    >
      <span 
        ref={iconRef}
        className={cn("theme-toggle-icon", animationClass)}
      >
        {isDark ? (
          <MoonIcon className="theme-toggle-moon" />
        ) : (
          <SunIcon className="theme-toggle-sun" />
        )}
      </span>
    </TogglePrimitive.Root>
  );
});

ThemeToggle.displayName = "ThemeToggle";

export { Toggle, toggleVariants, ThemeToggle, SunIcon, MoonIcon };
