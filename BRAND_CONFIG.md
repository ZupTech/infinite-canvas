# 🎯 Sistema de Branding Dinâmico

Sistema de configuração centralizada para diferentes marcas (white-label) baseado no domínio da aplicação.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Configuração de Marcas](#configuração-de-marcas)
- [Como Usar](#como-usar)
- [Desenvolvimento e Testes](#desenvolvimento-e-testes)
- [Adicionar Nova Marca](#adicionar-nova-marca)

## 🎨 Visão Geral

O sistema permite customizar completamente a experiência do usuário baseado no domínio:

- ✅ **Logos e Ícones** - Suporte para modo claro e escuro
- ✅ **SEO e Metadata** - Títulos, descrições, imagens OG personalizadas
- ✅ **Cores e Branding** - Esquema de cores por marca
- ✅ **Navegação** - URLs customizadas para pricing, support, etc.
- ✅ **Features Flags** - Habilitar/desabilitar funcionalidades por marca
- ✅ **Favicon dinâmico** - Ícone personalizado por marca

## 🏗️ Arquitetura

### Arquivos Principais

```
src/
├── config/
│   └── brand-config.ts          # Configuração central de todas as marcas
├── lib/
│   ├── brand-utils.ts            # Utilitários de detecção e manipulação
│   └── metadata.ts               # Geração de metadata dinâmica
├── components/
│   ├── BrandProvider.tsx         # Context Provider para React
│   └── canvas/
│       ├── BrandLogo.tsx         # Componente de logo responsivo
│       └── PoweredByUniteBadge.tsx # Badge com logo dinâmico
└── app/
    ├── layout.tsx                # Layout com metadata dinâmica
    └── core-providers.tsx        # Provider tree incluindo BrandProvider
```

## ⚙️ Configuração de Marcas

### Marcas Suportadas

#### 1. **cflab.ai**

- **Domínios**: `cflab.ai`, `www.cflab.ai`, `app.cflab.ai`, `canvas.cflab.ai`
- **Cor Primária**: `#5700dc` (roxo)
- **Idioma**: Português (pt_BR)
- **Features**: Planos visíveis, versões legadas, features avançadas

#### 2. **Unite AI** (myunite.ai)

- **Domínios**: `myunite.ai`, `www.myunite.ai`, `app.myunite.ai`, `canvas.myunite.ai`
- **Cor Primária**: `#0066cc` (azul)
- **Idioma**: Inglês (en_US)
- **Features**: Sidebar customizada, versões legadas

### Estrutura da Configuração

```typescript
export interface BrandConfig {
  id: BrandId;
  name: string;
  domains: string[];
  baseDomain: string;
  dominio_alternativo?: string;

  // Logos (suporte para modo claro e escuro)
  logo: {
    light: string; // URL do logo para tema claro
    dark: string; // URL do logo para tema escuro
    alt: string;
    width?: number;
    height?: number;
  };

  // Ícones
  icon: {
    light: string;
    dark: string;
    mobileSrc?: string; // Versão mobile opcional
    alt: string;
  };

  favicon: string;

  // Cores
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };

  // Feature Flags
  features: {
    showPlans: boolean;
    showLegacyVersions: boolean;
    enableAdvancedFeatures: boolean;
    customSidebar: boolean;
    showPrivacyModal: boolean;
  };

  // Navegação
  navigation: {
    homeUrl: string;
    pricingUrl: string;
    pricingCreditsUrl?: string;
    supportUrl: string;
    workflowsUrl: string;
    settingsUrl: string;
    privacyUrl: string;
    cookiesUrl: string;
  };

  // SEO
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogImage: string;
    ogImageAlt: string;
    twitterCard: "summary" | "summary_large_image";
    themeColor: string;
    locale?: string;
    canonicalUrl?: string;
  };
}
```

## 🚀 Como Usar

### 1. Em Componentes Client-Side

Use o hook `useBrand()` para acessar a configuração:

```tsx
"use client";

import { useBrand } from "@/components/BrandProvider";
import { useTheme } from "next-themes";

export function MyComponent() {
  const { brandId, config, isLoading } = useBrand();
  const { resolvedTheme } = useTheme();

  // Obter logo baseado no tema
  const logo = resolvedTheme === "dark" ? config.logo.dark : config.logo.light;

  return (
    <div>
      <img src={logo} alt={config.logo.alt} />
      <h1>{config.branding.companyName}</h1>
      <p>{config.branding.tagline}</p>
    </div>
  );
}
```

### 2. Componente de Logo (Pronto para Uso)

```tsx
import { BrandLogo } from "@/components/canvas/BrandLogo";

export function Header() {
  return <BrandLogo className="flex items-center" imgClassName="h-10 w-auto" />;
}
```

### 3. Em Server Components

```tsx
import { headers } from "next/headers";
import { detectBrandServer, getBrandConfig } from "@/lib/brand-utils";

export default async function Page() {
  const headersList = await headers();
  const brandId = detectBrandServer(headersList);
  const config = getBrandConfig(brandId);

  return (
    <div>
      <h1>{config.branding.companyName}</h1>
    </div>
  );
}
```

### 4. Metadata Dinâmica

O metadata já está configurado automaticamente no `layout.tsx`:

```tsx
// src/app/layout.tsx
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  return generateBrandMetadataFromHeaders(headersList);
}
```

Isso gera automaticamente:

- Títulos e descrições
- Open Graph tags
- Twitter Cards
- Favicons
- Theme colors

## 🧪 Desenvolvimento e Testes

### Testar Diferentes Marcas Localmente

Em ambientes de desenvolvimento (`localhost`), você pode forçar uma marca usando query params:

```bash
# Testar como cflab
http://localhost:3000?brand=cflab

# Testar como unite
http://localhost:3000?brand=unite
```

O override é salvo no `localStorage` e persiste entre navegações.

### Limpar Override

```javascript
// No console do navegador
localStorage.removeItem("brand-override");
```

### Domínios Permitidos para Override

```typescript
export const BRAND_OVERRIDE_ALLOWED_DOMAINS = [
  "localhost",
  "dev.cflab.ai",
  "dev.myunite.ai",
  "staging.cflab.ai",
  "staging.myunite.ai",
];
```

## ➕ Adicionar Nova Marca

1. **Edite** `src/config/brand-config.ts`
2. **Adicione** novo `BrandId` no type:

```typescript
export type BrandId = "cflab" | "unite" | "novamarca";
```

3. **Adicione** configuração em `BRAND_CONFIGS`:

```typescript
export const BRAND_CONFIGS: Record<BrandId, BrandConfig> = {
  // ... marcas existentes
  novamarca: {
    id: "novamarca",
    name: "Nova Marca",
    domains: ["novamarca.com", "www.novamarca.com"],
    baseDomain: "novamarca.com",
    logo: {
      light: "https://example.com/logo-light.png",
      dark: "https://example.com/logo-dark.png",
      alt: "Nova Marca",
    },
    // ... resto da configuração
  },
};
```

4. **Teste** localmente: `http://localhost:3000?brand=novamarca`

## 📝 Atualizar Logo CFLab (Modo Claro)

Quando receber o logo do modo claro do CFLab, atualize em `src/config/brand-config.ts`:

```typescript
cflab: {
  // ...
  logo: {
    light: 'URL_DO_NOVO_LOGO_CLARO',  // ⬅️ Atualizar aqui
    dark: 'https://train.cflab.ai/cflab_simbolo.svg',
    alt: 'cflab.ai',
  },
  icon: {
    light: 'URL_DO_NOVO_ICONE_CLARO',  // ⬅️ E aqui
    dark: 'https://storage.googleapis.com/unite_assets/cfLab/assets/logo-cflabAi.svg',
    // ...
  }
}
```

## 🔍 Features por Marca

### CFLab

- ✅ Mostrar planos de pricing
- ✅ Versões legadas habilitadas
- ✅ Features avançadas
- ✅ Modal de privacidade

### Unite

- ❌ Sem planos de pricing (usa link externo)
- ✅ Versões legadas habilitadas
- ✅ Sidebar customizada
- ✅ Modal de privacidade

## 🌐 Domínios em Produção

Para adicionar um novo domínio a uma marca existente:

1. Adicione o domínio no array `domains` da marca
2. Configure o DNS apontando para o servidor
3. Configure o SSL/TLS
4. Deploy!

O sistema detecta automaticamente a marca baseado no domínio da requisição.

## 🔒 Segurança

- ✅ Override de marca só funciona em domínios permitidos
- ✅ Validação de `brandId` antes de usar
- ✅ Fallback para marca padrão em caso de erro
- ✅ Sanitização de hostname

## 📱 Responsividade

O sistema suporta:

- Logos diferentes para desktop e mobile
- Ícones otimizados para cada tamanho
- Temas claro e escuro
- Favicon por marca

## 🎯 Próximos Passos

- [ ] Adicionar logo modo claro do CFLab
- [ ] Adicionar mais marcas conforme necessário
- [ ] Implementar cores dinâmicas no Tailwind (CSS variables)
- [ ] Cache de detecção de marca
- [ ] Analytics por marca
