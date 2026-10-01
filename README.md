# Parri Travel

AI trip planner: itinerary, budget, documents and to-dos in one place. Release 1 is a route-and-budget planner with **no booking of its own**.

The prototype lives in [`app/`](app/). It's a static web app with no build step, styled after iOS 27 (Liquid Glass: floating glass tab bar, large titles, inset lists, bottom sheets, light and dark themes).

## Running it

Open `app/index.html` in a browser, or serve the folder:

```sh
cd app && python3 -m http.server 8080
```

On an iPhone, open it in Safari and use "Share → Add to Home Screen". It then runs full screen like an app.

## What release 1 covers

| Section | What it does |
| --- | --- |
| **Trips** | Trip cards with dates, the estimate against the budget, and to-do progress. |
| **Itinerary** | Built from interests, pace, and constraints (less walking, travelling with kids). Each stop explains why it was picked; places excluded by constraints are listed. Nearby places go on the same day. |
| **Budget** | Three options (Economy / Balanced / Comfort) with a breakdown of every line ("how it was calculated") and a recommendation that fits the budget. |
| **Documents** | Passport, entry rules for the passport (visa / visa-free), insurance, tickets, accommodation. Statuses: not started → in progress → done. Warns when there isn't enough time for a visa. |
| **To-dos** | Deadlines are counted back from the departure date, across all trips: overdue / next two weeks / later. |
| **Wallet: Pay** | Trip spending against the plan, by category. Imports transactions from Pay (demo). |
| **Wallet: Key** | Payment methods available in the destination country, with a status for each. |
| **Parri assistant** | Answers questions about cost, how to make it cheaper, visas, payment, and booking, using the trip's data. |
| **Profile** | Interests and constraints, passport, departure city, price providers, Free/Plus subscription, and how Parri earns money. |

## Product principles built into the code

- **An estimate is not a booking.** Every amount has a status: `Оценка` (Parri's own estimate) or `Цена поставщика` (a connected provider's price, with the time it was checked). There is no "confirmed" status, because release 1 doesn't book anything.
- **Disclosed partner fees.** Places marked `Партнёр` can earn Parri a commission. Partner status is **not used** in ranking (see `buildItinerary` in `app/app.js`).
- **Revenue:** a Plus subscription (349 ₽/month or 2,990 ₽/year) plus a disclosed partner commission.

## Structure

```
app/
  index.html   page shell (phone frame on desktop)
  styles.css   iOS design tokens and components, light and dark themes
  data.js      destinations, cost estimates, entry rules, payment methods
  app.js       itinerary engine, cost calculation, screens, assistant
```

Data is stored only in the browser (`localStorage`). Prices, entry rules, and payment method statuses are demo data. Before launch they need to come from connected providers and from Pay/Key.

## Next steps toward a release

1. Connect price providers (flights, hotels) through an API and keep the price check time.
2. Replace the rule-based assistant with an LLM call over the trip's data, with the same rule: never present an estimate as a booking.
3. Integrate with Pay (transactions by trip tag) and Key (payment methods by country).
4. A native SwiftUI client once the scenarios are validated.
