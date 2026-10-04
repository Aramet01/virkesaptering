VIRKESAPTERING – PWA FÖR IPHONE
Version 2.1

Vad paketet innehåller
----------------------
index.html             Appens gränssnitt
app.js                 iPhone/webb-logik och lokal lagring
logic.js               Apterings-, pris- och barkberäkningar
styles.css             Utseende
manifest.webmanifest   Gör appen installerbar som webbapp
service-worker.js      Offline-cache
icons/                 Appikoner

Viktigt: PWA måste ligga på en HTTPS-adress
-------------------------------------------
Safari installerar webbappen korrekt när den körs från en säker webbplats (HTTPS).
Det räcker därför inte att bara öppna index.html direkt från appen Filer.

En enkel publiceringsväg är GitHub Pages:
1. Skapa ett konto på github.com om du inte redan har ett.
2. Skapa ett nytt repository, exempelvis "virkesaptering".
3. Ladda upp ALLA filer och mappen icons från detta paket till repositoryts rot.
4. Öppna Settings > Pages.
5. Välj Deploy from a branch, branch "main" och mappen "/ (root)".
6. GitHub visar därefter en HTTPS-adress till appen.

Installera på iPhone
--------------------
1. Öppna den publicerade HTTPS-adressen i Safari.
2. Tryck på Dela-knappen.
3. Välj "Lägg till på hemskärmen".
4. Välj "Öppna som webbapp" om alternativet visas.
5. Lägg till.
6. Öppna appen en gång medan du har internet. Därefter är appfilerna cachade för offlinebruk.

Användning
----------
1. Välj tall eller gran och kvalitetsklass.
2. Ange hela stammens längd.
3. Skapa mätpunkter var 1 m eller 2 m, eller lägg in egna.
4. Klava diametern UTANPÅ BARK vid mätpunkterna och fyll i mm.
5. Välj massavedskvalitet (prima/sekunda) och ange transportavståndet i km till mottagande industri om du vill räkna transportavdrag.
6. Tryck "Aptera hela stammen".
7. Appen visar timmer och massaved separat, med längder, kapmått, volym och uppskattat värde.

Mät- och prisregler i version 2.0
---------------------------------
- Prislista: Norra Skog NS46-01, giltig från 2026-04-20 för bland annat Vindeln.
- Tillåtna prislistelängder: 340, 370, 400, 430, 460, 490, 520 och 550 cm.
- Normalt sågtimmer: minst 140 mm toppdiameter under bark i kalkylen.
- 120–139 mm under bark kan valfritt räknas som underdimension till 360 kr/m³fub.
- Maxdiameter: 600 mm under bark på stockens grövsta del.
- Tall- och granpriser samt längdkorrektioner är inlagda från NS46-01.
- Barrmassaved prima: 410 kr/m³fub. Sekunda: 360 kr/m³fub.
- Massaved: 2,90–5,70 m, min 50 mm ub, max 700 mm ub.
- Appen planerar massaved i 10 cm steg.
- Transportavdrag för massaved räknas automatiskt som 0,35 kr/m³fub per km, högst 80 kr/m³fub. Du anger km; 0 visar baspriset före transportavdrag.
- Vid värdeoptimering jämförs timmer och massaved längs hela stammen. Vid "flest timmerstockar" prioriteras först antalet normala timmerstockar och sedan totalvärdet.

Barkavdrag
----------
Appen använder Skogforsks barkfunktioner från 2004 (Björn Hannrup, Arbetsrapport 575)
för att uppskatta dubbel barktjocklek på skördarmätt tall och gran.

För tall används brösthöjdsdiameter, höjd från rotänden och latitud.
För gran används brösthöjdsdiameter och aktuell diameter på bark.
Standardlatituden i appen är 64,25° N, motsvarande cirka Vindeln.

Brösthöjdspunkten anges som avstånd FRÅN ROTSKÄRET. Standard är 1,10 m. Om trädet är
fällt på en annan stubbhöjd bör detta värde justeras så att punkten motsvarar 1,30 m över mark.

Noggrannhet / begränsningar
---------------------------
Appen är en FÄLTKALKYL och inte ersättningsgrundande virkesmätning.
Volymen uppskattas genom att integrera den skattade stamprofilen under bark i korta sektioner.
Slutlig diameter, kvalitet och m³fub bestäms vid den faktiska virkesmätningen.

Appen bedömer INTE automatiskt:
- röta
- krök
- kvistar/sprötkvistar
- insektsskador
- nedsmutsning
- andra kvalitetsfel
- specialsortiment

Källor
------
Norra Skog: Prislista NS46-01 (PDF tillhandahållen för appbygget).
Norra Skog: Enkla instruktioner för virkestillredning 2026:
https://www.norraskog.se/media/k3mnonm0/instruktioner-tillredning-virke-2026.pdf

Biometria: Nationella mätningsbestämmelser:
https://www.biometria.se/publikationer/maetningsinstruktioner/maetningsbestaemmelser/nationella-maetningsbestaemmelser/

Skogforsk, Björn Hannrup (2004): Funktioner för skattning av barkens tjocklek hos tall och gran vid avverkning med skördare, Arbetsrapport 575:
https://www.skogforsk.se/kunskapsbanken/kunskapsartiklar/2004/funktioner-for-skattning-av-barkens-tjocklek-hos-tall-och-gran-vid-avverkning-med-skordare/
