export function capitalize(str: string) {
  return str[0].toUpperCase() + str.substring(1);
}

export function calculateTime(words: number, wordsPerMinute: number) {
  const wordsPerSecond = wordsPerMinute / 60;
  const time = secondsToHumanReadable(words / wordsPerSecond);

  return time;
}

export function secondsToHumanReadable(sec: number) {
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec - hours * 3600) / 60);
  let seconds = sec - hours * 3600 - minutes * 60;

  seconds = hours > 0 || minutes > 10 ? 0 : Math.floor(seconds);

  return [
    hours ? `${hours} ${choose(hours, 'hr', 'hrs')}` : '',
    minutes ? `${minutes} ${choose(minutes, 'min', 'mins')}` : '',
    seconds ? `${seconds} ${choose(seconds, 'sec', 'secs')}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function choose(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function asText(strings: string[], glue: string = ' ') {
  return strings.filter(Boolean).join(glue);
}

export function formatLines(str: string, maxLen: number) {
  let targetString = '';

  while (str) {
    if (str.length <= maxLen) {
      targetString += '\n' + str;
      str = '';
    } else {
      const index = str.substr(0, maxLen).lastIndexOf(' ');
      targetString += '\n' + str.substr(0, Math.max(1, index));
      str = str.substr(Math.max(1, index));
    }
  }

  return targetString.trim();
}
