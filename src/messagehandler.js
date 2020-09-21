const CONFIG = require("../config.json");
const Discord = require("discord.js");
const {
	checkJellyfinItemIDRegex
} = require("./util");
const {
	getAudioDispatcher
} = require("./dispachermanager");

const discordclientmanager = require("./discordclientmanager");
const jellyfinClientManager = require("./jellyfinclientmanager");
const playbackmanager = require("./playbackmanager");
const websocketHanler = require("./websockethandler");
const discordClient = discordclientmanager.getDiscordClient();

var isSummendByPlay = false;

// random Color of the Jellyfin Logo Gradient
function getRandomDiscordColor () {
	function randomNumber (b, a) {
		return Math.floor((Math.random() * Math.pow(Math.pow((b - a), 2), 1 / 2)) + (b > a ? a : b));
	}

	const GRANDIENT_START = "#AA5CC3";
	const GRANDIENT_END = "#00A4DC";

	let rS = GRANDIENT_START.slice(1, 3);
	let gS = GRANDIENT_START.slice(3, 5);
	let bS = GRANDIENT_START.slice(5, 7);
	rS = parseInt(rS, 16);
	gS = parseInt(gS, 16);
	bS = parseInt(bS, 16);

	let rE = GRANDIENT_END.slice(1, 3);
	let gE = GRANDIENT_END.slice(3, 5);
	let bE = GRANDIENT_END.slice(5, 7);
	rE = parseInt(rE, 16);
	gE = parseInt(gE, 16);
	bE = parseInt(bE, 16);

	return ("#" + ("00" + (randomNumber(rS, rE)).toString(16)).substr(-2) + ("00" + (randomNumber(gS, gE)).toString(16)).substr(-2) + ("00" + (randomNumber(bS, bE)).toString(16)).substr(-2));
}

async function searchForItemID (searchString) {
	const response = await jellyfinClientManager.getJellyfinClient().getSearchHints({
		searchTerm: searchString,
		includeItemTypes: "Audio"
	});

	if (response.TotalRecordCount < 1) {
		throw Error("Found no Song");
	} else {
		return response.SearchHints[0].ItemId;
	}
}

function summon (voiceChannel) {
	voiceChannel.join();
}

function summonMessage (message) {
	if (!message.member.voice.channel) {
		message.reply("please join a voice channel to summon me!");
	} else if (message.channel.type === "dm") {
		message.reply("no dms");
	} else {
		summon(message.member.voice.channel);
	}
}

async function playThis (message) {
	const indexOfItemID = message.content.indexOf(CONFIG["discord-prefix"] + "play") + (CONFIG["discord-prefix"] + "play").length + 1;
	const argument = message.content.slice(indexOfItemID);
	let itemID;
	// check if play command was used with itemID
	const regexresults = checkJellyfinItemIDRegex(argument);
	if (regexresults) {
		itemID = regexresults[0];
	} else {
		try {
			itemID = await searchForItemID(argument);
		} catch (e) {
			message.reply(e.message);
			playbackmanager.stop(discordClient.user.client.voice.connections.first());
			return;
		}
	}

	discordClient.user.client.voice.connections.forEach((element) => {
		playbackmanager.startPlaying(element, itemID, isSummendByPlay);
	});
}

function handleChannelMessage (message) {
	getRandomDiscordColor();

	if (message.content.startsWith(CONFIG["discord-prefix"] + "summon")) {
		isSummendByPlay = false;

		websocketHanler.openSocket();

		summonMessage(message);
	} else if (message.content.startsWith(CONFIG["discord-prefix"] + "disconnect")) {
		playbackmanager.stop();
		jellyfinClientManager.getJellyfinClient().closeWebSocket();
		discordClient.user.client.voice.connections.forEach((element) => {
			element.disconnect();
		});
	} else if ((message.content.startsWith(CONFIG["discord-prefix"] + "pause")) || (message.content.startsWith(CONFIG["discord-prefix"] + "resume"))) {
		if (getAudioDispatcher() !== undefined) {
			playbackmanager.playPause();
		} else {
			message.reply("there is nothing playing!");
		}
	} else if (message.content.startsWith(CONFIG["discord-prefix"] + "play")) {
		if (discordClient.user.client.voice.connections.size < 1) {
			summonMessage(message);
			isSummendByPlay = true;
		}

		playThis(message);
	} else if (message.content.startsWith(CONFIG["discord-prefix"] + "stop")) {
		if (isSummendByPlay) {
			if (discordClient.user.client.voice.connections.size > 0) {
				playbackmanager.stop(discordClient.user.client.voice.connections.first());
			}
		} else {
			playbackmanager.stop();
		}
	} else if (message.content.startsWith(CONFIG["discord-prefix"] + "help")) {
		const reply = new Discord.MessageEmbed()
			.setColor(getRandomDiscordColor())
			.addFields({
				name: `${CONFIG["discord-prefix"]}summon`,
				value: "Join the channel the author of the message"
			}, {
				name: `${CONFIG["discord-prefix"]}disconnect`,
				value: "Disconnect from all current Voice Channels"
			}, {
				name: `${CONFIG["discord-prefix"]}play`,
				value: "Play the following item"
			}, {
				name: `${CONFIG["discord-prefix"]}pause/resume`,
				value: "Pause/Resume audio"
			}, {
				name: `${CONFIG["discord-prefix"]}help`,
				value: "Display this help message"
			});
		message.channel.send(reply);
	}
}

module.exports = {
	handleChannelMessage
};
