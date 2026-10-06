// Aja: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { wilmaModel, piirra, aine, erotaAine, ratkaise, slug, linkitetty } from '../dist/wilma-card.js';

// Keksitty oppilas. Viikko: ma MA+ENA1, ti YM, ke MA (ke 7.10.2026 on keskiviikko).
const sensorit = (lisa = {}) => {
  const s = {
    tanaan: { state: '2 tuntia · 08:15 · 10:30', attributes: { lesson_1: '08:15 · 09:15 · MA · OPE · 3B:A101', lesson_2: '09:30 · 10:30 · ENA1 · OPE · Kielistudio:B2' } },
    seuraava_tunti: { state: 'x', attributes: { lesson_count: 4, lesson_1: '1 · 08:15 · 09:15 · MA · OPE · 3B:A101', lesson_2: '1 · 09:30 · 10:30 · ENA1 · OPE · Kielistudio:B2', lesson_3: '2 · 08:15 · 09:15 · YM · OPE · 3B:A101', lesson_4: '3 · 12:30 · 13:15 · MA · OPE · 3B:A101' } },
    aktiiviset_laksyt: { state: '1', attributes: { hw_1: '2026-10-02 · Kerho, syksy · Tuo eväät · lukujärjestys KER pe 9.10. 14:00' } },
    kaikki_laksyt: { state: '4', attributes: {
      hw_1: '2026-10-02 · Kerho, syksy · Tuo eväät · lukujärjestys KER pe 9.10. 14:00',
      hw_2: '2026-09-30 · Matematiikka, syksy · Tehtävät 1-4\n+ mökki · lukujärjestys MA ma 5.10. 08:15',
      hw_3: '2026-09-28 · Englanti, A1 · Sanat · tunti ohi · lukujärjestys ENA1 ma 5.10. 09:30',
      hw_4: '2026-10-05 · Ympäristöoppi, syksy · Lue kpl 7 · lukujärjestys YM ti 6.10. 08:15',
    } },
    seuraava_koe: { state: 'x', attributes: { exam_1: '2026-10-06 · YM YM09 · Koe 1', exam_2: '2026-11-20 · MA MA09 · Koe 3' } },
    arvosanat: { state: '2', attributes: { grade_1: '2026-09-01 · MA MA09 · 8 · Vanha', grade_2: '2026-10-02 · ENA1 ENA109 · 9+ · Sanakoe' } },
    kaikki_tuntimerkinnat: { state: '1', attributes: { item_1: '2026-10-02 · 09:30 · ENA1 · Kotitehtävät tekemättä, XYZ · OPE · x' } },
    uudet_viestit: { state: '3', attributes: { msg_1: '● 2026-10-04 10:00 · Liikunta vk 41 · Ope Olli', msg_2: '2026-10-01 09:00 · Luettu viesti · Ope Olli' } },
    kehut: { state: '1', attributes: { item_1: 'LI09; Hyvä tunti /Ope Olli' } },
  };
  Object.assign(s, lisa);
  return (rooli) => s[rooli];
};
const ma = (h, min = 0) => new Date(2026, 9, 5, h, min); // maanantai 5.10.2026

test('aineen tunnistus koodista ja nimestä', () => {
  assert.deepEqual(aine('ENA1'), { nimi: 'Englanti', known: true });
  assert.deepEqual(aine('Äidinkieli ja kirjallisuus: suomen kieli, syksy'), { nimi: 'Äidinkieli', known: true });
  assert.deepEqual(aine('Harrastamisen Suomen mallin kerho'), { nimi: 'Harrastamisen Suomen mallin kerho', known: false });
  // Pienellä kirjoitettu sana ei ole koodi: "Liikunta vk 41" tunnistuu vain nimestä.
  assert.equal(erotaAine(['ma-ilta']).aine, '');
});

