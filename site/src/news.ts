export interface NewsItem { date: string; text: string; kind: 'milestone' | 'world' }

// World-event lines: pop culture (film / music / sports / viral), notable
// births/deaths, and Nobel Prizes only — nothing political or controversial.
// Dates verified via GitHub's API (milestones) and well-documented public
// record (world events). Every line lands the same gag: #727 is still open.
export const NEWS: NewsItem[] = [
  { date: '2014-03-29', kind: 'milestone', text: 'aws-cli #727 filed: "Install aws-cli using Homebrew." A simple, polite request for a seven-line README change.' },
  { date: '2014-08-01', kind: 'world', text: 'The ALS Ice Bucket Challenge soaks every timeline in America.' },
  { date: '2015-02-26', kind: 'world', text: "The world can't agree whether 'The Dress' is blue-and-black or white-and-gold — a standoff #727 knows well." },
  { date: '2015-12-18', kind: 'world', text: "'Star Wars: The Force Awakens' reopens a saga many thought finished. #727? Nowhere close to finished." },
  { date: '2016-03-01', kind: 'milestone', text: 'Homebrew splits into brew and homebrew-core — a whole new home is brewed.' },
  { date: '2016-10-13', kind: 'world', text: 'Bob Dylan wins the Nobel Prize in Literature, the first songwriter so honored.' },
  { date: '2017-08-04', kind: 'world', text: "'Despacito' becomes the most-viewed video in YouTube history. #727 is feeling jealous." },
  { date: '2018-05-15', kind: 'world', text: "The whole internet argues whether it hears 'Yanny' or 'Laurel.'" },
  { date: '2019-01-23', kind: 'milestone', text: 'The legacy-homebrew repository is retired, leaving #727 pointing to a memory.' },
  { date: '2019-04-26', kind: 'world', text: "'Avengers: Endgame' closes out a 22-film saga in a single weekend." },
  { date: '2020-02-09', kind: 'world', text: "'Parasite' becomes the first non-English-language film to win the Best Picture Oscar." },
  { date: '2020-03-20', kind: 'world', text: "'Animal Crossing: New Horizons' lets millions build an island paradise from scratch." },
  { date: '2020-04-26', kind: 'milestone', text: "BrewTestBot's first automated bottle-bump commits land in homebrew-core, kicking off the Homebrew project's automation era." },
  { date: '2021-03-23', kind: 'world', text: 'The container ship Ever Given wedges sideways across the Suez Canal, halting global trade for six days.' },
  { date: '2022-06-17', kind: 'world', text: "A 37-year-old Kate Bush track, revived by 'Stranger Things,' hits #1 in the UK. #727 hopes not to wait that long." },
  { date: '2023-07-21', kind: 'world', text: "'Barbie' and 'Oppenheimer' turn one Friday into a shared cultural event, 'Barbenheimer.'" },
  { date: '2024-10-08', kind: 'world', text: 'John Hopfield and Geoffrey Hinton win the Nobel Prize in Physics for founding neural-network machine learning.' },
  { date: '2025-04-04', kind: 'world', text: "'A Minecraft Movie' mines a record opening weekend as theaters erupt at 'Chicken jockey!'" },
  { date: '2026-07-15', kind: 'milestone', text: 'awscli@1 enters maintenance mode, leaving #727 pointing to two defunct codebases and yet no less valid, worthwhile, or desired.' },
];
