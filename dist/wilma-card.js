/*
 * Wilma-kortti Home Assistantiin (ha-wilma-integraation sensorit).
 *
 *   type: custom:wilma-card
 *   device: <lapsen laite>     # valitaan kortin editorissa; ilman asetusta ensimmäinen lapsi
 *   title: Oma otsikko         # valinnainen
 *   subjects:                  # valinnainen: koulun omat ainekoodit
 *     KO: Kotitalous
 *   strip_suffixes: [XYZ]      # valinnainen: tuntimerkinnän perästä poistettavat tunnisteet
 *   pinned:                    # valinnainen: kiinnitetyt viestit
 *     - subject: Liikunta      #   uusin viesti, jonka otsikossa on teksti (myös sender)
 *     - id: 1234567            #   yksittäinen viesti
 *
 * wilmaModel() on puhdas funktio (ei DOMia), jotta logiikkaa voi testata Nodessa:
 * ks. test/model.test.mjs.
 */

const VERSION = '1.0.0';

// Oppiaineet: [koodin alku tai sana nimessä, nimi]. Myöhempi osuma voittaa.
const KOODIT = [
  ['ENA', 'Englanti'], ['ENG', 'Englanti'], ['RU', 'Ruotsi'],
  ['MA', 'Matematiikka'], ['ÄI', 'Äidinkieli'], ['SUK', 'Äidinkieli'],
  ['YM', 'Ympäristöoppi'], ['BI', 'Biologia'], ['GE', 'Maantieto'],
  ['HI', 'Historia'], ['YH', 'Yhteiskuntaoppi'], ['MU', 'Musiikki'],
  ['KU', 'Kuvataide'], ['KS', 'Käsityö'], ['KÄ', 'Käsityö'], ['TS', 'Käsityö'],
  ['LI', 'Liikunta'], ['UE', 'Uskonto'], ['ET', 'Elämänkatsomustieto'],
  ['UEEL', 'Elämänkatsomustieto'], ['TUKI', 'Tukitunti'],
];
const SANAT = [
  ['matematiikka', 'Matematiikka'], ['äidinkieli', 'Äidinkieli'], ['englanti', 'Englanti'],
  ['ruotsi', 'Ruotsi'], ['ympäristö', 'Ympäristöoppi'], ['biologia', 'Biologia'],
  ['maantieto', 'Maantieto'], ['historia', 'Historia'], ['yhteiskunta', 'Yhteiskuntaoppi'],
  ['musiikki', 'Musiikki'], ['kuvataide', 'Kuvataide'], ['käsityö', 'Käsityö'],
  ['liikunta', 'Liikunta'], ['uskonto', 'Uskonto'], ['elämänkatsomus', 'Elämänkatsomustieto'],
  ['tukitunti', 'Tukitunti'],
];

const PV = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];
const PV_PITKA = ['maanantai', 'tiistai', 'keskiviikko', 'torstai', 'perjantai', 'lauantai', 'sunnuntai'];
const PV_KSI = ['maanantaiksi', 'tiistaiksi', 'keskiviikoksi', 'torstaiksi', 'perjantaiksi', 'lauantaiksi', 'sunnuntaiksi'];

// Huomautukseksi lasketaan tuntimerkintä, jossa on jokin näistä (pienillä kirjaimilla).
const HUOMAUTUSSANAT = ['tekemättä', 'unohtu', 'unohti', 'häiri', 'huomautus', 'moite', 'käytöks', 'et osallistunut', 'opiskeluvälineitä'];
const TUOREET_PV = 7; // arvosanat, huomautukset ja tiedotteet näin monelta päivältä
const KOKEET_LAHIAIKA_PV = 14;
const ENINTAAN = 5;
const VIIKKORIVIN_PAIVAT = 4;
const ESIKATSELU_RIVIT = 3; // viestin esikatselun rivit (sama kuin tyylin line-clamp)
const ESIKATSELU_MERKIT = 100; // tätä pidempi teksti ei varmasti mahdu kolmelle riville kapealla näytöllä

/* ---------- apufunktiot ---------- */

const SEP = ' · ';
const osat = (v) => String(v).split(SEP);

const OLETUSAINEET = { koodit: KOODIT, sanat: SANAT };

/** Oletusaineet + kortin asetuksen `subjects` ({KOODI: 'Nimi'}). Nimi tunnistetaan myös sanana. */
function ainelistat(lisat) {
  if (!lisat || typeof lisat !== 'object') return OLETUSAINEET;
  const parit = Object.entries(lisat).filter(([k, n]) => k && typeof n === 'string' && n.trim());
  return {
    koodit: [...KOODIT, ...parit.map(([k, n]) => [String(k), n.trim()])],
    sanat: [...SANAT, ...parit.map(([, n]) => [n.trim().toLowerCase(), n.trim()])],
  };
}

/** Aine tekstistä. known=false: nimi on teksti pilkkuun asti. */
function aine(teksti, al = OLETUSAINEET) {
  const raaka = String(teksti || '');
  const t = raaka.toLowerCase();
  let nimi = raaka.split(',')[0].trim();
  let known = false;
  for (const [k, n] of al.koodit) if (t.startsWith(k.toLowerCase())) { nimi = n; known = true; }
  for (const [k, n] of al.sanat) if (t.includes(k)) { nimi = n; known = true; }
  return { nimi, known };
}

/**
 * Kentät, joista ensimmäinen oppiaineelta näyttävä tulkitaan aineeksi (koodit vain
 * ISOILLA kirjaimilla). Aineen nimellä alkavat toistokentät jätetään pois.
 */
function erotaAine(kentat, al = OLETUSAINEET) {
  let aineNimi = '';
  const muut = [];
  for (const o of kentat) {
    const t = o.toLowerCase();
    let n = '';
    if (!aineNimi) {
      const eka = o.split(' ')[0];
      if (eka === eka.toUpperCase()) for (const [k, nimi] of al.koodit) if (t.startsWith(k.toLowerCase())) n = nimi;
      for (const [k, nimi] of al.sanat) if (t.includes(k)) n = nimi;
    }
    if (n) aineNimi = n;
    else if (!(aineNimi && t.startsWith(aineNimi.toLowerCase()))) muut.push(o);
  }
  return { aine: aineNimi, muut };
}

function mins(t) {
  const p = (String(t) + ':0').replace('.', ':').split(':');
  return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}

const paiva = (y, m, d) => new Date(y, m - 1, d, 12); // keskipäivä: kesäaika ei siirrä päivää
const lisaa = (d, n) => paiva(d.getFullYear(), d.getMonth() + 1, d.getDate() + n);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sama = (a, b) => !!a && !!b && iso(a) === iso(b);
const vp = (d) => (d.getDay() + 6) % 7; // 0 = maanantai
const isoVp = (d) => String(vp(d) + 1);
const erotus = (a, b) => Math.round((a - b) / 86400000);
const lyhyt = (d) => `${PV[vp(d)]} ${d.getDate()}.${d.getMonth() + 1}.`;

/** "2026-09-28…" -> Date, muuten null. */
function isoPaiva(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  if (!m) return null;
  const d = paiva(+m[1], +m[2], +m[3]);
  return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

/** Sensorin numeroidut attribuutit (lesson_1, lesson_2, …) numerojärjestyksessä. */
function rivit(tila, alku) {
  if (!tila || !tila.attributes) return [];
  return Object.entries(tila.attributes)
    .map(([k, v]) => [k.startsWith(alku) ? Number(k.slice(alku.length)) : NaN, v])
    .filter(([n]) => Number.isInteger(n))
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => String(v));
}

