import Link from "next/link";
import { FeatureIcon } from "./_components/home/feature-icon";
import type { FeatureIconKind } from "./_components/home/feature-icon";
import { FloatingSilhouettes } from "./_components/home/floating-silhouettes";
import { MiniCard } from "./_components/home/mini-card";
import { Reveal } from "./_components/home/reveal";
import { getRecentScores, getTopPlayersToday } from "./data/activity";
import type { GameColor } from "./data/games";
import { getGames } from "./data/games";

const FEATURES: {
  icon: FeatureIconKind;
  title: string;
  desc: string;
  color: GameColor;
}[] = [
  {
    icon: "gamepad",
    title: "CLASSIC GAMES",
    desc: "Bricks, snakes, invaders and more. The best arcade formulas of all time, together in one vault.",
    color: "cyan",
  },
  {
    icon: "free",
    title: "100% FREE",
    desc: "No subscriptions, no hidden fees. Every game is available to play for free.",
    color: "yellow",
  },
  {
    icon: "trophy",
    title: "LADDER BOARDS",
    desc: "Compete with players from around the world. Climb the ranking and prove who is the best.",
    color: "magenta",
  },
  {
    icon: "rocket",
    title: "ALWAYS GROWING",
    desc: "We keep adding new games. Come back often, there is always something new to play.",
    color: "green",
  },
];

const PLAN_PERKS = [
  "Access to every game",
  "Global ranking and Hall of Fame",
  "No ads between matches",
  "Save your scores",
  "New games every month",
  "Works in any browser",
];

const FAQ = [
  {
    q: "IS IT REALLY FREE?",
    a: 'Yes. Arcade Vault is a non-profit project made out of love for the classics. There is no hidden "premium" version.',
  },
  {
    q: "DO I NEED AN ACCOUNT?",
    a: "No. You can play as a guest. If you want to save your score and appear in the ranking, sign up in 10 seconds.",
  },
  {
    q: "HOW DO YOU SURVIVE WITHOUT CHARGING?",
    a: "It is a community project. If you like it, share it. That is the only coin we accept.",
  },
];

function SectionHead({
  kicker,
  color,
  title,
}: {
  kicker: string;
  color: GameColor;
  title: string;
}) {
  return (
    <div className="section-head">
      <div className={`kicker pixel neon-${color}`}>{kicker}</div>
      <h2 className="section-title">{title}</h2>
      <div className="section-rule"></div>
    </div>
  );
}

export default async function Home() {
  const [games, recentScores, topPlayers] = await Promise.all([
    getGames(),
    getRecentScores(),
    getTopPlayersToday(),
  ]);
  const titleById = new Map(games.map((g) => [g.id, g.title]));

  const stats = [
    { n: String(games.length), u: "GAMES", s: "AND COUNTING" },
    { n: "THOUSANDS", u: "OF PLAYS", s: "EVERY DAY" },
    { n: "GLOBAL", u: "RANKING", s: "COMPETE WITH THE WORLD" },
  ];

  return (
    <div className="home fade-in">
      <Reveal />

      {/* HERO */}
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERT A COIN<span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">THE CLASSIC</span>
            <span className="line-2">ARCADE IS</span>
            <span className="line-3">BACK</span>
          </h1>
          <p className="home-sub">
            Play the best classics right in your browser.
            <br />
            No downloads. No cost. Just fun.
          </p>
          <div className="home-ctas">
            <Link href="/games" className="btn xl pulse">
              ▶ EXPLORE GAMES
            </Link>
            <Link href="/login?mode=create" className="btn xl magenta">
              ✦ CREATE ACCOUNT
            </Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>SCROLL</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="home-section reveal">
        <SectionHead kicker="// 01" color="magenta" title="WHY ARCADE VAULT?" />
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className={`feature-card ${f.color}`}>
              <FeatureIcon kind={f.icon} />
              <div className="ft-title pixel">{f.title}</div>
              <div className="ft-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* GAMES PREVIEW */}
      <section className="home-section reveal">
        <SectionHead kicker="// 02" color="cyan" title="GAMES AVAILABLE NOW" />
        <div className="mini-rail">
          {games.slice(0, 6).map((g) => (
            <MiniCard key={g.id} game={g} />
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/games" className="btn lg">
            SEE ALL GAMES →
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="home-stats reveal">
        <div className="stats-inner">
          {stats.map((st) => (
            <div key={st.u} className="stat-block">
              <div className="stat-n neon-yellow">{st.n}</div>
              <div className="stat-u pixel">{st.u}</div>
              <div className="stat-s">{st.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE ACTIVITY */}
      <section className="home-section reveal">
        <SectionHead kicker="// 03" color="yellow" title="LIVE ACTIVITY" />
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ LATEST SCORES</div>
            </div>
            <div className="ticker">
              {recentScores.map((r, i) => (
                <div
                  key={`${r.player}-${r.gameId}`}
                  className="tick-row"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className={`tk-p neon-${r.color}`}>{r.player}</span>
                  <span className="tk-mid">
                    ▸ {titleById.get(r.gameId) ?? r.gameId}
                  </span>
                  <span className="tk-s">
                    +{r.score.toLocaleString("en-US")}
                  </span>
                  <span className="tk-t">{r.ago}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">
                ▸ TOP PLAYERS · TODAY
              </div>
              <Link href="/hall-of-fame" className="lb-link">
                HALL OF FAME →
              </Link>
            </div>
            <div className="top-list">
              {topPlayers.map((p) => (
                <div
                  key={p.rank}
                  className={`top-row${p.rank <= 3 ? ` top${p.rank}` : ""}`}
                >
                  <span className="tp-rk">
                    #{String(p.rank).padStart(2, "0")}
                  </span>
                  <span className="tp-p">{p.player}</span>
                  <span className="tp-s">
                    {p.score.toLocaleString("en-US")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="home-section reveal">
        <SectionHead kicker="// 04" color="green" title="PRICING" />
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">SINGLE PLAN</div>
            <div className="pc-name pixel">VAULT PLAYER</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ FOREVER</span>
            </div>
            <div className="pc-tag">NO TRICKS · NO FINE PRINT</div>
            <ul className="pc-list">
              {PLAN_PERKS.map((perk) => (
                <li key={perk}>✔ {perk}</li>
              ))}
            </ul>
            <Link href="/login?mode=create" className="btn xl pulse w-full">
              START FREE →
            </Link>
            <div className="pc-foot">We do not ask for a card. We never will.</div>
            <div className="pc-stamp pixel">
              FREE
              <br />
              PLAY
            </div>
          </div>

          <div className="pricing-faq">
            {FAQ.map((item) => (
              <div key={item.q} className="faq-item">
                <div className="faq-q pixel">{item.q}</div>
                <div className="faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="home-final reveal">
        <h2 className="final-title pixel">READY TO PLAY?</h2>
        <Link href="/games" className="btn xl pulse final-cta">
          INSERT COIN →
        </Link>
        <div className="final-tag">
          Free. No sign-up required. Start in seconds.
        </div>
      </section>
    </div>
  );
}
