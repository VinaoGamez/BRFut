// Design probabilities, not measured population statistics.
export const NICKNAME_RATES = { derived: 0.015, curated: 0.001 };
export const CURATED_NICKNAMES = [
  'Kaká', 'Zico', 'Garrincha', 'Vampeta', 'Pelé', 'Didi', 'Vavá', 'Bebeto',
  'Mazinho', 'Careca', 'Dunga', 'Cafu', 'Zinho', 'Tostão', 'Rivellino', 'Jairzinho',
  'Dadá', 'Mazzola', 'Canhoteiro', 'Falcão', 'Alemão', 'Branco', 'Pintado', 'Müller',
  'Grafite', 'Hulk', 'Bujica', 'Tinga', 'Magrão', 'Ferrugem', 'Formiga', 'Tchê Tchê',
  'Gabigol', 'Gabiru', 'Amaral', 'Biro-Biro', 'Tupãzinho', 'Mirandinha', 'Dinei', 'Somália',
];

// Explicit, attested forms rather than arbitrary syllables producing nonsense.
const DERIVED = {
  Ronaldo: 'Ronaldinho', Paulo: 'Paulinho', Pedro: 'Pedrinho', Carlos: 'Carlinhos',
  José: 'Zezinho', João: 'Joãozinho', Luiz: 'Luizinho', Luís: 'Luisinho',
  Roberto: 'Robertinho', Ricardo: 'Ricardinho', Fernando: 'Fernandinho',
  Marcelo: 'Marcelinho', Fábio: 'Fabinho', Rafael: 'Rafinha', André: 'Andrezinho',
  Eduardo: 'Edu', Alexandre: 'Alex', Leonardo: 'Léo', Antônio: 'Toninho',
  Francisco: 'Chico', Marcos: 'Marquinhos', Wagner: 'Waguinho',
};

export function nicknameForName(first, random = Math.random) {
  const roll = random();
  if (roll < NICKNAME_RATES.curated) {
    return CURATED_NICKNAMES[Math.floor(random() * CURATED_NICKNAMES.length)];
  }
  if (roll < NICKNAME_RATES.curated + NICKNAME_RATES.derived) {
    return DERIVED[first] || '';
  }
  return '';
}
