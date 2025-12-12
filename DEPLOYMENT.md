# 📋 Evidencia Náradia a Spotrebičov

Aplikácia pre správu a evidenciu náradia, elektrospotrebičov a ich revízií podľa STN 33 1630.

## 🚀 Quick Start

### Prerekvizity

- Node.js 20+
- npm alebo yarn
- Supabase účet

### Lokálny development

1. **Nainštalujte závislosti:**

```bash
npm install
```

2. **Nastavte environment premenné:**

```bash
# Skopírujte example súbor
cp src/environments/environment.example.ts src/environments/environment.ts
cp src/environments/environment.example.ts src/environments/environment.prod.ts

# Upravte súbory a doplňte vaše Supabase credentials
```

3. **Spustite aplikáciu:**

```bash
npm run dev
```

Aplikácia bude dostupná na `http://localhost:3000`

## 🗄️ Nastavenie Supabase

### 1. Vytvorte nový Supabase projekt

1. Prejdite na [https://supabase.com](https://supabase.com)
2. Vytvorte nový projekt
3. Počkajte na inicializáciu databázy

### 2. Spustite setup SQL skript

1. V Supabase dashboard prejdite do **SQL Editor**
2. Otvorte súbor `supabase/setup.sql` z tohto repozitára
3. Skopírujte celý obsah a spustite ho v SQL Editor
4. Overte, že všetky tabuľky boli vytvorené

### 3. Vytvorte prvého používateľa

1. V Supabase dashboard prejdite do **Authentication** > **Users**
2. Kliknite na **Add user** > **Create new user**
3. Zadajte email a heslo
4. Po vytvorení skopírujte UUID používateľa

### 4. Nastavte rolu používateľa

V SQL Editor spustite:

```sql
-- Aktualizujte UUID na ID vášho používateľa
UPDATE public.profiles
SET role = 'Administrator'
WHERE id = 'your-user-uuid-here';
```

### 5. Získajte API credentials

1. V Supabase dashboard prejdite do **Settings** > **API**
2. Skopírujte:
   - **Project URL** (napr. `https://xxxxx.supabase.co`)
   - **anon public** key

### 6. Aktualizujte environment súbory

V `src/environments/environment.ts` a `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: false, // true pre production
  supabase: {
    url: "https://your-project-id.supabase.co",
    anonKey: "your-anon-key-here",
  },
};
```

## 📦 Deployment na GitHub Pages

### 1. Povoľte GitHub Pages v repozitári

1. Prejdite do **Settings** > **Pages**
2. V sekcii **Source** vyberte **GitHub Actions**

### 2. Nastavte GitHub Secrets (pre produkčné environment)

1. Prejdite do **Settings** > **Secrets and variables** > **Actions**
2. Pridajte tieto secrets:
   - `SUPABASE_URL`: vaša Supabase project URL
   - `SUPABASE_ANON_KEY`: váš Supabase anon key

### 3. Upravte repository name v package.json

V `package.json` upravte `--base-href` v build scripte:

```json
{
  "scripts": {
    "build": "ng build --configuration production --base-href=/REPOSITORY_NAME/"
  }
}
```

Nahraďte `REPOSITORY_NAME` názvom vášho GitHub repozitára.

### 4. Push do main branch

GitHub Actions automaticky zbuilduje a deployuje aplikáciu:

```bash
git add .
git commit -m "Setup deployment"
git push origin main
```

Aplikácia bude dostupná na: `https://your-username.github.io/REPOSITORY_NAME/`

## 🔒 Bezpečnosť

### ✅ Implementované bezpečnostné opatrenia:

1. **Supabase Auth** - profesionálna autentifikácia
2. **Row Level Security (RLS)** - každý používateľ vidí len to, čo môže
3. **Role-based Access Control** - tri úrovne oprávnení:
   - **Administrator**: plný prístup
   - **Revizor**: môže pridávať a upravovať náradia a revízie
   - **Užívateľ**: len prehliadanie
4. **Environment variables** - citlivé dáta nie sú v kóde
5. **Supabase RLS policies** - ochrana na úrovni databázy

### 🔑 Dôležité:

- **NIKDY** necommitujte `environment.ts` súbory s reálnymi credentials
- Credentials sú v `.gitignore`
- Pre produkciu používajte GitHub Secrets alebo Supabase Environment Variables
- Supabase anon key je bezpečný pre verejné použitie (chránený RLS)

## 👥 Používateľské role

### Administrator

- Plný prístup k všetkým funkciám
- Správa používateľov
- Pridávanie/úprava/mazanie náradia
- Pridávanie/úprava revízií

### Revizor

- Pridávanie nového náradia
- Úprava existujúceho náradia
- Pridávanie a úprava revízií
- Prehliadanie všetkých záznamov

### Užívateľ

- Prehliadanie záznamov náradia
- Prehliadanie revízií
- Export do PDF/CSV

## 📊 Funkcie aplikácie

- ✅ Evidencia náradia a elektrospotrebičov
- ✅ Správa kontrol a revízií
- ✅ Automatický výpočet termínov ďalších kontrol
- ✅ QR kódy pre rýchly prístup
- ✅ Export do PDF (protokoly) a CSV
- ✅ Štatistiky a prehľady
- ✅ Pokročilé filtrovanie a vyhľadávanie
- ✅ Synchronizácia dát v reálnom čase
- ✅ Offline režim (localStorage fallback)

## 🛠️ Technológie

- **Angular 21** - moderný frontend framework
- **Supabase** - backend as a service (PostgreSQL)
- **Tailwind CSS** - styling
- **TypeScript** - type safety
- **GitHub Actions** - CI/CD
- **GitHub Pages** - hosting

## 📝 Licencia

Private - For internal company use only

## 🤝 Podpora

Pre problémy alebo otázky vytvorte issue v GitHub repozitári.

---

**Poznámka**: Táto aplikácia je určená pre firemné nasadenie a obsahuje citlivé dáta. Uistite sa, že dodržiavate bezpečnostné postupy a nezdieľate prístupové údaje.