test('koulupäivän jälkeen näytetään seuraava koulupäivä ja sen läksyt', () => {
  const m = wilmaModel(sensorit(), ma(16));
  assert.equal(m.kesken, false);
  assert.equal(m.paiva.otsikko, 'Huomenna');
  assert.equal(m.paiva.paivays, 'tiistai 6.10.');
  assert.deepEqual(m.paiva.tunnit.map((t) => t.aine), ['Ympäristöoppi']);
  assert.deepEqual(m.laksyt.tanaan, []);
  assert.deepEqual(m.laksyt.seur.map((l) => l.aine), ['Ympäristöoppi']);
  // Huomisen koe näkyy vain Kokeet-osiossa, ei lukujärjestyksen alla.
  assert.deepEqual(m.kokeet.lahella.map((k) => `${k.ero} ${k.aine}`), ['1 Ympäristöoppi']);
  assert.ok(!piirra(m, 'Aino', {}).includes('Koe huomenna'));
  // Tunnistamaton aine näkyy, koska integraatio pitää sitä aktiivisena; päivä tulee vihjeestä.
  assert.deepEqual(m.laksyt.muut.map((l) => `${l.milloin} ${l.aine}`), ['pe 9.10. Kerho']);
});

test('tämän päivän läksy näkyy vain aineen tunnin alkuun asti', () => {
  const aamu = wilmaModel(sensorit(), ma(7, 30));
  assert.equal(aamu.paiva.otsikko, 'Tänään');
  assert.deepEqual(aamu.laksyt.tanaan.map((l) => `${l.tunti} ${l.aine}`), ['08:15 Matematiikka', '09:30 Englanti']);
  assert.equal(aamu.laksyt.tanaan[0].teksti, 'Tehtävät 1-4\n+ mökki');
  const valitunti = wilmaModel(sensorit(), ma(9, 20));
  assert.deepEqual(valitunti.laksyt.tanaan.map((l) => l.aine), ['Englanti']);
  assert.deepEqual(valitunti.paiva.tunnit.map((t) => t.tila), ['ohi', 'seuraava']);
  const tunnilla = wilmaModel(sensorit(), ma(9, 45));
  assert.deepEqual(tunnilla.laksyt.tanaan, []);
  assert.deepEqual(tunnilla.paiva.tunnit.map((t) => t.tila), ['ohi', 'nyt']);
});

test('poikkeava luokka, tauot ja viikkorivi', () => {
  const m = wilmaModel(sensorit(), ma(7));
  assert.equal(m.paiva.luokka, '3B:A101');
  assert.deepEqual(m.paiva.tunnit.map((t) => t.poikkeavaLuokka), ['', 'Kielistudio:B2']);
  assert.deepEqual(m.paiva.tunnit.map((t) => t.taukoMin), [15, 0]);
  const ilta = wilmaModel(sensorit(), ma(16));
  // Rivi alkaa näytettävästä koulupäivästä: illalla seuraavasta, koulupäivän aikana kuluvasta.
  assert.deepEqual(ilta.viikkorivi.map((d) => `${d.pv} ${d.pvm}`), ['ti 6.', 'ke 7.', 'ma 12.', 'ti 13.', 'ke 14.']);
  assert.deepEqual(ilta.viikkorivi.map((d) => [d.laksyja, d.kokeita]), [[1, 1], [0, 0], [0, 0], [0, 0], [0, 0]]);
  assert.deepEqual(m.viikkorivi.map((d) => `${d.pv} ${d.pvm}${d.nyt ? ' nyt' : ''}`), ['ma 5. nyt', 'ti 6.', 'ke 7.', 'ma 12.', 'ti 13.', 'ke 14.']);
  assert.deepEqual(m.viikkorivi.slice(0, 2).map((d) => d.laksyja), [2, 1]);
});

test('läksyt ovat yksi osio: viikkorivi otsikon alla, sitten tänään, huomiseksi ja myöhemmin', () => {
  const html = piirra(wilmaModel(sensorit(), ma(7)), 'Aino', {});
  assert.equal((html.match(/<h2 class="disp">[^<]*äksy[^<]*<\/h2>/g) || []).length, 1);
  const paikat = ['<h2 class="disp">Läksyt</h2>', 'class="viikko"', '<h3 class="disp">Tänään</h3>', '<h3 class="disp">Huomiseksi</h3>', '<h3 class="disp">Myöhemmin</h3>', '<h2 class="disp">Kokeet</h2>'].map((x) => html.indexOf(x));
  assert.ok(paikat.every((p, i) => p > 0 && (i === 0 || p > paikat[i - 1])), String(paikat));
  assert.ok(html.includes('<div class="nyt">'));
  const perjantai = piirra(wilmaModel(sensorit(), new Date(2026, 9, 9, 16)), 'Aino', {});
  assert.ok(perjantai.includes('<h3 class="disp">Maanantaiksi 12.10.</h3>'));
});

