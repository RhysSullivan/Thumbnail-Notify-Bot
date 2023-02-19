import { ApplyOptions } from "@sapphire/decorators";
import { ChatInputCommand, Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { fetchVideoThumbnail } from "../lib/youtube";

@ApplyOptions<Command.Options>({
    name: "diff",
    runIn: ["GUILD_ANY"],
    requiredUserPermissions: ["ManageGuild"],
})
export class ConsentCommand extends Command {
    public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand(
            new SlashCommandBuilder()
                .setName(this.name).setDescription("Diff command")
                .setDMPermission(false)
        );
    }
    public override async chatInputRun(interaction: ChatInputCommandInteraction) {
        const img1 = await fetchVideoThumbnail("https://i.ytimg.com/vi/Xl02L1jy53c/hqdefault.jpg");
        const img2 = await fetchVideoThumbnail("https://i.ytimg.com/vi/Xl02L1jy53c/hqdefault.jpg");
        const hashed1 = img1.toString("base64");
        const hashed2 = img2.toString("base64");
        // check if hashed 1 and 2 are equal
        for (let i = 0; i < hashed1.length; i++) {
            if (hashed1[i] !== hashed2[i]) {
                console.log(hashed1[i], hashed2[i])
                break;
            }
        }
        const isEqual = hashed1 === hashed2;
        console.log(isEqual)
        await interaction.reply({
            ephemeral: true,
            content: `Image 1 does ${isEqual ? "" : "not"} equal image 2`,
        });
    }
}
