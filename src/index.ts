import './lib/setup';
import { container, LogLevel, SapphireClient } from '@sapphire/framework';
import { PrismaClient } from '@prisma/client';

declare module "@sapphire/pieces" {
	interface Container {
		prisma: PrismaClient
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

const main = async () => {
	try {
		client.logger.info('Logging in');
		container.prisma = prisma;
		await client.login();
		client.logger.info('logged in');
	} catch (error) {
		client.logger.fatal(error);
		client.destroy();
		process.exit(1);
	}
};

main();