/* ---------- malli ---------- */

/**
 * @param {(rooli: string) => {state: string, attributes: object} | undefined} s
 *        sensorin tila roolin mukaan: 'tanaan', 'kaikki_laksyt', … (ks. ROOLIT)
 * @param {Date} nyt
 * @param {{subjects?: Record<string, string>, strip_suffixes?: string[], pinned?: Array<object|string>}} [asetukset]
 *        pinned: kiinnityssäännöt {subject?, sender?, id?}; merkkijono on sama kuin {subject}
 *        strip_suffixes: merkinnän perästä poistettavat tunnisteet, esim. "Kotitehtävät tekemättä, XYZ" -> ["XYZ"]
 */
function wilmaModel(s, nyt, asetukset = {}) {
  const al = ainelistat(asetukset.subjects);
  const tunnisteet = Array.isArray(asetukset.strip_suffixes) ? asetukset.strip_suffixes.map(String).filter(Boolean) : [];
  const tanaan = paiva(nyt.getFullYear(), nyt.getMonth() + 1, nyt.getDate());
  const nytMin = nyt.getHours() * 60 + nyt.getMinutes();
  const milloin = (d) => (sama(d, tanaan) ? 'tänään' : sama(d, lisaa(tanaan, 1)) ? 'huomenna' : lyhyt(d));

  /* Lukujärjestys. Viikko: "viikonpäivä · alku · loppu · aine · opettaja · luokka". */
  const viikko = rivit(s('seuraava_tunti'), 'lesson_').map(osat);
  let seur = null;
  for (let i = 1; i < 8 && !seur; i++) {
    const d = lisaa(tanaan, i);
    if (viikko.some((t) => t[0] === isoVp(d))) seur = d;
  }
  const tila = s('tanaan') ? String(s('tanaan').state) : '';
  const loppu = tila.includes(SEP) ? tila.split(SEP).pop() : '';
  const kesken = loppu !== '' && nytMin < mins(loppu);
  const nayta = kesken ? tanaan : seur;

  let raaka = [];
  if (kesken) raaka = rivit(s('tanaan'), 'lesson_').map(osat);
  else if (nayta) raaka = viikko.filter((o) => o[0] === isoVp(nayta)).map((o) => o.slice(1));
  // Luokka = viimeinen lisätieto, jossa on numero.
  const tunnit = raaka.map((o) => {
    let luokka = '';
    for (const x of o.slice(3)) if (/\d/.test(x)) luokka = x;
    const alkuT = o[0];
    const loppuT = o.length > 1 ? o[1] : '';
    return {
      alkuMin: mins(alkuT), loppuMin: mins(loppuT || alkuT), alku: alkuT, loppu: loppuT,
      aineRaaka: o.length > 2 ? o[2] : '', aine: aine(o.length > 2 ? o[2] : '', al).nimi, luokka,
    };
  }).sort((a, b) => a.alkuMin - b.alkuMin);

  // Tavallisin luokka näytetään kerran; tunnilla vain, jos se poikkeaa.
  const maarat = new Map();
  for (const t of tunnit) if (t.luokka) maarat.set(t.luokka, (maarat.get(t.luokka) || 0) + 1);
  let paaluokka = '';
  let paras = 0;
  for (const [x, n] of maarat) if (n > paras) { paaluokka = x; paras = n; }

  const nk = kesken ? tunnit.findIndex((t) => nytMin < t.loppuMin) : -1;
  tunnit.forEach((t, i) => {
    t.poikkeavaLuokka = t.luokka && t.luokka !== paaluokka ? t.luokka : '';
    t.tila = kesken && t.loppuMin <= nytMin ? 'ohi'
      : i === nk ? (t.alkuMin <= nytMin ? 'nyt' : 'seuraava') : '';
  });
  // Välit: tauko seuraavaan tuntiin minuutteina.
  tunnit.forEach((t, i) => {
    t.taukoMin = i + 1 < tunnit.length ? Math.max(0, tunnit[i + 1].alkuMin - t.loppuMin) : 0;
  });

  let paivanakyma = null;
  if (nayta && tunnit.length) {
    const huomenna = sama(nayta, lisaa(tanaan, 1));
    paivanakyma = {
      otsikko: sama(nayta, tanaan) ? 'Tänään' : huomenna ? 'Huomenna'
        : PV_PITKA[vp(nayta)][0].toUpperCase() + PV_PITKA[vp(nayta)].slice(1),
      paivays: sama(nayta, tanaan) || huomenna
        ? `${PV_PITKA[vp(nayta)]} ${nayta.getDate()}.${nayta.getMonth() + 1}.`
        : `${nayta.getDate()}.${nayta.getMonth() + 1}.`,
      tunteja: tunnit.length,
      kello: kesken && nytMin >= tunnit[0].alkuMin
        ? `päättyy ${tunnit[tunnit.length - 1].loppu}` : `alkaa ${tunnit[0].alku}`,
      luokka: paaluokka,
      paattyy: tunnit[tunnit.length - 1].loppu,
      tunnit,
    };
  }

  /* Kokeet: "2026-10-05 · ENA1 ENA109 · KPL 6 sanakoe". */
  const kokeet = rivit(s('seuraava_koe'), 'exam_').map((v) => {
    const o = osat(v);
    const d = isoPaiva(o[0]);
    return {
      paiva: d, ero: d ? erotus(d, tanaan) : 0, aine: aine(o.length > 1 ? o[1] : '', al).nimi,
      kuvaus: o.slice(2).join(SEP), paivays: d ? lyhyt(d) : o[0],
    };
  });
  const lahella = kokeet.filter((k) => k.ero >= 0 && k.ero <= KOKEET_LAHIAIKA_PV).sort((a, b) => a.ero - b.ero);
  const myohemmin = kokeet.filter((k) => k.ero > KOKEET_LAHIAIKA_PV).sort((a, b) => a.ero - b.ero);
  // Näytettävän päivän kokeet ja koulupäivän aikana myös seuraavan koulupäivän.
  const koepaivat = [nayta, kesken ? seur : null].filter(Boolean);
  const koeHalytykset = [];
  for (const k of kokeet) for (const d of koepaivat) if (sama(k.paiva, d)) koeHalytykset.push({ ...k, milloin: milloin(d) });

  /*
   * Läksyt. Palautuspäivä lasketaan itse: seuraava saman aineen tunti antopäivän jälkeen.
   * Jos ainetta ei tunnisteta, käytetään integraation vihjettä "lukujärjestys ENA1 ke 30.9. 10:30".
   */
  const ainepaivat = viikko.filter((t) => t.length > 3).map((t) => [t[0], aine(t[3], al)]).filter(([, a]) => a.known);
  const aktiiviset = new Set(rivit(s('aktiiviset_laksyt'), 'hw_').map((v) => osat(v).slice(0, 3).join(SEP)));
  const laksyt = { tanaan: [], seur: [], muut: [] };
  for (const v of rivit(s('kaikki_laksyt'), 'hw_')) {
    const kaikki = osat(v);
    // Irrota perästä integraation vihjeet: "tunti ohi", "lukujärjestys …", "ei lukujärjestysosumaa …".
    const o = [];
    let vihje = '';
    kaikki.forEach((x, i) => {
      if (i >= 2 && (x === 'tunti ohi' || x.startsWith('lukujärjestys') || x.startsWith('ei lukujärjestysosumaa'))) {
        if (x.startsWith('lukujärjestys')) vihje = x;
      } else o.push(x);
    });
    const ha = aine(o.length > 1 ? o[1] : '', al);
    const annettu = isoPaiva(o[0]);
    let era = null;
    let oma = false;
    if (ha.known && annettu) {
      const paivat = ainepaivat.filter(([, a]) => a.nimi === ha.nimi).map(([p]) => p);
      for (let i = 1; i < 15 && !era && paivat.length; i++) {
        const d = lisaa(annettu, i);
        if (paivat.includes(isoVp(d))) { era = d; oma = true; }
      }
    }
    if (!oma) {
      for (const t of vihje.split(' ')) {
        if ((t.match(/\./g) || []).length === 2 && /^\d+$/.test(t.replace(/\./g, ''))) {
          const [pp, kk] = t.split('.');
          let d = paiva(tanaan.getFullYear(), +kk, +pp);
          if (d < lisaa(tanaan, -180)) d = paiva(tanaan.getFullYear() + 1, +kk, +pp);
          era = d;
        }
      }
    }
    // Tänään palautettava läksy näkyy koulupäivän aikana siihen asti, kun aineen tunti alkaa.
    let alkuMin = null;
    let alkuTeksti = '';
    if (sama(era, tanaan)) {
      const tunti = kesken ? tunnit.find((t) => t.aine === ha.nimi) : null;
      if (tunti) { alkuMin = tunti.alkuMin; alkuTeksti = tunti.alku; }
      else {
        const klo = vihje.split(' ').find((t) => t.includes(':'));
        if (klo) { alkuMin = mins(klo); alkuTeksti = klo; }
      }
    }
    const jaljella = !sama(era, tanaan) || (kesken && (alkuMin === null || nytMin < alkuMin));
    const nakyy = jaljella && ((oma && era >= tanaan) || (!oma && aktiiviset.has(kaikki.slice(0, 3).join(SEP))));
    if (!nakyy) continue;
    const laksy = { aine: ha.nimi, teksti: o.slice(2).join(SEP), era, tunti: alkuTeksti };
    if (sama(era, tanaan)) laksyt.tanaan.push(laksy);
    else if (seur && sama(era, seur)) laksyt.seur.push(laksy);
    else laksyt.muut.push(laksy);
  }
  laksyt.tanaan.sort((a, b) => a.tunti.localeCompare(b.tunti));
  laksyt.muut.sort((a, b) => (a.era ? iso(a.era) : '9999').localeCompare(b.era ? iso(b.era) : '9999'));
  for (const l of laksyt.muut) l.milloin = l.era ? milloin(l.era) : 'päivä ei tiedossa';

  // Viikkorivi: seuraavan koulupäivän jälkeiset koulupäivät, läksyjen ja kokeiden määrä.
  const viikkorivi = [];
  if (laksyt.muut.length) {
    for (let i = 1; i < 15 && viikkorivi.length < VIIKKORIVIN_PAIVAT; i++) {
      const d = lisaa(seur || tanaan, i);
      if (!viikko.some((t) => t[0] === isoVp(d))) continue;
      viikkorivi.push({
        pv: PV[vp(d)], pvm: `${d.getDate()}.`,
        laksyja: laksyt.muut.filter((l) => sama(l.era, d)).length,
        kokeita: kokeet.filter((k) => sama(k.paiva, d)).length,
      });
    }
  }

  /* Huomiot. Kentät " · "-erotettuna, ensimmäinen on päivä tai aikaleima. */
  const raja = iso(lisaa(tanaan, -TUOREET_PV));
  const pvm = (p) => {
    const d = isoPaiva(p);
    if (!d) return p;
    return sama(d, tanaan) ? 'tänään' : sama(d, lisaa(tanaan, -1)) ? 'eilen' : lyhyt(d);
  };
  const kerää = (loppu2, alku2, vainTuoreet, taysi, piilota, hakusanat) => {
    const tulos = [];
    for (const v of rivit(s(loppu2), alku2)) {
      const pieni = v.toLowerCase();
      if (hakusanat.length && !hakusanat.some((h) => pieni.includes(h))) continue;
      let o = osat(v.replace(/^●\s*/, '')).map((x) => {
        for (const t of tunnisteet) if (x.endsWith(', ' + t)) return x.slice(0, -(t.length + 2));
        return x;
      });
      if (o.length === taysi) o = o.filter((_, i) => !piilota.includes(i));
      if (vainTuoreet && !(o[0].slice(0, 10) >= raja)) continue;
      tulos.push(o);
    }
    const avain = (o) => (isoPaiva(o[0]) ? o[0].slice(0, 10) : '');
    return tulos.sort((a, b) => avain(b).localeCompare(avain(a)));
  };
  const huomio = (o) => {
    const e = erotaAine(o.slice(1), al);
    return { aine: e.aine, teksti: e.muut.join(SEP), paivays: pvm(o[0]) };
  };
  const huomiot = [];
  const lisaaOsio = (otsikko, tyyppi, rivitL, yht) => {
    if (yht || rivitL.length) huomiot.push({ otsikko, tyyppi, rivit: rivitL.slice(0, ENINTAAN), yhteensa: Math.max(yht || 0, rivitL.length) });
  };
  lisaaOsio('Selvitä Wilmassa', 'virhe', kerää('selvittamattomat_tuntimerkinnat', 'item_', false, 5, [3], []).map(huomio));
  // Integraatio tuo otsikot vain 10 uusimmasta viestistä; sensorin tila on kaikkien lukemattomien määrä.
  const viestit = kerää('uudet_viestit', 'msg_', false, 0, [], ['●'])
    .map((o) => ({ aine: '', teksti: o[1] || '', lisatieto: o.slice(2).join(SEP), paivays: pvm(o[0]) }));
  lisaaOsio('Lukemattomat viestit', 'viesti', viestit, s('uudet_viestit') ? parseInt(s('uudet_viestit').state, 10) || 0 : 0);
  lisaaOsio('Huomautukset', 'varoitus', kerää('kaikki_tuntimerkinnat', 'item_', true, 6, [1, 4], HUOMAUTUSSANAT).map(huomio));
  lisaaOsio('Tiedotteet', 'tiedote', kerää('tiedote', 'news_', true, 0, [], []).map(huomio));

  /*
   * Kiinnitetyt viestit. Jokainen sääntö kiinnittää uusimman siihen sopivan viestin, joten
   * esim. viikoittainen viesti vaihtuu itsestään. Tunnisteet tulevat sensorin
   * messages-attribuutista; ilman sitä (vanhempi integraatio) käytetään msg_-rivejä.
   */
  const viestisensori = s('uudet_viestit');
  const viestilista = viestisensori && viestisensori.attributes && Array.isArray(viestisensori.attributes.messages)
    ? viestisensori.attributes.messages.map((v) => ({
      id: Number(v.id) || null, aika: String(v.timestamp || ''), otsikko: String(v.subject || ''),
      lahettaja: String(v.sender || ''), lukematon: !!v.unread,
    }))
    : rivit(viestisensori, 'msg_').map((v) => {
      const o = osat(v.replace(/^●\s*/, ''));
      return { id: null, aika: o[0] || '', otsikko: o[1] || '', lahettaja: o.slice(2).join(SEP), lukematon: /^●/.test(v) };
    });
  viestilista.sort((a, b) => b.aika.localeCompare(a.aika));
  const kiinnitetyt = [];
  // Kortista kiinnitetyt: integraatio säilyttää ne ja jakaa kaikille käyttäjille.
  const tallennetut = viestisensori && viestisensori.attributes && Array.isArray(viestisensori.attributes.pinned)
    ? viestisensori.attributes.pinned : [];
  for (const k of tallennetut) {
    const id = Number(k && k.id) || null;
    if (!id || kiinnitetyt.some((v) => v.id === id)) continue;
    // Listassa oleva viesti tietää lukutilan; listalta pudonnut näytetään tallennetuilla tiedoilla.
    const listassa = viestilista.find((v) => v.id === id);
    const v = listassa || { id, aika: String(k.timestamp || ''), otsikko: String(k.subject || ''), lahettaja: String(k.sender || ''), lukematon: false };
    v.irrotettava = true;
    kiinnitetyt.push(v);
  }
  for (const raaka of Array.isArray(asetukset.pinned) ? asetukset.pinned : []) {
    const ehto = typeof raaka === 'string' ? { subject: raaka } : (raaka || {});
    const id = Number(ehto.id) || null;
    const otsikossa = String(ehto.subject || '').trim().toLowerCase();
    const lahettajassa = String(ehto.sender || '').trim().toLowerCase();
    if (!id && !otsikossa && !lahettajassa) continue;
    const osuma = viestilista.find((v) => (!id || v.id === id)
      && (!otsikossa || v.otsikko.toLowerCase().includes(otsikossa))
      && (!lahettajassa || v.lahettaja.toLowerCase().includes(lahettajassa)));
    if (osuma && !kiinnitetyt.includes(osuma)) kiinnitetyt.push(osuma);
  }
  for (const v of [...viestilista, ...kiinnitetyt]) { v.paiva = isoPaiva(v.aika); v.paivays = pvm(v.aika); }
  const muutViestit = viestilista.filter((v) => !kiinnitetyt.includes(v));

  /* Arvosanat: "2026-09-28 · ENA1 ENA109 · 10 · KPL 5 sanakoe". */
  const arvosanat = kerää('arvosanat', 'grade_', true, 0, [], []).slice(0, ENINTAAN).map((o) => ({
    arvosana: o[2] || '', aine: aine(o[1] || '', al).nimi, kuvaus: o.slice(3).join(SEP), paivays: pvm(o[0]),
  }));

  /*
   * Kehut. Eriteltyinä sensorin notes-attribuutista (päivä, laji, aine, opettaja, teksti);
   * ilman sitä riveistä "2026-09-28 · tyyppi · aine · teksti" tai "LI09; teksti /Opettaja".
   */
  const maanantai = iso(lisaa(tanaan, -vp(tanaan)));
  const kehusensori = s('kehut');
  const eritellyt = kehusensori && kehusensori.attributes && Array.isArray(kehusensori.attributes.notes)
    ? kehusensori.attributes.notes : null;
  const kehut = eritellyt
    ? eritellyt.map((n) => {
      const a = aine(n.subject || '', al);
      return {
        otsikko: String(n.kind || n.text || ''), teksti: n.kind ? String(n.text || '') : '',
        aine: a.known ? a.nimi : String(n.subject || ''), opettaja: String(n.teacher || ''), paiva: isoPaiva(n.date),
      };
    })
    : rivit(kehusensori, 'item_').map((v) => {
      const o = osat(v);
      let kentat;
      let opettaja = '';
      if (isoPaiva(o[0])) kentat = o.length >= 4 ? o.slice(2) : o.slice(1);
      else {
        let teksti = v;
        const i = teksti.lastIndexOf(' /');
        if (i >= 0) { opettaja = teksti.slice(i + 2).trim(); teksti = teksti.slice(0, i); }
        const j = teksti.indexOf(';');
        kentat = j >= 0 ? [teksti.slice(0, j).trim(), teksti.slice(j + 1).trim()] : [teksti];
      }
      const e = erotaAine(kentat, al);
      return { otsikko: e.muut.join(SEP) || e.aine, teksti: '', aine: e.muut.length ? e.aine : '', opettaja, paiva: isoPaiva(o[0]) };
    });
  const kehujaViikolla = kehut.filter((k) => k.paiva && iso(k.paiva) >= maanantai).length;

  return {
    tanaan, kesken, seur,
    paiva: paivanakyma,
    koeHalytykset,
    laksyt,
    seurOtsikko: seur ? (sama(seur, lisaa(tanaan, 1)) ? 'huomiseksi' : `${PV_KSI[vp(seur)]} ${seur.getDate()}.${seur.getMonth() + 1}.`) : '',
    seurPaivays: seur ? lyhyt(seur) : '',
    viikkorivi,
    kokeet: { lahella, myohemmin },
    huomiot,
    kiinnitetyt,
    muutViestit,
    arvosanat,
    kehut: { rivit: kehut.slice(0, ENINTAAN), yhteensa: kehut.length, viikolla: kehujaViikolla },
  };
}

