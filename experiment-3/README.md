# Experiment 3 – Sales Analytics Dashboard (Chart.js)

**Aim:** Create an interactive dashboard using Chart.js that displays dataset statistics through Line and Bar charts.

## How to run
Open `index.html` in a browser. Chart.js loads from a CDN, so you need an internet connection.

## Sample dataset
| Month | Sales | Orders |
|---|---|---|
| Jan | 120 | 50 |
| Feb | 150 | 60 |
| Mar | 180 | 75 |
| Apr | 170 | 68 |
| May | 210 | 85 |
| Jun | 240 | 95 |

## Features → Procedure mapping
| Step | Where it is done |
|---|---|
| 1. HTML page with two `<canvas>` | `#lineChart`, `#barChart` in `index.html` |
| 2. Include Chart.js | `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1">` |
| 3. Sample dataset in JS | `SAMPLE` object in `script.js` |
| 4. Line chart for trends | `createLineChart()`: dual axis (Sales / Orders), gradient fill |
| 5. Bar chart to compare | `createBarChart()`: Grouped / Stacked / Horizontal layouts, best month highlighted |
| 6. Titles, legends, tooltips | `baseOptions()`: custom tooltips (bar tooltip shows sales per order) |
| 7. Responsiveness | `responsive: true`, `maintainAspectRatio: false`, CSS breakpoints, viewport badge |

## Extras
- KPI cards: total sales, total orders, growth %, best month, next-month forecast
- Descriptive statistics: count, total, mean, median, min, max, range, standard deviation, growth
- Smart insights: linear trend, Pearson correlation, biggest jump and dip, coefficient of variation
- Forecast from **linear regression**, drawn as a dashed point on the line chart
- Month range filter (From / To)
- Add and remove rows; the charts and statistics update right away (`chart.update()`)
- Live data simulation: a new month every 2 s, rolling 12-month window
- Download each chart as a PNG, and dark mode