test('kokeet, arvosanat, huomiot ja kehut', () => {
  const m = wilmaModel(sensorit(), ma(16));
  assert.deepEqual(m.kokeet.lahella.map((k) => `${k.ero} ${k.aine} ${k.kuvaus}`), ['1 Ympäristöoppi Koe 1']);
  assert.equal(m.kokeet.myohemmin.length, 1);
  // Vain 7 päivän sisällä annetut arvosanat.
  assert.deepEqual(m.arvosanat, [{ arvosana: '9+', aine: 'Englanti', kuvaus: 'Sanakoe', paivays: 'pe 2.10.' }]);
  const viestit = m.huomiot.find((h) => h.otsikko === 'Lukemattomat viestit');
  // Otsikko tulkitaan sellaisenaan, ja määrä on sensorin tila, ei näkyvien rivien määrä.
  assert.deepEqual(viestit.rivit.map((r) => r.teksti), ['Liikunta vk 41']);
  assert.equal(viestit.yhteensa, 3);
  const huom = m.huomiot.find((h) => h.otsikko === 'Huomautukset');
  assert.deepEqual(huom.rivit, [{ aine: 'Englanti', teksti: 'Kotitehtävät tekemättä, XYZ · x', paivays: 'pe 2.10.' }]);
  // Koulun oma tunniste siivotaan pois asetuksella.
  const siivottu = wilmaModel(sensorit(), ma(16), { strip_suffixes: ['XYZ'] }).huomiot.find((h) => h.otsikko === 'Huomautukset');
  assert.equal(siivottu.rivit[0].teksti, 'Kotitehtävät tekemättä · x');
  assert.deepEqual(m.kehut.rivit, [{ otsikko: 'Hyvä tunti', teksti: '', aine: 'Liikunta', opettaja: 'Ope Olli', paiva: null }]);
});

test('puuttuvat sensorit eivät kaada korttia ja teksti escapataan', () => {
  const tyhja = wilmaModel(() => undefined, ma(12));
  assert.equal(tyhja.paiva, null);
  assert.match(piirra(tyhja, 'Testi'), /Ei tunteja tiedossa/);
  const paha = sensorit({ kehut: { state: '1', attributes: { item_1: 'LI09; <img src=x onerror=alert(1)> /Ope' } } });
  const html = piirra(wilmaModel(paha, ma(16)), 'Testi');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});

test('koulun omat ainekoodit asetuksista', () => {
  const lisa = sensorit({ seuraava_koe: { state: 'x', attributes: { exam_1: '2026-10-06 · KO1 KO09 · Leivonta' } } });
  assert.equal(wilmaModel(lisa, ma(16)).kokeet.lahella[0].aine, 'KO1 KO09');
  assert.equal(wilmaModel(lisa, ma(16), { subjects: { KO: 'Kotitalous' } }).kokeet.lahella[0].aine, 'Kotitalous');
});

// Keksitty HA: yksi Wilma-tili, kaksi lasta.
const hass = () => {
  const laite = (id, name, tunniste) => ({ id, name, name_by_user: null, identifiers: [['wilma', tunniste]] });
  const devices = {
    tili: laite('tili', 'Wilma (Aino Esimerkki)', 'ENTRY'),
    d1: laite('d1', 'Aino Esimerkki', 'ENTRY:!1'),
    d2: laite('d2', 'Väinö Esimerkki', 'ENTRY:!2'),
    muu: { id: 'muu', name: 'Lamppu', identifiers: [['hue', 'x']] },
  };
  const entities = {};
  const states = {};
  const lisaa = (device_id, entity_id, friendly_name) => {
    entities[entity_id] = { entity_id, device_id };
    states[entity_id] = { state: '0', attributes: { friendly_name } };
  };
  lisaa('d1', 'sensor.aino_esimerkki_tanaan', 'Aino Esimerkki Tänään');
  lisaa('d1', 'sensor.aino_esimerkki_kaikki_laksyt', 'Aino Esimerkki Kaikki läksyt');
  lisaa('d1', 'sensor.aino_esimerkki_selvittamattomat_tuntimerkinnat', 'Aino Esimerkki Selvittämättömät tuntimerkinnät');
  lisaa('d1', 'sensor.aino_esimerkki_kaikki_tuntimerkinnat', 'Aino Esimerkki Kaikki tuntimerkinnät');
  lisaa('d2', 'sensor.vaino_esimerkki_tanaan', 'Väinö Esimerkki Tänään');
  lisaa('d2', 'sensor.omanimi', 'Väinö Esimerkki Kaikki läksyt'); // käyttäjä nimennyt entiteetin id:n uudelleen
  lisaa('tili', 'sensor.wilma_aino_esimerkki_viestit', 'Wilma (Aino Esimerkki) Viestit');
  return { devices, entities, states };
};

