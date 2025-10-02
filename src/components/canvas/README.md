# Canvas Components

Componentes relacionados ao canvas infinito e branding.

## Componentes de Branding

### BrandLogo

Componente responsivo que exibe o logo da marca atual baseado no tema.

**Props:**

- `className?: string` - Classes CSS para o container
- `imgClassName?: string` - Classes CSS para a imagem (default: "h-8 w-auto")
- `mobile?: boolean` - Flag para indicar versão mobile

**Exemplo:**

```tsx
<BrandLogo className="flex items-center" imgClassName="h-10 w-auto" />
```

### PoweredByUniteBadge

Badge com logo da marca que aparece no canto superior esquerdo (desktop).

**Exemplo:**

```tsx
<PoweredByUniteBadge />
```

## Uso com Temas

Ambos os componentes se adaptam automaticamente ao tema (claro/escuro) usando `next-themes`:

```tsx
import { useTheme } from "next-themes";

// O logo muda automaticamente quando o tema muda
const { theme, setTheme } = useTheme();
```
