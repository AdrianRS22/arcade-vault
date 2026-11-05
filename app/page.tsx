import { LibraryBrowser } from "./_components/library-browser";
import { getGames } from "./data/games";

export default async function Home() {
  const games = await getGames();

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERT COIN TO PLAY <span className="blink">_</span>
        </div>
      </section>
      <LibraryBrowser games={games} />
    </div>
  );
}