test('lapsi löytyy laitteesta, nimestä tai ilman asetusta', () => {
  const h = hass();
  assert.equal(slug('Väinö Esimerkki'), 'vaino_esimerkki');
  // Ilman asetusta: ensimmäinen lapsi nimen mukaan.
  const eka = ratkaise(h, {});
  assert.equal(eka.laite.id, 'd1');
  assert.equal(eka.roolit.tanaan, 'sensor.aino_esimerkki_tanaan');
  assert.equal(eka.roolit.kaikki_tuntimerkinnat, 'sensor.aino_esimerkki_kaikki_tuntimerkinnat');
  assert.equal(eka.roolit.selvittamattomat_tuntimerkinnat, 'sensor.aino_esimerkki_selvittamattomat_tuntimerkinnat');
  assert.equal(eka.roolit.kehut, undefined);
  // Toinen lapsi laitteella; uudelleennimetty entiteetti löytyy näyttönimestä.
  const toka = ratkaise(h, { device: 'd2' });
  assert.equal(toka.roolit.tanaan, 'sensor.vaino_esimerkki_tanaan');
  assert.equal(toka.roolit.kaikki_laksyt, 'sensor.omanimi');
  // Nimi tai slug kelpaa myös.
  assert.equal(ratkaise(h, { child: 'Väinö Esimerkki' }).laite.id, 'd2');
  assert.equal(ratkaise(h, { child: 'vaino_esimerkki' }).laite.id, 'd2');
  // Tuntematon child tulkitaan entiteettien etuliitteeksi.
  assert.equal(ratkaise(h, { child: 'joku' }).roolit.tanaan, 'sensor.joku_tanaan');
});

test('väärä laite antaa selkeän virheen', () => {
  const h = hass();
  assert.match(ratkaise(h, { device: 'tili' }).virhe, /Valitse lapsen laite.*Aino Esimerkki, Väinö Esimerkki/);
  assert.match(ratkaise(h, { device: 'poistettu' }).virhe, /ei löydy/);
  assert.match(ratkaise({ devices: {}, entities: {}, states: {} }, {}).virhe, /lapsia ei löytynyt/);
  // Yhden lapsen tilillä tilin laite kelpaa.
  delete h.devices.d2;
  assert.equal(ratkaise(h, { device: 'tili' }).laite.id, 'd1');
});

// Viestit tunnisteineen, kuten integraation messages-attribuutissa (keksitty data).
const viestit = (lista) => sensorit({ uudet_viestit: { state: '1', attributes: { messages: lista } } });
const LISTA = [
  { id: 30, timestamp: '2026-10-04 18:00', subject: 'Liikunta vk 41', sender: 'Olli Esimerkki (OE)', unread: false },
  { id: 40, timestamp: '2026-10-05 09:00', subject: 'Retkipäivä perjantaina', sender: 'Aila Opettaja (AO)', unread: true },
  { id: 20, timestamp: '2026-09-27 18:00', subject: 'Liikunta vk 40', sender: 'Olli Esimerkki (OE)', unread: false },
  { id: 10, timestamp: '2026-09-20 12:00', subject: 'Vanhempainilta', sender: 'Aila Opettaja (AO)', unread: false },
];

