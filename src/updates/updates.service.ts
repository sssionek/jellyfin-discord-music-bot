import { InjectDiscordClient } from '@discord-nestjs/core';
import { ButtonBuilder } from '@discordjs/builders';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { formatRelative, parseISO } from 'date-fns';
import { ActionRowBuilder, ButtonStyle, Client } from 'discord.js';
import { DiscordMessageService } from '../clients/discord/discord.message.service';
import { GithubRelease } from '../models/github-release';
import { Constants } from '../utils/constants';

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly discordMessageService: DiscordMessageService,
  ) {}

  @Cron('0 0 */1 * * *')
  async handleCron() {
    const isDisabled = process.env.UPDATER_DISABLE_NOTIFICATIONS;

    if (isDisabled === 'true') {
      return;
    }

    this.logger.debug('Checking for available updates...');

    const latestGitHubRelease = await this.fetchLatestGithubRelease();
    const currentVersion = Constants.Metadata.Version.All();

    if (latestGitHubRelease.tag_name <= currentVersion) {
      return;
    }

    await this.contactOwnerAboutUpdate(currentVersion, latestGitHubRelease);
  }

  private async contactOwnerAboutUpdate(
    currentVersion: string,
    latestVersion: GithubRelease,
  ) {
    const guilds = this.client.guilds.cache;

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('See update')
        .setStyle(ButtonStyle.Link)
        .setURL(latestVersion.html_url),
      new ButtonBuilder()
        .setLabel('Report an issue')
        .setStyle(ButtonStyle.Link)
        .setURL(Constants.Links.ReportIssue),
      new ButtonBuilder()
        .setLabel('Turn this notification off')
        .setStyle(ButtonStyle.Link)
        .setURL(Constants.Links.Wiki.DisableNotifications),
    );

    const isoDate = parseISO(latestVersion.published_at);
    const relativeReadable = formatRelative(isoDate, new Date());

    guilds.forEach(async (guild, key) => {
      const owner = await guild.fetchOwner();

      await owner.send({
        content: 'Update notification',
        embeds: [
          this.discordMessageService.buildMessage({
            title: 'Update is available',
            description: `Hello @${owner.user.tag},\nI'd like to inform you, that there is a new update available.\nTo ensure best security and being able to use the latest features, please update to the newest version.\n\n**${latestVersion.name}** (published ${relativeReadable})\n`,
            mixin(embedBuilder) {
              return embedBuilder.addFields([
                {
                  name: 'Your version',
                  value: currentVersion,
                  inline: true,
                },
                {
                  name: 'Newest version',
                  value: latestVersion.tag_name,
                  inline: true,
                },
              ]);
            },
          }),
        ],
        components: [actionRow],
      });
    });
  }

  private async fetchLatestGithubRelease(): Promise<null | GithubRelease> {
    return axios({
      method: 'GET',
      url: Constants.Links.Api.GetLatestRelease,
    })
      .then((response) => {
        if (response.status !== 200) {
          return null;
        }

        return response.data as GithubRelease;
      })
      .catch((err) => {
        this.logger.error('Error while checking for updates', err);
        return null;
      });
  }
}