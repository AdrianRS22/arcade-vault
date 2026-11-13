"use client";

import Image from "next/image";
import { useState } from "react";

const TOTAL_POKEMON = 1025;
const ART_URL =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

export function PokemonCounter() {
  const [count, setCount] = useState(0);

  // Count 0 shows nothing yet; every click shows the next Pokémon (wraps after the last one).
  const pokemonId = count === 0 ? null : ((count - 1) % TOTAL_POKEMON) + 1;

  return (
    <div className="flex flex-col items-center gap-8">
      <div
        className="crt flex h-72 w-72 items-center justify-center border-2 border-cyan sm:h-96 sm:w-96"
        aria-live="polite"
      >
        {pokemonId === null ? (
          <p className="font-pixel max-w-[16ch] text-center text-xs leading-loose text-ink">
            Click the button to meet your first Pokémon.
          </p>
        ) : (
          <Image
            key={pokemonId}
            src={`${ART_URL}/${pokemonId}.png`}
            alt={`Pokémon number ${pokemonId}`}
            width={475}
            height={475}
            unoptimized
            priority
            className="h-full w-full object-contain p-4"
          />
        )}
      </div>

      <p
        className="font-pixel text-4xl text-yellow"
        aria-label={`Count ${count}`}
      >
        {count}
      </p>

      <div className="flex gap-4">
        <button
          type="button"
          className="btn"
          onClick={() => setCount((c) => c + 1)}
        >
          Add one
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setCount(0)}
          disabled={count === 0}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