test('kiinnityssääntö poimii uusimman sopivan viestin, tunniste yksittäisen', () => {
  const m = (pinned) => wilmaModel(viestit(LISTA), ma(16), { pinned }).kiinnitetyt.map((v) => v.id);
  assert.deepEqual(m(undefined), []);
  // Sääntö: uusin "liikunta"-viesti, ei vanhempaa. Kirjainkoko ei vaikuta.
  assert.deepEqual(m([{ subject: 'liikunta' }]), [30]);
  assert.deepEqual(m(['LIIKUNTA']), [30]);
  assert.deepEqual(m([{ sender: 'aila' }]), [40]);
  assert.deepEqual(m([{ sender: 'aila', subject: 'vanhempain' }]), [10]);
  // Yksittäinen viesti tunnisteella pysyy, vaikka uudempia tulisi.
  assert.deepEqual(m([{ id: 20 }]), [20]);
  // Järjestys on sääntöjen järjestys, sama viesti vain kerran, tyhjä sääntö ohitetaan.
  assert.deepEqual(m([{ id: 10 }, { subject: 'liikunta' }, { sender: 'olli' }, {}, { subject: 'ei löydy' }]), [10, 30]);
  const v = wilmaModel(viestit(LISTA), ma(16), { pinned: ['retki'] }).kiinnitetyt[0];
  assert.equal(v.lukematon, true);
  assert.equal(v.paivays, 'tänään');
  assert.equal(v.paiva.getDate(), 5);
});

test('ilman messages-attribuuttia kiinnitys toimii otsikolla, mutta ilman tunnistetta', () => {
  const m = wilmaModel(sensorit(), ma(16), { pinned: ['liikunta'] });
  assert.equal(m.kiinnitetyt.length, 1);
  assert.equal(m.kiinnitetyt[0].otsikko, 'Liikunta vk 41');
  assert.equal(m.kiinnitetyt[0].id, null);
  assert.equal(m.kiinnitetyt[0].lukematon, true);
  // Ei tunnistetta eikä palvelua: pelkkä otsikko, ei painiketta.
  assert.ok(!piirra(m, 'Testi', { palvelu: true }).includes('data-toiminto'));
});

test('kiinnitetyn viestin tilat: painike, lataus, esikatselu, avattu, virhe', () => {
  const m = wilmaModel(viestit(LISTA), ma(16), { pinned: [{ id: 30 }] });
  const html = (ui) => piirra(m, 'Testi', { palvelu: true, auki: new Set(), viestit: new Map(), ...ui });
  assert.match(html({}), /<h2 class="disp">Viestit<\/h2><span class="sec">1 kiinnitetty</);
  assert.match(html({}), /data-toiminto="hae" data-id="30">Lue viesti</);
  // Integraatio ilman wilma.get_message-palvelua: ei painiketta.
  assert.ok(!html({ palvelu: false }).includes('data-toiminto'));
  assert.match(html({ viestit: new Map([[30, { tila: 'ladataan' }]]) }), /Haetaan viestiä/);
  const ok = new Map([[30, { tila: 'ok', sisalto: 'Rivi 1\n\nRivi 2\nRivi 3\nRivi 4', vastaukset: [{ sender: 'Huoltaja', timestamp: '2026-10-04 19:00', content: 'Kiitos' }] }]]);
  const kiinni = html({ viestit: ok });
  assert.match(kiinni, /class="viesti supistettu">Rivi 1\nRivi 2\nRivi 3\nRivi 4</);
  assert.match(kiinni, /aria-expanded="false">Näytä lisää</);
  assert.ok(!kiinni.includes('Kiitos'));
  const avattu = html({ viestit: ok, auki: new Set([30]) });
  // Avattuna kappalevälit säilyvät, esikatselussa ne on tiivistetty.
  assert.match(avattu, /class="viesti">Rivi 1\n\nRivi 2\nRivi 3\nRivi 4</);
  assert.match(avattu, /aria-expanded="true">Näytä vähemmän</);
  assert.match(avattu, /Huoltaja · 2026-10-04 19:00<\/span>Kiitos/);
  assert.match(html({ viestit: new Map([[30, { tila: 'virhe', virhe: 'aikakatkaisu' }]]) }), /haku epäonnistui: aikakatkaisu.*Yritä uudelleen/s);
  // Lukematon on merkitty.
  const uusi = piirra(wilmaModel(viestit(LISTA), ma(16), { pinned: ['retki'] }), 'Testi', { palvelu: true });
  assert.match(uusi, /Retkipäivä perjantaina<span class="hl uusi">lukematon<\/span>/);
});

