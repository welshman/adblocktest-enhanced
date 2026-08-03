# 🛡️ AdBlock Test Enhanced

A fully self-contained, privacy-first ad blocker and DNS filter test suite — no build step required. Open `index.html` directly in any browser.

> Based on [Turtlecute33/adblocktest](https://github.com/Turtlecute33/adblocktest) (fork of [d3ward/toolz](https://github.com/d3ward/toolz)). Licensed CC BY-NC-SA 4.0.

## ✨ What's improved

| Feature | Original | Enhanced |
|---|---|---|
| Build required | ✅ webpack/npm | ❌ Zero — open index.html |
| Dark / Light mode | ✅ | ✅ + auto system preference |
| Score history | ✅ (up to 10) | ✅ + mini trend chart |
| Shareable results URL | ❌ | ✅ encoded in URL hash |
| DNS leak detection | ❌ | ✅ WebRTC IP check |
| Fingerprint resistance check | ❌ | ✅ canvas fingerprint probe |
| Sponsor/ad banner | ✅ NymVPN banner | ❌ Removed |
| Export results | ✅ JSON download | ✅ JSON + copy-to-clipboard share link |
| Category breakdown bar | ❌ | ✅ per-category pass/fail bars |
| Accessibility | Partial | Full ARIA, keyboard nav, reduced-motion |
| Mobile layout | Partial | ✅ Fully responsive |
| No external fonts/CDN | Partial | ✅ 100% self-hosted |

## 🚀 Usage

```bash
git clone https://github.com/welshman/adblocktest-enhanced
cd adblocktest-enhanced
# Open index.html in your browser — that's it.
```

Or deploy the whole folder to any static host (Netlify, GitHub Pages, Cloudflare Pages).

### GitHub Pages

Push to `main`, then go to **Settings → Pages → Source: main / root**.

## 📁 Structure

```
index.html          # Main app — everything is inline/linked
css/
  style.css         # All styles (dark+light, responsive)
js/
  engine.js         # Core test engine
  checks.js         # Individual check modules
  history.js        # LocalStorage result history + chart
  share.js          # URL hash encode/decode for sharing
  extras.js         # DNS leak, WebRTC, canvas fingerprint checks
data/
  hosts.json        # Blocked host list (ads, trackers, analytics, social, OEM)
host-lists/
  d3host.txt        # Hosts file format
  d3host.adblock    # Adblock syntax format
LICENSE
README.md
```

## 🧪 What it tests

1. **Host blocking** — ~160 ad, tracker, analytics, social, and OEM domains
2. **Cosmetic filters** — static and dynamic ad-shaped DOM elements
3. **Script blocking** — fake `ads.js` and `pagead.js` load attempts
4. **WebRTC / DNS leak** — checks if your real IP leaks via WebRTC
5. **Canvas fingerprint resistance** — detects if canvas fingerprinting is blocked or randomised

## 📋 Host lists

Two formats to import into your blocker:

- `host-lists/d3host.txt` — hosts file (Pi-hole, AdGuard Home, etc.)
- `host-lists/d3host.adblock` — adblock syntax (uBlock Origin, AdGuard, etc.)

## 🤝 Contributing

Bug, broken domain, or new test idea? Open an issue or PR.

## License

CC BY-NC-SA 4.0 — same as upstream.
