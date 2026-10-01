// Aja: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { wilmaModel, piirra, aine, erotaAine, ratkaise, slug } from '../dist/wilma-card.js';

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
  assert.deepEqual(m.koeHalytykset.map((k) => `${k.milloin} ${k.aine}`), ['huomenna Ympäristöoppi']);
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
  assert.deepEqual(ilta.viikkorivi.map((d) => `${d.pv} ${d.pvm}`), ['ke 7.', 'ma 12.', 'ti 13.', 'ke 14.']);
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
  assert.deepEqual(m.kehut.rivit, [{ aine: 'Liikunta', teksti: 'Hyvä tunti', opettaja: 'Ope Olli', paivays: '' }]);
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
