// missionData.js — the eight jobs of Teo Reyes's week: staged objectives,
// GPS targets, timers, rewards and the dialogue that opens each stage.
// Characters: teo (Mateo Reyes), camila (Cami Vance, Taller Diablo),
// dante (Dante "El Reloj" Morales, fixer), salazar (Viktor "Viper"
// Salazar), cruz (Capt. Elena Cruz, BCPD radio).

export const CHARACTERS = {
  teo: { name: 'TEO REYES', color: '#ffb800' },
  camila: { name: 'CAMI VANCE', color: '#00f0ff' },
  dante: { name: 'DANTE "EL RELOJ"', color: '#c9a0ff' },
  salazar: { name: 'VIKTOR "VIPER" SALAZAR', color: '#ff3d7f' },
  cruz: { name: 'CAPT. CRUZ — BCPD', color: '#7db4ff' },
};

export const MISSIONS = [
  {
    title: 'HOTWIRE SUNRISE', preset: 'noon', cash: 4500, respect: 150,
    startAt: { x: 300, z: 330 },
    intro: [
      { who: 'camila', text: 'Teo? You look like a man the Caimanes framed. I run Taller Diablo — and I hate Salazar more than you do.' },
      { who: 'camila', text: 'Prove you can still drive. There is a Solara GT in the Hotel Coral car park. Bring her to my garage.' },
    ],
    stages: [
      { type: 'steal', x: 272, z: -140, carType: 'solara', carColor: '#e8b13a', label: 'Steal the Solara GT from the Hotel Coral car park',
        say: { who: 'teo', text: 'One car. One week. Let us see if the old hands remember.' } },
      { type: 'deliver', x: -300, z: 195, r: 11, label: 'Deliver the Solara to Taller Diablo — lose the heat on the way',
        say: { who: 'camila', text: 'That is her alarm — the BCPD will come sniffing. Shake them and get here.' } },
    ],
  },
  {
    title: 'BARRIO COLLECTION', preset: 'noon', cash: 7000, respect: 250,
    startAt: { x: -290, z: 195 },
    intro: [
      { who: 'dante', text: 'El Reloj never forgets a debt, Teo. Three shops in my Barrio pay Salazar for "protection". Collect what they owe me instead.' },
      { who: 'dante', text: 'Fast hands, soft voice. But the last shop keeps Caimanes muscle on the door — that conversation may turn loud.' },
    ],
    stages: [
      { type: 'collect', time: 150, inCar: false, label: 'Collect from 3 Barrio Viejo shops',
        points: [{ x: -455, z: 120 }, { x: -350, z: -160 }, { x: -480, z: -300 }],
        say: { who: 'dante', text: 'Two minutes thirty on my clock. It is always ticking, amigo.' } },
      { type: 'kill', x: -480, z: -300, count: 3, label: 'Drop the Caimanes thugs at the last shop',
        say: { who: 'teo', text: 'They chose the loud conversation.' } },
      { type: 'goto', x: -455, z: -40, r: 6, label: 'Report back to Dante',
        say: { who: 'dante', text: 'Come. Tell El Reloj how the Barrio received you.' } },
    ],
  },
  {
    title: 'HIGHWAY JACK', preset: 'golden', cash: 10500, respect: 350,
    startAt: { x: -290, z: 195 },
    intro: [
      { who: 'camila', text: 'A Caimanes hauler is circling Mirador with a hold full of Salazar\'s hardware. I want that truck, Teo.' },
      { who: 'camila', text: 'Run it down, beat it until it limps, then drive it to the Barrio warehouse. Gently. Mostly.' },
    ],
    stages: [
      { type: 'disable', label: 'Run down the Caimanes hauler and beat it to a stop',
        say: { who: 'teo', text: 'There she rolls. Time to knock on the door at speed.' } },
      { type: 'deliver', x: -320, z: -60, r: 12, vehicle: 'mission', label: 'Drive the hauler to the Barrio Viejo warehouse',
        say: { who: 'camila', text: 'She is yours. Warehouse in the Barrio — Dante is holding the door.' } },
    ],
  },
  {
    title: 'NEON DECOY', preset: 'night', cash: 13000, respect: 450,
    startAt: { x: 65, z: 65 },
    intro: [
      { who: 'dante', text: 'Tonight Cami moves something precious across Mirador. She needs every blue light in the district looking at YOU.' },
      { who: 'dante', text: 'Make noise, kiss five neon checkpoints, then vanish from their circle. Theatre, Teo. Dangerous theatre.' },
    ],
    stages: [
      { type: 'collect', time: 0, inCar: true, stars: 3, label: 'Draw the BCPD — pass 5 neon checkpoints',
        points: [{ x: 130, z: -130 }, { x: -130, z: -130 }, { x: -130, z: 130 }, { x: 130, z: 130 }, { x: 0, z: 260 }],
        say: { who: 'cruz', text: 'All units — the Solara from the hotel job is lighting up Mirador. Bring me that driver.' } },
      { type: 'escape', label: 'Break line of sight and lose the BCPD',
        say: { who: 'teo', text: 'Show is over. Now disappear.' } },
    ],
  },
  {
    title: 'DOCKSIDE CLEANUP', preset: 'golden', cash: 16500, respect: 600,
    startAt: { x: 60, z: 430 },
    intro: [
      { who: 'camila', text: 'Puerto Caimán is where Salazar\'s week gets loaded onto boats. His ammo crates are stacked in the container yard.' },
      { who: 'camila', text: 'Walk in on foot. Burn three crates, drop his dock guards, walk out. Send him a message written in fire.' },
    ],
    stages: [
      { type: 'goto', x: 165, z: 478, r: 7, onFoot: true, label: 'Enter the container yard on foot',
        say: { who: 'teo', text: 'Quiet shoes, loud ending.' } },
      { type: 'destroy', count: 3, label: 'Destroy ammo crates',
        say: { who: 'camila', text: 'Crates first — chain the explosions if you can. Poetry, Teo.' } },
      { type: 'kill', x: 190, z: 492, count: 8, label: 'Drop the dock guards',
        say: { who: 'salazar', text: 'Whoever is burning my port — name your price or dig your grave.' } },
      { type: 'goto', x: 60, z: 430, r: 8, label: 'Exit Puerto Caimán',
        say: { who: 'teo', text: 'Message delivered. Time to leave the smoke behind.' } },
    ],
  },
  {
    title: 'TURBO TUNED', preset: 'night', cash: 19000, respect: 750,
    startAt: { x: -290, z: 195 },
    intro: [
      { who: 'camila', text: 'Salazar\'s boys run a midnight lap — Paseo, the Faro, and over my bridge. Nobody beats their tuned toys in a stock car.' },
      { who: 'camila', text: 'So we tune yours first. Buy an upgrade off my lift, then take their money and their pride.' },
    ],
    stages: [
      { type: 'upgrade', label: 'Buy an engine tune or chassis armour at Taller Diablo',
        say: { who: 'camila', text: 'The lift is free and my tools are warm. Make her faster or make her tougher.' } },
      { type: 'checkpoints', racers: 3, label: 'Win the midnight lap — Paseo, Faro, Puente Bahía',
        points: [
          { x: 330, z: 130 }, { x: 330, z: -130 }, { x: 330, z: -390 }, { x: 330, z: -520 },
          { x: 330, z: -130 }, { x: 330, z: 130 }, { x: 330, z: 390 }, { x: 448, z: 520 },
          { x: 644, z: 603 }, { x: 836, z: 684 },
        ],
        say: { who: 'salazar', text: 'The framed mechanic thinks he can race my syndicate. Cute. Bury him.' } },
    ],
  },
  {
    title: 'BLACKOUT CONVOY', preset: 'golden', cash: 24000, respect: 900,
    startAt: { x: -290, z: 195 },
    intro: [
      { who: 'dante', text: 'Tonight the Viper moves his black book — codes, debts, names — in an armoured SUV over Puente Bahía, with escorts.' },
      { who: 'dante', text: 'Kill the escorts on the bridge, stop the lead car, and take the code bag. With that book, Salazar is a dead man walking.' },
    ],
    stages: [
      { type: 'convoy', label: 'Intercept the convoy on Puente Bahía — drop the escorts',
        say: { who: 'cruz', text: 'BCPD air is grounded tonight by fog on the bay. Whatever happens on that bridge, nobody official sees it.' } },
      { type: 'goto', dynamic: 'leadSuv', r: 9, label: 'Take the code bag from the lead SUV',
        say: { who: 'teo', text: 'The book is here. Salazar just lost his memory.' } },
    ],
  },
  {
    title: 'CROWN OF CORAL', preset: 'golden', cash: 50000, respect: 1500,
    startAt: { x: 300, z: 330 },
    intro: [
      { who: 'teo', text: 'The book says Salazar sails tonight from Pier 4 — money, names, everything, on one yacht.' },
      { who: 'camila', text: 'Every cop in Bahía Coral will be on you, Teo. Reach my speedboat at Pier 4 and end him before the bay does.' },
      { who: 'cruz', text: 'Mateo Reyes — this is Captain Cruz. Half my force wants you caged. Give me Salazar instead, and drive.' },
    ],
    stages: [
      { type: 'goto', x: 430, z: 545, r: 10, stars: 4, label: 'Reach Pier 4 through the manhunt',
        say: { who: 'cruz', text: 'All units, four stars — Reyes is running the Paseo. Roadblocks up, air unit live. Take him down.' } },
      { type: 'boat', label: 'Seize the speedboat at Pier 4',
        say: { who: 'teo', text: 'There she is. Old friend, one more race.' } },
      { type: 'sink', label: 'Destroy Salazar\'s yacht before it leaves the bay',
        say: { who: 'salazar', text: 'REYES. You should have stayed framed, little mechanic. My yacht eats boats like yours.' } },
    ],
  },
];
