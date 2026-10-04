# Källor och implementerade regler – version 2.4

## Norra Skog NS46-01

Prislistan gäller från 2026-04-20 och omfattar bland annat Vindelns kommun.

### Tall – grundpris kr/m³fub

| Diameterklass mm | 140 | 160 | 180 | 200 | 220 | 240 | 260 | 280 | 300 | 400 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kvalitet 1 | 520 | 580 | 630 | 680 | 720 | 750 | 780 | 805 | 820 | 775 |
| Kvalitet 2 & 3 | 450 | 470 | 485 | 500 | 510 | 515 | 520 | 525 | 530 | 500 |
| Kvalitet 4 & 8 | 440 | 442 | 443 | 444 | 445 | 445 | 445 | 445 | 445 | 440 |

### Gran – grundpris kr/m³fub

| Diameterklass mm | 140 | 160 | 180 | 200 | 220 | 240 | 260 | 280 | 300 | 400 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kvalitet 1 | 450 | 480 | 505 | 525 | 540 | 555 | 570 | 585 | 590 | 550 |
| Kvalitet 2 & 8 | 440 | 442 | 444 | 446 | 448 | 448 | 448 | 448 | 448 | 440 |

### Längdkorrektion kr/m³fub

| Längd cm | 340 | 370 | 400 | 430 | 460 | 490 | 520 | 550 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Tall | -39 | -14 | -16 | +4 | 0 | +19 | +21 | +23 |
| Gran | -38 | -22 | -27 | +7 | 0 | +24 | +26 | +28 |

Övrigt implementerat:
- underdimension 120–139 mm: 360 kr/m³fub (valfritt i optimeringen)
- max 600 mm under bark på grövsta delen av timmerstock

### Barrmassaved

- Prima barrmassaved: 410 kr/m³fub
- Sekunda: avdrag 50 kr/m³fub, alltså 360 kr/m³fub
- Fallande längder: 29–57 dm
- Min diameter: 50 mm ub
- Max diameter: 700 mm ub
- Transportkostnad från avlägg till industri: 0,35 kr/m³fub och km, max 80 kr/m³fub
- Tall, gran och contorta får samsorteras i barrmassaved

Appen använder 10 cm planeringssteg för massaved inom intervallet 2,90–5,70 m. Detta är en appinställning för praktiska kapmått, inte ett ytterligare krav som anges i prislistan.

## Norra Skog – tillredningsinstruktion 2026

https://www.norraskog.se/media/k3mnonm0/instruktioner-tillredning-virke-2026.pdf

Anger bland annat timmerlängd minst 340 cm, maximalt 570 cm, kapning i 30-cm-moduler mellan 340 och 550 cm samt minst 14 cm under bark i topp och max 60 cm under bark på grövsta del.

## Barkfunktioner

Skogforsk, Björn Hannrup, 2004, Arbetsrapport 575:
https://www.skogforsk.se/kunskapsbanken/kunskapsartiklar/2004/funktioner-for-skattning-av-barkens-tjocklek-hos-tall-och-gran-vid-avverkning-med-skordare/

Barkfunktionerna returnerar dubbel barktjocklek i mm och används för att uppskatta diameter under bark från användarens klavning på bark.

## Biometria

Aktuella nationella mätningsbestämmelser:
https://www.biometria.se/publikationer/maetningsinstruktioner/maetningsbestaemmelser/nationella-maetningsbestaemmelser/

Biometria beskriver m³fub som stocks fastvolym under bark och stockmätning av sågtimmer som mätning av längd och diameter under bark. Toppdiameter i toppmätning mäts 10 cm från toppänden.

## Viktig avgränsning

Appen är inte ett ersättningsgrundande mätsystem. Den ger en fältuppskattning och en apteringsrekommendation utifrån inmatad stamprofil, valda kvalitetsklasser och prislistan. Version 2.4 jämför dimensionellt möjlig timmeraptering med barrmassaved och räknar transportavdrag från användarens angivna transportavstånd enligt 0,35 kr/m³fub och km, max 80 kr/m³fub. Kvalitetsfel som röta, krök, kvistfel eller nedsmutsning kan inte avgöras från klavmåtten och klassificeras därför inte automatiskt.


## Nytt i version 2.4

Version 2.4 ändrar inte pris- eller dimensionsreglerna. Den lägger till lokal lagring av flera stammar per avverkning, summering av sortiment/volym/värde samt CSV-export. Summeringen är en matematisk summering av appens redan beräknade fältuppskattningar.


## Nytt i version 2.4

Version 2.4 ändrar inte pris- eller dimensionsreglerna. Den separata stamlängdsrutan är borttagen. Trädets mätta stamlängd bestäms automatiskt av den sista kompletta mätpunkten och appen apterar aldrig längre än denna punkt. Diameterinmatningar görs i centimeter på bark och konverteras internt till millimeter före barkberäkning, diameterklassning och prisberäkning.
