import './lib/setup';
import { container, LogLevel, SapphireClient } from '@sapphire/framework';
import { PrismaClient } from '@prisma/client';
import { google, youtube_v3 } from 'googleapis';


declare module "@sapphire/pieces" {
	interface Container {
		prisma: PrismaClient
		youtube: youtube_v3.Youtube
	}
}



const client = new SapphireClient({
	defaultPrefix: '!',
	caseInsensitiveCommands: true,
	logger: {
		level: LogLevel.Debug
	},
	intents: [],
	loadMessageCommandListeners: true,
	hmr: {
		enabled: process.env.NODE_ENV === 'development'
	}
});

const prisma = new PrismaClient();

const youtube = google.youtube({
	version: 'v3',
	auth: process.env.GOOGLE_API_KEY
});

const main = async () => {
	try {
		client.logger.info('Logging in');
		container.prisma = prisma;
		container.youtube = youtube;
		await client.login();
		client.logger.info('logged in');
	} catch (error) {
		client.logger.fatal(error);
		client.destroy();
		process.exit(1);
	}
};

main();
