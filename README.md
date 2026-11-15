# Ernähri 🥘

Wochenplan-Kochassistent auf Basis von **Migusto**, **Betty Bossi** und **FOOBY** (Rezepte)
sowie **Migros** (Produkte & Preise).

Der Assistent führt durch einen Wizard – Personenanzahl → Kochtage (Mo–So) → Budget → optionale
Präferenzen – und erstellt daraus einen Wochenplan samt Einkaufsliste mit echten Migros-Preisen in CHF.
Einzelne Gerichte lassen sich austauschen oder löschen, die ganze Woche neu generieren. Die Einkaufsliste
lässt sich kopieren, drucken oder per Klick in die Bring!-App übertragen (optional, siehe
[Konfiguration](#einkaufsliste-nach-bring-senden-optional)). Die Rezepte
werden automatisch aus allen drei Quellen gemischt; Produkte, Preise und Einkaufsliste kommen immer
von Migros.

## Schnellstart

```bash
npm install
npm run dev      # http://localhost:3000
```

Weitere Skripte: `npm run build`, `npm run start`, `npm run lint`.

## Wie es funktioniert

```
Wizard (Client) ──► Server Actions ──► Planner ──► Rezeptquellen (Migusto / Betty Bossi / FOOBY)
                                   └─► Einkaufsliste + Budget ──► Migros (Preise)
```

| Schritt | Datei | Aufgabe |
| --- | --- | --- |
| Kandidaten (Migusto) | `lib/migusto/catalog.ts` | liest `/de/rezept-uebersicht/<taxonomie>?page=N`, zieht die Rezept-Links aus dem HTML |
| Kandidaten (Betty Bossi) | `lib/bettybossi/sitemap.ts` | liest `sitemap-recipe-de.xml` (~7 400 Rezepte) |
| Kandidaten (FOOBY) | `lib/fooby/sitemap.ts` | liest `sitemap.xml` (~8 400 Rezepte) |
| Registry | `lib/recipes/registry.ts` | verteilt Detail-Fetches an die Quelle eines Rezepts, hält Quellen-Metadaten |
| Rezeptdaten (Migusto) | `lib/migusto/recipe.ts` + `flight.ts`, `listing.ts`, `recipe-parse.ts` | parst schema.org JSON-LD **und** den React-Server-Component-Payload: Zutaten mit Mengen/Einheiten, Portionsgrössen, Migros-Produkt-IDs |
| Rezeptdaten (Betty Bossi / FOOBY) | `lib/bettybossi/recipe.ts`, `lib/fooby/recipe.ts`, `lib/recipes/jsonld.ts` | parst schema.org JSON-LD (`recipeIngredient`-Textzeilen über `lib/recipes/ingredient-text.ts`) |
| Produkte & Preise | `lib/migros/client.ts` | `api.migros.ch/migros/products/v1/public/products` (Name, CHF-Preis, Kategorie, Bild, Link) |
| Preis-Lücken | `lib/migros/search.ts` | Textsuche (`?search=`) für Zutaten ohne verlinktes Produkt (u. a. alle BB-/FOOBY-Zutaten) |
| Zusammenführung | `lib/migros/match.ts` | Zutaten ↔ Produkte über Namensähnlichkeit (inkl. „X oder Y“-Varianten) |
| Plan | `lib/planner/*` | deterministische Auswahl (Seed), Abwechslung, Quellen-Mix, Budgetkorrektur, Tausch/Löschen/Neu |
| Einkaufsliste | `lib/shopping/*` | Zutaten auf Personen skalieren, gleiche Produkte zusammenfassen, nach Migros-Kategorien gruppieren, Vorratsposten separat |
| Bring!-Export | `lib/bring/*` | Positionen (Label + Menge) über die Bring!-API in eine Bring!-Liste übertragen |

## Datenquellen (live geprüft)

- **Rezepte (Migusto):** `https://migusto.migros.ch/de/rezept-uebersicht/…` und `/de/rezepte/<slug>/<id>`
  (JSON-LD `Recipe` + eingebetteter Payload mit strukturierten Zutaten, `isShoppingListRelevant`,
  Portions- und Migros-Produkt-IDs).
- **Rezepte (Betty Bossi):** Katalog aus `https://www.bettybossi.ch/sitemap-recipe-de.xml`, Rezeptseiten
  `/de/rezepte/rezept/<slug>-<id>/` mit JSON-LD `Recipe` (`recipeIngredient` als Textzeilen).
- **Rezepte (FOOBY):** Katalog aus `https://fooby.ch/sitemap.xml` (~5 MB), Rezeptseiten
  `/de/rezepte/<id>/<slug>` mit JSON-LD `Recipe`. Es werden nur die (in `robots.txt` erlaubten) Sitemaps
  genutzt; der von FOOBY per `robots.txt` gesperrte Suchfeed `hawaii_search.sri` wird **nicht** verwendet.
- **Produkte/Preise:** ausschliesslich `https://api.migros.ch/migros/products/v1/public/products?ids=…|search=…&lang=de`
  mit Header `x-api-key`. Das ist derselbe öffentliche Client-Key, den Migusto auf seinen Rezeptseiten
  für das Widget „Zutaten in deiner Migros“ mitliefert. Betty Bossi und FOOBY liefern keine
  Produkt-IDs, deren Zutaten werden daher über die Migros-Textsuche einem Produkt zugeordnet.

### Konfiguration (optional)

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `MIGROS_API_KEY` | Key für `api.migros.ch` | öffentlicher Migusto-Client-Key |
| `MIGROS_API_URL` | Basis-URL der Produkt-API | `https://api.migros.ch` |
| `MIGUSTO_USER_AGENT` | User-Agent für Migusto-Requests | aktueller Chrome-UA |
| `BETTYBOSSI_USER_AGENT` | User-Agent für Betty-Bossi-Requests | aktueller Chrome-UA |
| `FOOBY_USER_AGENT` | User-Agent für FOOBY-Requests | aktueller Chrome-UA |
| `BRING_EMAIL` | E-Mail des Bring!-Kontos (aktiviert den Export) | – (Export aus) |
| `BRING_PASSWORD` | Passwort des Bring!-Kontos | – |
| `BRING_LIST_NAME` | Ziel-Liste in Bring!, wird beim Senden angelegt, wenn sie fehlt | `Ernähri` |
| `BRING_API_URL` | Basis-URL der Bring!-API | `https://api.getbring.com/rest/v2` |
| `BRING_API_KEY` | Client-Key der Bring!-API | öffentlicher Web-App-Key |
| `BRING_COUNTRY` | Ländercode für Bring! | `CH` |
| `BRING_CLIENT` | Client-Kennung (`webApp` oder `android`) | `webApp` |

`.env.local` anlegen, z. B. `MIGROS_API_KEY=…` (Dateien mit `.env*` sind gitignored).

### Einkaufsliste nach Bring! senden (optional)

Sind `BRING_EMAIL` und `BRING_PASSWORD` gesetzt, zeigt die Einkaufsliste den Button
**„Nach Bring! senden“**:

- Der Name jeder Position wird zum Bring!-Artikel, die berechnete Menge (`amountText`) landet als
  Mengenangabe unter dem Artikel – der Mengenrechner in Bring! bleibt unberührt.
- Standardmässig werden nur **offene** (nicht abgehakte) Positionen übertragen, und der Block
  *Vorrat & Gewürze* bleibt aussen vor; beides lässt sich im Panel umschalten.
- Artikel, die schon auf der Bring!-Liste stehen, werden übersprungen (Namensvergleich), damit
  mehrfaches Senden keine Duplikate erzeugt.
- Ohne `BRING_LIST_NAME` wird die (deutsche) Standardliste `Ernähri` beim ersten Senden angelegt.
  Mit mehreren Listen im Konto erscheint eine Listenauswahl, die in `localStorage` gemerkt wird.
- Die Zugangsdaten bleiben ausschliesslich serverseitig; an den Browser gehen nur Listenname und
  Listen-UUID. `GET /api/diag` prüft die Verbindung (`bring`-Block).

> **Hinweis:** Genutzt wird die *inoffizielle* Bring!-API von `api.getbring.com`
> (kein offizieller Support, kann sich jederzeit ändern; dieses Projekt steht in keiner Verbindung
> zu Bring! Labs AG). Der Login ist passwortbasiert – Konten, die über Google/Apple erstellt wurden,
> haben kein Passwort und funktionieren hier nicht.

### Hinweise zu den neuen Quellen

- **Nur Hauptgerichte:** Ein Rezept kommt nur in den Plan, wenn die Quelle es selbst als Hauptgang
  ausweist (Migusto und FOOBY `Hauptgericht`, Betty Bossi `Hauptspeise`). Desserts, Gebäck, Getränke,
  Vor- und Beilagen werden verworfen. Da Betty Bossi und FOOBY keine Hauptgang-Taxonomie liefern,
  werden dafür einmal pro Cache-Periode Kandidaten klassifiziert und nur die Hauptgerichte behalten
  (`lib/recipes/registry.ts` → `listMainDishRefs`, Filter in `lib/recipes/main-dish.ts`).
- **Präferenzen:** Migusto filtert über Taxonomien. Betty Bossi und FOOBY liefern keine Taxonomien,
  deshalb werden deren Rezepte nach dem Laden anhand des geparsten Rezepts gefiltert. Bei *vegetarisch*
  bzw. *vegan* werden unsichere Rezepte ausgeschlossen (kein Fleischrisiko), was den Mix bewusst in
  Richtung Migusto verschiebt.
- **Zutaten:** Betty Bossi und FOOBY liefern Zutaten nur als Textzeilen (inkl. Brüchen wie „1 ½ kg“).
  Der Parser `lib/recipes/ingredient-text.ts` wandelt sie in Mengen um; dadurch kann eine
  Einkaufslisten-Position als *Schätzung* ausgewiesen sein.
- **Höflichkeit:** FOOBY setzt `Crawl-delay: 10`. Sitemaps und Rezeptdaten werden über Next.js
  `use cache` (mehrere Tage) sowie die Migration-Caches gecacht, Detail-Fetches sind begrenzt.

## Robustheit

- **Preis-API nicht erreichbar:** zuerst frischer Disk-Cache, dann Live-API, dann veraltete Cache-Werte,
  zuletzt eine Kurzliste mit Richtpreisen (`lib/migros/fallback-prices.ts`). Betroffene Zeilen sind in der
  UI als *Schätzung* bzw. *Schätzpreis* markiert, dazu erscheint ein Hinweis.
- **Cache:** `data/cache/*.json` (Produkte, Preissuche) – 12 Stunden gültig, gitignored.
- **Rezept-Cache:** Next.js Cache Components (`use cache` + `cacheLife`/`cacheTag`).
- **Pläne:** liegen im Browser (`localStorage`), inklusive abgehakter Einkaufslisten-Positionen.

## Diagnose

`GET /api/diag` (optional mit `?id=<recipeId>&slug=<slug>`) prüft in einem Rutsch: Katalog, Rezeptparser,
Produkt-/Preis-API und Zutaten-Matching:

```bash
curl "http://localhost:3000/api/diag"
```

## Kostensemantik

- Pro Gericht: Summe der Migros-Richtpreise der kleinsten Packung der Zutaten (ohne Vorratsposten).
- Einkaufsliste: identische Produkte über alle Gerichte zusammengefasst, Vorrat & Gewürze separat
  (`Vorrat & Gewürze`) und nur einmal gerechnet.
- „Geschätzte Summe“ = was an der Kasse ungefähr anfällt; das Budget im Wizard bezieht sich darauf.

## Deployment (Docker)

Das Image ist eigenständig (`output: "standalone"`) und enthält nur den Next.js-Server, die statischen
Assets und `public/` – kein `node_modules`, keine Quelldateien.

### Image bauen und starten

```bash
docker build -t ernaehri .
docker run --rm -p 3000:3000 -v ./data:/app/data ernaehri   # → http://localhost:3000
```

Oder über Compose (baut lokal oder nutzt das veröffentlichte Image):

```bash
docker compose up --build                   # aus den lokalen Quellen bauen
docker compose pull && docker compose up    # ghcr.io/aytee77/ernaehri:latest
```

### Veröffentlichtes Image

`.github/workflows/docker-publish.yml` baut bei jedem Push auf `master`, bei Tags `v*.*.*` und manuell
(`workflow_dispatch`) ein Multi-Arch-Image (`linux/amd64`, `linux/arm64`) und schiebt es nach GitHub
Container Registry:

```bash
docker run --rm -p 3000:3000 -v ./data:/app/data ghcr.io/aytee77/ernaehri:latest
```

Tags: `latest` (Standardbranch), `master`, `sha-<kurz>` sowie `{{version}}` und `{{major}}.{{minor}}`,
sobald ein `v*.*.*`-Tag existiert.

### Konfiguration

Alle Variablen aus [Konfiguration](#konfiguration-optional) sind optional und werden zur Laufzeit
gelesen – dasselbe Image lässt sich also in mehreren Umgebungen verwenden. Secrets (`BRING_EMAIL`,
`BRING_PASSWORD`, `MIGROS_API_KEY`) werden **nicht** ins Image gebacken:

```bash
docker run --rm -p 3000:3000 --env-file .env.local ghcr.io/aytee77/ernaehri:latest
```

`.env.example` listet alle Variablen auf (`cp .env.example .env.local`).

### Laufzeit-Daten & Neustarts

Zwei Pfade schreibt der Container zur Laufzeit; beide sind in `docker-compose.yml` als **Bind-Mounts**
in das Projektverzeichnis gelegt – es gibt also keine Docker-Volumes:

| Host (neben `docker-compose.yml`) | Im Container | Inhalt |
| --- | --- | --- |
| `./data` | `/app/data` | Migros-Produkte/-Preise (`data/cache/*.json`, 12 h TTL) – dasselbe Verzeichnis, das `npm run dev` nutzt |
| `./next-cache` | `/app/.next/cache` | Next.js-Server-Cache (`use cache`, ISR) – bewusst getrennt vom lokalen `.next/` |

**Rechte (Linux):** Bind-Mounts bekommen von Docker **nicht** die Rechte aus dem Image, sondern es gelten
die Rechte des Host-Verzeichnisses. Der Container läuft als `uid/gid 1001`, deshalb vor dem ersten Start:

```bash
mkdir -p data/cache next-cache
sudo chown -R 1001:1001 data next-cache
```

Auf Docker Desktop (Windows/macOS) ist der Zugriff über die Ordnerfreigabe geregelt und meist permissiv;
dort entstehen die Verzeichnisse beim ersten Start automatisch. Mit SELinux (RHEL/Fedora) zusätzlich `:Z`
anhängen, z. B. `- ./data:/app/data:Z`.

Die Daten liegen damit als normale Dateien im Projektordner (`data/cache/products.json`), sind direkt
sicherbar und wandern zusammen mit der Compose-Datei auf einen anderen Server. `docker compose down`
lässt sie stehen; `docker compose down -v` greift nicht mehr, weil keine Volumes existieren.

Braucht der Container die Verzeichnisse nicht, kann man die Mounts auch weglassen: `lib/migros/cache.ts`
verschluckt Schreibfehler bewusst und Next.js legt seinen Cache neu an – es fehlt dann nur der warme Cache.
Ein reines `docker run` ohne `-v` persistiert nichts; das Image deklariert bewusst kein `VOLUME`. Die
Pläne selbst liegen im Browser (`localStorage`), der Container ist daher zustandslos.

### Betriebshinweise

- **Reverse Proxy empfohlen:** Für Streaming (Suspense/PPR) beim Proxy `X-Accel-Buffering: no` setzen
  und Timeouts grosszügig wählen – FOOBY gibt `Crawl-delay: 10` vor, ein kalter Wochenplan kann daher
  mehrere Sekunden dauern.
- **Healthcheck:** Der Container prüft `GET /`. `GET /api/diag` ist eine Diagnose (externe APIs) und
  nicht als Liveness-Probe gedacht.
- **Mehrere Instanzen:** Wären zusätzlich `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (identisch auf allen
  Instanzen), ein `deploymentId` und ein gemeinsamer `cacheHandlers`-Backend nötig. Für eine
  Einzelinstanz nicht erforderlich.
- **Build braucht Netz:** `next/font/google` lädt die Geist-Schriften zur Buildzeit.

Rezepte und Produktdaten: © Migusto / Migros. Dieses Projekt ist privat und steht in keiner Verbindung
zu Migros.
