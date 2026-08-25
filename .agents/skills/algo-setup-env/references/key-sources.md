# Key sources

Consult only for names still in `.env.example`. New vars: comments in `.env.example`.
L = local · P = preview/prod.

## Matryca "skąd wziąć wartość"

Konsultuj ją **tylko dla zmiennych obecnych w aktualnym `.env.example`**; dla nowych zmiennych spoza matrycy źródłem są komentarze w `.env.example`. Wymagalność: `L` lokalnie · `P` preview/produkcja.

| Zmienne | Skąd | Wymagane |
|---|---|---|
| `BETTER_AUTH_SECRET`, `OMNIGENT_FORWARD_AUTH_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET`, `JOBS_TICK_SECRET` | generuj: `openssl rand -base64 32` (tick: `-hex 32`) | L: BETTER_AUTH tak, reszta nie · P: tak |
| `AUTH_GITHUB_ID/SECRET` | https://github.com/settings/developers → "New OAuth App" | L: opcjonalnie · P: tak |
| `AUTH_GOOGLE_ID/SECRET` | https://console.cloud.google.com → APIs & Services → Credentials | L: opcjonalnie · P: tak |
| `AUTH_DISCORD_ID/SECRET` | https://discord.com/developers/applications | L: opcjonalnie · P: tak |
| `BUNNY_STORAGE_*`, `BUNNY_S3_*` | https://dash.bunny.net → Storage → strefa → Access (S3); włącz CORS dla originów local/preview/prod | L: opcjonalnie (bez tego brak uploadów) · P: tak |
| `BUNNY_STREAM_*` | https://dash.bunny.net → Delivery → Stream → biblioteka → API | L: opcjonalnie · P: tak |
| `BREVO_API_KEY` | https://app.brevo.com → Account → SMTP & API → API Keys | L: nie · P: tak |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys | L: opcjonalnie · P: tak |
| `ALGOLIA_*`, `NEXT_PUBLIC_ALGOLIA_*` | https://www.algolia.com → projekt "devs" → API Keys | L: opcjonalnie (bez tego szukajka w `/baza` nie działa) · P: tak |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com → Developers → API Keys (lokalnie `sk_test_`) | L: opcjonalnie · P: tak |
| `STRIPE_WEBHOOK_SECRET` | lokalnie Stripe CLI: `stripe listen`; produkcyjnie z dashboardu webhooka | L: opcjonalnie · P: tak |
| `HYPERDX_*`, `NEXT_PUBLIC_HYPERDX_*` | https://observability.algoacademy.pl → Settings → API Keys | L: nie · P: tak |
| `GOOGLE_WORKSPACE_DWD_*` | Google Admin console → Security → API controls → Domain-wide delegation (JSON konta serwisowego inline, jedna linia) | L: nie · P: tak |
| `ALGOACADEMY_API_KEY` (docs MCP) | https://algoacademy.pl/app/my-profile/api-keys — `ask_json_secret ALGOACADEMY_API_KEY "$SETTINGS_FILE" env.ALGOACADEMY_API_KEY ...`, potem `write_json`; **nie** zapisuj do `.env` | L: opcjonalnie |
| legacy — `SENTRY_DSN`/`SENTRY_AUTH_TOKEN`: https://sentry.io (Settings → DSN; /settings/auth-tokens/); `AXIOM_TOKEN/DATASET`: https://axiom.co → Settings → API Tokens | tylko jeśli nadal występują w `.env.example` | — |