test('viestin teksti escapataan ja vain http-osoitteet linkitetään', () => {
  assert.equal(linkitetty('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(
    linkitetty('Katso https://example.com/a?b=1&c=2. Kiitos'),
    'Katso <a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">https://example.com/a?b=1&amp;c=2</a>. Kiitos',
  );
  assert.ok(!linkitetty('javascript:alert(1) ja "https://x.fi/"').includes('href="javascript'));
  assert.match(linkitetty('(https://example.com/ohje)'), /href="https:\/\/example\.com\/ohje"[^>]*>https:\/\/example\.com\/ohje<\/a>\)/);
  const m = wilmaModel(viestit(LISTA), ma(16), { pinned: [{ id: 30 }] });
  const paha = new Map([[30, { tila: 'ok', sisalto: '<script>alert(1)</script>', vastaukset: [] }]]);
  assert.ok(!piirra(m, 'Testi', { palvelu: true, viestit: paha }).includes('<script>'));
});

test('kortista kiinnitetyt viestit tulevat integraation pinned-attribuutista', () => {
  const tila = (pinned) => sensorit({ uudet_viestit: { state: '1', attributes: { messages: LISTA, pinned } } });
  // Listalta pudonnut kiinnitys näkyy tallennetuilla tiedoilla, listassa oleva tietää lukutilan.
  const vanha = { id: 5, subject: 'Syksyn retki', sender: 'Aila Opettaja (AO)', timestamp: '2026-08-20 10:00' };
  const m = wilmaModel(tila([vanha, { id: 40 }]), ma(16), { pinned: ['liikunta', { id: 40 }] });
  assert.deepEqual(m.kiinnitetyt.map((v) => [v.id, !!v.irrotettava]), [[5, true], [40, true], [30, false]]);
  assert.equal(m.kiinnitetyt[0].otsikko, 'Syksyn retki');
  assert.equal(m.kiinnitetyt[0].paivays, 'to 20.8.');
  assert.equal(m.kiinnitetyt[1].lukematon, true);
  // Muut viestit: kaikki paitsi kiinnitetyt, uusin ensin.
  assert.deepEqual(m.muutViestit.map((v) => v.id), [20, 10]);
});

test('viestilista ja kiinnityspainikkeet', () => {
  const tila = sensorit({ uudet_viestit: { state: '0', attributes: { messages: LISTA, pinned: [{ id: 10 }] } } });
  const m = wilmaModel(tila, ma(16), { pinned: ['liikunta'] });
  const html = (ui) => piirra(m, 'Testi', { palvelu: true, kiinnitys: true, auki: new Set(), viestit: new Map(), ...ui });
  const kiinni = html({});
  assert.match(kiinni, /<span class="sec">2 kiinnitettyä</);
  // Kortista kiinnitetyn voi irrottaa, asetuksen säännöllä kiinnitettyä ei.
  assert.match(kiinni, /data-toiminto="irrota" data-id="10">Poista kiinnitys</);
  assert.ok(!kiinni.includes('data-toiminto="irrota" data-id="30"'));
  assert.ok(!kiinni.includes('data-toiminto="kiinnita" data-id="30"'));
  // Muut viestit ovat piilossa, kunnes lista avataan.
  assert.match(kiinni, /data-toiminto="lista" aria-expanded="false">Näytä muut viestit</);
  assert.ok(!kiinni.includes('Retkipäivä perjantaina'));
  const auki = html({ lista: true });
  assert.match(auki, /aria-expanded="true">Piilota muut viestit</);
  assert.match(auki, /Retkipäivä perjantaina.*data-toiminto="hae" data-id="40">Lue viesti<.*data-toiminto="kiinnita" data-id="40">Kiinnitä</s);
  assert.match(auki, /data-toiminto="kiinnita" data-id="20">Kiinnitä</);
  assert.match(html({ viestivirhe: 'Kiinnitys epäonnistui: x' }), /class="virhe sec">Kiinnitys epäonnistui: x</);
  // Integraatio ilman kiinnitystoimintoja: ei listaa eikä kiinnityspainikkeita.
  const ilman = html({ kiinnitys: false, lista: true });
  assert.ok(!ilman.includes('data-toiminto="lista"') && !ilman.includes('Kiinnitä<') && !ilman.includes('Poista kiinnitys'));
  // Ei kiinnitettyjä: osio näkyy silti, jotta ensimmäisen viestin voi kiinnittää.
  const tyhja = piirra(wilmaModel(viestit(LISTA), ma(16)), 'Testi', { palvelu: true, kiinnitys: true });
  assert.match(tyhja, /<h2 class="disp">Viestit<\/h2><span class="sec"><\/span>/);
  assert.match(tyhja, />Näytä viestit</);
  assert.ok(!piirra(wilmaModel(viestit(LISTA), ma(16)), 'Testi', { palvelu: true }).includes('>Viestit<'));
});

