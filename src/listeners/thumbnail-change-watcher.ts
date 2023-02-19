import { ApplyOptions } from '@sapphire/decorators';
import { container, Listener } from '@sapphire/framework';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageActionRowComponentBuilder } from 'discord.js';
import { GaxiosError, request } from 'gaxios';
import { google, youtube_v3 } from "googleapis"


async function rateLimitedFetch<T>(request: () => Promise<T>, rateLimitMessage: string) {
    try {
        const result = await request();
        return result;
    } catch (error) {
        if (!(error instanceof GaxiosError && error.code == "403")) throw error;
        container.logger.error(rateLimitMessage)
        return undefined;
    }
}

async function fetchAllChannelVideos({
    youtube,
    channelId
}: {
    youtube: youtube_v3.Youtube,
    channelId: string,
}) {
    const response = await rateLimitedFetch(
        () => youtube.channels.list({
            part: ['id'],
            id: [
                channelId
            ]
        }),
        "Rate limited while fetching channel"
    )

    const fetchedChannel = response?.data?.items?.at(0)

    if (!fetchedChannel) {
        container.logger.error(
            "Could not find channel with id: ",
            channelId
        )
        return
    }

    container.logger.info("Fetched channel: ", fetchedChannel.snippet?.title || fetchedChannel.id)

    let nextPageToken: string | undefined = undefined;
    let allVideos: youtube_v3.Schema$Video[] = [];
    do {
        const query = {
            channelId,
            part: ["id"],
            type: ['video'],
            maxResults: 50,
            pageToken: nextPageToken
        } as youtube_v3.Params$Resource$Search$List
        const response = await rateLimitedFetch(
            () => youtube.search.list(
                query
            ),
            "Rate limited while fetching videos"
        )

        const fetchedVideos = response?.data.items?.filter(item => item.id)
        if (!fetchedVideos) {
            container.logger.error("No videos found for channel: ", channelId)
            return
        }

        const videoIds = fetchedVideos.map(item => item.id?.videoId).filter(id => id) as string[];
        const vidQuery = {
            part: ["snippet"],
            id: videoIds
        } as youtube_v3.Params$Resource$Videos$List
        const videoResponse = await rateLimitedFetch(
            () => youtube.videos.list(vidQuery),
            "Rate limited while fetching video thumbnails"
        )
        const items = videoResponse?.data.items;
        if (items) {
            allVideos = allVideos.concat(items);
        }

        nextPageToken = response!.data.nextPageToken ?? undefined;
    } while (nextPageToken);
    return allVideos;
}

@ApplyOptions<Listener.Options>({ once: true, event: "ready" })
export class SyncOnReady extends Listener {
    public CHNANEL_USERNAME = 'Theo - t3․gg';

    public async run() {
        container.logger.info("Starting youtube sync")
        const youtube = google.youtube({
            version: 'v3',
            auth: process.env.GOOGLE_API_KEY
        });

        const channelId = "UCbRP3c757lWg9M-U7TyEkXA";
        // const allVideos = await fetchAllChannelVideos({
        //     youtube,
        //     channelId
        // })

        // if (!allVideos) return;

        //const thumbnails = allVideos.map(video => video.snippet?.thumbnails?.high?.url).filter(url => url) as string[];
        const firstThumbnail = "https://i.ytimg.com/vi/KJGn2vJwiyg/hqdefault.jpg";
        if (!firstThumbnail) {
            container.logger.error("No thumbnails found for channel: ", channelId)
            return
        }

        const thumbnailData = await request<Buffer>({
            url: firstThumbnail,
            responseType: 'arraybuffer'
        })

        container.logger.info("Thumbnail data: ", thumbnailData.data)

        const notificationChannel = await this.container.client.channels.fetch("1076656830324936744");
        if (!notificationChannel?.isTextBased() || notificationChannel.type == ChannelType.GuildStageVoice) {
            container.logger.error("Could not find valid notification channel")
            return
        }


        const viewCount = 1234;
        const embedDescription = `**View Count**: ${viewCount}\n\n**Changed At**: ${new Date().toLocaleString()}`
        const embed = new EmbedBuilder().setTitle("NOT TYPESAFE - New Thumbnail").setImage(firstThumbnail).setDescription(embedDescription);

        await notificationChannel.send({
            embeds: [embed],
        });
    }
}