export interface NewsItem { date: string; text: string; kind: 'milestone' | 'world' }

// World-event lines: pop culture (film / music / sports / viral), notable
// births/deaths, and Nobel Prizes only — nothing political or controversial.
// Dates verified via GitHub's API (milestones) and well-documented public
// record (world events). Every line lands the same gag: #727 is still open.
export const NEWS: NewsItem[] = [
  { date: '2014-03-29', kind: 'milestone', text: 'aws-cli #727 filed: "Install aws-cli using Homebrew." A simple, polite request.' },
  { date: '2014-08-01', kind: 'world', text: 'The ALS Ice Bucket Challenge soaks every timeline in America. #727, four months old, is only getting started.' },
  { date: '2015-12-18', kind: 'world', text: "'Star Wars: The Force Awakens' reopens a saga many thought finished. #727 never needed reopening — it never closed." },
  { date: '2016-03-01', kind: 'milestone', text: 'Homebrew splits into brew and homebrew-core — a whole new home is built. #727 does not move in.' },
  { date: '2016-10-13', kind: 'world', text: 'Bob Dylan wins the Nobel Prize in Literature, the first songwriter so honored. #727 remains unsung and unresolved.' },
  { date: '2017-08-04', kind: 'world', text: "'Despacito' becomes the most-viewed video in YouTube history. Billions of views later, #727 still has zero merges." },
  { date: '2019-01-23', kind: 'milestone', text: 'legacy-homebrew is archived. An entire repository retires before #727 does.' },
  { date: '2019-04-26', kind: 'world', text: "'Avengers: Endgame' closes out a 22-film saga in a single weekend. #727's story arc is still going." },
  { date: '2020-01-26', kind: 'world', text: 'The sports world pauses to mourn Kobe Bryant. #727 does not pause — it just remains open.' },
  { date: '2020-03-20', kind: 'world', text: "'Animal Crossing: New Horizons' lets millions build an island paradise from scratch. #727 stays stuck on the mainland." },
  { date: '2020-04-26', kind: 'milestone', text: "BrewTestBot's first automated bottle-bump commits land in homebrew-core, kicking off the automation era. #727 stays firmly manual." },
  { date: '2022-06-17', kind: 'world', text: "A 37-year-old Kate Bush track, revived by 'Stranger Things,' hits #1 in the UK. #727 needed no soundtrack to stay exactly where it was." },
  { date: '2023-07-21', kind: 'world', text: "'Barbie' and 'Oppenheimer' turn one Friday into a shared cultural event, 'Barbenheimer.' #727 shares the news cycle with no one; it's just still open." },
  { date: '2024-10-08', kind: 'world', text: 'John Hopfield and Geoffrey Hinton win the Nobel Prize in Physics for founding neural-network machine learning. The machines are learning; #727 is not closing.' },
  { date: '2026-07-15', kind: 'milestone', text: 'awscli@1 enters maintenance mode — even the original CLI is winding down. #727, filed against it, carries on.' },
];