test('laajennuspainike näkyy vain, kun esikatselu ei näytä kaikkea', () => {
  const m = wilmaModel(viestit(LISTA), ma(16), { pinned: [{ id: 30 }] });
  const html = (sisalto, vastaukset = []) => piirra(m, 'Testi', { palvelu: true, viestit: new Map([[30, { tila: 'ok', sisalto, vastaukset }]]) });
  assert.ok(!html('Lyhyt viesti.\n\nKolme riviä\nriittää.').includes('data-toiminto="vaihda"'));
  assert.ok(html('1\n2\n3\n4').includes('data-toiminto="vaihda"'));
  assert.ok(html('Yksi pitkä kappale ilman rivinvaihtoja. '.repeat(4)).includes('data-toiminto="vaihda"'));
  assert.ok(html('Lyhyt', [{ sender: 'Huoltaja', timestamp: '', content: 'Ok' }]).includes('data-toiminto="vaihda"'));
});

test('Viestit on kortin viimeinen osio', () => {
  const html = piirra(wilmaModel(viestit(LISTA), ma(16), { pinned: [{ id: 30 }] }), 'Testi', { palvelu: true, kiinnitys: true });
  const otsikot = [...html.matchAll(/<h2 class="disp">([^<]*)</g)].map((x) => x[1]);
  assert.equal(otsikot.at(-1), 'Viestit');
  assert.ok(otsikot.indexOf('Kehut') < otsikot.indexOf('Viestit'));
});

test('kehut eriteltyinä: päivä vasemmalla, opettaja näkyvissä', () => {
  const tila = sensorit({ kehut: { state: '2', attributes: {
    item_1: '2026-10-01 · Positiivinen asenne · YM09 · Hauska tunti',
    notes: [
      { date: '2026-10-01', kind: 'Positiivinen asenne', subject: 'YM09', teacher: 'Olli Esimerkki', text: 'Hauska tunti' },
      { date: '2026-09-28', kind: 'Tuntityöskentely aktiivista', subject: 'XX09', teacher: '', text: '' },
    ],
  } } });
  const m = wilmaModel(tila, ma(16));
  assert.deepEqual(m.kehut.rivit.map((k) => [k.otsikko, k.teksti, k.aine, k.opettaja, k.paiva.getDate()]), [
    ['Positiivinen asenne', 'Hauska tunti', 'Ympäristöoppi', 'Olli Esimerkki', 1],
    ['Tuntityöskentely aktiivista', '', 'XX09', '', 28],
  ]);
  // Viikko alkaa ma 5.10., joten kumpikaan ei ole tältä viikolta.
  assert.equal(m.kehut.viikolla, 0);
  const html = piirra(m, 'Testi');
  assert.match(html, /<div class="era"><small class="sec">to<\/small><b class="num">1\.10\.<\/b><\/div><div class="sis"><span class="nimi">Positiivinen asenne<\/span><span class="teksti">Hauska tunti<\/span><span class="meta sec">Ympäristöoppi · Olli Esimerkki</);
  // Ilman notes-attribuuttia päivätön kehu: sarake jää tyhjäksi, opettaja rivin lopusta.
  const vanha = piirra(wilmaModel(sensorit(), ma(16)), 'Testi');
  assert.match(vanha, /<div class="kisko"><div><\/div><div class="sis"><span class="nimi">Hyvä tunti<\/span><span class="meta sec">Liikunta · Ope Olli</);
});

