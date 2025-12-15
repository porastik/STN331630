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
- Export zoznamu do CSV súboru
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

## 📖 Návod pre rolu Revizor

### Prihlásenie

1. Otvorte aplikáciu v prehliadači
2. Zadajte váš email a heslo pridelené administrátorom
3. Kliknite na **Prihlásiť sa**

### Evidencia náradia

#### Pridanie nového spotrebiča

1. Po prihlásení kliknite na tlačidlo **+ Pridať nový spotrebič** vpravo hore
2. Vyplňte povinné údaje:
   - **Názov/Typ**: názov alebo typ zariadenia
   - **Výrobné číslo**: sériové číslo výrobcu
   - **Inventárne číslo**: interné číslo vašej organizácie
   - **Umiestnenie**: kde sa zariadenie nachádza
   - **Stav**: vyberte aktuálny stav (V prevádzke, V oprave, atď.)
3. Vyplňte doplňujúce informácie (voliteľné):
   - Výrobca
   - Dátum výroby / zaradenia do prevádzky
   - Poznámky
4. Kliknite na **Uložiť**
5. Zariadenie sa automaticky uloží a zobrazí v zozname

#### Úprava existujúceho spotrebiča

1. V zozname nájdite spotrebič, ktorý chcete upraviť
2. Kliknite na tlačidlo **Upraviť** (ikona ceruzky) v riadku spotrebiča
3. Upravte potrebné údaje vo formulári
4. Kliknite na **Uložiť zmeny**

### Správa revízií

#### Pridanie novej kontroly/revízie

1. V zozname nájdite spotrebič, ku ktorému chcete pridať kontrolu
2. Kliknite na tlačidlo **+ Pridať kontrolu** v riadku spotrebiča
3. Vyplňte údaje o kontrole:
   - **Typ kontroly**: výber podľa STN 33 1630
     - Predbežná prehliadka a skúška pred uvedením do prevádzky
     - Pravidelná prehliadka a skúška – ochrana
     - Pravidelná prehliadka a skúška – izolácia
     - Opravná prehliadka a skúška
     - Mimor. prehliadka a skúška
   - **Dátum vykonania**: kedy bola kontrola vykonaná
   - **Kontroloval**: meno osoby, ktorá vykonala kontrolu
   - **Výsledok kontroly**: Vyhovuje / Nevyhovuje
   - **Poznámky**: doplňujúce informácie o kontrole
4. Kliknite na **Uložiť**
5. Systém automaticky vypočíta termín ďalšej kontroly

#### Zobrazenie histórie kontrol

1. Kliknite na tlačidlo **📋 História** pri spotrebiči
2. Zobrazí sa kompletný zoznam všetkých vykonaných kontrol
3. Pre každú kontrolu vidíte:
   - Typ kontroly
   - Dátum vykonania
   - Kto vykonával
   - Výsledok
   - Poznámky

### Export dát

#### Export zoznamu do CSV

1. V hlavnom zozname spotrebičov kliknite na tlačidlo **📊 Exportovať zoznam do CSV**
2. Automaticky sa stiahne CSV súbor obsahujúci:
   - ID spotrebiča
   - Názov/Typ
   - Výrobné číslo
   - Inventárne číslo
   - Umiestnenie
   - Stav
   - Posledná kontrola
   - Ďalšia kontrola
3. CSV súbor môžete otvoriť v Exceli alebo inom tabuľkovom editore

#### Export do PDF (len administrátor)

- Funkcia exportu protokolov do PDF je dostupná len pre používateľov s rolou Administrátor
- Revizor môže požiadať administrátora o vytvorenie PDF protokolov

### Filtrovanie a vyhľadávanie

#### Filtrovanie podľa stavu

1. Použijte filter **Stav** nad zoznamom
2. Vyberte stav, ktorý chcete zobraziť:
   - Všetko
   - V prevádzke
   - V oprave
   - Vyradené
   - Odložené
3. Zoznam sa automaticky prefiltruje

#### Vyhľadávanie

1. Do poľa **🔍 Hľadať** zadajte hľadaný výraz
2. Môžete vyhľadávať podľa:
   - Názvu spotrebiča
   - Výrobného čísla
   - Inventárneho čísla
   - Umiestnenia
3. Zoznam sa automaticky aktualizuje

#### Filtrovanie podľa termínu kontroly

1. Použite filter **Ďalšia kontrola** nad zoznamom
2. Vyberte časové obdobie:
   - Všetko
   - Do 7 dní
   - Do 30 dní
   - Preč. termín
3. Systém zobrazí spotrebiče s blížiacim sa alebo prečerpaným termínom

### QR kódy

1. Každý spotrebič má vlastný QR kód
2. Kliknite na tlačidlo **QR** pri spotrebiči
3. Zobrazí sa QR kód, ktorý môžete:
   - Vytlačiť a nalepiť na zariadenie
   - Naskenovať mobilným telefónom pre rýchly prístup k záznamu
   - Použiť pre fyzické označenie zariadenia

### Štatistiky

- V hornej časti aplikácie vidíte prehľadné štatistiky:
  - **Celkový počet** spotrebičov v evidencii
  - **Aktívne** spotrebiče v prevádzke
  - **V oprave** - počet spotrebičov na oprave
  - **Vyradené** - počet vyradených spotrebičov
  - **Najbližšia kontrola** - dátum najbližšej plánovanej kontroly

### Dôležité informácie

- **Automatické ukladanie**: Všetky zmeny sa automaticky ukladajú do databázy
- **Synchronizácia**: Dáta sa synchronizujú v reálnom čase so serverom
- **Termíny kontrol**: Systém automaticky vypočíta termíny podľa typu kontroly a normy STN 33 1630
- **História**: Všetky zmeny sa zaznamenávajú a uchovávajú v histórii
- **Bezpečnosť**: Vidíte len údaje, ktoré máte oprávnenie vidieť podľa vašej roly

### Často kladené otázky

**Q: Čo robiť, ak sa mi nezobrazuje tlačidlo na pridanie spotrebiča?**  
A: Skontrolujte, či ste prihlásený s účtom s rolou Revizor alebo Administrátor. Užívatelia s rolou Užívateľ môžu len prezerať dáta.

**Q: Ako často treba vykonávať kontroly?**  
A: Frekvenciu určuje norma STN 33 1630. Systém automaticky vypočíta termín ďalšej kontroly na základe typu vykonanej kontroly.

**Q: Môžem upraviť už uloženú kontrolu?**  
A: Nie, kontroly po uložení nie je možné upravovať. Ide o overené záznamy s časovou pečiatkou. Pri chybe kontaktujte administrátora.

**Q: Čo znamenajú farebné označenia termínov?**  
A: 
- **Červená** - termín kontroly už prešiel
- **Oranžová** - termín kontroly je do 30 dní
- **Zelená** - termín kontroly je v poriadku

**Q: Ako exportovať dáta do Excelu?**  
A: Použite funkciu "Exportovať zoznam do CSV" - tento formát sa otvorí v Exceli.

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
