import type { Video } from "@prisma/client";
import { container, type SapphireClient } from "@sapphire/framework";
import { ChannelType, EmbedBuilder } from "discord.js";
import type { youtube_v3 } from "googleapis";
import { GaxiosError, request } from 'gaxios';

export async function rateLimitedFetch<T>(request: () => Promise<T>, rateLimitMessage: string) {
    try {
        const result = await request();
        return result;
    } catch (error) {
        if (!(error instanceof GaxiosError && error.code == "403")) throw error;
        container.logger.error(rateLimitMessage)
        return undefined;
    }
}

export async function fetchAllChannelVideos({
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


export async function fetchVideoThumbnail(url: string) {
    const response = await request<string>({
        url,
        responseType: 'arraybuffer',
    })
    return Buffer.from(response.data, 'binary')
}

export async function hashThumbnail(thumbnail: Buffer) {
    return thumbnail.toString('base64')
}

export async function toPrismaVideos({ video, thumbnailHash }: {
    video: youtube_v3.Schema$Video
    thumbnailHash?: string | undefined
}): Promise<Video> {
    if (!thumbnailHash) {
        const thumbnail = await fetchVideoThumbnail(video.snippet?.thumbnails?.default?.url || "")
        thumbnailHash = await hashThumbnail(thumbnail)
    }
    return {
        channelId: video.snippet?.channelId || "",
        id: video.id || "",
        thumbnailHash: thumbnailHash,
        title: video.snippet?.title || "",
        updatedAt: new Date(),
        url: `https://www.youtube.com/watch?v=${video.id}`
    }
};

export async function syncYoutubeVideos({ client, youtube }: {
    client: SapphireClient,
    youtube: youtube_v3.Youtube
}) {

    const channelId = "UCbRP3c757lWg9M-U7TyEkXA";
    const allVideos = await fetchAllChannelVideos({
        youtube,
        channelId
    })
    if (!allVideos) return;

    const existingVideos = await container.prisma.video.findMany({
        where: {
            channelId: {
                equals: channelId
            }
        }
    })

    // 1. Diff existing videos 
    const videoLookup = new Map<string, Video>(
        existingVideos.map(video => [video.id, video])
    );
    const videosWithNewThumbnails = (await Promise.all(allVideos.map(async video => {
        if (!video.id) return; // TODO: Prboably should error
        const newVideoData = await toPrismaVideos({
            video
        });
        const oldVideoData = videoLookup.get(video.id);
        if (newVideoData != oldVideoData) {
            return video;
        }
        return;
    }))).filter(video => video) as youtube_v3.Schema$Video[]; // 🤮

    const updatedVideoData = await Promise.all(allVideos.map(async video => {
        return toPrismaVideos({
            video
        })
    }))

    await container.prisma.$transaction(
        updatedVideoData.map(video => {
            return container.prisma.video.upsert({
                where: {
                    id: video.id
                },
                create: video,
                update: video
            })
        })
    )


    // 3. Notify of new thumbnails
    const notificationChannel = await client.channels.fetch("1076656830324936744");
    if (!notificationChannel?.isTextBased() || notificationChannel.type == ChannelType.GuildStageVoice) {
        container.logger.error("Could not find valid notification channel")
        return
    }


    for (const video of videosWithNewThumbnails) {
        const viewCount = video.statistics?.viewCount;
        const name = video.snippet?.title;
        const thumbnail = video.snippet?.thumbnails?.high
        if (!thumbnail || !thumbnail.url) {
            container.logger.error("Video has no thumbnail: ", video)
            continue;
        }
        const embedDescription = `**View Count**: ${viewCount}\n\n**Changed At**: ${new Date().toLocaleString()}`
        const embed = new EmbedBuilder().setTitle(`${name
            } - New Thumbnail`).setImage(thumbnail.url).setDescription(embedDescription);

        await notificationChannel.send({
            embeds: [embed],
            content: "@everyone"
        });
    }
}