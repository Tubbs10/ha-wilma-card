# Wilma-kortti Home Assistantiin

Lapsen koulupäivä yhdellä silmäyksellä: lukujärjestys aikajanana, läksyt, kokeet,
Wilma-viestit, arvosanat ja kehut.

<p>
  <img src="docs/kortti-1.png" width="320" alt="Kortin yläosa: koulupäivä aikajanana ja läksyt">
  <img src="docs/kortti-2.png" width="320" alt="Kortin alaosa: viikkorivi, kokeet, huomiot, arvosanat ja kehut">
</p>

Kortti tarvitsee [ha-wilma](https://github.com/mniittymaki/ha-wilma)-integraation.
Asenna se ensin ja lisää Wilma-tilisi.

## Asennus

[![Avaa HACSissa](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Tubbs10&repository=ha-wilma-card&category=plugin)

1. Paina yllä olevaa nappia ja lisää repo HACSiin.
2. Paina **Lataa**.
3. Lataa selainsivu uudelleen.

<details>
<summary>Ilman HACSia</summary>

1. Lataa [uusimman julkaisun](https://github.com/Tubbs10/ha-wilma-card/releases/latest) lähdekoodi ja kopioi
   `dist/`-hakemiston tiedostot HA:n hakemistoon `/config/www/wilma-card/`.
2. **Asetukset → Dashboardit → ⋮ → Resurssit → Lisää resurssi**:
   `/local/wilma-card/wilma-card.js`, tyyppi **JavaScript-moduuli**.
3. Lataa selainsivu uudelleen. Päivityksen jälkeen lisää osoitteen perään esimerkiksi `?v=2`,
   jotta selain hakee uuden version.

</details>

## Käyttö

1. Avaa dashboard muokkaustilaan ja paina **Lisää kortti**.
2. Valitse **Wilma**.
3. Valitse lapsi.

Yhden lapsen perheessä kortti löytää lapsen itse. Useammalle lapselle lisätään oma kortti
jokaiselle.

## Asetukset

Kaikki asetukset ovat valinnaisia. Kaksi ensimmäistä löytyvät kortin editorista, loput
lisätään YAML-näkymässä.

| Asetus | Selitys |
|---|---|
| `device` | Lapsi. Valitaan editorin pudotusvalikosta. |
| `title` | Teksti otsikon yläpuolella. Oletus on lapsen etunimi ja luokka. |
| `child` | Lapsen nimi tekstinä `device`-asetuksen sijaan, esim. `Aino Esimerkki`. |
| `subjects` | Koulun omat ainekoodit, joita kortti ei tunnista valmiiksi. |
| `strip_suffixes` | Tunnisteet, jotka poistetaan tuntimerkinnän lopusta. |

```yaml
type: custom:wilma-card
child: Aino Esimerkki
subjects:
  KO: Kotitalous
strip_suffixes:
  - XYZ        # "Kotitehtävät tekemättä, XYZ" näkyy muodossa "Kotitehtävät tekemättä"
```

## Mitä kortti näyttää

- **Koulupäivä.** Koulupäivän aikana kuluva päivä, sen jälkeen seuraava koulupäivä.
  Tunnit ovat kestonsa korkuisia ja tauot näkyvät niiden väleinä. Käynnissä oleva tunti on merkitty.
- **Läksyt tänään.** Näkyy siihen asti, kun aineen tunti alkaa.
- **Läksyt huomiseksi** ja **myöhemmin.** Palautuspäivä on aineen seuraava tunti.
  Viikkorivillä neliö on läksy ja rengas koe.
- **Kokeet** kahden viikon sisällä ja päivät niihin.
- **Huomiot.** Lukemattomat Wilma-viestit, selvitettävät tuntimerkinnät, huomautukset ja
  tiedotteet. Osio näkyy, kun siinä on sisältöä.
- **Arvosanat** viimeiseltä viikolta ja **kehut**.

Keltavihreä korostus kertoo, mikä on seuraavaksi edessä. Muut värit tulevat Home Assistantin
teemasta, joten kortti toimii tummassa ja vaaleassa teemassa.

## Kehitys ja lisenssit

Testit: `node --test test/`. Kuvien data on keksittyä.

Koodi: [MIT](LICENSE). Otsikkofontti Bricolage Grotesque:
[SIL Open Font License 1.1](dist/bricolage-grotesque-OFL.txt). Fontti on mukana tiedostona,
joten kortti toimii ilman ulkoisia palvelimia.
