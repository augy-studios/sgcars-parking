# SG Park n' Charge

Real-time Singapore carpark availability and EV charging points at your fingertips!

---

## Features

- 🚗 **Carparks tab** — All HDB, LTA, and URA carparks sorted by distance from your GPS location
  - Filter by lot type (Cars / Motorcycles / Heavy Vehicles)
  - Filter by agency (HDB / LTA / URA)
  - Search by name or area
  - Auto-refresh every 1 minute
  - Colour-coded availability (green/amber/red)

- ⚡ **EV Charging tab** — EV chargers by postal code
  - Auto-detect postal code from GPS via Nominatim reverse geocode
  - Shows available stations only (hides status 100)
  - Expandable charger detail (plug type, speed, price, individual point status)
  - Auto-refresh every 5 minutes

- 🗺️ **Map** — Leaflet + OpenStreetMap with MarkerCluster
  - Different icons for carparks (🅿️) and EV chargers (⚡)
  - Tap marker → popup with Navigate button

- 🧭 **Navigation** — Google Maps, Waze, Apple Maps, or in-app map

- 🎨 **7 Themes** — Classic, Not green 1-5, Really really light green

- 📱 **PWA** — Installable, offline shell, service worker

---

## LTA API Coverage Notes

- **CarPark API** updates every 1 minute. Covers HDB, URA, and LTA carparks.
- **LTA carparks only** cover Orchard, Marina, HarbourFront, and Jurong Lake District.
- **EV API** updates every 5 minutes and requires a postal code.