/* ---------- piirto ---------- */

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Wilman tekstissä rivinvaihdot ovat merkityksellisiä (tehtävälistat).
const rivitetty = (v) => esc(v).replace(/\s*\n\s*/g, '<br>');
const monikko = (n, yks, mon) => `${n} ${n === 1 ? yks : mon}`;
/** Viestin teksti: escapattu, ja vain http(s)-osoitteet linkeiksi. */
const linkitetty = (v) => esc(v).replace(/https?:\/\/[^\s<>"']+/g, (osoite) => {
  const loppu = (/(?:&amp;|&quot;|&#39;|[.,;:!?)\]])+$/.exec(osoite) || [''])[0];
  const url = loppu ? osoite.slice(0, -loppu.length) : osoite;
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${loppu}`;
});

const TYYLIT = `
:host { display: block; --w-hl: #D9F24B; --w-ink: #15170A; }
ha-card { background: none; border: none; box-shadow: none; padding: 6px 8px 16px; color: var(--primary-text-color); }
.sivu { display: flex; flex-direction: column; gap: 18px; font-size: 14px; line-height: 1.4; }
.sec { color: var(--secondary-text-color); }
.num { font-variant-numeric: tabular-nums; }
.disp { font-family: 'Bricolage Grotesque', var(--paper-font-body1_-_font-family, Roboto), sans-serif; font-weight: 700; letter-spacing: -0.02em; }
.hl { background: var(--w-hl); color: var(--w-ink); padding: 1px 6px; margin-left: -6px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.kisko { display: grid; grid-template-columns: 64px minmax(0, 1fr); column-gap: 14px; }
.kisko > :first-child { text-align: right; }

.paa { display: flex; flex-direction: column; gap: 4px; }
.paa h1 { margin: 0; font-size: 44px; letter-spacing: -0.03em; line-height: 1; }
.paa .ylä { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.paa .ylä b { font-size: 15px; font-weight: 500; }
.paa .tiedot { font-size: 13px; }

.jana { display: flex; flex-direction: column; }
.tunti .klo { font-size: 15px; font-weight: 500; line-height: 1; }
.tunti .palkki { background: var(--secondary-background-color); border-left: 3px solid var(--primary-text-color); padding: 9px 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; box-sizing: border-box; }
.tunti .palkki > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.tunti .aine { font-size: 16px; font-weight: 500; line-height: 1.1; }
.tunti .ajat, .tunti .luokka { font-size: 13px; }
.tunti .luokka { white-space: nowrap; }
.tunti.ohi { opacity: 0.45; }
.tunti.nyt .palkki { border-left-color: var(--w-hl); }
.tauko > div:last-child { border-left: 3px dotted var(--disabled-text-color, #777); padding-left: 12px; display: flex; align-items: center; font-size: 12px; }
.loppu { padding-top: 6px; font-size: 13px; }

.koe-halytys { font-size: 15px; font-weight: 500; }

h2 { margin: 0; font-size: 28px; line-height: 1.1; }
.otsikko { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; border-top: 1px solid var(--divider-color); padding-top: 18px; }
.otsikko span { font-size: 14px; white-space: nowrap; }
.lista { display: flex; flex-direction: column; gap: 16px; }
.lista.tiivis { gap: 14px; }

.era { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.15; }
.era small { font-size: 12px; }
.era b { font-size: 15px; font-weight: 500; }
.sis { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sis .nimi { font-size: 16px; font-weight: 500; }
.sis .teksti { font-size: 14px; line-height: 1.5; opacity: 0.85; overflow-wrap: anywhere; }
.sis .meta { font-size: 13px; }

.viikko { display: grid; border-right: 1px solid var(--divider-color); border-top: 1px solid var(--divider-color); border-bottom: 1px solid var(--divider-color); }
.viikko > div { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; border-left: 1px solid var(--divider-color); }
.viikko small { font-size: 12px; }
.viikko b { font-size: 20px; line-height: 1; }
.merkit { display: flex; gap: 4px; align-items: center; height: 10px; }
.nelio { width: 7px; height: 7px; background: var(--primary-text-color); }
.rengas { width: 6px; height: 6px; border: 2px solid var(--w-hl); border-radius: 50%; }
.selite { display: flex; gap: 14px; font-size: 12px; margin-top: -8px; }
.selite span { display: flex; align-items: center; gap: 5px; }

.koe { align-items: center; }
.koe .pv { display: flex; align-items: baseline; justify-content: flex-end; gap: 3px; }
.koe .pv b { font-size: 34px; line-height: 1; letter-spacing: -0.03em; }
.koe .pv b.hl { margin-left: 0; padding: 0 6px; }
.koe .pv small { font-size: 12px; }
.koe .pv .sana { font-size: 13px; font-weight: 500; }

.arvosana { align-items: center; }
.arvosana > b { font-size: 44px; line-height: 1; letter-spacing: -0.03em; }
.ryhma { font-size: 14px; font-weight: 500; }
.kiinni .viesti { font-size: 14px; line-height: 1.5; opacity: 0.85; white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 4px; }
.kiinni .viesti.supistettu { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.kiinni .viesti a { color: inherit; }
.kiinni .vastaus { border-left: 2px solid var(--divider-color); padding-left: 10px; margin-top: 10px; }
.kiinni .vastaus .meta { display: block; opacity: 1; white-space: normal; }
.kiinni .uusi { font-size: 12px; font-weight: 500; margin-left: 8px; }
.napit { display: flex; flex-wrap: wrap; column-gap: 18px; }
.virhe { font-size: 13px; }
button.linkki { background: none; border: 0; margin: 0; padding: 0; min-height: 44px; font: inherit; font-size: 14px; font-weight: 500; color: var(--primary-text-color); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; text-align: left; align-self: flex-start; }
button.linkki:focus-visible { outline: 2px solid var(--w-hl); outline-offset: 2px; }
.tyhja { font-size: 14px; }
`;

/**
 * @param {object} m      wilmaModelin tulos
 * @param {string} nimi   otsikon yläpuolen teksti
 * @param {{palvelu?: boolean, auki?: Set<number>, viestit?: Map<number, object>}} [ui]
 *        kortin tila: onko wilma.get_message käytössä, avatut viestit ja haetut sisällöt
 */
function piirra(m, nimi, ui = {}) {
  const auki = ui.auki || new Set();
  const haetut = ui.viestit || new Map();
  const h = [];
  const osio = (otsikko, oikea = '') => `<div class="otsikko"><h2 class="disp">${esc(otsikko)}</h2><span class="sec">${esc(oikea)}</span></div>`;
  const era = (d) => (d ? `<div class="era"><small class="sec">${PV[vp(d)]}</small><b class="num">${d.getDate()}.${d.getMonth() + 1}.</b></div>` : '<div></div>');
  const laksy = (l, kisko, korosta) => `<div class="kisko">${kisko}<div class="sis"><span class="nimi">${korosta ? `<span class="hl">${esc(l.aine)}</span>` : esc(l.aine)}</span><span class="teksti">${rivitetty(l.teksti)}</span></div></div>`;

  /* Otsikko ja aikajana */
  const p = m.paiva;
  if (p) {
    h.push(`<div class="paa"><div class="ylä"><span class="sec">${esc(nimi)}</span><b>${esc(p.paivays)}</b></div>
      <h1 class="disp">${esc(p.otsikko)}</h1>
      <span class="sec tiedot">${monikko(p.tunteja, 'tunti', 'tuntia')} · ${esc(p.kello)}${p.luokka ? ` · luokka ${esc(p.luokka)}` : ''}</span></div>`);
    const jana = [];
    for (const t of p.tunnit) {
      const kesto = Math.max(52, t.loppuMin - t.alkuMin);
      const merkki = t.tila === 'nyt' ? ' <span class="hl" style="margin-left:4px">nyt</span>' : t.tila === 'seuraava' ? ' <span class="sec" style="font-size:13px;font-weight:400">· seuraavaksi</span>' : '';
      jana.push(`<div class="kisko tunti ${t.tila}" style="min-height:${kesto}px"><div class="klo num">${esc(t.alku)}</div>
        <div class="palkki"><div><span class="aine">${esc(t.aine)}${merkki}</span><span class="ajat sec num">${esc(t.alku)}–${esc(t.loppu)}</span></div><span class="luokka sec">${esc(t.poikkeavaLuokka)}</span></div></div>`);
      if (t.taukoMin > 0) {
        jana.push(`<div class="kisko tauko" style="height:${Math.min(t.taukoMin, 60)}px"><div></div><div class="sec">${t.taukoMin >= 30 ? `${t.taukoMin} min` : ''}</div></div>`);
      }
    }
    jana.push(`<div class="kisko loppu"><div class="sec num">${esc(p.paattyy)}</div><div class="sec">koulu päättyy</div></div>`);
    h.push(`<div class="jana">${jana.join('')}</div>`);
  } else {
    h.push(`<div class="paa"><div class="ylä"><span class="sec">${esc(nimi)}</span></div><h1 class="disp">Koulupäivä</h1></div><div class="tyhja sec">Ei tunteja tiedossa.</div>`);
  }
  for (const k of m.koeHalytykset) {
    h.push(`<div class="kisko koe-halytys"><div></div><div><span class="hl">Koe ${esc(k.milloin)}</span> ${esc(k.aine)}${k.kuvaus ? ` · ${esc(k.kuvaus)}` : ''}</div></div>`);
  }

  /* Läksyt */
  if (m.laksyt.tanaan.length) {
    h.push(osio('Läksyt tänään', monikko(m.laksyt.tanaan.length, 'tehtävä', 'tehtävää')));
    h.push(`<div class="lista">${m.laksyt.tanaan.map((l) => laksy(l, `<div class="era"><small class="sec">tunti</small><b class="num">${esc(l.tunti)}</b></div>`, true)).join('')}</div>`);
  }
  if (m.seur) {
    h.push(osio(`Läksyt ${m.seurOtsikko}`, m.laksyt.seur.length ? monikko(m.laksyt.seur.length, 'tehtävä', 'tehtävää') : ''));
    h.push(m.laksyt.seur.length
      ? `<div class="lista">${m.laksyt.seur.map((l, i) => laksy(l, i === 0 ? era(m.seur) : '<div></div>', !m.laksyt.tanaan.length)).join('')}</div>`
      : '<div class="kisko"><div></div><div class="tyhja sec">Ei läksyjä.</div></div>');
  }
  if (m.laksyt.muut.length) {
    h.push(osio('Myöhemmin', monikko(m.laksyt.muut.length, 'tehtävä', 'tehtävää')));
    if (m.viikkorivi.length) {
      h.push(`<div class="viikko" style="grid-template-columns: repeat(${m.viikkorivi.length}, minmax(0, 1fr))">${m.viikkorivi.map((d) => `<div><small class="sec">${d.pv}</small><b class="disp">${d.pvm}</b><div class="merkit">${'<span class="nelio"></span>'.repeat(d.laksyja)}${'<span class="rengas"></span>'.repeat(d.kokeita)}</div></div>`).join('')}</div>
        <div class="selite sec"><span><span class="nelio"></span> läksy</span><span><span class="rengas"></span> koe</span></div>`);
    }
    let edellinen = null;
    h.push(`<div class="lista">${m.laksyt.muut.map((l) => {
      const uusi = !(edellinen && l.era && sama(edellinen, l.era));
      edellinen = l.era;
      const kisko = l.era ? (uusi ? era(l.era) : '<div></div>') : '<div class="era"><small class="sec">päivä ei</small><small class="sec">tiedossa</small></div>';
      return laksy(l, kisko, false);
    }).join('')}</div>`);
  }

  /* Kokeet */
  const k = m.kokeet;
  h.push(osio('Kokeet', k.myohemmin.length ? `+${k.myohemmin.length} myöhemmin` : ''));
  if (k.lahella.length) {
    h.push(`<div class="lista tiivis">${k.lahella.map((x, i) => {
      const hl = i === 0 ? ' hl' : '';
      const pv = x.ero === 0 ? `<span class="sana${hl}">tänään</span>` : x.ero === 1 ? `<span class="sana${hl}">huomenna</span>`
        : `<b class="disp num${hl}">${x.ero}</b><small class="sec">pv</small>`;
      return `<div class="kisko koe"><div class="pv">${pv}</div><div class="sis"><span class="nimi">${esc(x.aine)}${x.kuvaus ? ` · ${esc(x.kuvaus)}` : ''}</span><span class="meta sec">${esc(x.paivays)}</span></div></div>`;
    }).join('')}</div>`);
  } else {
    h.push(`<div class="kisko"><div></div><div class="tyhja sec">Ei kokeita seuraavaan ${KOKEET_LAHIAIKA_PV} päivään.</div></div>`);
  }
  if (k.myohemmin.length) {
    const s0 = k.myohemmin[0];
    h.push(`<div class="kisko"><div></div><div class="meta sec" style="font-size:13px">Seuraava sen jälkeen: ${esc(s0.aine)} ${s0.paiva.getDate()}.${s0.paiva.getMonth() + 1}.</div></div>`);
  }

  /* Huomiot */
  if (m.huomiot.length) {
    h.push(osio('Huomiot'));
    for (const o of m.huomiot) {
      h.push(`<div class="kisko"><div></div><div class="ryhma">${o.tyyppi === 'virhe' || o.tyyppi === 'viesti' ? `<span class="hl">${esc(o.otsikko)}</span>` : esc(o.otsikko)} <span class="sec" style="font-weight:400">${o.yhteensa}</span></div></div>`);
      h.push(`<div class="lista tiivis">${o.rivit.map((r) => `<div class="kisko"><div class="sec" style="font-size:13px">${esc(r.paivays)}</div><div class="sis"><span class="nimi">${esc(r.aine || r.teksti)}</span>${r.aine && r.teksti ? `<span class="teksti">${rivitetty(r.teksti)}</span>` : ''}${r.lisatieto ? `<span class="meta sec">${esc(r.lisatieto)}</span>` : ''}</div></div>`).join('')}</div>`);
      if (o.yhteensa > o.rivit.length) h.push(`<div class="kisko"><div></div><div class="sec" style="font-size:13px">+${o.yhteensa - o.rivit.length} lisää Wilmassa</div></div>`);
    }
  }

  /* Arvosanat */
  if (m.arvosanat.length) {
    h.push(osio('Arvosanat', 'viimeiset 7 päivää'));
    h.push(`<div class="lista tiivis">${m.arvosanat.map((a) => `<div class="kisko arvosana"><b class="disp num">${esc(a.arvosana)}</b><div class="sis"><span class="nimi">${esc(a.aine)}${a.kuvaus ? ` · ${esc(a.kuvaus)}` : ''}</span><span class="meta sec">${esc(a.paivays)}</span></div></div>`).join('')}</div>`);
  }

  /* Kehut */
  if (m.kehut.rivit.length) {
    h.push(osio('Kehut', m.kehut.viikolla ? `${m.kehut.viikolla} tällä viikolla` : ''));
    h.push(`<div class="lista">${m.kehut.rivit.map((x) => `<div class="kisko">${era(x.paiva)}<div class="sis"><span class="nimi">${esc(x.otsikko)}</span>${x.teksti ? `<span class="teksti">${rivitetty(x.teksti)}</span>` : ''}<span class="meta sec">${[x.aine, x.opettaja].filter(Boolean).map(esc).join(' · ')}</span></div></div>`).join('')}</div>`);
    if (m.kehut.yhteensa > m.kehut.rivit.length) h.push(`<div class="kisko"><div></div><div class="sec" style="font-size:13px">+${m.kehut.yhteensa - m.kehut.rivit.length} lisää Wilmassa</div></div>`);
  }

  /*
   * Viestit: kiinnitetyt aina näkyvissä, muut avattavassa listassa. Painikkeet tarvitsevat
   * integraatiolta toiminnot (ui.palvelu: wilma.get_message, ui.kiinnitys: wilma.pin_message).
   */
  const viesti = (v) => {
    const d = v.id ? haetut.get(v.id) : null;
    const avattu = v.id && auki.has(v.id);
    const napit = [];
    let runko = '';
    if (d && d.tila === 'ok') {
      const vastaukset = avattu ? d.vastaukset.map((r) => `<div class="viesti vastaus"><span class="meta sec">${[r.sender, r.timestamp].filter(Boolean).map(esc).join(' · ')}</span>${linkitetty(r.content)}</div>`).join('') : '';
      // Esikatselussa tyhjät rivit pois, jotta kolmelle riville mahtuu sisältöä.
      const teksti = avattu ? d.sisalto : d.sisalto.replace(/\n\s*\n+/g, '\n');
      runko = `<div class="viesti${avattu ? '' : ' supistettu'}">${linkitetty(teksti) || '<span class="sec">Viestissä ei ole tekstiä.</span>'}</div>${vastaukset}`;
      // Painike vain, jos esikatselu ei näytä kaikkea: yli kolme riviä, pitkä teksti tai vastauksia.
      const tiivis = d.sisalto.replace(/\n\s*\n+/g, '\n');
      if (tiivis.split('\n').length > ESIKATSELU_RIVIT || tiivis.length > ESIKATSELU_MERKIT || d.vastaukset.length) {
        napit.push(`<button class="linkki" type="button" data-toiminto="vaihda" data-id="${v.id}" aria-expanded="${avattu ? 'true' : 'false'}">${avattu ? 'Näytä vähemmän' : 'Näytä lisää'}</button>`);
      }
    } else if (d && d.tila === 'ladataan') {
      runko = '<div class="viesti sec">Haetaan viestiä…</div>';
    } else if (d && d.tila === 'virhe') {
      runko = `<div class="viesti sec">Viestin haku epäonnistui: ${esc(d.virhe)}</div>`;
      napit.push(`<button class="linkki" type="button" data-toiminto="hae" data-id="${v.id}">Yritä uudelleen</button>`);
    } else if (v.id && ui.palvelu) {
      napit.push(`<button class="linkki" type="button" data-toiminto="hae" data-id="${v.id}">Lue viesti</button>`);
    }
    if (v.id && ui.kiinnitys) {
      if (v.irrotettava) napit.push(`<button class="linkki" type="button" data-toiminto="irrota" data-id="${v.id}">Poista kiinnitys</button>`);
      else if (!m.kiinnitetyt.includes(v)) napit.push(`<button class="linkki" type="button" data-toiminto="kiinnita" data-id="${v.id}">Kiinnitä</button>`);
    }
    return `<div class="kisko kiinni">${era(v.paiva)}<div class="sis"><span class="nimi">${esc(v.otsikko)}${v.lukematon ? '<span class="hl uusi">lukematon</span>' : ''}</span><span class="meta sec">${esc(v.lahettaja)}</span>${runko}${napit.length ? `<div class="napit">${napit.join('')}</div>` : ''}</div></div>`;
  };
  const kiinnitetyt = m.kiinnitetyt || [];
  const muut = (ui.kiinnitys && m.muutViestit) || [];
  if (kiinnitetyt.length || muut.length) {
    h.push(osio('Viestit', kiinnitetyt.length ? monikko(kiinnitetyt.length, 'kiinnitetty', 'kiinnitettyä') : ''));
    if (kiinnitetyt.length) h.push(`<div class="lista">${kiinnitetyt.map(viesti).join('')}</div>`);
    if (ui.viestivirhe) h.push(`<div class="kisko"><div></div><div class="virhe sec">${esc(ui.viestivirhe)}</div></div>`);
    if (muut.length) {
      h.push(`<div class="kisko"><div></div><div class="napit"><button class="linkki" type="button" data-toiminto="lista" aria-expanded="${ui.lista ? 'true' : 'false'}">${ui.lista ? 'Piilota muut viestit' : kiinnitetyt.length ? 'Näytä muut viestit' : 'Näytä viestit'}</button></div></div>`);
      if (ui.lista) h.push(`<div class="lista">${muut.map(viesti).join('')}</div>`);
    }
  }

  return `<style>${TYYLIT}</style><ha-card><div class="sivu">${h.join('')}</div></ha-card>`;
}

/* ---------- kortti ---------- */

/* ---------- lapsen ja sensorien tunnistus ---------- */

// Rooli -> ha-wilman entiteetin nimi. Entiteetin id on "<laitteen nimi>_<nimi>" slugattuna.
const ROOLIT = {
  tanaan: 'Tänään', seuraava_tunti: 'Seuraava tunti', aktiiviset_laksyt: 'Aktiiviset läksyt',
  kaikki_laksyt: 'Kaikki läksyt', seuraava_koe: 'Seuraava koe', arvosanat: 'Arvosanat',
  kaikki_tuntimerkinnat: 'Kaikki tuntimerkinnät', selvittamattomat_tuntimerkinnat: 'Selvittämättömät tuntimerkinnät',
  tiedote: 'Tiedote', uudet_viestit: 'Uudet viestit', kehut: 'Kehut', oppilas: 'Oppilas',
};

const slug = (v) => String(v || '').toLowerCase().replace(/[äå]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const laiteNimi = (d) => d.name_by_user || d.name || '';
const wilmaTunniste = (d) => ((d.identifiers || []).find((i) => i[0] === 'wilma') || [])[1] || '';
// ha-wilma: tilin laite "<merkintä>", lapsen laite "<merkintä>:<lapsen id>".
const onLapsi = (d) => wilmaTunniste(d).includes(':');

function lapsilaitteet(hass) {
  return Object.values(hass.devices || {}).filter(onLapsi).sort((a, b) => laiteNimi(a).localeCompare(laiteNimi(b), 'fi'));
}

/**
 * Kortin asetuksista lapsen laite ja roolien entiteetit.
 * @returns {{roolit?: Record<string, string>, laite?: object, virhe?: string}}
 */
function ratkaise(hass, config) {
  const lapset = lapsilaitteet(hass);
  const nimet = lapset.map(laiteNimi).join(', ');
  let laite = null;
  if (config.device) {
    laite = (hass.devices || {})[config.device] || null;
    if (!laite) return { virhe: 'Valittua laitetta ei löydy. Valitse lapsi kortin asetuksista.' };
    if (!onLapsi(laite)) {
      // Tilin laite valittu: kelpaa, jos tilillä on tasan yksi lapsi.
      const tili = wilmaTunniste(laite);
      const omat = tili ? lapset.filter((d) => wilmaTunniste(d).startsWith(tili + ':')) : [];
      if (omat.length !== 1) return { virhe: `Valitse lapsen laite, ei Wilma-tilin laitetta.${nimet ? ` Lapset: ${nimet}.` : ''}` };
      laite = omat[0];
    }
  } else if (config.child) {
    const haku = slug(config.child);
    laite = lapset.find((d) => slug(laiteNimi(d)) === haku || slug(d.name) === haku) || null;
    // Ei laitetta: tulkitaan entiteettien etuliitteeksi (sensor.<child>_tanaan).
    if (!laite) return { roolit: Object.fromEntries(Object.keys(ROOLIT).map((r) => [r, `sensor.${config.child}_${r}`])) };
  } else {
    if (!lapset.length) return { virhe: 'Wilma-integraation lapsia ei löytynyt. Asenna ha-wilma ja lisää Wilma-tili.' };
    laite = lapset[0];
  }
  const omat = Object.values(hass.entities || {}).filter((e) => e.device_id === laite.id && e.entity_id.startsWith('sensor.'));
  const roolit = {};
  for (const [rooli, nimi] of Object.entries(ROOLIT)) {
    const osuma = omat.find((e) => e.entity_id.endsWith('_' + rooli))
      // Uudelleennimetty entiteetti: tunnistetaan näyttönimen lopusta.
      || omat.find((e) => {
        const tila = hass.states[e.entity_id];
        return tila && String(tila.attributes.friendly_name || '').endsWith(nimi);
      });
    if (osuma) roolit[rooli] = osuma.entity_id;
  }
  return { roolit, laite };
}

/* ---------- kortti ---------- */

if (typeof HTMLElement !== 'undefined' && typeof customElements !== 'undefined') {
  const FONT_URL = new URL('bricolage-grotesque-latin.woff2', import.meta.url).href;

  class WilmaCard extends HTMLElement {
    setConfig(config) {
      this._config = config || {};
      this._avain = '';
      this._ratkaisu = null;
      this._auki = this._auki || new Set(); // avatut kiinnitetyt viestit
      this._viestit = this._viestit || new Map(); // id -> {tila, sisalto, vastaukset, virhe}
      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
        // Sisältö piirretään uudelleen joka päivityksellä, joten painikkeet kuunnellaan juuresta.
        this.shadowRoot.addEventListener('click', (ev) => {
          const nappi = ev.target.closest && ev.target.closest('button[data-toiminto]');
          if (!nappi) return;
          const id = Number(nappi.dataset.id);
          const toiminto = nappi.dataset.toiminto;
          this._viestivirhe = '';
          if (toiminto === 'lista') this._lista = !this._lista;
          else if (toiminto === 'hae') this._haeViesti(id, true);
          else if (toiminto === 'kiinnita' || toiminto === 'irrota') this._kiinnita(id, toiminto === 'kiinnita');
          else if (this._auki.has(id)) this._auki.delete(id);
          else this._auki.add(id);
          this._kohdistus = toiminto === 'lista' ? 'button[data-toiminto="lista"]' : `button[data-id="${id}"]`;
          this._paivita(true);
        });
      }
      // @font-face ei vaikuta shadow DOMin sisältä; fontti rekisteröidään dokumenttiin kerran.
      if (!document.getElementById('wilma-card-font')) {
        const st = document.createElement('style');
        st.id = 'wilma-card-font';
        st.textContent = `@font-face { font-family: 'Bricolage Grotesque'; font-style: normal; font-weight: 600 700; font-display: swap; src: url(${FONT_URL}) format('woff2'); }`;
        document.head.appendChild(st);
      }
      this._paivita();
    }

    set hass(hass) {
      this._hass = hass;
      this._paivita();
    }

    connectedCallback() {
      // Näkymä riippuu kellonajasta (menneet tunnit, tämän päivän läksyt).
      this._ajastin = setInterval(() => this._paivita(), 30000);
      this._paivita();
    }

    disconnectedCallback() {
      clearInterval(this._ajastin);
    }

    _ratkaise() {
      const h = this._hass;
      const r = this._ratkaisu;
      // Rekisterit vaihtuvat vain, kun laitteita tai entiteettejä lisätään tai nimetään.
      if (!r || r.devices !== h.devices || r.entities !== h.entities) {
        this._ratkaisu = { devices: h.devices, entities: h.entities, ...ratkaise(h, this._config) };
      }
      return this._ratkaisu;
    }

    /** Hakee viestin sisällön integraatiolta. Wilma merkitsee viestin luetuksi. */
    async _haeViesti(id, avaa) {
      const { roolit } = this._ratkaise();
      const tila = this._viestit.get(id);
      if (!id || !roolit || !roolit.uudet_viestit || (tila && tila.tila === 'ladataan')) return;
      this._viestit.set(id, { tila: 'ladataan' });
      if (avaa) this._auki.add(id);
      this._paivita(true);
      try {
        const tulos = await this._hass.callWS({
          type: 'call_service', domain: 'wilma', service: 'get_message',
          service_data: { entity_id: roolit.uudet_viestit, message_id: id }, return_response: true,
        });
        const v = (tulos && tulos.response) || {};
        this._viestit.set(id, { tila: 'ok', sisalto: String(v.content || ''), vastaukset: Array.isArray(v.replies) ? v.replies : [] });
      } catch (err) {
        this._viestit.set(id, { tila: 'virhe', virhe: (err && err.message) || String(err) });
      }
      this._paivita(true);
    }

    /** Kiinnittää viestin tai poistaa kiinnityksen. Integraatio tallentaa sen kaikille käyttäjille. */
    async _kiinnita(id, kiinni) {
      const { roolit } = this._ratkaise();
      if (!id || !roolit || !roolit.uudet_viestit) return;
      try {
        // Sensorin pinned-attribuutti päivittyy, ja kortti piirtyy siitä uudelleen.
        await this._hass.callService('wilma', kiinni ? 'pin_message' : 'unpin_message', { entity_id: roolit.uudet_viestit, message_id: id });
      } catch (err) {
        this._viestivirhe = `${kiinni ? 'Kiinnitys' : 'Kiinnityksen poisto'} epäonnistui: ${(err && err.message) || err}`;
        this._paivita(true);
      }
    }

    _paivita(pakota) {
      if (!this._hass || !this._config || !this.shadowRoot) return;
      const { roolit, laite, virhe } = this._ratkaise();
      const nyt = new Date();
      const tila = (rooli) => (roolit && roolit[rooli] ? this._hass.states[roolit[rooli]] : undefined);
      const avain = (virhe || Object.keys(ROOLIT).map((x) => {
        const t = tila(x);
        return t ? t.last_updated : '-';
      }).join('|')) + '|' + Math.floor(nyt.getTime() / 60000);
      if (avain === this._avain && !pakota) return;
      this._avain = avain;
      if (virhe) {
        this.shadowRoot.innerHTML = `<ha-card style="padding:16px">${esc(virhe)}</ha-card>`;
        return;
      }
      const oppilas = tila('oppilas');
      const luokka = oppilas && oppilas.attributes && oppilas.attributes.class;
      const kokoNimi = (laite && laiteNimi(laite)) || (oppilas ? String(oppilas.state) : '') || this._config.child || '';
      const nimi = this._config.title || [kokoNimi.split(' ')[0], luokka].filter(Boolean).join(' · ');
      try {
        const malli = wilmaModel(tila, nyt, { subjects: this._config.subjects, strip_suffixes: this._config.strip_suffixes, pinned: this._config.pinned });
        const palvelut = (this._hass.services && this._hass.services.wilma) || {};
        const palvelu = !!palvelut.get_message;
        const kiinnitys = !!(palvelut.pin_message && palvelut.unpin_message);
        this.shadowRoot.innerHTML = piirra(malli, nimi, { palvelu, kiinnitys, lista: !!this._lista, viestivirhe: this._viestivirhe, auki: this._auki, viestit: this._viestit });
        this._viimeistele(malli, palvelu);
      } catch (err) {
        this.shadowRoot.innerHTML = `<ha-card style="padding:16px">Wilma-kortti: ${esc(err && err.message)}</ha-card>`;
        throw err;
      }
    }

    /** Piirron jälkeen: luettujen kiinnitettyjen viestien esikatselut ja kohdistus takaisin painikkeeseen. */
    _viimeistele(malli, palvelu) {
      // Lukematonta ei haeta itsestään, koska haku merkitsee sen Wilmassa luetuksi.
      if (palvelu) for (const v of malli.kiinnitetyt) if (v.id && !v.lukematon && !this._viestit.has(v.id)) this._haeViesti(v.id, false);
      if (this._kohdistus) {
        const kohde = this.shadowRoot.querySelector(this._kohdistus);
        if (kohde) kohde.focus({ preventScroll: true });
        this._kohdistus = null;
      }
    }

    getCardSize() {
      return 12;
    }

    getGridOptions() {
      return { columns: 12, min_columns: 6 };
    }

    static getStubConfig(hass) {
      const lapset = hass ? lapsilaitteet(hass) : [];
      return lapset.length ? { device: lapset[0].id } : {};
    }

    static getConfigForm() {
      const nimet = { device: 'Lapsi (Wilma-integraation laite)', title: 'Otsikko (valinnainen)' };
      const ohjeet = { title: 'Oletus: lapsen etunimi ja luokka.' };
      return {
        schema: [
          { name: 'device', selector: { device: { filter: { integration: 'wilma' } } } },
          { name: 'title', selector: { text: {} } },
        ],
        computeLabel: (kentta) => nimet[kentta.name],
        computeHelper: (kentta) => ohjeet[kentta.name],
      };
    }
  }

  if (!customElements.get('wilma-card')) customElements.define('wilma-card', WilmaCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === 'wilma-card')) {
    window.customCards.push({ type: 'wilma-card', name: 'Wilma', description: 'Koulupäivä aikajanana, läksyt, kokeet ja huomiot.' });
  }
  console.info(`%c WILMA-CARD %c ${VERSION} `, 'background:#D9F24B;color:#15170A;font-weight:700', 'background:#333;color:#fff');
}

export { wilmaModel, piirra, aine, erotaAine, ainelistat, ratkaise, slug, linkitetty };
