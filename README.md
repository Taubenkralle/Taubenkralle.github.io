# Langzeitgedächtnis

Diese README.md ist permanent und dient als mein Langzeitgedächtnis. Bitte nicht löschen.

Hier entsteht mein Wiki mit meinem Uni-Stoff. Zurzeit schreibe ich das Skript Statistik runter und lerne dabei HTML und CSS. Das ist meine erste Website und ich bin Anfänger.

- Wir schreiben Umlaute (ä, ö, ü) direkt, nicht als ae/oe/ue.

## Training Game (Matrix)
- Eigene Seite `training.html`, im Index-Menü immer über `white-rabbit.html`.
- Läuft im gleichen Layout wie die anderen Seiten.
- Mini Tower Defense mit 3 Towern, Wellen, Credits, Upgrades, Boss-Wellen.
- Savegame: Auto-Save in `localStorage` plus Export/Import als JSON.
- Shortcut `9` startet Training von jeder Seite; `Shift+S` Quick Save und `Shift+L` Quick Load.
- Beim Seitenwechsel lädt der Save, Spiel läuft nicht weiter im Hintergrund.
- Auto-Resume-Option für Training nach Seitenwechsel.
- Wave-Preview-Panel, Map-Wechsel (2 Karten) und neue Gegner/Status-Effekte (Burn/EMP/Regen).
- Training jetzt mit 3 Maps, Wave-Preview, Anleitung-Overlay und visuellen Status-Effekten.
- Tooltips für Tower/Gegner, Mini-Campaign mit Unlocks und Matrix-Style Anleitung.
- Upgrade-Tree pro Tower, neue SFX (UI/Typewriter/Hit) und Boss-Glitch-Effekt.
- Sound-Toggle im HUD, Campaign-Rewards und visuelle Tower-Skins pro Pfad.
- Highscore-Tracking, Wave-Summary-Overlay und Branch-Icons für Tower-Pfade.
- Count-up Summary, Top-5 Highscore-Liste und Audio-Mixer für SFX.
- Save-Slots (Autosave pro Slot), Daily-Run Seed und Boss-Swarm-Attacke.
- Slot-Preview, Daily-Top5 und Boss-Varianten mit Adds.
- Slot-Preview mit Datum/Credits, Daily-Streak und Boss-Shield-Aura.
- Slot-Preview mit Lives/Kills, Daily-Streak-Bonus und Shield-Warnung vorm Boss-Schild.
- Performance-Limits: Gegner-Cap `MAX_ENEMIES=120`, Shot-Cap `MAX_SHOTS=240`, Logik-Tick `LOGIC_DT=1/30s` in `training.js`.
