# ⚠️ BEZPEČNOSTNÉ POZNÁMKY PRE DEPLOYMENT

## 🔐 Pred deploymentom

### 1. Environment Configuration

**NIKDY** necommitujte tieto súbory s reálnymi credentials:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`
- `.env.local`

Tieto súbory sú v `.gitignore` a zostanú lokálne.

### 2. Supabase Setup Checklist

- [ ] Vytvorený Supabase projekt
- [ ] Spustený `supabase/setup.sql` skript
- [ ] Row Level Security (RLS) je ENABLED na všetkých tabuľkách
- [ ] Vytvorený admin používateľ
- [ ] Nastavené správne role v `profiles` tabuľke
- [ ] Otestovaný prístup s rôznymi rolami

### 3. GitHub Pages Setup

- [ ] Repository je nastavený ako Private (pre firemné dáta)
- [ ] GitHub Pages sú povolené len pre authorized users
- [ ] Base-href v `package.json` je správne nastavený
- [ ] GitHub Actions majú správne permissions

### 4. Supabase RLS Policies

Overte, že sú aktívne tieto politiky:

**Profiles:**

- ✅ Users can view all profiles
- ✅ Users can update own profile
- ✅ Admins can update any profile

**Assets:**

- ✅ Anyone authenticated can view assets
- ✅ Admins and Revizors can insert assets
- ✅ Admins and Revizors can update assets
- ✅ Only Admins can delete assets

**Inspections:**

- ✅ Anyone authenticated can view inspections
- ✅ Admins and Revizors can insert inspections
- ✅ Admins and Revizors can update inspections
- ✅ Only Admins can delete inspections

### 5. Testovanie pred produkciou

```bash
# Build test
npm run build

# Overte že build je úspešný a dist/ folder obsahuje súbory
```

## 🔒 Bezpečnostné best practices

### Supabase

- Používajte **anon key** (nie service_role key) v aplikácii
- Service role key je len pre backend/admin operácie
- RLS policies sú vaša hlavná obrana
- Pravidelne kontrolujte audit logs

### GitHub

- Repository by malo byť **Private** pre firemné použitie
- Používajte GitHub Secrets pre citlivé dáta
- Povoľte branch protection na main branch
- Vyžadujte code review pred merge

### Aplikácia

- Všetky API volania idú cez Supabase (nie direct SQL)
- Client-side validácia + server-side RLS
- Session tokens sú automaticky spravované Supabase Auth
- localStorage je len backup/fallback

## 📋 Deployment Checklist

### Pre prvý deployment:

1. **Lokálne:**

   - [ ] `npm install` úspešný
   - [ ] `npm run dev` funguje
   - [ ] Login funguje s Supabase
   - [ ] CRUD operácie fungujú

2. **Supabase:**

   - [ ] Databáza je nastavená
   - [ ] RLS je enabled a testovaný
   - [ ] Admin user existuje
   - [ ] Email templates sú nastavené (voliteľné)

3. **GitHub:**

   - [ ] Repository je vytvorený
   - [ ] Secrets sú nastavené (ak používate)
   - [ ] GitHub Pages je povolený
   - [ ] `.gitignore` obsahuje environment súbory

4. **Produkcia:**
   - [ ] `npm run build` je úspešný
   - [ ] GitHub Actions deployment prešiel
   - [ ] Aplikácia je dostupná na GitHub Pages URL
   - [ ] Login funguje v produkcii
   - [ ] Testované všetky role

## 🚨 V prípade problémov

### Login nefunguje

- Overte Supabase credentials v environment súboroch
- Skontrolujte či je RLS enabled na profiles tabuľke
- Overte trigger `on_auth_user_created`

### Data sa nenačítavajú

- Skontrolujte browser konzolu pre chyby
- Overte RLS policies pre aktuálneho používateľa
- Testujte query v Supabase SQL Editor

### Deployment zlyhá

- Overte GitHub Actions logs
- Skontrolujte či `npm run build` funguje lokálne
- Overte base-href v package.json

## 📞 Kontakt

Pre kritické bezpečnostné problémy kontaktujte IT administrátora.

---

**Pamätajte:** Bezpečnosť je kontinuálny proces, nie jednorázová úloha.
