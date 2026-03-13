import path from "node:path";
import process from "node:process";

const cacheDir = path.resolve(".obsidian-cache");
const obsidianVersion = process.env.OBSIDIAN_TEST_VERSION ?? "latest";
const installerVersion = process.env.OBSIDIAN_INSTALLER_VERSION ?? "latest";

export const config = {
	runner: "local",
	framework: "mocha",
	specs: ["./obsidian-tests/demo/**/*.e2e.mjs"],
	maxInstances: 1,
	capabilities: [
		{
			browserName: "obsidian",
			browserVersion: obsidianVersion,
			"wdio:obsidianOptions": {
				installerVersion,
				plugins: ["."],
				vault: "./obsidian-tests/demo-vaults/en",
			},
		},
	],
	services: ["obsidian"],
	reporters: ["obsidian"],
	mochaOpts: {
		ui: "bdd",
		timeout: 180000,
	},
	waitforInterval: 250,
	waitforTimeout: 20000,
	logLevel: "warn",
	injectGlobals: false,
	cacheDir,
};
