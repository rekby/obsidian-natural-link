/**
 * Splits text into lowercase word tokens.
 * Removes punctuation and extra whitespace.
 */
export function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(/[^a-zA-Zа-яёА-ЯЁ0-9]+/)
		.filter((token) => token.length > 0);
}
