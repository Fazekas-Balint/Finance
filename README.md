# Pénziránytű

Személyes pénzügyi követő webalkalmazás: bevételek, kiadások, előrejelzés,
megtakarítási célok és költségkeretek – magyar nyelven, sötét/világos témával.

**Az adatok nem hagyják el a gépet.** Minden a böngésző `localStorage`-ában
tárolódik, nincs mögötte szerver és nincs regisztráció. 
A Beállítások oldalon bármikor letölthető egy teljes JSON
mentést, és vissza is tölthető.

## Indítás

```bash
npm install
npm run dev
```

Ezután nyisd meg: http://localhost:5180

Éles build készítése és megnyitása:

```bash
npm run build
npm run preview
```

## Technikai háttér

React 18 + TypeScript + Vite, Tailwind CSS 4, Recharts, lucide-react ikonok.
Nincs backend, nincs külső hálózati hívás.

