
import { ApplyOptions } from '@sapphire/decorators';
import { container, Listener } from '@sapphire/framework';

@ApplyOptions<Listener.Options>({ once: true, event: "ready" })
export class SyncOnReady extends Listener {
    public CHNANEL_USERNAME = 'Theo - t3․gg';

    public async run() {
        container.logger.info("Starting youtube sync")
    }
}