const quotes = [
  "Believe you can and you're halfway there.",
  "The only way to do great work is to love what you do.",
  "Your time is limited, so don't waste it living someone else's life.",
  "The way to get started is to quit talking and begin doing.",
  "If you want to live a happy life, tie it to a goal, not to people or things.",
  "Don't watch the clock; do what it does. Keep going.",
  "The only person you are destined to become is the person you decide to be.",
  "Everything you’ve ever wanted is on the other side of fear.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "It does not matter how slowly you go as long as you do not stop."
];

let lastIndex = -1;

export const getRandomQuote = (): string => {
  let newIndex = Math.floor(Math.random() * quotes.length);
  while (newIndex === lastIndex && quotes.length > 1) {
    newIndex = Math.floor(Math.random() * quotes.length);
  }
  lastIndex = newIndex;
  return quotes[newIndex];
};
