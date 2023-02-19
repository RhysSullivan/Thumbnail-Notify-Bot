
import { ApplyOptions } from '@sapphire/decorators';
import { container, Listener } from '@sapphire/framework';
import { syncYoutubeVideos } from '../lib/youtube';

@ApplyOptions<Listener.Options>({ once: true, event: "ready" })
export class SyncOnReady extends Listener {
    public CHNANEL_USERNAME = 'Theo - t3․gg';

    public async run() {
        await syncYoutubeVideos({
            client: this.container.client,
            youtube: container.youtube
        })
    }
}