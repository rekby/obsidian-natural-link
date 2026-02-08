declare module "snowball-stemmers" {
	interface SnowballStemmer {
		stem(word: string): string;
	}
	interface SnowballFactory {
		newStemmer(algorithm: string): SnowballStemmer;
		algorithms(): string[];
	}
	const factory: SnowballFactory;
	export default factory;
}
