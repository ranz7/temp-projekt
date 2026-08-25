---
name: algo-setup-env
description: Konfiguracja zmiennych środowiskowych projektu przez wygenerowany kreator bash (wizard), który użytkownik uruchamia samodzielnie — sekrety nigdy nie przechodzą przez czat. Użyj gdy konfigurujesz projekt po raz pierwszy, gdy brakuje .env lub pojedynczego klucza, gdy użytkownik prosi "skonfiguruj środowisko" / "setup env" / "uzupełnij .env", albo gdy chce sprawdzić i odświeżyć to, co ma już ustawione.
allowed-tools: Bash Read Write Edit
---

Mów po polsku. Piszesz kreator bash; użytkownik odpala go sam. Sekrety nie wchodzą do czatu: nigdy nie proś o wklejenie wartości, nigdy nie czytaj wartości z `.env` (same nazwy: `grep -oE '^[A-Z0-9_]+' .env`), nigdy nie uruchamiaj kreatora.

1. **Źródło** — `.env.example` w runtime. Sekcje `# ===` = stage'e. Komentarze = skąd wziąć / `openssl` / opcjonalne. Zakomentowane zmienne = opcjonalne. `INSTRUCTIONS` = minimum lokalne. URL-e: `references/key-sources.md` tylko dla nazw nadal w `.env.example`.
2. **Plan** — lista stage'ów, zmienne, wymagane vs opcjonalne. Pełny vs wybrane grupy. Pisz kreator dopiero po potwierdzeniu.
3. **Skrypt** — skopiuj `template.sh`, edytuj tylko poniżej `STAGES`. `ENV_FILE` = absolutna ścieżka `.env`. `TOTAL_STAGES` = liczba `stage`. Nie ruszaj biblioteki nad znacznikiem. Scratchpad, nie `scripts/` (chyba że user chce).
   - `open_url` przed pytaniem; `step` jak dla obcego.
   - `ask_secret` / `ask_json_secret` + `write_env` / `write_json`. Enter zachowuje obecną wartość.
   - `openssl rand` w skrypcie gdy komentarz tak każe; `confirm` jeśli klucz już jest.
   - Opcjonalne grupy: `confirm` na starcie. Lokalne defaulty z example: potwierdź i zapisz, bez przeglądarki.
   - Brak `.env` → pierwszy stage `cp .env.example .env` (`confirm`).
4. **Check** — `bash -n`, `chmod +x`, suchy przegląd (każda zmienna z planu ma zapis). Nie odpalaj.
5. **Oddaj** — `bash <ścieżka>`. Ctrl-C + rerun jest OK. Po `finish`: `bun run db:up && bun run db:migrate && bun run db:seed && bun dev`. Potem podsumuj z samych **nazw** w `.env`.