test('moitteet: tuoreet Huomioissa, vanhemmat avattavassa listassa', () => {
  const moitteet = { state: '2', attributes: { notes: [
    { date: '2026-10-02', kind: 'Kotitehtävät tekemättä, XYZ', subject: 'ENA1', teacher: 'Ope Olli', text: 'Sanat' },
    { date: '2026-09-10', kind: 'Opiskeluvälineet puuttuvat', subject: 'MA', teacher: 'Liisa Malli', text: '' },
  ] } };
  const m = wilmaModel(sensorit({ moitteet }), ma(16), { strip_suffixes: ['XYZ'] });
  const tuoreet = m.huomiot.find((o) => o.otsikko === 'Huomautukset');
  assert.deepEqual(tuoreet.rivit.map((r) => [r.aine, r.teksti]), [['Englanti', 'Kotitehtävät tekemättä · Sanat']]);
  assert.deepEqual(m.aiemmatMoitteet.map((r) => [r.aine, r.teksti, r.pv]), [['Matematiikka', 'Opiskeluvälineet puuttuvat', '2026-09-10']]);

  const kiinni = piirra(m, 'Aino', {});
  assert.match(kiinni, /data-toiminto="moitteet" aria-expanded="false">Aiemmat huomautukset \(1\)</);
  assert.ok(!kiinni.includes('Opiskeluvälineet puuttuvat'));
  assert.ok(kiinni.indexOf('Aiemmat huomautukset') < kiinni.indexOf('Viestit</h2>') || !kiinni.includes('Viestit'));
  const auki = piirra(m, 'Aino', { moitteet: true });
  assert.ok(auki.includes('Piilota aiemmat huomautukset') && auki.includes('Opiskeluvälineet puuttuvat'));
  assert.ok(!auki.includes('Liisa Malli'));

  // Ilman notes-attribuuttia (alkuperäinen integraatio) toimitaan kuten ennen.
  const vanha = wilmaModel(sensorit({ moitteet: { state: '1', attributes: { item_1: 'x' } } }), ma(16), { strip_suffixes: ['XYZ'] });
  assert.deepEqual(vanha.aiemmatMoitteet, []);
  assert.equal(vanha.huomiot.find((o) => o.otsikko === 'Huomautukset').rivit[0].teksti, 'Kotitehtävät tekemättä · x');
  assert.ok(!piirra(vanha, 'Aino', {}).includes('data-toiminto="moitteet"'));
});

test('päivätty lukujärjestys: jakson vaihtuessa näkyy vain päivän oma tunti', () => {
  // Maanantain viikkopaikassa on kaksi tuntia: ENA1 lokakuun alussa, MU 19.10. alkaen.
  const perus = sensorit()('seuraava_tunti');
  const schedule = [
    { day: 1, start: '08:15', end: '09:15', subject: 'MA', teacher: 'OPE', room: '3B:A101', dates: ['2026-10-05', '2026-10-19'] },
    { day: 1, start: '09:30', end: '10:30', subject: 'ENA1', teacher: 'OPE', room: 'Kielistudio:B2', dates: ['2026-10-05'] },
    { day: 1, start: '09:30', end: '10:30', subject: 'MU', teacher: 'OPE', room: '3B:A101', dates: ['2026-10-19'] },
    { day: 2, start: '08:15', end: '09:15', subject: 'YM', teacher: 'OPE', room: '3B:A101', dates: [] },
  ];
  const lisa = { seuraava_tunti: { state: 'x', attributes: { ...perus.attributes, schedule } } };
  const su = (pv) => new Date(2026, 9, pv, 12);
  assert.deepEqual(wilmaModel(sensorit(lisa), su(4)).paiva.tunnit.map((t) => t.aine), ['Matematiikka', 'Englanti']);
  assert.deepEqual(wilmaModel(sensorit(lisa), su(18)).paiva.tunnit.map((t) => t.aine), ['Matematiikka', 'Musiikki']);
  // Päivätön tunti kulkee viikonpäivän mukaan; päivä ilman tunteja ei ole koulupäivä.
  const ma = wilmaModel(sensorit(lisa), new Date(2026, 9, 5, 16));
  assert.equal(ma.paiva.paivays, 'tiistai 6.10.');
  const ti = wilmaModel(sensorit(lisa), new Date(2026, 9, 6, 16));
  assert.equal(`${ti.paiva.otsikko} ${ti.paiva.paivays}`, 'Tiistai 13.10.');
  // Läksyn palautuspäivä on aineen seuraava tunti päivättynä: ENA1 28.9. -> 5.10., ei enää 12.10.
  const laksy = { kaikki_laksyt: { state: '1', attributes: { hw_1: '2026-10-05 · Englanti, A1 · Sanat' } }, aktiiviset_laksyt: { state: '0', attributes: {} } };
  assert.deepEqual(wilmaModel(sensorit({ ...lisa, ...laksy }), new Date(2026, 9, 5, 16)).laksyt.muut, []);
});
