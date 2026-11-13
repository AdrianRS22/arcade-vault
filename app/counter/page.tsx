import type { Metadata } from "next";
import { PokemonCounter } from "./pokemon-counter";

export const metadata: Metadata = {
  title: "Pokémon counter",
  description: "Click to count up and meet a new Pokémon with every number.",
};

export default function CounterPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-10 px-4 py-12">
      <h1 className="font-pixel text-center text-xl text-cyan sm:text-2xl">
        Pokémon counter
      </h1>
      <PokemonCounter />
    </main>
  );
}
