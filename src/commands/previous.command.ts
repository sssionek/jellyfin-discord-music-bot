import { TransformPipe } from '@discord-nestjs/common';

import { Command, DiscordCommand, UsePipes } from '@discord-nestjs/core';
import { CommandInteraction } from 'discord.js';
import { DiscordMessageService } from '../clients/discord/discord.message.service';
import { PlaybackService } from '../playback/playback.service';

@Command({
  name: 'previous',
  description: 'Go to the previous track',
})
@UsePipes(TransformPipe)
export class PreviousTrackCommand implements DiscordCommand {
  constructor(
    private readonly playbackService: PlaybackService,
    private readonly discordMessageService: DiscordMessageService,
  ) {}

  async handler(interaction: CommandInteraction): Promise<void> {
    if (!this.playbackService.previousTrack()) {
      await interaction.reply({
        embeds: [
          this.discordMessageService.buildErrorMessage({
            title: 'There is no previous track',
          }),
        ],
      });
    }

    await interaction.reply({
      embeds: [
        this.discordMessageService.buildMessage({
          title: 'Went to previous track',
        }),
      ],
    });
  }
}
